from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from gateway_manager import gateway_manager
from database import get_db
import json
import uuid
import asyncio
import re
from typing import List, Dict, Optional

router = APIRouter()


async def ensure_session_exists(db, gateway_id: str, session_key: str):
    """Ensure session exists in database, create if not"""
    cursor = await db.execute(
        "SELECT id FROM sessions WHERE gateway_id = ? AND session_key = ?",
        (gateway_id, session_key)
    )
    row = await cursor.fetchone()
    
    if not row:
        # Create new session
        await db.execute(
            "INSERT INTO sessions (gateway_id, session_key) VALUES (?, ?)",
            (gateway_id, session_key)
        )
        await db.commit()
        
        cursor = await db.execute(
            "SELECT id FROM sessions WHERE gateway_id = ? AND session_key = ?",
            (gateway_id, session_key)
        )
        row = await cursor.fetchone()
    
    return row["id"]


async def save_message(db, session_id: int, role: str, content: str, timestamp: int = None):
    """Save a message to database"""
    await db.execute(
        "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        (session_id, role, content, timestamp)
    )
    await db.commit()
    
    # Update session activity
    await db.execute(
        "UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (session_id,)
    )
    await db.commit()


@router.websocket("/ws/chat/{gateway_id}")
async def websocket_chat(websocket: WebSocket, gateway_id: str):
    """WebSocket endpoint for chat"""
    # Route to federated handler if gateway_id is "federated"
    if gateway_id == "federated":
        return await websocket_federated_chat(websocket)
    
    await websocket.accept()
    
    # Get gateway connection
    conn = gateway_manager.get_connection(gateway_id)
    
    if not conn:
        await websocket.send_json({
            "type": "error",
            "error": "Gateway not found"
        })
        await websocket.close()
        return
    
    if not conn.connected:
        await websocket.send_json({
            "type": "error",
            "error": "Gateway not connected"
        })
        await websocket.close()
        return
    
    # Send initial status
    await websocket.send_json({
        "type": "connected",
        "agents": conn.agents,
        "models": conn.models,
        "defaultModel": conn.default_model
    })
    
    # Set up isolated event handler for this WebSocket connection
    chat_events = asyncio.Queue()

    async def handle_chat_event(payload):
        await chat_events.put(payload)

    conn.on_event("chat", handle_chat_event)

    # Set up reconnection notification for this WebSocket
    async def handle_reconnect():
        try:
            await websocket.send_json({
                "type": "reconnected",
                "agents": conn.agents,
                "models": conn.models,
                "defaultModel": conn.default_model
            })
        except Exception as e:
            print(f"Failed to send reconnection notification: {e}")

    conn.on_reconnect(handle_reconnect)
    
    # Background task to forward chat events to browser
    async def forward_chat_events():
        while True:
            try:
                payload = await chat_events.get()
                state = payload.get("state")
                
                if state == "delta":
                    # Extract text from content blocks
                    message = payload.get("message", {})
                    content = message.get("content", [])
                    text = ""
                    for block in content:
                        if block.get("type") == "text":
                            text += block.get("text", "")
                    
                    await websocket.send_json({
                        "type": "stream",
                        "state": "delta",
                        "text": text
                    })
                
                elif state == "final":
                    # Extract and strip thinking tags
                    message = payload.get("message", {})
                    content = message.get("content", [])
                    text = ""
                    for block in content:
                        if block.get("type") == "text":
                            text += block.get("text", "")
                    
                    # Strip thinking tags
                    text = conn.strip_thinking_tags(text)
                    
                    await websocket.send_json({
                        "type": "stream",
                        "state": "final",
                        "text": text
                    })
                
                elif state == "error":
                    error_msg = payload.get("error", "Unknown error")
                    await websocket.send_json({
                        "type": "stream",
                        "state": "error",
                        "error": error_msg
                    })
            
            except Exception as e:
                print(f"Error forwarding chat event: {e}")
                break
    
    forward_task = asyncio.create_task(forward_chat_events())
    
    try:
        while True:
            # Receive message from browser
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                # Respond to ping with pong
                await websocket.send_json({"type": "pong"})
                continue

            elif msg_type == "chat":
                session_key = data.get("sessionKey")
                message = data.get("message")
                
                if not session_key or not message:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Missing sessionKey or message"
                    })
                    continue
                
                # Ensure session exists and get ID
                db = await get_db()
                try:
                    session_id = await ensure_session_exists(db, gateway_id, session_key)
                    
                    # Save user message
                    user_content = json.dumps([{"type": "text", "text": message}])
                    await save_message(db, session_id, "user", user_content)
                finally:
                    await db.close()
                
                # Send chat request to gateway
                idempotency_key = str(uuid.uuid4())
                response = await conn.request("chat.send", {
                    "sessionKey": session_key,
                    "message": message,
                    "deliver": False,
                    "idempotencyKey": idempotency_key
                })
                
                if not response or not response.get("ok"):
                    error = response.get("error", "Unknown error") if response else "No response"
                    await websocket.send_json({
                        "type": "error",
                        "error": error
                    })
            
            elif msg_type == "abort":
                session_key = data.get("sessionKey")
                
                if not session_key:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Missing sessionKey"
                    })
                    continue
                
                # Send abort request to gateway
                await conn.request("chat.abort", {
                    "sessionKey": session_key
                })
            
            elif msg_type == "history":
                session_key = data.get("sessionKey")
                limit = data.get("limit", 50)
                
                if not session_key:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Missing sessionKey"
                    })
                    continue
                
                # Fetch from database
                db = await get_db()
                try:
                    cursor = await db.execute(
                        "SELECT id FROM sessions WHERE gateway_id = ? AND session_key = ?",
                        (gateway_id, session_key)
                    )
                    row = await cursor.fetchone()
                    
                    if row:
                        session_id = row["id"]
                        cursor = await db.execute(
                            """SELECT role, content, timestamp 
                               FROM messages 
                               WHERE session_id = ? 
                               ORDER BY id DESC 
                               LIMIT ?""",
                            (session_id, limit)
                        )
                        rows = await cursor.fetchall()
                        
                        messages = [
                            {
                                "role": row["role"],
                                "content": json.loads(row["content"]),
                                "timestamp": row["timestamp"]
                            }
                            for row in reversed(rows)
                        ]
                        
                        await websocket.send_json({
                            "type": "history",
                            "messages": messages
                        })
                    else:
                        await websocket.send_json({
                            "type": "history",
                            "messages": []
                        })
                finally:
                    await db.close()
    
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for gateway {gateway_id}")

    except Exception as e:
        print(f"WebSocket error: {e}")

    finally:
        forward_task.cancel()
        # Clean up event handlers for this specific connection
        conn.remove_event_handler("chat", handle_chat_event)
        # Clean up reconnect callback
        try:
            conn.reconnect_callbacks.remove(handle_reconnect)
        except (ValueError, AttributeError):
            pass


def parse_mentions(message: str) -> List[Dict[str, str]]:
    """Parse @mentions from message, format: @gateway:agent or @gateway"""
    mention_pattern = r'@([\w-]+)(?::([\w-]+))?'
    matches = re.findall(mention_pattern, message)

    mentions = []
    for gateway_id, agent_id in matches:
        mentions.append({
            "gateway_id": gateway_id,
            "agent_id": agent_id if agent_id else None
        })

    return mentions


@router.websocket("/ws/chat/federated")
async def websocket_federated_chat(websocket: WebSocket):
    """WebSocket endpoint for federated chat across multiple gateways"""
    await websocket.accept()

    # Send initial status
    await websocket.send_json({
        "type": "connected",
        "federated": True
    })

    # Event queues for each gateway
    gateway_queues: Dict[str, asyncio.Queue] = {}
    forward_tasks = []
    event_handlers = []
    reconnect_handlers = []

    try:
        while True:
            # Receive message from browser
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                # Respond to ping with pong
                await websocket.send_json({"type": "pong"})
                continue

            elif msg_type == "chat":
                message = data.get("message", "")
                targets = data.get("targets", [])  # List of {gateway_id, session_key}
                broadcast = data.get("broadcast", False)

                if not message:
                    await websocket.send_json({
                        "type": "error",
                        "error": "Missing message"
                    })
                    continue

                # Parse @mentions from message
                mentions = parse_mentions(message)

                # Determine which gateways to send to
                target_gateways = []

                if mentions:
                    # Send to mentioned gateways
                    for mention in mentions:
                        gw_id = mention["gateway_id"]
                        # Find matching target
                        for target in targets:
                            if target["gateway_id"] == gw_id:
                                target_gateways.append(target)
                                break
                elif broadcast:
                    # Send to all targets
                    target_gateways = targets
                else:
                    # No mentions and no broadcast - send to all targets (default behavior)
                    target_gateways = targets

                if not target_gateways:
                    await websocket.send_json({
                        "type": "error",
                        "error": "No valid targets"
                    })
                    continue

                # Send to each target gateway
                for target in target_gateways:
                    gw_id = target["gateway_id"]
                    session_key = target["session_key"]

                    conn = gateway_manager.get_connection(gw_id)

                    if not conn:
                        await websocket.send_json({
                            "type": "stream",
                            "source": {"gateway_id": gw_id, "agent_name": "system"},
                            "state": "error",
                            "error": f"Gateway {gw_id} not found"
                        })
                        continue

                    if not conn.connected:
                        await websocket.send_json({
                            "type": "stream",
                            "source": {"gateway_id": gw_id, "agent_name": "system"},
                            "state": "error",
                            "error": f"Gateway {gw_id} not connected"
                        })
                        continue

                    # Set up event queue for this gateway if not exists
                    if gw_id not in gateway_queues:
                        gateway_queues[gw_id] = asyncio.Queue()

                        # Create event handler for this gateway
                        async def make_handler(gateway_id: str):
                            queue = gateway_queues[gateway_id]

                            async def handler(payload):
                                await queue.put(payload)

                            return handler

                        handler = await make_handler(gw_id)
                        event_handlers.append((gw_id, handler))
                        conn.on_event("chat", handler)

                        # Set up reconnection notification
                        async def make_reconnect_handler(gateway_id: str):
                            async def reconnect_handler():
                                try:
                                    await websocket.send_json({
                                        "type": "reconnected",
                                        "gateway_id": gateway_id
                                    })
                                except Exception as e:
                                    print(f"Failed to send reconnection notification: {e}")

                            return reconnect_handler

                        reconnect_handler = await make_reconnect_handler(gw_id)
                        reconnect_handlers.append((gw_id, reconnect_handler))
                        conn.on_reconnect(reconnect_handler)

                        # Start forwarding task for this gateway
                        async def forward_gateway_events(gateway_id: str):
                            queue = gateway_queues[gateway_id]
                            conn = gateway_manager.get_connection(gateway_id)

                            while True:
                                try:
                                    payload = await queue.get()
                                    state = payload.get("state")

                                    # Extract agent name from payload
                                    message = payload.get("message", {})
                                    agent_name = message.get("agent", {}).get("name", "unknown")

                                    if state == "delta":
                                        content = message.get("content", [])
                                        text = ""
                                        for block in content:
                                            if block.get("type") == "text":
                                                text += block.get("text", "")

                                        await websocket.send_json({
                                            "type": "stream",
                                            "source": {
                                                "gateway_id": gateway_id,
                                                "agent_name": agent_name
                                            },
                                            "state": "delta",
                                            "text": text
                                        })

                                    elif state == "final":
                                        content = message.get("content", [])
                                        text = ""
                                        for block in content:
                                            if block.get("type") == "text":
                                                text += block.get("text", "")

                                        # Strip thinking tags
                                        text = conn.strip_thinking_tags(text)

                                        await websocket.send_json({
                                            "type": "stream",
                                            "source": {
                                                "gateway_id": gateway_id,
                                                "agent_name": agent_name
                                            },
                                            "state": "final",
                                            "text": text
                                        })

                                    elif state == "error":
                                        error_msg = payload.get("error", "Unknown error")
                                        await websocket.send_json({
                                            "type": "stream",
                                            "source": {
                                                "gateway_id": gateway_id,
                                                "agent_name": agent_name
                                            },
                                            "state": "error",
                                            "error": error_msg
                                        })

                                except Exception as e:
                                    print(f"Error forwarding federated chat event from {gateway_id}: {e}")
                                    break

                        task = asyncio.create_task(forward_gateway_events(gw_id))
                        forward_tasks.append(task)

                    # Ensure session exists and save message
                    db = await get_db()
                    try:
                        session_id = await ensure_session_exists(db, gw_id, session_key)

                        # Save user message
                        user_content = json.dumps([{"type": "text", "text": message}])
                        await save_message(db, session_id, "user", user_content)
                    finally:
                        await db.close()

                    # Send chat request to gateway
                    idempotency_key = str(uuid.uuid4())
                    response = await conn.request("chat.send", {
                        "sessionKey": session_key,
                        "message": message,
                        "deliver": False,
                        "idempotencyKey": idempotency_key
                    })

                    if not response or not response.get("ok"):
                        error = response.get("error", "Unknown error") if response else "No response"
                        await websocket.send_json({
                            "type": "stream",
                            "source": {"gateway_id": gw_id, "agent_name": "system"},
                            "state": "error",
                            "error": error
                        })

            elif msg_type == "abort":
                targets = data.get("targets", [])

                # Abort on all target gateways
                for target in targets:
                    gw_id = target["gateway_id"]
                    session_key = target["session_key"]

                    conn = gateway_manager.get_connection(gw_id)
                    if conn and conn.connected:
                        await conn.request("chat.abort", {
                            "sessionKey": session_key
                        })

    except WebSocketDisconnect:
        print("Federated WebSocket disconnected")

    except Exception as e:
        print(f"Federated WebSocket error: {e}")

    finally:
        # Cancel all forwarding tasks
        for task in forward_tasks:
            task.cancel()

        # Clean up event handlers
        for gw_id, handler in event_handlers:
            conn = gateway_manager.get_connection(gw_id)
            if conn:
                conn.remove_event_handler("chat", handler)

        # Clean up reconnect handlers
        for gw_id, handler in reconnect_handlers:
            conn = gateway_manager.get_connection(gw_id)
            if conn:
                try:
                    conn.reconnect_callbacks.remove(handler)
                except (ValueError, AttributeError):
                    pass
