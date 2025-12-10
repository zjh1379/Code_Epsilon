"""
Memory API endpoints
Handles memory write and query operations
"""
import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.models.memory import (
    WriteMemoryRequest,
    WriteMemoryResponse,
    QueryContextRequest,
    QueryContextResponse,
    GraphQueryRequest,
    GraphQueryResponse,
    GraphStatsResponse,
    NodeDetailsResponse,
    GraphNode,
    GraphLink
)
from app.services.memory_service import get_memory_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/memory/write", response_model=WriteMemoryResponse)
async def write_memory(request: WriteMemoryRequest):
    """
    Write conversation memory to Neo4j
    
    Extracts entities and relations from conversation and stores them in graph database
    """
    memory_service = get_memory_service()
    if not memory_service:
        from app.config import settings
        reason = "Memory service not initialized. "
        if not settings.graph_memory_enabled:
            reason += "Please enable GRAPH_MEMORY_ENABLED in .env file."
        elif not settings.neo4j_password:
            reason += "Please configure NEO4J_PASSWORD in .env file."
        else:
            reason += "Neo4j connection may have failed. Check server logs for details."
        raise HTTPException(
            status_code=503,
            detail=reason
        )
    
    try:
        result = await memory_service.write_conversation(
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            messages=request.messages,
            character_id=request.character_id
        )
        
        return WriteMemoryResponse(
            success=True,
            entities_count=result.get("entities_count", 0),
            relations_count=result.get("relations_count", 0)
        )
    except Exception as e:
        logger.error(f"Memory write error: {str(e)}")
        return WriteMemoryResponse(
            success=False,
            error=str(e)
        )


@router.get("/memory/context", response_model=QueryContextResponse)
async def query_context(
    user_id: str = Query(..., description="User ID"),
    query: str = Query(..., description="Query text"),
    limit: int = Query(10, description="Maximum number of results")
):
    """
    Query related context from memory
    
    Returns relevant entities and relations based on query text
    """
    memory_service = get_memory_service()
    if not memory_service:
        from app.config import settings
        reason = "Memory service not initialized. "
        if not settings.graph_memory_enabled:
            reason += "Please enable GRAPH_MEMORY_ENABLED in .env file."
        elif not settings.neo4j_password:
            reason += "Please configure NEO4J_PASSWORD in .env file."
        else:
            reason += "Neo4j connection may have failed. Check server logs for details."
        raise HTTPException(
            status_code=503,
            detail=reason
        )
    
    try:
        context = await memory_service.query_related_context(
            user_id=user_id,
            query_text=query,
            limit=limit
        )
        
        # Extract entities from context (simplified, can be enhanced)
        entities = []
        # TODO: Parse entities from context or query separately
        
        return QueryContextResponse(
            context=context,
            entities=entities
        )
    except Exception as e:
        logger.error(f"Context query error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Context query failed: {str(e)}")


@router.get("/graph/query", response_model=GraphQueryResponse)
async def query_graph(
    user_id: str = Query(..., description="User ID"),
    entity_types: Optional[str] = Query(None, description="Entity types filter, comma-separated"),
    relation_types: Optional[str] = Query(None, description="Relation types filter, comma-separated"),
    depth: int = Query(2, description="Query depth"),
    limit: int = Query(100, description="Node count limit")
):
    """
    Query graph data for visualization
    
    Returns nodes and links for graph visualization
    """
    memory_service = get_memory_service()
    if not memory_service:
        from app.config import settings
        reason = "Memory service not initialized. "
        if not settings.graph_memory_enabled:
            reason += "Please enable GRAPH_MEMORY_ENABLED in .env file."
        elif not settings.neo4j_password:
            reason += "Please configure NEO4J_PASSWORD in .env file."
        else:
            reason += "Neo4j connection may have failed. Check server logs for details."
        raise HTTPException(
            status_code=503,
            detail=reason
        )
    
    entity_types_list = entity_types.split(',') if entity_types else None
    relation_types_list = relation_types.split(',') if relation_types else None
    
    try:
        graph_data = await memory_service.query_graph(
            user_id=user_id,
            entity_types=entity_types_list,
            relation_types=relation_types_list,
            depth=depth,
            limit=limit
        )
        
        # Convert to response models
        nodes = [GraphNode(**node) for node in graph_data.get("nodes", [])]
        links = [GraphLink(**link) for link in graph_data.get("links", [])]
        
        return GraphQueryResponse(nodes=nodes, links=links)
    except Exception as e:
        logger.error(f"Graph query error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Graph query failed: {str(e)}")


@router.get("/graph/stats", response_model=GraphStatsResponse)
async def get_graph_stats(
    user_id: str = Query(..., description="User ID")
):
    """
    Get graph statistics
    
    Returns statistics about nodes and relations in the graph
    """
    memory_service = get_memory_service()
    if not memory_service:
        from app.config import settings
        reason = "Memory service not initialized. "
        if not settings.graph_memory_enabled:
            reason += "Please enable GRAPH_MEMORY_ENABLED in .env file."
        elif not settings.neo4j_password:
            reason += "Please configure NEO4J_PASSWORD in .env file."
        else:
            reason += "Neo4j connection may have failed. Check server logs for details."
        raise HTTPException(
            status_code=503,
            detail=reason
        )
    
    try:
        stats = await memory_service.get_graph_stats(user_id)
        return GraphStatsResponse(**stats)
    except Exception as e:
        logger.error(f"Graph stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get("/graph/node/{node_id}", response_model=NodeDetailsResponse)
async def get_node_details(node_id: str):
    """
    Get node details
    
    Returns detailed information about a specific node including its relations
    """
    memory_service = get_memory_service()
    if not memory_service:
        from app.config import settings
        reason = "Memory service not initialized. "
        if not settings.graph_memory_enabled:
            reason += "Please enable GRAPH_MEMORY_ENABLED in .env file."
        elif not settings.neo4j_password:
            reason += "Please configure NEO4J_PASSWORD in .env file."
        else:
            reason += "Neo4j connection may have failed. Check server logs for details."
        raise HTTPException(
            status_code=503,
            detail=reason
        )
    
    try:
        details = await memory_service.get_node_details(node_id)
        if not details:
            raise HTTPException(status_code=404, detail="Node not found")
        return NodeDetailsResponse(**details)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Node details error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get node details: {str(e)}")

