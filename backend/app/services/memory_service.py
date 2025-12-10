"""
Memory/GRAG service for Neo4j graph database integration
Implements GraphRAG memory system for long-term memory storage
"""
import logging
import json
import re
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from neo4j import GraphDatabase
from app.config import settings
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class MemoryService:
    """
    Memory/GRAG service (inspired by NagaAgent design)
    
    Uses Neo4j Python driver 5.0+ best practices:
    - Uses execute_write/execute_read for transaction management
    - Supports sync operations (async can be added later)
    - Properly handles connection pool and session lifecycle
    """
    
    def __init__(self, uri: str, user: str, password: str, database: str = "neo4j"):
        self.uri = uri
        self.user = user
        self.password = password
        self.database = database
        self.driver: Optional[GraphDatabase] = None
        self._initialized = False
    
    def initialize(self):
        """Initialize Neo4j connection (sync)"""
        if self._initialized:
            return
        
        try:
            # Neo4j Aura uses neo4j+s:// (encrypted connection)
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_lifetime=30 * 60,  # 30 minutes
                max_connection_pool_size=50,
                connection_acquisition_timeout=2 * 60  # 2 minutes
            )
            
            # Test connection
            with self.driver.session(database=self.database) as session:
                result = session.execute_read(lambda tx: tx.run("RETURN 1 AS test").single())
                if result["test"] != 1:
                    raise Exception("Connection test failed")
            
            self._initialized = True
            logger.info(f"Neo4j connected successfully: {self.uri}")
            
            # Create indexes (including vector index)
            self.create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            raise
    
    def create_indexes(self):
        """Create necessary indexes for performance optimization"""
        if not self.driver:
            return
        
        try:
            with self.driver.session(database=self.database) as session:
                def write_tx(tx):
                    """Transaction function: create indexes"""
                    # Use Neo4j 5.x compatible syntax
                    indexes = [
                        "CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id)",
                        "CREATE INDEX entity_id_index IF NOT EXISTS FOR (e:Entity) ON (e.id)",
                    ]
                    for index_query in indexes:
                        try:
                            tx.run(index_query)
                        except Exception as e:
                            logger.warning(f"Index creation warning: {str(e)}")
                    
                    # Create Vector Index for Entity embeddings
                    # Dimension 1536 for OpenAI text-embedding-3-small
                    try:
                        tx.run("""
                            CREATE VECTOR INDEX entity_embedding_index IF NOT EXISTS
                            FOR (e:Entity) ON (e.embedding)
                            OPTIONS {indexConfig: {
                                `vector.dimensions`: 1536,
                                `vector.similarity_function`: 'cosine'
                            }}
                        """)
                    except Exception as e:
                         # Ignore if already exists or not supported (though 5.x supports it)
                        logger.warning(f"Vector index creation warning: {str(e)}")
                
                session.execute_write(write_tx)
                logger.info("Neo4j indexes created/verified")
        except Exception as e:
            logger.warning(f"Failed to create indexes: {str(e)}")
    
    def verify_connectivity(self) -> bool:
        """Verify connection is healthy"""
        if not self.driver:
            return False
        try:
            with self.driver.session(database=self.database) as session:
                session.execute_read(lambda tx: tx.run("RETURN 1").single())
            return True
        except Exception:
            return False
    
    async def extract_entities(
        self,
        conversation_text: str,
        user_id: str
    ) -> Tuple[List[dict], List[dict]]:
        """
        Extract entities and relations using LLM
        
        Returns:
            (entities, relations)
        """
        extraction_prompt = f"""
请从以下对话中抽取实体和关系，以JSON格式返回。

对话内容：
{conversation_text}

请识别以下类型的实体：
1. Topic（话题/领域）：如"Python"、"图像识别"、"机器学习"
2. Project（项目）：用户提到的项目名称
3. Skill（技能）：技术技能、软技能等
4. Resource（资源）：文档、课程、论文、工具等

关系类型：
- INTERESTED_IN: 用户对话题感兴趣
- WORKING_ON: 用户正在做的项目
- HAS_SKILL: 用户拥有的技能
- LEARNED_FROM: 用户从资源中学习
- USES: 项目使用的技能
- RELATED_TO: 实体之间的关联

返回格式（必须是有效的JSON）：
{{
    "entities": [
        {{"id": "topic_python", "type": "Topic", "name": "Python", "properties": {{}}}},
        {{"id": "project_epsilon", "type": "Project", "name": "异界声律·Epsilon", "properties": {{"status": "in_progress"}}}}
    ],
    "relations": [
        {{"source": "{user_id}", "target": "topic_python", "type": "INTERESTED_IN", "properties": {{"confidence": 0.8}}}},
        {{"source": "{user_id}", "target": "project_epsilon", "type": "WORKING_ON", "properties": {{"role": "developer"}}}}
    ]
}}

只返回JSON，不要其他文字说明。
"""
        
        try:
            # Call LLM for extraction
            response = await llm_service.chat(
                message=extraction_prompt,
                history=[],
                system_prompt="你是一个专业的实体抽取助手，能够从对话中准确提取实体和关系。"
            )
            
            # Parse JSON response
            # Try to extract JSON from response (in case LLM adds extra text)
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                response = json_match.group(0)
            
            data = json.loads(response)
            entities = data.get("entities", [])
            relations = data.get("relations", [])
            
            logger.info(f"Extracted {len(entities)} entities and {len(relations)} relations")
            return entities, relations
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse extraction result as JSON: {str(e)}")
            logger.error(f"LLM response: {response[:500]}")
            return [], []
        except Exception as e:
            logger.error(f"Failed to extract entities: {str(e)}")
            return [], []
    
    async def write_conversation(
        self,
        user_id: str,
        conversation_id: str,
        messages: List[Dict[str, str]],
        character_id: str = "epsilon"
    ) -> Dict[str, int]:
        """
        Write conversation memory to Neo4j (inspired by NagaAgent design)
        
        Returns:
            Dict with entities_count and relations_count
        """
        if not self._initialized:
            raise RuntimeError("MemoryService not initialized")
        
        # 1. Merge conversation text
        conversation_text = "\n".join([
            f"{msg.get('role', 'unknown')}: {msg.get('content', '')}" for msg in messages
        ])
        
        # 2. Extract entities and relations
        entities, relations = await self.extract_entities(conversation_text, user_id)
        
        if not entities and not relations:
            logger.warning("No entities or relations extracted")
            return {"entities_count": 0, "relations_count": 0}

        # 2.5 Generate Embeddings for Entities (Parallelized)
        import asyncio
        
        async def compute_entity_embedding(entity):
            text_to_embed = f"{entity.get('name', '')} {entity.get('type', '')} {json.dumps(entity.get('properties', {}), ensure_ascii=False)}"
            embedding = await llm_service.get_embedding(text_to_embed)
            entity['embedding'] = embedding
            return entity

        # Batch process embeddings
        if entities:
            entities = await asyncio.gather(*[compute_entity_embedding(e) for e in entities])
        
        # 3. Write to Neo4j (using execute_write for transaction management)
        with self.driver.session(database=self.database) as session:
            def write_tx(tx):
                """Transaction function: write all nodes and relations"""
                now = datetime.now().isoformat()
                
                # Create/update user node
                # Check if user exists first, then set properties accordingly
                result = tx.run("""
                    MATCH (u:User {id: $user_id})
                    RETURN u
                    LIMIT 1
                """, user_id=user_id)
                
                if result.single():
                    # User exists, update
                    tx.run("""
                        MATCH (u:User {id: $user_id})
                        SET u.last_active = $now,
                            u.updated_at = $now
                    """, user_id=user_id, now=now)
                else:
                    # User doesn't exist, create with all properties
                    tx.run("""
                        CREATE (u:User {id: $user_id, created_at: $now, last_active: $now, updated_at: $now})
                    """, user_id=user_id, now=now)
                
                # Create conversation node
                # Check if conversation exists first
                conv_result = tx.run("""
                    MATCH (c:Conversation {id: $conversation_id})
                    RETURN c
                    LIMIT 1
                """, conversation_id=conversation_id)
                
                if conv_result.single():
                    # Conversation exists, update
                    tx.run("""
                        MATCH (c:Conversation {id: $conversation_id})
                        SET c.message_count = $message_count,
                            c.character_id = $character_id,
                            c.updated_at = $now
                    """, 
                        conversation_id=conversation_id,
                        message_count=len(messages),
                        character_id=character_id,
                        now=now
                    )
                else:
                    # Conversation doesn't exist, create
                    tx.run("""
                        CREATE (c:Conversation {
                            id: $conversation_id,
                            created_at: $now,
                            message_count: $message_count,
                            character_id: $character_id,
                            updated_at: $now
                        })
                    """, 
                        conversation_id=conversation_id,
                        message_count=len(messages),
                        character_id=character_id,
                        now=now
                    )
                
                # Create relationship
                rel_result = tx.run("""
                    MATCH (u:User {id: $user_id})-[r:HAS_CONVERSATION]->(c:Conversation {id: $conversation_id})
                    RETURN r
                    LIMIT 1
                """, user_id=user_id, conversation_id=conversation_id)
                
                if rel_result.single():
                    # Relationship exists, update
                    tx.run("""
                        MATCH (u:User {id: $user_id})-[r:HAS_CONVERSATION]->(c:Conversation {id: $conversation_id})
                        SET r.created_at = $now
                    """, user_id=user_id, conversation_id=conversation_id, now=now)
                else:
                    # Relationship doesn't exist, create
                    tx.run("""
                        MATCH (u:User {id: $user_id})
                        MATCH (c:Conversation {id: $conversation_id})
                        CREATE (u)-[r:HAS_CONVERSATION {created_at: $now}]->(c)
                    """, 
                        user_id=user_id,
                        conversation_id=conversation_id,
                        now=now
                    )
                
                # Create entity nodes (deduplicate, use Entity type+id as unique identifier)
                for entity in entities:
                    entity_id = entity.get('id')
                    entity_type = entity.get('type', 'Entity')
                    entity_name = entity.get('name', '')
                    entity_props = entity.get('properties', {})
                    
                    # Entity properties preparation
                    props_dict = {k: v for k, v in entity_props.items()}
                    props_dict['id'] = entity_id
                    props_dict['name'] = entity_name
                    props_dict['type'] = entity_type
                    props_dict['created_at'] = now
                    props_dict['updated_at'] = now
                    if entity.get('embedding'):
                        props_dict['embedding'] = entity['embedding']

                    # Check if entity exists first
                    entity_result = tx.run(f"""
                        MATCH (e:{entity_type} {{id: $id}})
                        RETURN e
                        LIMIT 1
                    """, id=entity_id)
                    
                    if entity_result.single():
                        # Entity exists, update
                        set_clauses = [
                            "e.name = $name",
                            "e.type = $type",
                            "e.updated_at = $updated_at"
                        ]
                        # Add property updates
                        for k in entity_props.keys():
                            set_clauses.append(f"e.{k} = ${k}")
                        
                        # Update embedding if new one exists
                        if 'embedding' in props_dict:
                            set_clauses.append("e.embedding = $embedding")
                            
                        set_clause_str = ", ".join(set_clauses)
                        
                        tx.run(f"""
                            MATCH (e:{entity_type} {{id: $id}})
                            SET {set_clause_str}
                        """, **props_dict)
                    else:
                        # Entity doesn't exist, create
                        # Build CREATE statement dynamically
                        # Note: We need to handle embedding separately or ensure it's in props_dict
                        
                        # Prepare fields string
                        fields = [f"{k}: ${k}" for k in props_dict.keys()]
                        fields_str = ", ".join(fields)
                        
                        tx.run(f"""
                            CREATE (e:{entity_type} {{{fields_str}}})
                        """, **props_dict)
                
                # Create relations (deduplicate and merge)
                for relation in relations:
                    source_id = relation.get('source_id') or relation.get('source')
                    target_id = relation.get('target_id') or relation.get('target')
                    rel_type = relation.get('type', 'RELATED_TO')
                    rel_props = relation.get('properties', {})
                    
                    # Check if relation exists
                    rel_check = tx.run("""
                        MATCH (a {id: $source_id})-[r:RELATION]->(b {id: $target_id})
                        WHERE r.type = $rel_type
                        RETURN r
                        LIMIT 1
                    """, 
                        source_id=source_id,
                        target_id=target_id,
                        rel_type=rel_type
                    )
                    
                    if rel_check.single():
                        # Relation exists, update count and properties
                        update_params = {
                            'source_id': source_id,
                            'target_id': target_id,
                            'rel_type': rel_type,
                            'now': now,
                            **rel_props
                        }
                        
                        # Get current count
                        count_result = tx.run("""
                            MATCH (a {id: $source_id})-[r:RELATION]->(b {id: $target_id})
                            WHERE r.type = $rel_type
                            RETURN COALESCE(r.count, 0) as current_count
                        """, source_id=source_id, target_id=target_id, rel_type=rel_type)
                        current_count = count_result.single()['current_count'] if count_result.single() else 0
                        
                        props_updates = []
                        if rel_props:
                            props_updates = [f"r.{k} = ${k}" for k in rel_props.keys()]
                        props_updates.append("r.updated_at = $now")
                        props_updates.append(f"r.count = {current_count + 1}")
                        
                        props_str = ', '.join(props_updates)
                        tx.run(f"""
                            MATCH (a {{id: $source_id}})-[r:RELATION]->(b {{id: $target_id}})
                            WHERE r.type = $rel_type
                            SET {props_str}
                        """, **update_params)
                    else:
                        # Relation doesn't exist, create
                        rel_props_dict = {
                            'type': rel_type,
                            'created_at': now,
                            'updated_at': now,
                            'count': 1,
                            **rel_props
                        }
                        
                        rel_props_str = ', '.join([f"{k}: ${k}" for k in rel_props_dict.keys()])
                        params = {
                            'source_id': source_id,
                            'target_id': target_id,
                            **rel_props_dict
                        }
                        tx.run(f"""
                            MATCH (a {{id: $source_id}})
                            MATCH (b {{id: $target_id}})
                            CREATE (a)-[r:RELATION {{{rel_props_str}}}]->(b)
                        """, **params)
                
                return len(entities), len(relations)
            
            # Execute transaction
            entities_count, relations_count = session.execute_write(write_tx)
            logger.info(f"Written {entities_count} entities and {relations_count} relations to Neo4j")
            return {"entities_count": entities_count, "relations_count": relations_count}
    
    async def query_related_context(
        self,
        user_id: str,
        query_text: str,
        limit: int = 10
    ) -> str:
        """
        Query related context using Hybrid Search (Vector + Graph)
        """
        if not self._initialized:
            return ""
        
        # 1. Get query embedding
        query_embedding = await llm_service.get_embedding(query_text)
        
        # 2. Extract keywords as fallback/filter
        keywords = self._extract_keywords(query_text)
        
        # 3. Hybrid Retrieval Strategy
        with self.driver.session(database=self.database) as session:
            def read_tx(tx):
                context_nodes = []
                
                # A. Vector Search (Semantic Recall)
                if query_embedding:
                    try:
                        # Query vector index
                        # Find top similar entities
                        vector_query = """
                        CALL db.index.vector.queryNodes('entity_embedding_index', $k, $embedding)
                        YIELD node, score
                        WHERE score > 0.7  // Similarity threshold
                        RETURN node.id as id, node.name as name, node.type as type, score
                        """
                        vector_result = tx.run(vector_query, k=5, embedding=query_embedding)
                        vector_nodes = [record.data() for record in vector_result]
                        context_nodes.extend(vector_nodes)
                    except Exception as e:
                        logger.warning(f"Vector search failed: {e}")
                
                # B. Keyword Search (Lexical Recall) - if vector search returns few results
                if len(context_nodes) < 3:
                     keyword_query = """
                     MATCH (e:Entity)
                     WHERE (
                         ANY(keyword IN $keywords WHERE 
                             e.name CONTAINS keyword OR 
                             e.type CONTAINS keyword
                         )
                         OR e.name IN $keywords
                     )
                     RETURN e.id as id, e.name as name, e.type as type, 1.0 as score
                     LIMIT $limit
                     """
                     keyword_result = tx.run(keyword_query, keywords=keywords, limit=limit)
                     keyword_nodes = [record.data() for record in keyword_result]
                     context_nodes.extend(keyword_nodes)
                
                # Deduplicate nodes by ID
                seen_ids = set()
                unique_nodes = []
                for n in context_nodes:
                    if n['id'] not in seen_ids:
                        unique_nodes.append(n)
                        seen_ids.add(n['id'])
                
                # C. Graph Traversal (Context Expansion)
                # For each relevant node, find 1-hop related information
                expanded_context = []
                
                for node in unique_nodes[:limit]: # Process top nodes
                    node_id = node['id']
                    
                    # Find related entities (1-hop)
                    # We look for relationships from User to this node, OR this node to others
                    traversal_query = """
                    MATCH (e {id: $node_id})
                    // Incoming from User (Direct relevance)
                    OPTIONAL MATCH (u:User {id: $user_id})-[r1]->(e)
                    
                    // Outgoing to others (Context)
                    OPTIONAL MATCH (e)-[r2]->(related)
                    
                    RETURN 
                        e.name as entity_name, 
                        e.type as entity_type,
                        type(r1) as user_rel,
                        type(r2) as out_rel,
                        related.name as related_name,
                        related.type as related_type
                    LIMIT 5
                    """
                    t_result = tx.run(traversal_query, node_id=node_id, user_id=user_id)
                    
                    for rec in t_result:
                        e_name = rec['entity_name']
                        e_type = rec['entity_type']
                        user_rel = rec['user_rel']
                        out_rel = rec['out_rel']
                        rel_name = rec['related_name']
                        
                        if user_rel:
                            expanded_context.append(f"用户与 {e_type} '{e_name}' 的关系: {user_rel}")
                        if out_rel and rel_name:
                            expanded_context.append(f"{e_type} '{e_name}' {out_rel} {rel_name}")

                return list(set(expanded_context)) # Remove duplicates

            context_list = session.execute_read(read_tx)
            return "\n".join(context_list) if context_list else ""
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Simple keyword extraction (can be optimized with LLM)"""
        # Remove punctuation, tokenize
        words = re.findall(r'\w+', text.lower())
        # Filter stop words
        stop_words = {'的', '了', '是', '在', '我', '你', '他', '她', '它', '这', '那', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'must'}
        keywords = [w for w in words if w not in stop_words and len(w) > 1]
        return keywords[:5]  # Return top 5 keywords
    
    async def query_graph(
        self,
        user_id: str,
        entity_types: Optional[List[str]] = None,
        relation_types: Optional[List[str]] = None,
        depth: int = 2,
        limit: int = 100
    ) -> Dict[str, List]:
        """Query graph data (for visualization)"""
        if not self._initialized:
            return {"nodes": [], "links": []}
        
        with self.driver.session(database=self.database) as session:
            def read_tx(tx):
                nodes = []
                node_ids = set()
                links = []
                
                # Build entity type filter
                entity_type_filter = ""
                if entity_types:
                    entity_type_list = "', '".join(entity_types)
                    entity_type_filter = f"AND e.type IN ['{entity_type_list}']"
                
                # Query nodes (using dynamic label matching)
                node_query = f"""
                MATCH (u:User {{id: $user_id}})
                MATCH path = (u)-[*1..{depth}]-(e)
                WHERE e.id IS NOT NULL {entity_type_filter}
                WITH DISTINCT e
                LIMIT $limit
                RETURN e.id as id, 
                       labels(e) as labels,
                       COALESCE(e.name, '') as name, 
                       COALESCE(e.type, labels(e)[0], 'Entity') as type,
                       properties(e) as properties
                """
                
                node_result = tx.run(node_query, user_id=user_id, limit=limit)
                
                for record in node_result:
                    node_id = record['id']
                    if node_id and node_id not in node_ids:
                        node_labels = record['labels']
                        node_type = record.get('type') or (node_labels[0] if node_labels else 'Entity')
                        nodes.append({
                            "id": node_id,
                            "label": record.get('name') or node_id,
                            "type": node_type,
                            "properties": record.get('properties') or {}
                        })
                        node_ids.add(node_id)
                
                # Query relations (using RELATION type with type property)
                rel_type_filter = ""
                if relation_types:
                    rel_type_list = "', '".join(relation_types)
                    rel_type_filter = f"AND r.type IN ['{rel_type_list}']"
                
                rel_query = f"""
                MATCH (u:User {{id: $user_id}})
                MATCH path = (u)-[*1..{depth}]-(e)
                WHERE e.id IS NOT NULL
                UNWIND relationships(path) as r
                WITH r
                WHERE r IS NOT NULL AND type(r) = 'RELATION' {rel_type_filter}
                WITH DISTINCT startNode(r) as source, endNode(r) as target, r.type as rel_type
                WHERE source.id IS NOT NULL AND target.id IS NOT NULL
                LIMIT $limit
                RETURN source.id as source_id, 
                       target.id as target_id, 
                       rel_type as type
                """
                
                rel_result = tx.run(rel_query, user_id=user_id, limit=limit)
                
                for record in rel_result:
                    source_id = record['source_id']
                    target_id = record['target_id']
                    if source_id in node_ids and target_id in node_ids:
                        links.append({
                            "source": source_id,
                            "target": target_id,
                            "type": record['type']
                        })
                
                return {"nodes": nodes, "links": links}
            
            return session.execute_read(read_tx)
    
    async def get_node_details(self, node_id: str) -> Optional[Dict]:
        """Get node details"""
        if not self._initialized:
            return None
        
        with self.driver.session(database=self.database) as session:
            def read_tx(tx):
                result = tx.run("""
                    MATCH (n {id: $node_id})
                    OPTIONAL MATCH (n)<-[r1]-(source)
                    OPTIONAL MATCH (n)-[r2]->(target)
                    RETURN n, 
                           labels(n) as labels,
                           collect(DISTINCT {
                               source: source.id, 
                               source_name: source.name,
                               type: type(r1), 
                               properties: properties(r1)
                           }) as incoming,
                           collect(DISTINCT {
                               target: target.id,
                               target_name: target.name,
                               type: type(r2), 
                               properties: properties(r2)
                           }) as outgoing
                """, node_id=node_id)
                
                record = result.single()
                if not record:
                    return None
                
                node = record['n']
                labels = record['labels']
                node_type = node.get('type') or (labels[0] if labels else 'Entity')
                
                return {
                    "id": node['id'],
                    "type": node_type,
                    "name": node.get('name', ''),
                    "properties": dict(node),
                    "incoming_relations": [r for r in record['incoming'] if r.get('source')],
                    "outgoing_relations": [r for r in record['outgoing'] if r.get('target')]
                }
            
            return session.execute_read(read_tx)
    
    async def get_graph_stats(self, user_id: str) -> Dict[str, Any]:
        """Get graph statistics"""
        if not self._initialized:
            return {
                "total_nodes": 0,
                "total_relations": 0,
                "node_types": {},
                "relation_types": {}
            }
        
        with self.driver.session(database=self.database) as session:
            def read_tx(tx):
                # Node statistics (by label)
                node_stats_query = """
                MATCH (u:User {id: $user_id})
                MATCH (u)-[*]->(e)
                WHERE e.id IS NOT NULL
                UNWIND labels(e) as label
                RETURN label as type, count(DISTINCT e) as count
                """
                node_result = tx.run(node_stats_query, user_id=user_id)
                
                node_types = {}
                total_nodes = 0
                for record in node_result:
                    node_type = record['type']
                    count = record['count']
                    node_types[node_type] = count
                    total_nodes += count
                
                # Relation statistics
                rel_stats_query = """
                MATCH (u:User {id: $user_id})
                MATCH (u)-[*]->(e)
                WHERE e.id IS NOT NULL
                MATCH path = (u)-[*]-(e)
                UNWIND relationships(path) as r
                WITH r
                WHERE r IS NOT NULL
                RETURN type(r) as type, count(DISTINCT r) as count
                """
                rel_result = tx.run(rel_stats_query, user_id=user_id)
                
                relation_types = {}
                total_relations = 0
                for record in rel_result:
                    rel_type = record['type']
                    count = record['count']
                    relation_types[rel_type] = count
                    total_relations += count
                
                return {
                    "total_nodes": total_nodes,
                    "total_relations": total_relations,
                    "node_types": node_types,
                    "relation_types": relation_types
                }
            
            return session.execute_read(read_tx)
    
    def close(self):
        """Close connection"""
        if self.driver:
            self.driver.close()
            self._initialized = False
            logger.info("Neo4j connection closed")


# Global Memory Service instance
memory_service: Optional[MemoryService] = None


def get_memory_service() -> Optional[MemoryService]:
    """Get Memory Service instance (singleton)"""
    return memory_service


def initialize_memory_service():
    """Initialize Memory Service"""
    global memory_service
    
    if not settings.graph_memory_enabled:
        logger.info("Graph memory is disabled, skipping initialization")
        return None
    
    if not settings.neo4j_password:
        logger.warning("NEO4J_PASSWORD not configured, skipping memory service initialization")
        return None
    
    try:
        memory_service = MemoryService(
            uri=settings.neo4j_uri,
            user=settings.neo4j_user,
            password=settings.neo4j_password,
            database=settings.neo4j_database
        )
        memory_service.initialize()
        return memory_service
    except Exception as e:
        logger.error(f"Failed to initialize memory service: {str(e)}")
        return None

