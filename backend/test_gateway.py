#!/usr/bin/env python3
"""
Quick test script to verify gateway connection and chat functionality.
Usage: python test_gateway.py <gateway_url> <token>
"""
import asyncio
import sys
import json
from gateway_manager import GatewayConnection


async def test_gateway(url: str, token: str):
    """Test connecting to a gateway and sending a chat message"""
    print(f"🔌 Testing connection to {url}")
    
    conn = GatewayConnection("test-gateway", url, token)
    
    # Connect
    success = await conn.connect()
    if not success:
        print("❌ Connection failed")
        return False
    
    print(f"✅ Connected! Protocol version: {conn.default_model}")
    print(f"📋 Agents: {len(conn.agents)}")
    print(f"🤖 Models: {len(conn.models)}")
    
    # Set up chat event handler
    responses = []
    
    async def handle_chat(payload):
        state = payload.get("state")
        if state == "delta":
            message = payload.get("message", {})
            content = message.get("content", [])
            for block in content:
                if block.get("type") == "text":
                    text = block.get("text", "")
                    print(text, end="", flush=True)
        elif state == "final":
            print("\n✅ Response complete")
            message = payload.get("message", {})
            content = message.get("content", [])
            full_text = ""
            for block in content:
                if block.get("type") == "text":
                    full_text += block.get("text", "")
            responses.append(conn.strip_thinking_tags(full_text))
        elif state == "error":
            print(f"\n❌ Error: {payload.get('error')}")
    
    conn.on_event("chat", handle_chat)
    
    # Start listening
    listen_task = asyncio.create_task(conn.listen())
    
    # Send a test message
    print("\n💬 Sending test message...")
    response = await conn.request("chat.send", {
        "sessionKey": "test-session-123",
        "message": "Say 'Hello from OpenClaw backend test!'",
        "deliver": False,
        "idempotencyKey": "test-123"
    })
    
    if not response or not response.get("ok"):
        print(f"❌ Chat send failed: {response}")
        await conn.stop()
        listen_task.cancel()
        return False
    
    # Wait for response
    await asyncio.sleep(5)
    
    # Fetch history
    print("\n📜 Fetching history...")
    history = await conn.request("chat.history", {
        "sessionKey": "test-session-123",
        "limit": 10
    })
    
    if history and history.get("ok"):
        messages = history.get("payload", {}).get("messages", [])
        print(f"✅ Retrieved {len(messages)} messages from history")
    
    # Clean up
    await conn.stop()
    listen_task.cancel()
    
    print("\n✅ All tests passed!")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_gateway.py <gateway_url> <token>")
        print("Example: python test_gateway.py ws://localhost:18789 your-token-here")
        sys.exit(1)
    
    url = sys.argv[1]
    token = sys.argv[2]
    
    try:
        success = asyncio.run(test_gateway(url, token))
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Test interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
