import asyncio
import websockets
import json
import uuid
import re
from typing import Dict, Optional, Any, Callable
from datetime import datetime


class GatewayConnection:
    """Manages a persistent WebSocket connection to an OpenClaw gateway"""
    
    def __init__(self, gateway_id: str, url: str, token: Optional[str] = None, password: Optional[str] = None):
        self.gateway_id = gateway_id
        self.url = url
        self.token = token
        self.password = password
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.connected = False
        self.reconnect_delay = 1
        self.max_reconnect_delay = 60
        self.running = False
        self.req_id_counter = 0
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.event_handlers: Dict[str, list] = {}
        self.agents = []
        self.models = []
        self.default_model = None
        self.reconnect_callbacks: list = []
        
    def strip_thinking_tags(self, text: str) -> str:
        """Strip thinking tags from assistant responses"""
        patterns = [
            r'<think>.*?</think>',
            r'<thinking>.*?</thinking>',
            r'<antthinking>.*?</antthinking>'
        ]
        for pattern in patterns:
            text = re.sub(pattern, '', text, flags=re.DOTALL)
        return text.strip()
    
    def next_req_id(self) -> str:
        """Generate next request ID"""
        self.req_id_counter += 1
        return f"r{self.req_id_counter}"
    
    async def connect(self):
        """Establish connection and perform handshake"""
        try:
            print(f"🔌 Connecting to gateway {self.gateway_id} at {self.url}")
            # Use the gateway's own host as origin so it passes origin checks
            from urllib.parse import urlparse
            parsed = urlparse(self.url)
            host = parsed.hostname or "localhost"
            port = parsed.port or 18789
            origin = f"http://{host}:{port}"
            self.ws = await asyncio.wait_for(
                websockets.connect(self.url, origin=origin, open_timeout=10),
                timeout=15
            )
            
            # Wait for connect.challenge
            challenge_msg = await self.ws.recv()
            challenge = json.loads(challenge_msg)
            
            if challenge.get("type") == "event" and challenge.get("event") == "connect.challenge":
                print(f"✅ Received challenge from {self.gateway_id}")
                
                # Build auth object exactly like frontend (gateway.ts:126-128)
                auth = {}
                if self.token:
                    auth["token"] = self.token
                if self.password:
                    auth["password"] = self.password

                # Send connect request matching frontend exactly (gateway.ts:133-156)
                connect_req = {
                    "type": "req",
                    "id": self.next_req_id(),
                    "method": "connect",
                    "params": {
                        "auth": auth if len(auth) > 0 else None,
                        "role": "operator",
                        "scopes": ["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"],
                        "permissions": {
                            "operator.admin": True,
                            "operator.approvals": True,
                            "operator.pairing": True,
                        },
                        "client": {
                            "id": "openclaw-control-ui",
                            "version": "2.0.0",
                            "platform": "web",
                            "mode": "webchat",
                            "instanceId": f"backend_{self.gateway_id}"
                        },
                        "minProtocol": 3,
                        "maxProtocol": 3
                    }
                }

                # Strip None values from params (matches frontend behavior)
                connect_req["params"] = {k: v for k, v in connect_req["params"].items() if v is not None}
                
                await self.ws.send(json.dumps(connect_req))
                
                # Wait for connect response
                connect_res = await self.ws.recv()
                response = json.loads(connect_res)
                
                if response.get("ok"):
                    self.connected = True
                    self.reconnect_delay = 1
                    print(f"✅ Connected to gateway {self.gateway_id}")
                    
                    # Extract default model from snapshot
                    snapshot = response.get("payload", {}).get("snapshot", {})
                    session_defaults = snapshot.get("sessionDefaults", {})
                    self.default_model = session_defaults.get("model")
                    
                    # Note: fetch_metadata is called from _start_connect after listen() starts
                    return True
                else:
                    print(f"❌ Connection failed for {self.gateway_id}: {response}")
                    return False
            else:
                print(f"❌ Unexpected message from {self.gateway_id}: {challenge}")
                return False
                
        except Exception as e:
            print(f"❌ Connection error for {self.gateway_id}: {e}")
            return False
    
    async def fetch_metadata(self):
        """Fetch agents and models from gateway"""
        try:
            # Fetch agents
            agents_res = await self.request("agents.list", {})
            if agents_res and agents_res.get("ok"):
                self.agents = agents_res.get("payload", {}).get("agents", [])
            
            # Fetch models
            models_res = await self.request("models.list", {})
            if models_res and models_res.get("ok"):
                self.models = models_res.get("payload", {}).get("models", [])
                
        except Exception as e:
            print(f"⚠️ Failed to fetch metadata for {self.gateway_id}: {e}")
    
    async def request(self, method: str, params: Dict[str, Any]) -> Optional[Dict]:
        """Send a request and wait for response"""
        if not self.ws or not self.connected:
            return None
        
        req_id = self.next_req_id()
        future = asyncio.Future()
        self.pending_requests[req_id] = future
        
        request = {
            "type": "req",
            "id": req_id,
            "method": method,
            "params": params
        }
        
        try:
            await self.ws.send(json.dumps(request))
            # Wait for response with timeout
            response = await asyncio.wait_for(future, timeout=30.0)
            return response
        except asyncio.TimeoutError:
            print(f"⚠️ Request {req_id} timed out")
            self.pending_requests.pop(req_id, None)
            return None
        except Exception as e:
            print(f"❌ Request error: {e}")
            self.pending_requests.pop(req_id, None)
            return None
    
    def on_event(self, event_type: str, handler: Callable):
        """Register event handler (supports multiple handlers per event)"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)

    def remove_event_handler(self, event_type: str, handler: Callable):
        """Remove a specific event handler"""
        if event_type in self.event_handlers:
            try:
                self.event_handlers[event_type].remove(handler)
            except ValueError:
                pass

    def on_reconnect(self, callback: Callable):
        """Register callback for reconnection events"""
        self.reconnect_callbacks.append(callback)
    
    async def listen(self):
        """Listen for messages from gateway"""
        while self.running and self.ws:
            try:
                message = await self.ws.recv()
                data = json.loads(message)
                
                msg_type = data.get("type")
                
                if msg_type == "res":
                    # Response to a request
                    req_id = data.get("id")
                    if req_id in self.pending_requests:
                        future = self.pending_requests.pop(req_id)
                        if not future.done():
                            future.set_result(data)
                
                elif msg_type == "event":
                    # Event from gateway - call all registered handlers
                    event = data.get("event")
                    if event in self.event_handlers:
                        for handler in self.event_handlers[event]:
                            try:
                                await handler(data.get("payload", {}))
                            except Exception as e:
                                print(f"⚠️ Event handler error for {event}: {e}")
                
            except websockets.exceptions.ConnectionClosed:
                print(f"⚠️ Connection closed for {self.gateway_id}")
                self.connected = False
                break
            except Exception as e:
                print(f"❌ Listen error for {self.gateway_id}: {e}")
                break
    
    async def reconnect_loop(self):
        """Auto-reconnect with exponential backoff"""
        while self.running:
            if not self.connected:
                print(f"🔄 Attempting to reconnect {self.gateway_id} in {self.reconnect_delay}s")
                await asyncio.sleep(self.reconnect_delay)

                if await self.connect():
                    # Start listening again, then fetch metadata
                    asyncio.create_task(self.listen())
                    await self.fetch_metadata()

                    # Notify all reconnect callbacks
                    for callback in self.reconnect_callbacks:
                        try:
                            await callback()
                        except Exception as e:
                            print(f"⚠️ Reconnect callback error: {e}")
                else:
                    # Increase backoff
                    self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
            else:
                await asyncio.sleep(5)
    
    async def start(self):
        """Start the connection (non-blocking — reconnect loop handles retries)"""
        self.running = True
        asyncio.create_task(self._start_connect())
    
    async def _start_connect(self):
        """Internal: attempt initial connect then start reconnect loop"""
        try:
            if await self.connect():
                # Start listener FIRST so metadata requests get responses
                asyncio.create_task(self.listen())
                # Now fetch metadata
                await self.fetch_metadata()
            asyncio.create_task(self.reconnect_loop())
        except Exception as e:
            print(f"❌ Initial connect error for {self.gateway_id}: {e}")
            asyncio.create_task(self.reconnect_loop())

    async def stop(self):
        """Stop the connection"""
        self.running = False
        self.connected = False
        
        if self.ws:
            await self.ws.close()
            self.ws = None


class GatewayManager:
    """Manages all gateway connections"""
    
    def __init__(self):
        self.connections: Dict[str, GatewayConnection] = {}
    
    async def add_gateway(self, gateway_id: str, url: str, token: Optional[str] = None, password: Optional[str] = None):
        """Add and connect to a gateway"""
        if gateway_id in self.connections:
            await self.remove_gateway(gateway_id)
        
        conn = GatewayConnection(gateway_id, url, token, password)
        self.connections[gateway_id] = conn
        await conn.start()
    
    async def remove_gateway(self, gateway_id: str):
        """Remove a gateway connection"""
        if gateway_id in self.connections:
            conn = self.connections.pop(gateway_id)
            await conn.stop()
    
    def get_connection(self, gateway_id: str) -> Optional[GatewayConnection]:
        """Get a gateway connection"""
        return self.connections.get(gateway_id)
    
    async def stop_all(self):
        """Stop all connections"""
        for conn in self.connections.values():
            await conn.stop()
        self.connections.clear()


# Global gateway manager instance
gateway_manager = GatewayManager()
