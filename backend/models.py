from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# Gateway models
class GatewayCreate(BaseModel):
    id: str
    name: str
    url: str
    token: Optional[str] = None
    password: Optional[str] = None


class GatewayResponse(BaseModel):
    id: str
    name: str
    url: str
    connected: bool = False
    created_at: Optional[str] = None


class GatewayStatus(BaseModel):
    id: str
    connected: bool
    agents: List[Any] = []
    models: List[Any] = []
    default_model: Optional[str] = None


class DiscoveredGateway(BaseModel):
    ip: str
    port: int
    url: str
    metadata: Optional[dict] = None


# Session models
class SessionCreate(BaseModel):
    session_key: str
    title: Optional[str] = None
    agent_id: Optional[str] = None
    model: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    gateway_id: str
    session_key: str
    title: Optional[str] = None
    agent_id: Optional[str] = None
    model: Optional[str] = None
    created_at: str
    last_activity: str


# Message models
class MessageResponse(BaseModel):
    id: int = 0
    session_id: int = 0
    role: str
    content: str  # JSON string
    timestamp: Optional[int] = None
    created_at: Optional[str] = None


# Federated session models
class FederatedSessionGateway(BaseModel):
    gateway_id: str
    session_key: str


class FederatedSessionCreate(BaseModel):
    title: Optional[str] = None
    gateways: List[FederatedSessionGateway]


class FederatedSessionResponse(BaseModel):
    id: str
    title: Optional[str] = None
    gateways: List[FederatedSessionGateway]
    created_at: str
    last_activity: str


# WebSocket message types
class ChatMessage(BaseModel):
    type: str
    sessionKey: Optional[str] = None
    message: Optional[str] = None
    limit: Optional[int] = None


class FederatedChatMessage(BaseModel):
    type: str
    message: str
    targets: Optional[List[FederatedSessionGateway]] = None
    broadcast: bool = False
