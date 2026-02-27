from fastapi import APIRouter, HTTPException
from typing import List
from models import SessionCreate, SessionResponse
from database import get_db
import importlib

router = APIRouter(prefix="/api/gateways/{gateway_id}/sessions", tags=["sessions"])


def _get_gateway_manager():
    """Lazy import to avoid circular deps"""
    mod = importlib.import_module("gateway_manager")
    return mod.gateway_manager


@router.get("", response_model=List[SessionResponse])
async def list_sessions(gateway_id: str):
    """List sessions by querying the gateway directly, merged with local data"""
    manager = _get_gateway_manager()
    conn = manager.get_connection(gateway_id)
    
    gateway_sessions = []
    if conn and conn.connected:
        try:
            import asyncio
            result = await asyncio.wait_for(
                conn.request("sessions.list", {}),
                timeout=5
            )
            payload = result.get("payload", result) if result else None
            if payload and isinstance(payload, dict):
                for s in payload.get("sessions", []):
                    gateway_sessions.append(
                        SessionResponse(
                            id=0,
                            gateway_id=gateway_id,
                            session_key=s.get("key", s.get("sessionKey", "")),
                            title=s.get("title"),
                            agent_id=s.get("agentId"),
                            model=s.get("model"),
                            created_at=s.get("createdAt", ""),
                            last_activity=s.get("lastActivity", s.get("createdAt", ""))
                        )
                    )
        except Exception as e:
            print(f"⚠️ Failed to fetch sessions from gateway {gateway_id}: {e}")
    
    # If we got sessions from the gateway, return those (they're authoritative)
    if gateway_sessions:
        return gateway_sessions
    
    # Fallback to local SQLite sessions
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT id, gateway_id, session_key, title, agent_id, model, 
                      created_at, last_activity 
               FROM sessions 
               WHERE gateway_id = ? 
               ORDER BY last_activity DESC""",
            (gateway_id,)
        )
        rows = await cursor.fetchall()
        
        return [
            SessionResponse(
                id=row["id"],
                gateway_id=row["gateway_id"],
                session_key=row["session_key"],
                title=row["title"],
                agent_id=row["agent_id"],
                model=row["model"],
                created_at=row["created_at"],
                last_activity=row["last_activity"]
            )
            for row in rows
        ]
    finally:
        await db.close()


@router.post("", response_model=SessionResponse)
async def create_session(gateway_id: str, session: SessionCreate):
    """Create a new session"""
    db = await get_db()
    try:
        cursor = await db.execute(
            """INSERT INTO sessions (gateway_id, session_key, title, agent_id, model) 
               VALUES (?, ?, ?, ?, ?)""",
            (gateway_id, session.session_key, session.title, session.agent_id, session.model)
        )
        await db.commit()
        
        session_id = cursor.lastrowid
        
        # Fetch the created session
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (session_id,)
        )
        row = await cursor.fetchone()
        
        return SessionResponse(
            id=row["id"],
            gateway_id=row["gateway_id"],
            session_key=row["session_key"],
            title=row["title"],
            agent_id=row["agent_id"],
            model=row["model"],
            created_at=row["created_at"],
            last_activity=row["last_activity"]
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await db.close()


@router.get("/{session_key}", response_model=SessionResponse)
async def get_session(gateway_id: str, session_key: str):
    """Get session info"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE gateway_id = ? AND session_key = ?",
            (gateway_id, session_key)
        )
        row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return SessionResponse(
            id=row["id"],
            gateway_id=row["gateway_id"],
            session_key=row["session_key"],
            title=row["title"],
            agent_id=row["agent_id"],
            model=row["model"],
            created_at=row["created_at"],
            last_activity=row["last_activity"]
        )
    finally:
        await db.close()


@router.delete("/{session_key}")
async def delete_session(gateway_id: str, session_key: str):
    """Delete a session and all its messages"""
    db = await get_db()
    try:
        # Get session ID
        cursor = await db.execute(
            "SELECT id FROM sessions WHERE gateway_id = ? AND session_key = ?",
            (gateway_id, session_key)
        )
        row = await cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_id = row["id"]
        
        # Delete messages
        await db.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        
        # Delete session
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        
        await db.commit()
        
        return {"ok": True}
    finally:
        await db.close()


@router.get("/{session_key}/context")
async def get_session_context(gateway_id: str, session_key: str):
    """Get session context usage by querying the gateway RPC"""
    gm = _get_gateway_manager()
    conn = gm.get_connection(gateway_id)
    if not conn or not conn.connected:
        raise HTTPException(status_code=404, detail="Gateway not connected")
    
    # Try RPC methods the gateway might support
    for method in ["session_status", "sessions.status", "status"]:
        result = await conn.request(method, {"sessionKey": session_key})
        if result and result.get("ok"):
            data = result.get("result", result)
            ctx = data.get("contextTokens") or data.get("context_tokens") or data.get("context", {}).get("used")
            mx = data.get("maxTokens") or data.get("max_tokens") or data.get("context", {}).get("max")
            pct = data.get("contextPercentage") or data.get("context_percentage")
            if ctx or mx or pct:
                if ctx and mx and not pct:
                    pct = round((ctx / mx) * 100, 1)
                return {"contextTokens": ctx, "maxTokens": mx, "percentage": pct}
    
    # Fallback: try list_sessions which includes token info
    result = await conn.request("list_sessions", {})
    if result and result.get("ok"):
        sessions = result.get("result", result)
        if isinstance(sessions, list):
            for s in sessions:
                if s.get("key") == session_key or s.get("sessionKey") == session_key:
                    ctx = s.get("contextTokens") or s.get("context_tokens") or s.get("tokens")
                    mx = s.get("maxTokens") or s.get("max_tokens") or s.get("contextWindow")
                    if ctx and mx:
                        return {"contextTokens": ctx, "maxTokens": mx, "percentage": round((ctx / mx) * 100, 1)}

    return {"contextTokens": None, "maxTokens": None, "percentage": None}
