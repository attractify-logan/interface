from fastapi import APIRouter, HTTPException
from typing import List
from models import FederatedSessionCreate, FederatedSessionResponse, FederatedSessionGateway
from database import get_db
import uuid

router = APIRouter(prefix="/api/federated-sessions", tags=["federated"])


@router.post("", response_model=FederatedSessionResponse)
async def create_federated_session(session: FederatedSessionCreate):
    """Create a new federated session"""
    db = await get_db()
    try:
        session_id = str(uuid.uuid4())

        # Insert federated session
        await db.execute(
            "INSERT INTO federated_sessions (id, title) VALUES (?, ?)",
            (session_id, session.title)
        )

        # Insert gateway associations
        for gw in session.gateways:
            await db.execute(
                "INSERT INTO federated_session_gateways (federated_session_id, gateway_id, session_key) VALUES (?, ?, ?)",
                (session_id, gw.gateway_id, gw.session_key)
            )

        await db.commit()

        # Fetch created session
        cursor = await db.execute(
            "SELECT id, title, created_at, last_activity FROM federated_sessions WHERE id = ?",
            (session_id,)
        )
        row = await cursor.fetchone()

        return FederatedSessionResponse(
            id=row["id"],
            title=row["title"],
            gateways=session.gateways,
            created_at=row["created_at"],
            last_activity=row["last_activity"]
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await db.close()


@router.get("", response_model=List[FederatedSessionResponse])
async def list_federated_sessions():
    """List all federated sessions"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, title, created_at, last_activity FROM federated_sessions ORDER BY last_activity DESC"
        )
        rows = await cursor.fetchall()

        sessions = []
        for row in rows:
            # Fetch associated gateways
            gw_cursor = await db.execute(
                "SELECT gateway_id, session_key FROM federated_session_gateways WHERE federated_session_id = ?",
                (row["id"],)
            )
            gw_rows = await gw_cursor.fetchall()

            gateways = [
                FederatedSessionGateway(gateway_id=gw["gateway_id"], session_key=gw["session_key"])
                for gw in gw_rows
            ]

            sessions.append(FederatedSessionResponse(
                id=row["id"],
                title=row["title"],
                gateways=gateways,
                created_at=row["created_at"],
                last_activity=row["last_activity"]
            ))

        return sessions
    finally:
        await db.close()


@router.get("/{session_id}", response_model=FederatedSessionResponse)
async def get_federated_session(session_id: str):
    """Get a specific federated session"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, title, created_at, last_activity FROM federated_sessions WHERE id = ?",
            (session_id,)
        )
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Federated session not found")

        # Fetch associated gateways
        gw_cursor = await db.execute(
            "SELECT gateway_id, session_key FROM federated_session_gateways WHERE federated_session_id = ?",
            (session_id,)
        )
        gw_rows = await gw_cursor.fetchall()

        gateways = [
            FederatedSessionGateway(gateway_id=gw["gateway_id"], session_key=gw["session_key"])
            for gw in gw_rows
        ]

        return FederatedSessionResponse(
            id=row["id"],
            title=row["title"],
            gateways=gateways,
            created_at=row["created_at"],
            last_activity=row["last_activity"]
        )
    finally:
        await db.close()


@router.delete("/{session_id}")
async def delete_federated_session(session_id: str):
    """Delete a federated session"""
    db = await get_db()
    try:
        await db.execute("DELETE FROM federated_session_gateways WHERE federated_session_id = ?", (session_id,))
        await db.execute("DELETE FROM federated_sessions WHERE id = ?", (session_id,))
        await db.commit()

        return {"ok": True}
    finally:
        await db.close()
