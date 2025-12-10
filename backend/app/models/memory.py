"""
Memory and graph data models
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class Entity(BaseModel):
    """Entity extracted from conversation"""
    id: str
    type: str  # Topic, Project, Skill, Resource, etc.
    name: str
    properties: Dict[str, Any] = {}


class Relation(BaseModel):
    """Relation between entities"""
    source: str  # Source entity ID
    target: str  # Target entity ID
    type: str  # INTERESTED_IN, WORKING_ON, HAS_SKILL, etc.
    properties: Dict[str, Any] = {}


class WriteMemoryRequest(BaseModel):
    """Request to write conversation memory"""
    user_id: str
    conversation_id: str
    messages: List[Dict[str, str]]  # List of {"role": "user/assistant", "content": "..."}
    character_id: str = "epsilon"


class WriteMemoryResponse(BaseModel):
    """Response from memory write operation"""
    success: bool
    entities_count: int = 0
    relations_count: int = 0
    error: Optional[str] = None


class QueryContextRequest(BaseModel):
    """Request to query related context"""
    user_id: str
    query: str
    limit: int = 10


class QueryContextResponse(BaseModel):
    """Response from context query"""
    context: str
    entities: List[Entity] = []


class GraphQueryRequest(BaseModel):
    """Request to query graph data"""
    user_id: str
    entity_types: Optional[List[str]] = None
    relation_types: Optional[List[str]] = None
    depth: int = 2
    limit: int = 100


class GraphNode(BaseModel):
    """Graph node for visualization"""
    id: str
    label: str
    type: str
    properties: Dict[str, Any] = {}


class GraphLink(BaseModel):
    """Graph link/edge for visualization"""
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = {}


class GraphQueryResponse(BaseModel):
    """Response from graph query"""
    nodes: List[GraphNode]
    links: List[GraphLink]


class GraphStatsResponse(BaseModel):
    """Graph statistics response"""
    total_nodes: int
    total_relations: int
    node_types: Dict[str, int]
    relation_types: Dict[str, int]


class NodeDetailsResponse(BaseModel):
    """Node details response"""
    id: str
    type: str
    name: str
    properties: Dict[str, Any]
    incoming_relations: List[Dict[str, Any]]
    outgoing_relations: List[Dict[str, Any]]

