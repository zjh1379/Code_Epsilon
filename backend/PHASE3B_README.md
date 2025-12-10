# Phase 3B: 长期记忆与知识图谱 - 阶段1完成说明

## 已完成功能

### 1. Neo4j集成和Memory Service

**新增文件**:
- `backend/app/services/memory_service.py` - Memory/GRAG服务实现
- `backend/app/models/memory.py` - 记忆数据模型
- `backend/app/api/memory.py` - 记忆API端点

**修改文件**:
- `backend/app/config.py` - 添加Neo4j配置项
- `backend/app/main.py` - 集成Memory Service初始化和生命周期管理
- `backend/requirements.txt` - 添加neo4j>=5.0.0依赖
- `backend/ENV_CONFIG.md` - 添加Neo4j配置说明

### 2. 核心功能实现

#### Memory Service功能
- ✅ Neo4j连接管理（支持Neo4j Aura加密连接）
- ✅ 实体抽取（使用LLM从对话中提取实体和关系）
- ✅ 记忆写入（将实体和关系写入Neo4j图数据库）
- ✅ 记忆检索（GraphRAG查询相关上下文）
- ✅ 图查询（用于可视化）
- ✅ 节点详情查询
- ✅ 图统计信息查询
- ✅ 索引创建（性能优化）

#### API端点
- ✅ `POST /api/memory/write` - 写入对话记忆
- ✅ `GET /api/memory/context` - 查询相关上下文
- ✅ `GET /api/graph/query` - 查询图数据（可视化）
- ✅ `GET /api/graph/stats` - 获取图统计信息
- ✅ `GET /api/graph/node/{node_id}` - 获取节点详情

## 配置说明

### 环境变量配置

在 `backend/.env` 文件中添加以下配置：

```bash
# Enable graph memory system
GRAPH_MEMORY_ENABLED=true

# Neo4j Aura connection (encrypted)
NEO4J_URI=neo4j+s://c9810bad.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=hbfLim4NAijBbiJoiOJk6NtBGjk7B8fVmAKveWfA1XY
NEO4J_DATABASE=neo4j
```

**重要提示**:
- Neo4j Aura实例创建后需要等待60秒才能连接
- 连接信息保存在项目根目录的 `Neo4j-c9810bad-Created-2025-12-10.txt` 文件中
- 如果 `GRAPH_MEMORY_ENABLED=false` 或未配置Neo4j密码，记忆系统将不会初始化，但不会影响其他功能

### 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

## 使用说明

### 1. 启动服务

确保已配置环境变量后，启动后端服务：

```bash
cd backend
python start.py
```

如果Memory Service初始化成功，日志中会显示：
```
INFO: Neo4j connected successfully: neo4j+s://...
INFO: Neo4j indexes created/verified
INFO: Memory service initialized successfully
```

### 2. 写入记忆

通过API写入对话记忆：

```bash
curl -X POST "http://localhost:8000/api/memory/write" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1",
    "conversation_id": "conv_123",
    "messages": [
      {"role": "user", "content": "我正在做一个Python项目"},
      {"role": "assistant", "content": "很好！Python是一个强大的编程语言。"}
    ],
    "character_id": "epsilon"
  }'
```

### 3. 查询上下文

查询相关上下文：

```bash
curl "http://localhost:8000/api/memory/context?user_id=user_1&query=Python项目&limit=10"
```

### 4. 查询图数据

查询图数据用于可视化：

```bash
curl "http://localhost:8000/api/graph/query?user_id=user_1&depth=2&limit=100"
```

## 技术实现细节

### 知识图谱Schema

**实体类型**:
- User（用户）
- Topic（话题/领域）
- Project（项目）
- Skill（技能）
- Resource（资源）
- Conversation（对话会话）

**关系类型**:
- INTERESTED_IN（用户对话题感兴趣）
- WORKING_ON（用户正在做的项目）
- HAS_SKILL（用户拥有的技能）
- LEARNED_FROM（用户从资源中学习）
- USES（项目使用的技能）
- RELATED_TO（实体之间的关联）
- HAS_CONVERSATION（用户拥有对话）

### 实体抽取

使用LLM从对话中提取实体和关系：
- 支持Topic、Project、Skill、Resource等实体类型
- 自动识别实体之间的关系
- 返回JSON格式的结构化数据

### 图存储策略

- 使用Neo4j图数据库存储实体和关系
- 实体节点使用动态标签（如:Topic, :Project）
- 关系使用通用RELATION类型，实际类型存储在关系属性中
- 支持去重和合并（MERGE操作）

## 阶段2完成：记忆系统集成到对话流程

### 已完成功能

**修改文件**:
- `backend/app/models/chat.py` - 添加user_id和conversation_id字段
- `backend/app/services/llm_service.py` - 支持记忆上下文注入
- `backend/app/api/chat.py` - 集成记忆检索和写入

**核心功能**:
- ✅ 对话前自动查询相关记忆上下文
- ✅ 将记忆上下文拼接到System Prompt
- ✅ LLM回复中可引用历史信息
- ✅ 对话结束后自动写入记忆（异步，不阻塞响应）
- ✅ 支持可选的user_id和conversation_id（未提供时自动生成）

### 使用说明

#### 1. 基本使用（自动生成ID）

如果不提供user_id和conversation_id，系统会自动生成：
- user_id: 默认为 "default_user"
- conversation_id: 自动生成唯一ID

```bash
curl -X POST "http://localhost:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我正在做一个Python项目",
    "history": [],
    "config": {
      "ref_audio_path": "/path/to/audio.wav",
      "prompt_text": "参考音频文本",
      "text_lang": "zh"
    }
  }'
```

#### 2. 指定用户和对话ID

如果需要跟踪特定用户和对话，可以指定：

```bash
curl -X POST "http://localhost:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "我的Python项目进展如何？",
    "history": [],
    "config": {
      "ref_audio_path": "/path/to/audio.wav",
      "prompt_text": "参考音频文本",
      "text_lang": "zh"
    },
    "user_id": "user_123",
    "conversation_id": "conv_456"
  }'
```

### 工作流程

1. **对话前**：
   - 查询用户相关的记忆上下文（基于当前消息）
   - 将上下文拼接到System Prompt
   - LLM生成回复时可以引用历史信息

2. **对话中**：
   - 流式返回LLM生成的文本
   - 生成音频并流式返回

3. **对话后**：
   - 异步写入对话记忆到Neo4j
   - 提取实体和关系
   - 更新知识图谱

### 技术实现细节

#### 记忆上下文注入

记忆上下文通过以下方式注入到System Prompt：

```
[原始System Prompt]

## 相关记忆信息
Topic 'Python' (关系: INTERESTED_IN)
Project 'Epsilon' 使用技能: FastAPI, React

请根据以上记忆信息，在回复中自然地引用相关信息，体现你对用户的了解。
```

#### 异步记忆写入

记忆写入使用`asyncio.create_task`在后台异步执行，不会阻塞响应：
- 不等待写入完成
- 错误不会影响对话响应
- 日志记录写入状态

## 阶段3完成：知识图谱可视化

### 已完成功能

**新增文件**:
- `frontend/src/components/KnowledgeGraphViewer/` - 知识图谱可视化组件目录
  - `GraphCanvas.tsx` - 主图渲染组件（使用react-force-graph-2d）
  - `NodeDetailPanel.tsx` - 节点详情面板
  - `GraphControls.tsx` - 控制面板（搜索、过滤）
  - `GraphLegend.tsx` - 图例组件
  - `KnowledgeGraphViewer.tsx` - 主视图组件
- `frontend/src/services/graph.ts` - 图查询API服务
- `frontend/src/types/index.ts` - 添加图数据类型定义

**修改文件**:
- `frontend/package.json` - 添加react-force-graph-2d依赖
- `frontend/src/components/ConfigPanel.tsx` - 添加"知识图谱"标签页

**核心功能**:
- ✅ 交互式图可视化（力导向布局）
- ✅ 节点和边的展示（不同颜色表示不同类型）
- ✅ 节点点击查看详情
- ✅ 图的缩放、平移、拖拽
- ✅ 节点搜索功能
- ✅ 实体类型过滤
- ✅ 关系类型过滤
- ✅ 图统计信息显示
- ✅ 图例显示

### 使用说明

#### 1. 安装依赖

```bash
cd frontend
npm install
```

#### 2. 访问知识图谱

1. 打开应用，点击"配置"按钮
2. 在配置面板中选择"知识图谱"标签页
3. 查看交互式知识图谱可视化

#### 3. 交互功能

- **点击节点**: 查看节点详细信息（右侧面板）
- **悬停节点**: 高亮显示节点
- **搜索**: 在搜索框输入关键词，高亮匹配的节点
- **过滤**: 通过复选框过滤实体类型和关系类型
- **拖拽**: 可以拖拽节点调整布局
- **缩放**: 使用鼠标滚轮缩放

### 技术实现细节

#### 可视化库

使用 `react-force-graph-2d` 实现力导向图可视化：
- 基于D3.js和Canvas渲染
- 性能优秀，支持大量节点
- 支持交互式操作

#### 节点颜色映射

- User: 红色 (#FF6B6B)
- Topic: 青色 (#4ECDC4)
- Project: 蓝色 (#45B7D1)
- Skill: 绿色 (#96CEB4)
- Resource: 黄色 (#FFEAA7)
- Conversation: 紫色 (#DDA0DD)
- Entity: 灰色 (#95A5A6)

#### 组件架构

```
KnowledgeGraphViewer (主组件)
├── GraphControls (控制面板)
│   ├── 搜索框
│   ├── 实体类型过滤
│   └── 关系类型过滤
├── GraphCanvas (图渲染)
│   └── ForceGraph2D (react-force-graph-2d)
├── GraphLegend (图例)
└── NodeDetailPanel (节点详情面板，可选)
```

### 性能优化

- 限制初始加载节点数量（默认100个）
- 使用Canvas渲染提升性能
- 延迟加载节点详情（点击时才加载）
- 支持过滤减少渲染节点数

## Phase 3B 开发完成总结

Phase 3B的所有三个阶段已完成：

### ✅ 阶段1：Neo4j集成和Memory Service
- Neo4j连接和配置
- Memory Service实现
- 实体抽取和记忆写入
- 记忆检索和图查询

### ✅ 阶段2：记忆系统集成到对话流程
- 对话前自动查询记忆
- 记忆上下文注入到System Prompt
- 对话后自动写入记忆

### ✅ 阶段3：知识图谱可视化
- 交互式图可视化
- 节点详情查看
- 搜索和过滤功能
- 集成到配置面板

### 完整功能流程

1. **对话阶段**：
   - 用户发送消息
   - 系统查询相关记忆上下文
   - LLM生成回复（引用历史信息）
   - 对话结束后写入记忆

2. **可视化阶段**：
   - 在配置面板打开"知识图谱"标签页
   - 查看用户的知识图谱
   - 探索实体和关系
   - 查看节点详情

### 下一步建议

1. **性能优化**：
   - 实现图查询缓存
   - 优化大量节点的渲染性能
   - 实现虚拟化渲染

2. **功能增强**：
   - 支持节点编辑
   - 支持关系编辑
   - 支持图导出（PNG/SVG）
   - 支持时间线视图

3. **用户体验**：
   - 添加加载动画
   - 优化移动端显示
   - 添加图布局算法选择

## 注意事项

1. **Neo4j连接**: 确保Neo4j Aura实例已启动并可访问
2. **LLM依赖**: 实体抽取依赖OpenAI API，确保已配置OPENAI_API_KEY
3. **性能优化**: 已创建必要的索引，但大量数据时可能需要进一步优化
4. **错误处理**: 如果Memory Service未初始化，相关API会返回503错误

## 参考文档

- `开发提示词_Phase3_长期记忆与知识图谱.md` - 详细开发文档
- `backend/ENV_CONFIG.md` - 环境变量配置说明
- Neo4j官方文档: https://neo4j.com/docs/

