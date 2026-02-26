from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from models import MessageResponse
from database import get_db
import asyncio
import importlib

router = APIRouter(prefix="/api/gateways/{gateway_id}/sessions/{session_key:path}/messages", tags=["messages"])


def _get_gateway_manager():
    mod = importlib.import_module("gateway_manager")
    return mod.gateway_manager


def _extract_text(content) -> str:
    """Extract plain text from message content (string or array of blocks)"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "toolCall":
                    parts.append(f"[Tool: {block.get('name', 'unknown')}]")
                elif block.get("type") == "toolResult":
                    # Skip tool results in display
                    pass
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts) if parts else ""
    return str(content) if content else ""


@router.get("", response_model=List[MessageResponse])
async def get_messages(
    gateway_id: str,
    session_key: str,
    limit: int = Query(50, ge=1, le=500),
    before: Optional[int] = None
):
    """Get messages for a session - fetches from gateway first, falls back to SQLite"""
    manager = _get_gateway_manager()
    conn = manager.get_connection(gateway_id)
    
    # Try fetching from gateway
    if conn and conn.connected:
        try:
            print(f"📜 Fetching history for {session_key} from {gateway_id}")
            result = await asyncio.wait_for(
                conn.request("chat.history", {
                    "sessionKey": session_key,
                    "limit": limit,
                }),
                timeout=10
            )
            print(f"📜 Got result: ok={result.get('ok') if result else None}, keys={list(result.keys()) if result else None}")
            payload = result.get("payload", result) if result else None
            if payload and isinstance(payload, dict):
                messages = []
                for m in payload.get("messages", []):
                    role = m.get("role", "")
                    # Skip tool results in the message list
                    if role == "toolResult":
                        continue
                    content = _extract_text(m.get("content", ""))
                    if not content.strip():
                        continue
                    ts = m.get("timestamp")
                    messages.append(MessageResponse(
                        role=role,
                        content=content,
                        timestamp=ts,
                        created_at=str(ts) if ts else None,
                    ))
                return messages
        except Exception as e:
            print(f"⚠️ Failed to fetch history from gateway {gateway_id}: {e}")
    
    # Fallback to SQLite
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM sessions WHERE gateway_id = ? AND session_key = ?",
            (gateway_id, session_key)
        )
        row = await cursor.fetchone()
        
        if not row:
            return []  # No local session, return empty instead of 404
        
        session_id = row["id"]
        
        if before:
            cursor = await db.execute(
                """SELECT * FROM messages 
                   WHERE session_id = ? AND id < ? 
                   ORDER BY id DESC LIMIT ?""",
                (session_id, before, limit)
            )
        else:
            cursor = await db.execute(
                """SELECT * FROM messages 
                   WHERE session_id = ? 
                   ORDER BY id DESC LIMIT ?""",
                (session_id, limit)
            )
        
        rows = await cursor.fetchall()
        return [
            MessageResponse(
                id=row["id"],
                session_id=row["session_id"],
                role=row["role"],
                content=row["content"],
                timestamp=row["timestamp"],
                created_at=row["created_at"]
            )
            for row in reversed(rows)
        ]
    finally:
        await db.close()
