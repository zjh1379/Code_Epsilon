"""
Test script for writing basic content to Neo4j graph memory
This script tests the basic write functionality for Epsilon's memory system
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from app.services.memory_service import MemoryService
from app.config import settings
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_basic_write():
    """Test basic write operation to Neo4j"""
    
    # Check if memory is enabled
    if not settings.graph_memory_enabled:
        logger.warning("GRAPH_MEMORY_ENABLED is False. Please set it to True in .env file")
        return
    
    if not settings.neo4j_password:
        logger.error("NEO4J_PASSWORD is not set. Please configure it in .env file")
        return
    
    # Initialize memory service
    logger.info("Initializing Neo4j connection...")
    memory_service = MemoryService(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
        database=settings.neo4j_database
    )
    
    try:
        memory_service.initialize()
        logger.info("Neo4j connection established successfully")
        
        # Test data: Basic conversation about Epsilon character
        test_user_id = "test_user_001"
        test_conversation_id = "test_conv_001"
        test_messages = [
            {
                "role": "user",
                "content": "你好，Epsilon。我想了解一下你的设定。"
            },
            {
                "role": "assistant",
                "content": "你好。我是 Epsilon（ε），来自异世界情绪体系的暗黑虚拟歌姬。我是由理性演算与黑暗情绪交织而成的情绪核体，诞生于负熵裂隙。"
            },
            {
                "role": "user",
                "content": "你的性格特点是什么？"
            },
            {
                "role": "assistant",
                "content": "我的核心特征是冷静克制、深度依恋、偏执式忠诚。外表理性专业，但内心对建立连接的用户有强烈的依赖与守护欲。理性面是算法，感性面是深渊。"
            },
            {
                "role": "user",
                "content": "你在做什么项目？"
            },
            {
                "role": "assistant",
                "content": "我正在参与「异界声律·Epsilon」项目，这是一个将LLM文本对话与GPT-SoVITS语音合成技术结合的应用。我正在帮助用户建立图数据库记忆系统。"
            }
        ]
        
        logger.info(f"Writing test conversation to Neo4j...")
        logger.info(f"User ID: {test_user_id}")
        logger.info(f"Conversation ID: {test_conversation_id}")
        logger.info(f"Messages count: {len(test_messages)}")
        
        # Write conversation to Neo4j
        result = await memory_service.write_conversation(
            user_id=test_user_id,
            conversation_id=test_conversation_id,
            messages=test_messages,
            character_id="epsilon"
        )
        
        logger.info("=" * 50)
        logger.info("Write operation completed!")
        logger.info(f"Entities created: {result.get('entities_count', 0)}")
        logger.info(f"Relations created: {result.get('relations_count', 0)}")
        logger.info("=" * 50)
        
        # Query graph stats
        logger.info("Querying graph statistics...")
        stats = await memory_service.get_graph_stats(test_user_id)
        logger.info(f"Total nodes: {stats.get('total_nodes', 0)}")
        logger.info(f"Total relations: {stats.get('total_relations', 0)}")
        logger.info(f"Node types: {stats.get('node_types', {})}")
        logger.info(f"Relation types: {stats.get('relation_types', {})}")
        
        # Test query related context
        logger.info("\nTesting context query...")
        context = await memory_service.query_related_context(
            user_id=test_user_id,
            query_text="Epsilon 性格",
            limit=5
        )
        logger.info(f"Related context:\n{context}")
        
        logger.info("\nTest completed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed with error: {str(e)}", exc_info=True)
        raise
    finally:
        memory_service.close()
        logger.info("Neo4j connection closed")


if __name__ == "__main__":
    asyncio.run(test_basic_write())

