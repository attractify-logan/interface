from fastapi import APIRouter, HTTPException
from typing import List
from models import DeviceCreate, DeviceResponse, DeviceStatusResponse, ServiceStatus
from database import get_db
import json
import asyncio
import subprocess
from datetime import datetime

router = APIRouter(prefix="/api/devices", tags=["devices"])

# Module-level cache for device statuses
_status_cache = {}
_poller_task = None


async def check_device_status(device_id: str, ip: str, ssh_user: str, ssh_port: int, services: List[str]) -> DeviceStatusResponse:
    """Check device status via ping and SSH service checks"""
    # Ping check
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", ip],
            capture_output=True,
            timeout=3
        )
        online = result.returncode == 0
    except Exception as e:
        return DeviceStatusResponse(
            id=device_id,
            name="",
            icon="",
            online=False,
            services=[],
            last_check=datetime.utcnow().isoformat(),
            error=f"Ping failed: {str(e)}"
        )

    if not online:
        return DeviceStatusResponse(
            id=device_id,
            name="",
            icon="",
            online=False,
            services=[],
            last_check=datetime.utcnow().isoformat(),
            error="Device offline (ping failed)"
        )

    # SSH service checks
    service_statuses = []
    if ssh_user and services:
        for service in services:
            try:
                result = subprocess.run(
                    [
                        "ssh",
                        "-o", "ConnectTimeout=5",
                        "-o", "StrictHostKeyChecking=no",
                        "-p", str(ssh_port),
                        f"{ssh_user}@{ip}",
                        f"systemctl is-active {service}"
                    ],
                    capture_output=True,
                    timeout=10,
                    text=True
                )
                active = result.returncode == 0 and result.stdout.strip() == "active"
                service_statuses.append(ServiceStatus(
                    name=service,
                    active=active,
                    error=None if active else result.stdout.strip()
                ))
            except Exception as e:
                service_statuses.append(ServiceStatus(
                    name=service,
                    active=False,
                    error=str(e)
                ))

    return DeviceStatusResponse(
        id=device_id,
        name="",
        icon="",
        online=True,
        services=service_statuses,
        last_check=datetime.utcnow().isoformat(),
        error=None
    )


async def poll_devices():
    """Background task to poll all enabled devices every 60 seconds"""
    while True:
        try:
            db = await get_db()
            try:
                cursor = await db.execute(
                    "SELECT id, name, ip, icon, ssh_user, ssh_port, services FROM devices WHERE enabled = 1"
                )
                rows = await cursor.fetchall()

                for row in rows:
                    services = json.loads(row["services"]) if row["services"] else []
                    status = await check_device_status(
                        row["id"],
                        row["ip"],
                        row["ssh_user"],
                        row["ssh_port"],
                        services
                    )
                    status.name = row["name"]
                    status.icon = row["icon"]
                    _status_cache[row["id"]] = status
            finally:
                await db.close()
        except Exception as e:
            print(f"Error polling devices: {e}")

        await asyncio.sleep(60)


def start_poller():
    """Start the background poller"""
    global _poller_task
    if _poller_task is None:
        _poller_task = asyncio.create_task(poll_devices())


@router.get("", response_model=List[DeviceResponse])
async def list_devices():
    """List all devices"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, name, ip, icon, enabled, ssh_user, ssh_port, services, created_at FROM devices ORDER BY created_at"
        )
        rows = await cursor.fetchall()

        devices = []
        for row in rows:
            services = json.loads(row["services"]) if row["services"] else []
            devices.append(DeviceResponse(
                id=row["id"],
                name=row["name"],
                ip=row["ip"],
                icon=row["icon"],
                enabled=bool(row["enabled"]),
                ssh_user=row["ssh_user"],
                ssh_port=row["ssh_port"],
                services=services,
                created_at=row["created_at"]
            ))

        return devices
    finally:
        await db.close()


@router.post("", response_model=DeviceResponse)
async def create_device(device: DeviceCreate):
    """Create a new device"""
    db = await get_db()
    try:
        # Check if device already exists
        cursor = await db.execute("SELECT id FROM devices WHERE id = ?", (device.id,))
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Device with this ID already exists")

        await db.execute(
            """
            INSERT INTO devices (id, name, ip, icon, enabled, ssh_user, ssh_port, services)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                device.id,
                device.name,
                device.ip,
                device.icon,
                1 if device.enabled else 0,
                device.ssh_user,
                device.ssh_port,
                json.dumps(device.services)
            )
        )
        await db.commit()

        # Fetch the created device
        cursor = await db.execute(
            "SELECT id, name, ip, icon, enabled, ssh_user, ssh_port, services, created_at FROM devices WHERE id = ?",
            (device.id,)
        )
        row = await cursor.fetchone()

        services = json.loads(row["services"]) if row["services"] else []
        return DeviceResponse(
            id=row["id"],
            name=row["name"],
            ip=row["ip"],
            icon=row["icon"],
            enabled=bool(row["enabled"]),
            ssh_user=row["ssh_user"],
            ssh_port=row["ssh_port"],
            services=services,
            created_at=row["created_at"]
        )
    finally:
        await db.close()


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: str, device: DeviceCreate):
    """Update a device"""
    db = await get_db()
    try:
        await db.execute(
            """
            UPDATE devices
            SET name = ?, ip = ?, icon = ?, enabled = ?, ssh_user = ?, ssh_port = ?, services = ?
            WHERE id = ?
            """,
            (
                device.name,
                device.ip,
                device.icon,
                1 if device.enabled else 0,
                device.ssh_user,
                device.ssh_port,
                json.dumps(device.services),
                device_id
            )
        )
        await db.commit()

        # Fetch the updated device
        cursor = await db.execute(
            "SELECT id, name, ip, icon, enabled, ssh_user, ssh_port, services, created_at FROM devices WHERE id = ?",
            (device_id,)
        )
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Device not found")

        services = json.loads(row["services"]) if row["services"] else []
        return DeviceResponse(
            id=row["id"],
            name=row["name"],
            ip=row["ip"],
            icon=row["icon"],
            enabled=bool(row["enabled"]),
            ssh_user=row["ssh_user"],
            ssh_port=row["ssh_port"],
            services=services,
            created_at=row["created_at"]
        )
    finally:
        await db.close()


@router.delete("/{device_id}")
async def delete_device(device_id: str):
    """Delete a device"""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM devices WHERE id = ?", (device_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Device not found")

        await db.execute("DELETE FROM devices WHERE id = ?", (device_id,))
        await db.commit()

        # Remove from cache
        if device_id in _status_cache:
            del _status_cache[device_id]

        return {"status": "deleted"}
    finally:
        await db.close()


@router.get("/status", response_model=List[DeviceStatusResponse])
async def get_device_statuses():
    """Get status for all enabled devices"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, name, icon FROM devices WHERE enabled = 1 ORDER BY created_at"
        )
        rows = await cursor.fetchall()

        statuses = []
        for row in rows:
            if row["id"] in _status_cache:
                status = _status_cache[row["id"]]
                status.name = row["name"]
                status.icon = row["icon"]
                statuses.append(status)
            else:
                # Return offline status if not in cache yet
                statuses.append(DeviceStatusResponse(
                    id=row["id"],
                    name=row["name"],
                    icon=row["icon"],
                    online=False,
                    services=[],
                    last_check=datetime.utcnow().isoformat(),
                    error="Status not yet available"
                ))

        return statuses
    finally:
        await db.close()


@router.get("/{device_id}/status", response_model=DeviceStatusResponse)
async def get_device_status(device_id: str):
    """Get status for a specific device"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, name, icon, ip, ssh_user, ssh_port, services FROM devices WHERE id = ? AND enabled = 1",
            (device_id,)
        )
        row = await cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Device not found or disabled")

        if device_id in _status_cache:
            status = _status_cache[device_id]
            status.name = row["name"]
            status.icon = row["icon"]
            return status
        else:
            # Perform immediate check
            services = json.loads(row["services"]) if row["services"] else []
            status = await check_device_status(
                row["id"],
                row["ip"],
                row["ssh_user"],
                row["ssh_port"],
                services
            )
            status.name = row["name"]
            status.icon = row["icon"]
            _status_cache[device_id] = status
            return status
    finally:
        await db.close()
