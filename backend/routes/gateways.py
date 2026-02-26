from fastapi import APIRouter, HTTPException
from typing import List
from models import GatewayCreate, GatewayResponse, GatewayStatus, DiscoveredGateway
from database import get_db
from gateway_manager import gateway_manager
from network_scanner import scan_network

router = APIRouter(prefix="/api/gateways", tags=["gateways"])


@router.get("", response_model=List[GatewayResponse])
async def list_gateways():
    """List all gateways (tokens omitted)"""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id, name, url, created_at FROM gateways")
        rows = await cursor.fetchall()
        
        gateways = []
        for row in rows:
            conn = gateway_manager.get_connection(row["id"])
            gateways.append(GatewayResponse(
                id=row["id"],
                name=row["name"],
                url=row["url"],
                connected=conn.connected if conn else False,
                created_at=row["created_at"]
            ))
        
        return gateways
    finally:
        await db.close()


@router.post("", response_model=GatewayResponse)
async def add_gateway(gateway: GatewayCreate):
    """Add a new gateway"""
    db = await get_db()
    try:
        # Insert into database
        await db.execute(
            "INSERT INTO gateways (id, name, url, token, password) VALUES (?, ?, ?, ?, ?)",
            (gateway.id, gateway.name, gateway.url, gateway.token, gateway.password)
        )
        await db.commit()
        
        # Connect to gateway
        await gateway_manager.add_gateway(gateway.id, gateway.url, gateway.token, gateway.password)
        
        conn = gateway_manager.get_connection(gateway.id)
        
        return GatewayResponse(
            id=gateway.id,
            name=gateway.name,
            url=gateway.url,
            connected=conn.connected if conn else False
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        await db.close()


@router.delete("/{gateway_id}")
async def delete_gateway(gateway_id: str):
    """Delete a gateway"""
    db = await get_db()
    try:
        # Remove from database
        await db.execute("DELETE FROM gateways WHERE id = ?", (gateway_id,))
        await db.commit()
        
        # Disconnect
        await gateway_manager.remove_gateway(gateway_id)
        
        return {"ok": True}
    finally:
        await db.close()


@router.get("/{gateway_id}/status", response_model=GatewayStatus)
async def get_gateway_status(gateway_id: str):
    """Get gateway connection status and metadata"""
    conn = gateway_manager.get_connection(gateway_id)

    if not conn:
        raise HTTPException(status_code=404, detail="Gateway not found")

    return GatewayStatus(
        id=gateway_id,
        connected=conn.connected,
        agents=conn.agents,
        models=conn.models,
        default_model=conn.default_model
    )


@router.post("/scan", response_model=List[DiscoveredGateway])
async def scan_for_gateways():
    """
    Scan the local network for OpenClaw gateways.
    Auto-detects the local subnet and probes port 18789 on all hosts.
    """
    try:
        discovered = await scan_network()
        return [
            DiscoveredGateway(
                ip=gw["ip"],
                port=gw["port"],
                url=gw["url"],
                metadata=gw
            )
            for gw in discovered
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")
