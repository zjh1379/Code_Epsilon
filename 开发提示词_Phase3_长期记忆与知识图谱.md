# 异界声律·Epsilon - Phase 3 开发提示词：长期记忆与知识图谱

## 【项目概述】

**项目名称**: 异界声律·Epsilon - Phase 3

**当前状态**: 
Phase 2已完成，包括：
- ✅ LLM文本聊天（流式输出）
- ✅ GPT-SoVITS文本转语音集成（流式）
- ✅ 角色助手切换功能
- ✅ 对话历史管理（内存中）

**Phase 3 目标**:
1. **长期记忆系统**：引入Neo4j图数据库，实现GraphRAG记忆系统
2. **知识图谱构建**：实体抽取、关系抽取、图存储
3. **记忆检索与应用**：图查询、上下文拼接、对话中引用历史
4. **知识图谱可视化**：前端展示交互式知识图谱（类似Neo4j Browser）

**核心价值**:
- 让Epsilon真正"记住"用户的信息（项目、技能、偏好等）
- 对话中能够引用历史信息，体现"记忆"
- 构建用户的知识图谱（适合面试展示）
- 可视化展示知识图谱，直观了解用户的知识结构

**参考项目**:
- **NagaAgent**：Memory/GRAG独立模块设计、Neo4j集成、GraphRAG实现
- **ai_virtual_mate_web**：Web平台多模态集成思路

---

## 【技术架构】

### 整体架构

```
┌─────────────────────────────────────────────────┐
│         UI Layer (React)                       │
│  - ChatInterface                                │
│  - CharacterSwitcher                           │
│  - KnowledgeGraphViewer ⭐ 新增                 │
│    - 交互式图可视化                            │
│    - 节点和边的展示                            │
│    - 图探索和过滤                              │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/WebSocket
┌──────────────────▼──────────────────────────────┐
│      Service Layer (FastAPI)                    │
│  ┌──────────────────────────────────────────┐  │
│  │  API Endpoints                           │  │
│  │  - /api/chat (集成记忆检索)              │  │
│  │  - /api/memory ⭐ 新增                   │  │
│  │  - /api/graph ⭐ 新增                    │  │
│  └──────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│    Business Logic Layer                         │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ LLM Service  │  │ TTS Service  │            │
│  │ + Emotion    │  │ + Streaming  │            │
│  └──────┬───────┘  └──────────────┘            │
│         │                                       │
│  ┌──────▼──────────────────────────┐            │
│  │  Memory/GRAG Service ⭐ 新增   │            │
│  │  - write_memory()               │            │
│  │  - query_memory()               │            │
│  │  - query_graph()                │            │
│  │  - extract_entities()           │            │
│  │  - build_context()               │            │
│  └──────┬──────────────────────────┘            │
└─────────┼───────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────┐
│         Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Neo4j      │  │  SQLite      │            │
│  │  (Graph DB)  │  │  (对话历史)  │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐                              │
│  │   Memory      │                              │
│  │   (会话状态)  │                              │
│  └──────────────┘                              │
└─────────────────────────────────────────────────┘
```

### 数据流设计

#### 1. 记忆写入流程
```
对话完成 → LLM抽取实体和关系 → 写入Neo4j
→ 去重和合并 → 更新图结构
```

#### 2. 记忆检索流程
```
用户输入 → 提取关键词/话题 → 图查询相关实体
→ 构建上下文 → 拼接到System Prompt
→ LLM生成回复（引用历史信息）
```

#### 3. 知识图谱可视化流程
```
前端请求 → 后端查询Neo4j → 返回图数据
→ 前端渲染（使用图可视化库）
→ 交互式探索（点击节点、过滤、搜索）
```

---

## 【功能需求】

### 第一部分：Neo4j集成与Memory Service

#### 1.1 Neo4j配置和连接

**重要说明**：
- 本项目使用Neo4j Aura（云服务），连接URI格式为`neo4j+s://`（加密连接）
- 连接信息保存在`Neo4j-c9810bad-Created-2025-12-10.txt`文件中
- 需要等待60秒后连接，或登录https://console.neo4j.io验证Aura实例可用

**配置管理**：
```python
# backend/app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Graph Memory配置（借鉴NagaAgent）
    graph_memory_enabled: bool = False  # 默认关闭，可选启用
    
    # Neo4j Aura连接配置（从环境变量读取）
    neo4j_uri: str = "neo4j+s://c9810bad.databases.neo4j.io"  # Aura加密连接
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""  # 从环境变量读取，不要硬编码
    neo4j_database: str = "neo4j"  # 数据库名称
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```

**环境变量配置（.env文件）**：
```bash
# Neo4j Aura配置（从Neo4j-c9810bad-Created-2025-12-10.txt读取）
NEO4J_URI=neo4j+s://c9810bad.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=hbfLim4NAijBbiJoiOJk6NtBGjk7B8fVmAKveWfA1XY
NEO4J_DATABASE=neo4j
GRAPH_MEMORY_ENABLED=true
```

**连接管理**（使用Neo4j Python驱动最佳实践）：
```python
# backend/app/services/memory_service.py
from neo4j import GraphDatabase, AsyncGraphDatabase
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class MemoryService:
    """
    Memory/GRAG服务（借鉴NagaAgent设计）
    
    使用Neo4j Python驱动5.0+的最佳实践：
    - 使用execute_write/execute_read进行事务管理
    - 支持同步和异步操作
    - 正确处理连接池和会话管理
    """
    
    def __init__(self, uri: str, user: str, password: str, database: str = "neo4j"):
        self.uri = uri
        self.user = user
        self.password = password
        self.database = database
        self.driver: Optional[GraphDatabase] = None
        self._initialized = False
    
    def initialize(self):
        """初始化Neo4j连接（同步）"""
        if self._initialized:
            return
        
        try:
            # Neo4j Aura使用neo4j+s://（加密连接）
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_lifetime=30 * 60,  # 30分钟
                max_connection_pool_size=50,
                connection_acquisition_timeout=2 * 60  # 2分钟
            )
            
            # 测试连接
            with self.driver.session(database=self.database) as session:
                result = session.execute_read(lambda tx: tx.run("RETURN 1 AS test").single())
                if result["test"] != 1:
                    raise Exception("Connection test failed")
            
            self._initialized = True
            logger.info(f"Neo4j connected successfully: {self.uri}")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            raise
    
    def verify_connectivity(self) -> bool:
        """验证连接是否正常"""
        if not self.driver:
            return False
        try:
            with self.driver.session(database=self.database) as session:
                session.execute_read(lambda tx: tx.run("RETURN 1").single())
            return True
        except Exception:
            return False
    
    def close(self):
        """关闭连接"""
        if self.driver:
            self.driver.close()
            self._initialized = False
            logger.info("Neo4j connection closed")
```

#### 1.2 KG Schema设计（针对Epsilon场景）

**实体类型**：
```cypher
// 核心实体
(User)              // 用户
(Topic)             // 话题/领域（如"图像识别"、"Python"）
(Project)           // 项目
(Skill)             // 技能
(Resource)          // 资源（文档、课程、论文）
(Conversation)      // 对话会话
(Message)           // 单条消息（可选，用于详细追踪）

// 扩展实体（未来）
(Company)           // 公司
(Position)          // 岗位
(Event)             // 事件（如"面试"、"项目完成"）
(Emotion)           // 情感状态（结合D_sakiko的情感系统）
```

**关系类型**：
```cypher
// 用户相关关系
(User)-[:INTERESTED_IN {confidence: float, first_mentioned: datetime}]->(Topic)
(User)-[:WORKING_ON {role: string, start_date: datetime, status: string}]->(Project)
(User)-[:HAS_SKILL {level: string, proficiency: float}]->(Skill)
(User)-[:LEARNED_FROM {date: datetime}]->(Resource)
(User)-[:HAS_CONVERSATION {created_at: datetime}]->(Conversation)

// 项目相关关系
(Project)-[:USES {importance: string}]->(Skill)
(Project)-[:RELATED_TO]->(Topic)
(Project)-[:REFERS_TO]->(Resource)
(Project)-[:DEPENDS_ON]->(Project)  // 项目依赖

// 技能相关关系
(Skill)-[:RELATED_TO]->(Topic)
(Skill)-[:REQUIRES]->(Skill)  // 技能依赖

// 资源相关关系
(Resource)-[:TEACHES]->(Skill)
(Resource)-[:ABOUT]->(Topic)

// 对话相关关系
(Conversation)-[:CONTAINS]->(Message)
(Conversation)-[:MENTIONS]->(Topic)
(Conversation)-[:MENTIONS]->(Project)
(Conversation)-[:MENTIONS]->(Skill)

// Epsilon角色相关（体现角色设定）
(Epsilon)-[:KNOWS_ABOUT]->(User)
(Epsilon)-[:REMEMBERS]->(Conversation)
(Epsilon)-[:CARES_ABOUT]->(Topic)
```

#### 1.3 实体抽取实现

**LLM抽取策略**（借鉴NagaAgent思路）：
```python
async def extract_entities(
    self,
    conversation_text: str,
    user_id: str
) -> Tuple[List[dict], List[dict]]:
    """
    使用LLM抽取实体和关系
    
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

    返回格式：
    {{
        "entities": [
            {{"id": "topic_python", "type": "Topic", "name": "Python", "properties": {{}}}},
            {{"id": "project_epsilon", "type": "Project", "name": "异界声律·Epsilon", "properties": {{"status": "in_progress"}}}}
        ],
        "relations": [
            {{"source": "user_1", "target": "topic_python", "type": "INTERESTED_IN", "properties": {{"confidence": 0.8}}}},
            {{"source": "user_1", "target": "project_epsilon", "type": "WORKING_ON", "properties": {{"role": "developer"}}}}
        ]
    }}
    """
    
    # 调用LLM提取
    response = await self.llm_service.chat(extraction_prompt)
    
    # 解析JSON响应
    import json
    try:
        data = json.loads(response)
        entities = data.get("entities", [])
        relations = data.get("relations", [])
        return entities, relations
    except Exception as e:
        logger.error(f"Failed to parse extraction result: {str(e)}")
        return [], []
```

#### 1.4 记忆写入实现

```python
async def write_conversation(
    self,
    user_id: str,
    conversation_id: str,
    messages: List[Message],
    character_id: str = "epsilon"
):
    """
    写入对话记忆到Neo4j（借鉴NagaAgent设计）
    """
    # 1. 合并对话文本
    conversation_text = "\n".join([
        f"{msg.role}: {msg.content}" for msg in messages
    ])
    
    # 2. 抽取实体和关系
    entities, relations = await self.extract_entities(conversation_text, user_id)
    
    if not entities and not relations:
        logger.warning("No entities or relations extracted")
        return
    
    # 3. 写入Neo4j（使用execute_write进行事务管理）
    with self.driver.session(database=self.database) as session:
        def write_tx(tx):
            """事务函数：写入所有节点和关系"""
            now = datetime.now().isoformat()
            
            # 创建/更新用户节点
            tx.run("""
                MERGE (u:User {id: $user_id})
                SET u.last_active = $now,
                    u.updated_at = $now
                ON CREATE SET u.created_at = $now
            """, user_id=user_id, now=now)
            
            # 创建对话节点
            tx.run("""
                MATCH (u:User {id: $user_id})
                MERGE (c:Conversation {id: $conversation_id})
                SET c.created_at = $now,
                    c.message_count = $message_count,
                    c.character_id = $character_id,
                    c.updated_at = $now
                ON CREATE SET c.created_at = $now
                MERGE (u)-[:HAS_CONVERSATION {created_at: $now}]->(c)
            """, 
                conversation_id=conversation_id,
                message_count=len(messages),
                user_id=user_id,
                character_id=character_id,
                now=now
            )
            
            # 创建实体节点（去重，使用Entity类型+id作为唯一标识）
            for entity in entities:
                entity_id = entity.get('id')
                entity_type = entity.get('type', 'Entity')
                entity_name = entity.get('name', '')
                entity_props = entity.get('properties', {})
                
                # 使用动态标签创建节点（如:Topic, :Project等）
                # 注意：Neo4j Aura可能不支持APOC，使用纯Cypher实现
                if entity_props:
                    # 构建属性设置语句
                    props_set = ', '.join([f"e.{k} = ${k}" for k in entity_props.keys()])
                    params = {
                        'id': entity_id,
                        'name': entity_name,
                        'type': entity_type,
                        'now': now,
                        **entity_props
                    }
                    tx.run(f"""
                        MERGE (e:{entity_type} {{id: $id}})
                        SET e.name = $name,
                            e.type = $type,
                            e.updated_at = $now,
                            {props_set}
                        ON CREATE SET e.created_at = $now
                    """, **params)
                else:
                    tx.run(f"""
                        MERGE (e:{entity_type} {{id: $id}})
                        SET e.name = $name,
                            e.type = $type,
                            e.updated_at = $now
                        ON CREATE SET e.created_at = $now
                    """, 
                        id=entity_id,
                        name=entity_name,
                        type=entity_type,
                        now=now
                    )
            
            # 创建关系（去重和合并）
            for relation in relations:
                source_id = relation.get('source_id') or relation.get('source')
                target_id = relation.get('target_id') or relation.get('target')
                rel_type = relation.get('type', 'RELATED_TO')
                rel_props = relation.get('properties', {})
                
                # 动态查找源节点和目标节点的类型
                tx.run("""
                    MATCH (a {id: $source_id})
                    MATCH (b {id: $target_id})
                    MERGE (a)-[r:RELATION {type: $rel_type}]->(b)
                    SET r.updated_at = $now,
                        r.type = $rel_type
                    ON CREATE SET r.created_at = $now,
                        r.count = 1
                    ON MATCH SET r.count = COALESCE(r.count, 0) + 1
                """, 
                    source_id=source_id,
                    target_id=target_id,
                    rel_type=rel_type,
                    now=now
                )
                
                # 设置关系属性
                if rel_props:
                    props_str = ', '.join([f"r.{k} = ${k}" for k in rel_props.keys()])
                    params = {
                        'source_id': source_id,
                        'target_id': target_id,
                        'rel_type': rel_type,
                        'now': now,
                        **rel_props
                    }
                    tx.run(f"""
                        MATCH (a {{id: $source_id}})-[r:RELATION {{type: $rel_type}}]->(b {{id: $target_id}})
                        SET {props_str}, r.updated_at = $now
                    """, **params)
                
                # 创建用户-实体关系（如果源是用户）
                if source_id == user_id:
                    tx.run("""
                        MATCH (u:User {id: $user_id})
                        MATCH (e {id: $target_id})
                        MERGE (u)-[r:RELATION {type: $rel_type}]->(e)
                        SET r.updated_at = $now
                        ON CREATE SET r.created_at = $now
                    """, 
                        user_id=user_id,
                        target_id=target_id,
                        rel_type=rel_type,
                        now=now
                    )
            
            return len(entities), len(relations)
        
        # 执行事务
        entities_count, relations_count = session.execute_write(write_tx)
        logger.info(f"Written {entities_count} entities and {relations_count} relations to Neo4j")
```

#### 1.5 记忆检索实现

```python
async def query_related_context(
    self,
    user_id: str,
    query_text: str,
    limit: int = 10
) -> str:
    """
    查询相关上下文（GraphRAG实现）
    """
    # 1. 提取查询关键词（简单实现，可以用LLM提取）
    keywords = self._extract_keywords(query_text)
    
    # 2. 图查询相关实体（使用execute_read进行事务管理）
    with self.driver.session(database=self.database) as session:
        def read_tx(tx):
            # 查询用户相关的实体（使用动态关系类型匹配）
            query = """
            MATCH (u:User {id: $user_id})
            MATCH (u)-[r1]->(e)
            WHERE type(r1) IN ['INTERESTED_IN', 'WORKING_ON', 'HAS_SKILL', 'LEARNED_FROM']
            AND (
                ANY(keyword IN $keywords WHERE 
                    e.name CONTAINS keyword OR 
                    e.type CONTAINS keyword
                )
                OR e.name IN $keywords
            )
            RETURN DISTINCT e.id as id, 
                   e.type as type, 
                   e.name as name, 
                   properties(e) as properties, 
                   type(r1) as relation_type,
                   e.updated_at as updated_at
            ORDER BY e.updated_at DESC
            LIMIT $limit
            """
            result = tx.run(query, user_id=user_id, keywords=keywords, limit=limit)
            return [record.data() for record in result]
        
        records = session.execute_read(read_tx)
        
        context_parts = []
        for record in result:
            entity_type = record['e.type']
            entity_name = record['e.name']
            relation_type = record['relation_type']
            context_parts.append(f"{entity_type} '{entity_name}' (关系: {relation_type})")
        
        # 3. 查询相关项目及其技能
        result = session.run("""
            MATCH (u:User {id: $user_id})-[:WORKING_ON]->(p:Project)
            MATCH (p)-[:USES]->(s:Skill)
            RETURN p.name as project_name, collect(s.name) as skills
            LIMIT 5
        """, user_id=user_id)
        
        for record in result:
            project_name = record['project_name']
            skills = record['skills']
            context_parts.append(f"项目 '{project_name}' 使用技能: {', '.join(skills)}")
        
        return "\n".join(context_parts) if context_parts else ""
    
    def _extract_keywords(self, text: str) -> List[str]:
        """简单关键词提取（可以用LLM优化）"""
        # 移除标点，分词
        import re
        words = re.findall(r'\w+', text.lower())
        # 过滤停用词
        stop_words = {'的', '了', '是', '在', '我', '你', '他', '她', '它', '这', '那'}
        keywords = [w for w in words if w not in stop_words and len(w) > 1]
        return keywords[:5]  # 返回前5个关键词
```

---

### 第二部分：知识图谱可视化

#### 2.1 可视化需求

**核心功能**：
- 交互式图可视化（类似Neo4j Browser）
- 节点和边的展示
- 节点点击查看详情
- 图的缩放、平移、拖拽
- 节点过滤和搜索
- 关系类型过滤
- 实体类型过滤

**技术要求**：
- 使用成熟的图可视化库（如react-force-graph、vis-network、cytoscape.js）
- 支持大量节点和边（性能优化）
- 响应式设计

#### 2.2 图可视化库选型

**方案A：react-force-graph（推荐）**
- ✅ 基于D3.js，性能好
- ✅ 支持力导向布局
- ✅ 交互丰富
- ✅ 支持3D可视化（可选）

**方案B：vis-network**
- ✅ 功能完整
- ✅ 文档完善
- ✅ 支持多种布局算法

**方案C：cytoscape.js**
- ✅ 功能强大
- ✅ 支持复杂图操作
- ⚠️ 学习曲线较陡

**推荐**：react-force-graph（简单、性能好、交互丰富）

#### 2.3 前端组件设计

**组件结构**：
```
KnowledgeGraphViewer/
├── GraphCanvas.tsx        # 主图渲染组件
├── NodeDetailPanel.tsx    # 节点详情面板
├── GraphControls.tsx      # 控制面板（过滤、搜索）
└── GraphLegend.tsx       # 图例（实体类型、关系类型）
```

**数据流**：
```
后端API (/api/graph/query) 
→ 返回图数据（节点+边）
→ 前端格式化（适配可视化库）
→ 渲染和交互
```

---

## 【API集成】

### 后端API接口

#### 1. POST /api/memory/write
**功能**: 写入对话记忆

**请求体**:
```json
{
  "conversation_id": "conv_123",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "character_id": "epsilon"
}
```

**响应**:
```json
{
  "success": true,
  "entities_count": 5,
  "relations_count": 8
}
```

#### 2. GET /api/memory/context
**功能**: 查询相关上下文

**查询参数**:
- `query`: 查询文本
- `limit`: 返回数量（默认10）

**响应**:
```json
{
  "context": "Topic 'Python' (关系: INTERESTED_IN)\nProject 'Epsilon' 使用技能: FastAPI, React",
  "entities": [
    {
      "id": "topic_python",
      "type": "Topic",
      "name": "Python",
      "properties": {}
    }
  ]
}
```

#### 3. GET /api/graph/query
**功能**: 查询图数据（用于可视化）

**查询参数**:
- `user_id`: 用户ID（可选，默认当前用户）
- `entity_types`: 实体类型过滤（可选，如"Topic,Project,Skill"）
- `relation_types`: 关系类型过滤（可选）
- `depth`: 查询深度（默认2）
- `limit`: 节点数量限制（默认100）

**响应**:
```json
{
  "nodes": [
    {
      "id": "user_1",
      "label": "用户",
      "type": "User",
      "properties": {
        "created_at": "2025-01-XX"
      }
    },
    {
      "id": "topic_python",
      "label": "Python",
      "type": "Topic",
      "properties": {
        "category": "programming_language"
      }
    }
  ],
  "links": [
    {
      "source": "user_1",
      "target": "topic_python",
      "type": "INTERESTED_IN",
      "properties": {
        "confidence": 0.8
      }
    }
  ]
}
```

#### 4. GET /api/graph/stats
**功能**: 获取图统计信息

**响应**:
```json
{
  "total_nodes": 150,
  "total_relations": 300,
  "node_types": {
    "User": 1,
    "Topic": 50,
    "Project": 10,
    "Skill": 30,
    "Resource": 20
  },
  "relation_types": {
    "INTERESTED_IN": 50,
    "WORKING_ON": 10,
    "HAS_SKILL": 30
  }
}
```

#### 5. GET /api/graph/node/{node_id}
**功能**: 获取节点详情

**响应**:
```json
{
  "id": "topic_python",
  "type": "Topic",
  "name": "Python",
  "properties": {
    "category": "programming_language",
    "description": "Python编程语言"
  },
  "incoming_relations": [
    {
      "source": "user_1",
      "type": "INTERESTED_IN",
      "properties": {}
    }
  ],
  "outgoing_relations": [
    {
      "target": "skill_fastapi",
      "type": "RELATED_TO",
      "properties": {}
    }
  ]
}
```

---

## 【开发任务】

### 分阶段开发计划

#### 阶段1: Neo4j集成和Memory Service（1周）

**步骤1.1: Neo4j环境搭建**
- [ ] 确认Neo4j Aura实例可用（登录https://console.neo4j.io验证）
- [ ] 从`Neo4j-c9810bad-Created-2025-12-10.txt`读取连接信息
- [ ] 配置环境变量（.env文件）
- [ ] 测试连接和基本操作

**步骤1.2: Memory Service实现**
- [ ] 创建`MemoryService`类（`backend/app/services/memory_service.py`）
- [ ] 实现Neo4j连接管理
- [ ] 实现基础的节点/关系CRUD操作
- [ ] 实现实体抽取方法（LLM提取）
- [ ] 实现记忆写入方法
- [ ] 实现记忆检索方法

**步骤1.3: 配置管理**
- [ ] 在`config.py`中添加Neo4j配置
- [ ] 支持可选启用（graph_memory_enabled）
- [ ] 环境变量配置

**步骤1.4: 测试**
- [ ] 单元测试Memory Service
- [ ] 集成测试Neo4j操作
- [ ] 测试实体抽取准确性

#### 阶段2: 记忆系统集成到对话流程（1周）

**步骤2.1: 对话API集成**
- [ ] 修改`/api/chat`端点，集成记忆检索
- [ ] 在对话前查询相关上下文
- [ ] 将上下文拼接到System Prompt
- [ ] 对话结束后写入记忆

**步骤2.2: LLM Service扩展**
- [ ] 修改`LLMService`，支持上下文注入
- [ ] 实现上下文构建逻辑
- [ ] 优化System Prompt构建

**步骤2.3: 实体抽取优化**
- [ ] 优化抽取Prompt
- [ ] 实现抽取结果验证
- [ ] 处理抽取错误和异常

**步骤2.4: 测试**
- [ ] 测试记忆检索和上下文拼接
- [ ] 测试记忆写入
- [ ] 验证对话中是否引用历史信息

#### 阶段3: 知识图谱可视化（1-2周）

**步骤3.1: 后端图查询API**
- [ ] 实现`/api/graph/query`端点
- [ ] 实现`/api/graph/stats`端点
- [ ] 实现`/api/graph/node/{node_id}`端点
- [ ] 优化查询性能（索引、缓存）

**步骤3.2: 前端可视化组件**
- [ ] 安装图可视化库（react-force-graph）
- [ ] 创建`KnowledgeGraphViewer`组件
- [ ] 实现图渲染（节点和边）
- [ ] 实现交互功能（缩放、平移、拖拽）

**步骤3.3: 控制面板**
- [ ] 创建`GraphControls`组件
- [ ] 实现节点搜索
- [ ] 实现实体类型过滤
- [ ] 实现关系类型过滤
- [ ] 实现图例显示

**步骤3.4: 节点详情面板**
- [ ] 创建`NodeDetailPanel`组件
- [ ] 显示节点详细信息
- [ ] 显示节点的关系
- [ ] 支持节点编辑（可选）

**步骤3.5: 集成到主界面**
- [ ] 在配置面板添加"知识图谱"标签页
- [ ] 或创建独立的知识图谱页面
- [ ] 实现路由和导航

**步骤3.6: 测试和优化**
- [ ] 测试大量节点的性能
- [ ] 优化渲染性能
- [ ] 测试交互功能
- [ ] 响应式布局优化

---

### 代码结构变更

#### 新增文件
```
backend/
├── app/
│   ├── services/
│   │   └── memory_service.py      # Memory/GRAG服务
│   ├── api/
│   │   └── memory.py              # 记忆API端点
│   │   └── graph.py               # 图查询API端点
│   └── models/
│       └── memory.py               # 记忆数据模型

frontend/
├── src/
│   ├── components/
│   │   └── KnowledgeGraphViewer/  # 知识图谱可视化组件
│   │       ├── GraphCanvas.tsx
│   │       ├── NodeDetailPanel.tsx
│   │       ├── GraphControls.tsx
│   │       └── GraphLegend.tsx
│   ├── services/
│   │   └── graph.ts               # 图查询API调用
│   └── types/
│       └── graph.ts               # 图数据类型定义
```

#### 修改文件
```
backend/
├── app/
│   ├── services/
│   │   └── llm_service.py        # 添加上下文注入支持
│   ├── api/
│   │   └── chat.py               # 集成记忆检索和写入
│   └── config.py                 # 添加Neo4j配置

frontend/
├── src/
│   ├── components/
│   │   └── ConfigPanel.tsx      # 添加知识图谱标签页
│   └── services/
│       └── api.ts               # 添加图查询API调用
```

---

## 【关键实现点】

### 1. Memory Service完整实现

```python
# backend/app/services/memory_service.py
from neo4j import GraphDatabase
from typing import List, Tuple, Optional, Dict, Any
import logging
from app.models.chat import Message

logger = logging.getLogger(__name__)

class MemoryService:
    """Memory/GRAG服务（借鉴NagaAgent设计）"""
    
    def __init__(self, uri: str, user: str, password: str, database: str = "neo4j"):
        self.uri = uri
        self.user = user
        self.password = password
        self.database = database
        self.driver = None
        self._initialized = False
    
    def initialize(self):
        """初始化Neo4j连接"""
        if self._initialized:
            return
        
        try:
            self.driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password)
            )
            # 测试连接
            with self.driver.session(database=self.database) as session:
                session.run("RETURN 1")
            self._initialized = True
            logger.info(f"Neo4j connected: {self.uri}")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            raise
    
    async def write_conversation(
        self,
        user_id: str,
        conversation_id: str,
        messages: List[Message],
        character_id: str = "epsilon"
    ) -> Dict[str, int]:
        """写入对话记忆"""
        # 实现见上方1.4节
        pass
    
    async def query_related_context(
        self,
        user_id: str,
        query_text: str,
        limit: int = 10
    ) -> str:
        """查询相关上下文"""
        # 实现见上方1.5节
        pass
    
    async def extract_entities(
        self,
        conversation_text: str,
        user_id: str
    ) -> Tuple[List[dict], List[dict]]:
        """抽取实体和关系"""
        # 实现见上方1.3节
        pass
    
    async def query_graph(
        self,
        user_id: str,
        entity_types: Optional[List[str]] = None,
        relation_types: Optional[List[str]] = None,
        depth: int = 2,
        limit: int = 100
    ) -> Dict[str, List]:
        """查询图数据（用于可视化）"""
        with self.driver.session(database=self.database) as session:
            def read_tx(tx):
                nodes = []
                node_ids = set()
                links = []
                
                # 构建实体类型过滤
                entity_type_filter = ""
                if entity_types:
                    entity_type_list = "', '".join(entity_types)
                    entity_type_filter = f"AND e.type IN ['{entity_type_list}']"
                
                # 查询节点（使用动态标签匹配）
                node_query = f"""
                MATCH (u:User {{id: $user_id}})
                MATCH path = (u)-[*1..{depth}]-(e)
                WHERE e.id IS NOT NULL {entity_type_filter}
                WITH DISTINCT e
                LIMIT $limit
                RETURN e.id as id, 
                       labels(e) as labels,
                       e.name as name, 
                       e.type as type,
                       properties(e) as properties
                """
                
                node_result = tx.run(node_query, user_id=user_id, limit=limit)
                
                for record in node_result:
                    node_id = record['id']
                    if node_id and node_id not in node_ids:
                        node_labels = record['labels']
                        node_type = record['type'] or (node_labels[0] if node_labels else 'Entity')
                        nodes.append({
                            "id": node_id,
                            "label": record['name'] or node_id,
                            "type": node_type,
                            "properties": record['properties'] or {}
                        })
                        node_ids.add(node_id)
                
                # 查询关系
                rel_type_filter = ""
                if relation_types:
                    rel_type_list = "', '".join(relation_types)
                    rel_type_filter = f"AND type(r) IN ['{rel_type_list}']"
                
                rel_query = f"""
                MATCH (u:User {{id: $user_id}})
                MATCH path = (u)-[*1..{depth}]-(e)
                WHERE e.id IS NOT NULL
                UNWIND relationships(path) as r
                WHERE r IS NOT NULL {rel_type_filter}
                WITH DISTINCT startNode(r) as source, endNode(r) as target, type(r) as rel_type
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
        """获取节点详情"""
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
                    "properties": dict(properties(node)),
                    "incoming_relations": [r for r in record['incoming'] if r['source']],
                    "outgoing_relations": [r for r in record['outgoing'] if r['target']]
                }
            
            return session.execute_read(read_tx)
    
    async def get_graph_stats(self, user_id: str) -> Dict[str, Any]:
        """获取图统计信息"""
        with self.driver.session(database=self.database) as session:
            def read_tx(tx):
                # 节点统计（按标签统计）
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
                
                # 关系统计
                rel_stats_query = """
                MATCH (u:User {id: $user_id})
                MATCH (u)-[*]->(e)
                WHERE e.id IS NOT NULL
                MATCH path = (u)-[*]-(e)
                UNWIND relationships(path) as r
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
        """关闭连接"""
        if self.driver:
            self.driver.close()
            self._initialized = False

# 全局Memory Service实例
memory_service = None

def get_memory_service() -> Optional[MemoryService]:
    """获取Memory Service实例（单例）"""
    global memory_service
    return memory_service

def initialize_memory_service(uri: str, user: str, password: str, database: str = "neo4j"):
    """初始化Memory Service"""
    global memory_service
    memory_service = MemoryService(uri, user, password, database)
    memory_service.initialize()
    return memory_service
```

### 2. 知识图谱可视化组件实现

```typescript
// frontend/src/components/KnowledgeGraphViewer/GraphCanvas.tsx
import React, { useRef, useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { GraphData, GraphNode, GraphLink } from '../../types/graph'

interface GraphCanvasProps {
  data: GraphData
  onNodeClick?: (node: GraphNode) => void
}

export default function GraphCanvas({ data, onNodeClick }: GraphCanvasProps) {
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null)
  
  // 节点颜色映射
  const getNodeColor = (node: GraphNode) => {
    const colorMap: Record<string, string> = {
      User: '#FF6B6B',
      Topic: '#4ECDC4',
      Project: '#45B7D1',
      Skill: '#96CEB4',
      Resource: '#FFEAA7',
      Conversation: '#DDA0DD',
      Entity: '#95A5A6'
    }
    return colorMap[node.type] || '#95A5A6'
  }
  
  // 关系颜色映射
  const getLinkColor = (link: GraphLink) => {
    return '#999'
  }
  
  return (
    <div className="w-full h-full border border-gray-300 rounded-lg">
      <ForceGraph2D
        graphData={data}
        nodeLabel={(node: GraphNode) => `${node.type}: ${node.label}`}
        nodeColor={(node: GraphNode) => getNodeColor(node)}
        nodeVal={(node: GraphNode) => {
          // 节点大小根据连接数
          const links = data.links.filter(
            l => l.source === node.id || l.target === node.id
          )
          return Math.sqrt(links.length) * 4 + 5
        }}
        linkColor={(link: GraphLink) => getLinkColor(link)}
        linkWidth={1}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(node: GraphNode) => {
          setHighlightedNode(node.id)
          onNodeClick?.(node)
        }}
        onNodeHover={(node: GraphNode | null) => {
          setHighlightedNode(node?.id || null)
        }}
        nodeCanvasObjectMode={() => 'after'}
        nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D) => {
          // 高亮节点
          if (node.id === highlightedNode) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
            ctx.beginPath()
            ctx.arc(node.x!, node.y!, 20, 0, 2 * Math.PI)
            ctx.fill()
          }
        }}
        cooldownTicks={100}
        onEngineStop={() => {
          // 图布局完成后
        }}
      />
    </div>
  )
}
```

```typescript
// frontend/src/components/KnowledgeGraphViewer/GraphControls.tsx
import React, { useState } from 'react'

interface GraphControlsProps {
  onSearch: (query: string) => void
  onFilterEntityTypes: (types: string[]) => void
  onFilterRelationTypes: (types: string[]) => void
  entityTypes: string[]
  relationTypes: string[]
}

export default function GraphControls({
  onSearch,
  onFilterEntityTypes,
  onFilterRelationTypes,
  entityTypes,
  relationTypes
}: GraphControlsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([])
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([])
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }
  
  const handleEntityTypeToggle = (type: string) => {
    const newSelected = selectedEntityTypes.includes(type)
      ? selectedEntityTypes.filter(t => t !== type)
      : [...selectedEntityTypes, type]
    setSelectedEntityTypes(newSelected)
    onFilterEntityTypes(newSelected)
  }
  
  return (
    <div className="bg-white p-4 border-b border-gray-200 space-y-4">
      {/* 搜索 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索节点..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          搜索
        </button>
      </form>
      
      {/* 实体类型过滤 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          实体类型过滤
        </label>
        <div className="flex flex-wrap gap-2">
          {entityTypes.map(type => (
            <label key={type} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedEntityTypes.includes(type)}
                onChange={() => handleEntityTypeToggle(type)}
                className="mr-1"
              />
              <span className="text-sm text-gray-700">{type}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* 关系类型过滤 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          关系类型过滤
        </label>
        <div className="flex flex-wrap gap-2">
          {relationTypes.map(type => (
            <label key={type} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedRelationTypes.includes(type)}
                onChange={(e) => {
                  const newSelected = e.target.checked
                    ? [...selectedRelationTypes, type]
                    : selectedRelationTypes.filter(t => t !== type)
                  setSelectedRelationTypes(newSelected)
                  onFilterRelationTypes(newSelected)
                }}
                className="mr-1"
              />
              <span className="text-sm text-gray-700">{type}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
```

```typescript
// frontend/src/components/KnowledgeGraphViewer/KnowledgeGraphViewer.tsx
import React, { useState, useEffect } from 'react'
import GraphCanvas from './GraphCanvas'
import GraphControls from './GraphControls'
import NodeDetailPanel from './NodeDetailPanel'
import GraphLegend from './GraphLegend'
import { fetchGraphData, fetchGraphStats, fetchNodeDetails } from '../../services/graph'
import type { GraphData, GraphNode } from '../../types/graph'

export default function KnowledgeGraphViewer() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    loadGraphData()
    loadStats()
  }, [])
  
  const loadGraphData = async () => {
    try {
      setLoading(true)
      const data = await fetchGraphData()
      setGraphData(data)
    } catch (error) {
      console.error('Failed to load graph data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadStats = async () => {
    try {
      const statsData = await fetchGraphStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }
  
  const handleNodeClick = async (node: GraphNode) => {
    try {
      const details = await fetchNodeDetails(node.id)
      setSelectedNode(details)
    } catch (error) {
      console.error('Failed to load node details:', error)
    }
  }
  
  const handleSearch = async (query: string) => {
    // 实现搜索逻辑
    // 可以高亮匹配的节点
  }
  
  const handleFilterEntityTypes = async (types: string[]) => {
    // 重新加载图数据，应用过滤
    const data = await fetchGraphData({ entity_types: types })
    setGraphData(data)
  }
  
  if (loading) {
    return <div className="flex items-center justify-center h-96">加载中...</div>
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* 控制面板 */}
      <GraphControls
        onSearch={handleSearch}
        onFilterEntityTypes={handleFilterEntityTypes}
        onFilterRelationTypes={() => {}}
        entityTypes={stats?.node_types ? Object.keys(stats.node_types) : []}
        relationTypes={stats?.relation_types ? Object.keys(stats.relation_types) : []}
      />
      
      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 图可视化 */}
        <div className="flex-1 relative">
          <GraphCanvas
            data={graphData}
            onNodeClick={handleNodeClick}
          />
          {/* 图例 */}
          <div className="absolute top-4 right-4">
            <GraphLegend />
          </div>
        </div>
        
        {/* 节点详情面板 */}
        {selectedNode && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

### 3. 图查询API实现

```python
# backend/app/api/graph.py
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.services.memory_service import get_memory_service
from app.models.memory import GraphQueryRequest, GraphQueryResponse

router = APIRouter()

@router.get("/graph/query")
async def query_graph(
    user_id: str = Query(..., description="用户ID"),
    entity_types: Optional[str] = Query(None, description="实体类型过滤，逗号分隔"),
    relation_types: Optional[str] = Query(None, description="关系类型过滤，逗号分隔"),
    depth: int = Query(2, description="查询深度"),
    limit: int = Query(100, description="节点数量限制")
):
    """查询图数据（用于可视化）"""
    memory_service = get_memory_service()
    if not memory_service:
        raise HTTPException(status_code=503, detail="Memory service not initialized")
    
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
        return GraphQueryResponse(**graph_data)
    except Exception as e:
        logger.error(f"Graph query error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Graph query failed: {str(e)}")

@router.get("/graph/stats")
async def get_graph_stats(user_id: str = Query(...)):
    """获取图统计信息"""
    memory_service = get_memory_service()
    if not memory_service:
        raise HTTPException(status_code=503, detail="Memory service not initialized")
    
    try:
        stats = await memory_service.get_graph_stats(user_id)
        return stats
    except Exception as e:
        logger.error(f"Graph stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@router.get("/graph/node/{node_id}")
async def get_node_details(node_id: str):
    """获取节点详情"""
    memory_service = get_memory_service()
    if not memory_service:
        raise HTTPException(status_code=503, detail="Memory service not initialized")
    
    try:
        details = await memory_service.get_node_details(node_id)
        if not details:
            raise HTTPException(status_code=404, detail="Node not found")
        return details
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Node details error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get node details: {str(e)}")
```

---

## 【验收标准】

### 功能验收

#### Memory Service
- [ ] Neo4j连接正常
- [ ] 实体抽取准确（LLM提取）
- [ ] 记忆写入成功（去重、合并）
- [ ] 记忆检索返回相关上下文
- [ ] 图查询返回正确的节点和边

#### 对话集成
- [ ] 对话前自动检索相关记忆
- [ ] 上下文正确拼接到System Prompt
- [ ] LLM回复中引用历史信息
- [ ] 对话结束后自动写入记忆

#### 知识图谱可视化
- [ ] 图正确渲染（节点和边）
- [ ] 节点点击显示详情
- [ ] 搜索功能正常
- [ ] 过滤功能正常（实体类型、关系类型）
- [ ] 图的交互正常（缩放、平移、拖拽）
- [ ] 性能良好（100+节点流畅）

### 技术验收

- [ ] Neo4j配置正确
- [ ] Memory Service接口完整
- [ ] API端点正常工作
- [ ] 前端组件功能完整
- [ ] 错误处理完善
- [ ] 性能优化到位

---

## 【技术难点和注意事项】

### 1. Neo4j部署和配置

**重要：本项目使用Neo4j Aura（云服务）**

**Aura连接信息**（从`Neo4j-c9810bad-Created-2025-12-10.txt`读取）：
- URI: `neo4j+s://c9810bad.databases.neo4j.io`（加密连接，`neo4j+s://`表示SSL加密）
- Username: `neo4j`
- Password: `hbfLim4NAijBbiJoiOJk6NtBGjk7B8fVmAKveWfA1XY`
- Database: `neo4j`
- 控制台: https://console.neo4j.io

**注意事项**：
- Aura实例创建后需要等待60秒才能连接
- 使用`neo4j+s://`协议（不是`neo4j://`），表示加密连接
- 密码不要硬编码，使用环境变量
- Aura是托管服务，无需本地部署

**本地开发（可选，如果需要本地Neo4j）**：
```bash
# Docker部署本地Neo4j（仅用于开发测试）
docker run -d \
  --name neo4j-local \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -v neo4j_data:/data \
  neo4j:latest
```
- 本地Neo4j使用`neo4j://127.0.0.1:7687`（非加密）
- 默认端口：7474（HTTP Browser），7687（Bolt协议）

### 2. 实体抽取准确性

**优化策略**：
- 使用结构化的抽取Prompt
- 要求LLM返回JSON格式
- 实现抽取结果验证
- 支持人工审核和纠错

### 2.1 Python依赖安装

**必需依赖**：
```bash
# backend/requirements.txt 或 pyproject.toml
neo4j>=5.0.0  # Neo4j Python驱动（官方驱动，支持同步和异步）
```

**安装命令**：
```bash
pip install neo4j>=5.0.0
```

### 2.2 Neo4j索引创建（性能优化）

**重要**：为常用查询字段创建索引，提升查询性能

**索引创建脚本**（在Neo4j Browser中执行）：
```cypher
// 为用户ID创建索引
CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id);

// 为实体ID创建索引
CREATE INDEX entity_id_index IF NOT EXISTS FOR (e) ON (e.id);

// 为实体类型创建索引
CREATE INDEX entity_type_index IF NOT EXISTS FOR (e) ON (e.type);

// 为实体名称创建全文索引（用于搜索）
CREATE FULLTEXT INDEX entity_name_index IF NOT EXISTS FOR (e) ON EACH [e.name];

// 为关系类型创建索引
CREATE INDEX relation_type_index IF NOT EXISTS FOR ()-[r:RELATION]-() ON (r.type);
```

**在Memory Service初始化时创建索引**（可选）：
```python
def create_indexes(self):
    """创建必要的索引（仅在首次运行时执行）"""
    with self.driver.session(database=self.database) as session:
        def write_tx(tx):
            # 创建索引（如果不存在）
            indexes = [
                "CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id)",
                "CREATE INDEX entity_id_index IF NOT EXISTS FOR (e) ON (e.id)",
                "CREATE INDEX entity_type_index IF NOT EXISTS FOR (e) ON (e.type)",
            ]
            for index_query in indexes:
                try:
                    tx.run(index_query)
                except Exception as e:
                    logger.warning(f"Index creation warning: {str(e)}")
        
        session.execute_write(write_tx)
        logger.info("Neo4j indexes created/verified")
```

### 3. 图查询性能

**优化策略**：
- 创建索引（节点ID、类型等）
- 限制查询深度和节点数量
- 使用查询缓存
- 异步查询，不阻塞主流程

### 4. 前端可视化性能

**优化策略**：
- 限制初始加载的节点数量
- 使用虚拟化（只渲染可见节点）
- 延迟加载（按需加载更多节点）
- Web Workers处理大量数据

---

## 【参考资源】

- Neo4j官方文档：https://neo4j.com/docs/
- Cypher查询语言：https://neo4j.com/developer/cypher/
- react-force-graph文档：https://github.com/vasturiano/react-force-graph
- NagaAgent项目：https://github.com/Xxiii8322766509/NagaAgent.git

---

---

## 【重要更新说明】

### 基于Neo4j官方文档的修正

1. **Neo4j Aura连接**：
   - 使用`neo4j+s://`协议（加密连接），不是`neo4j://`
   - 连接信息从`Neo4j-c9810bad-Created-2025-12-10.txt`读取
   - 需要等待60秒后连接，或登录https://console.neo4j.io验证

2. **Python驱动最佳实践**：
   - 使用`execute_write()`和`execute_read()`进行事务管理（推荐）
   - 不再使用`session.run()`（旧方式）
   - 正确管理连接池和会话生命周期

3. **Cypher查询修正**：
   - 使用`datetime()`函数需要导入，或使用ISO格式字符串
   - 关系类型匹配使用`type(r) IN [...]`而不是动态关系模式
   - 节点标签使用动态标签（如`:Topic`, `:Project`）

4. **避免APOC依赖**：
   - Neo4j Aura可能不支持APOC插件
   - 使用纯Cypher实现所有功能
   - 手动设置属性而不是使用`apoc.create.setProperties`

5. **索引优化**：
   - 为常用查询字段创建索引
   - 使用`CREATE INDEX IF NOT EXISTS`避免重复创建
   - 全文索引用于节点名称搜索

---

**提示词生成时间**: 2025-01-XX
**版本**: Phase 3 v1.1
**基于**: Neo4j官方文档 + NagaAgent架构 + Epsilon项目现状
**Neo4j连接**: Neo4j Aura (neo4j+s://c9810bad.databases.neo4j.io)

