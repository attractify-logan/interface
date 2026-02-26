#!/usr/bin/env python3
"""Test federated session endpoints"""

import asyncio
import aiosqlite
from database import get_db
from models import FederatedSessionGateway


async def test_federated_api():
    """Test federated session creation and retrieval"""
    print("🧪 Testing federated session API...")

    # Test database connection
    db = await get_db()
    try:
        # Check tables exist
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'federated%'"
        )
        tables = await cursor.fetchall()
        print(f"✅ Found tables: {[t['name'] for t in tables]}")

        # Test data insertion
        session_id = "test-session-123"
        await db.execute(
            "INSERT OR REPLACE INTO federated_sessions (id, title) VALUES (?, ?)",
            (session_id, "Test Federated Session")
        )

        await db.execute(
            "DELETE FROM federated_session_gateways WHERE federated_session_id = ?",
            (session_id,)
        )

        await db.execute(
            "INSERT INTO federated_session_gateways (federated_session_id, gateway_id, session_key) VALUES (?, ?, ?)",
            (session_id, "steve", "main")
        )

        await db.execute(
            "INSERT INTO federated_session_gateways (federated_session_id, gateway_id, session_key) VALUES (?, ?, ?)",
            (session_id, "neil", "main")
        )

        await db.commit()
        print(f"✅ Inserted test federated session: {session_id}")

        # Test retrieval
        cursor = await db.execute(
            "SELECT id, title FROM federated_sessions WHERE id = ?",
            (session_id,)
        )
        row = await cursor.fetchone()
        print(f"✅ Retrieved session: {dict(row)}")

        # Test gateway associations
        cursor = await db.execute(
            "SELECT gateway_id, session_key FROM federated_session_gateways WHERE federated_session_id = ?",
            (session_id,)
        )
        gateways = await cursor.fetchall()
        print(f"✅ Retrieved gateways: {[dict(g) for g in gateways]}")

        # Clean up
        await db.execute("DELETE FROM federated_session_gateways WHERE federated_session_id = ?", (session_id,))
        await db.execute("DELETE FROM federated_sessions WHERE id = ?", (session_id,))
        await db.commit()
        print("✅ Cleaned up test data")

    finally:
        await db.close()

    print("✅ All tests passed!")


if __name__ == "__main__":
    asyncio.run(test_federated_api())
