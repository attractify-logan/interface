import asyncio
import websockets
import json
import ipaddress
import socket
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse


def get_local_subnet() -> Optional[str]:
    """Detect the local subnet by finding the primary network interface"""
    try:
        # Create a socket to determine the local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Connect to a public DNS server (doesn't actually send data)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()

        # Convert to network address with /24 subnet
        network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
        return str(network)
    except Exception as e:
        print(f"⚠️ Failed to detect local subnet: {e}")
        return None


async def probe_gateway(ip: str, port: int = 18789, timeout: float = 2.0) -> Optional[Dict[str, Any]]:
    """
    Probe a single IP address to check if it's an OpenClaw gateway.
    Returns metadata if successful, None if not a gateway or unreachable.
    """
    url = f"ws://{ip}:{port}"

    try:
        # Try to connect with timeout
        ws = await asyncio.wait_for(
            websockets.connect(url, origin=f"http://{ip}:{port}", open_timeout=timeout),
            timeout=timeout
        )

        try:
            # Wait for connect.challenge with timeout
            challenge_msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
            challenge = json.loads(challenge_msg)

            # Verify it's a valid OpenClaw gateway
            if challenge.get("type") == "event" and challenge.get("event") == "connect.challenge":
                # Send a minimal connect request to get metadata
                connect_req = {
                    "type": "req",
                    "id": "scan_probe",
                    "method": "connect",
                    "params": {
                        "auth": None,
                        "role": "operator",
                        "scopes": ["operator.read"],
                        "permissions": {},
                        "client": {
                            "id": "openclaw-scanner",
                            "version": "1.0.0",
                            "platform": "backend",
                            "mode": "scan",
                            "instanceId": "scanner"
                        },
                        "minProtocol": 3,
                        "maxProtocol": 3
                    }
                }

                # Strip None values
                connect_req["params"] = {k: v for k, v in connect_req["params"].items() if v is not None}

                await ws.send(json.dumps(connect_req))

                # Wait for response
                response_msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
                response = json.loads(response_msg)

                if response.get("ok"):
                    # Extract useful metadata
                    payload = response.get("payload", {})
                    snapshot = payload.get("snapshot", {})

                    metadata = {
                        "ip": ip,
                        "port": port,
                        "url": url,
                        "sessionDefaults": snapshot.get("sessionDefaults"),
                        "gatewayInfo": snapshot.get("gatewayInfo"),
                    }

                    await ws.close()
                    return metadata

            await ws.close()
            return None

        except (asyncio.TimeoutError, json.JSONDecodeError, KeyError):
            await ws.close()
            return None

    except (asyncio.TimeoutError, OSError, websockets.exceptions.WebSocketException):
        # Connection failed, timeout, or not a WebSocket server
        return None
    except Exception as e:
        print(f"⚠️ Unexpected error probing {ip}: {e}")
        return None


async def scan_network(subnet: Optional[str] = None, port: int = 18789, max_concurrent: int = 50) -> List[Dict[str, Any]]:
    """
    Scan the local network for OpenClaw gateways.

    Args:
        subnet: Network subnet in CIDR notation (e.g., "192.168.1.0/24"). Auto-detected if None.
        port: Port to scan (default: 18789)
        max_concurrent: Maximum number of concurrent connections

    Returns:
        List of discovered gateway metadata dictionaries
    """
    # Auto-detect subnet if not provided
    if subnet is None:
        subnet = get_local_subnet()
        if subnet is None:
            print("❌ Could not detect local subnet")
            return []

    print(f"🔍 Scanning network {subnet} on port {port}...")

    # Generate list of IPs to scan
    try:
        network = ipaddress.IPv4Network(subnet, strict=False)
        # Skip network and broadcast addresses
        ips = [str(ip) for ip in network.hosts()]
    except ValueError as e:
        print(f"❌ Invalid subnet: {e}")
        return []

    discovered = []
    semaphore = asyncio.Semaphore(max_concurrent)

    async def probe_with_semaphore(ip: str) -> Optional[Dict[str, Any]]:
        async with semaphore:
            return await probe_gateway(ip, port)

    # Scan all IPs concurrently (limited by semaphore)
    tasks = [probe_with_semaphore(ip) for ip in ips]
    results = await asyncio.gather(*tasks)

    # Filter out None results
    discovered = [r for r in results if r is not None]

    print(f"✅ Scan complete. Found {len(discovered)} gateway(s)")
    return discovered
