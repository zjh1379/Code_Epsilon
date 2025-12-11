# 异界声律·Epsilon

一个将本地LLM文本对话与GPT-SoVITS语音合成技术结合的Web应用，具备长期记忆与知识图谱功能。

## 项目概述

异界声律·Epsilon是一个可扩展的虚拟角色对话系统，旨在提供具备"记忆"和"个性"的沉浸式对话体验。

### 核心功能

- **多模态交互**：
  - ✅ Web界面的LLM文本聊天（流式输出）
  - ✅ GPT-SoVITS自动语音合成（流式音频播放）
  - ✅ 支持多模型切换（OpenAI GPT系列, Google Gemini系列）

- **角色系统**：
  - ✅ 角色助手切换功能
  - ✅ 自定义角色创建与管理
  - ✅ 角色专属System Prompt

- **记忆与历史**：
  - ✅ **长期记忆系统**：基于Neo4j图数据库的GraphRAG，记住用户的关键信息（项目、技能、偏好）。
  - ✅ **知识图谱可视化**：交互式展示AI对用户的认知结构。
  - ✅ **对话历史持久化**：基于SQLite的历史记录存储，支持回看和多会话管理。

- **系统特性**：
  - ✅ 实时配置管理（语音、模型参数）
  - ✅ 响应式UI设计（支持深色/浅色主题）
  - ✅ 健壮的错误处理与重试机制

## 技术栈

### 后端
- **核心框架**: Python 3.8+, FastAPI
- **AI集成**: LangChain, LangChain-Google-GenAI
- **数据库**:
  - **SQLite**: 对话历史存储 (SQLAlchemy ORM)
  - **Neo4j**: 知识图谱与长期记忆 (Neo4j Aura)
- **其他**: Pydantic, Aiohttp

### 前端
- **核心框架**: React 18+, TypeScript, Vite
- **UI框架**: Tailwind CSS
- **可视化**: @neo4j-nvl/react (知识图谱展示)
- **状态管理**: React Hooks, Context API

## 项目结构

```
epsilon/
├── backend/          # FastAPI后端
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py      # SQLite连接
│   │   ├── models/          # 数据模型 (Pydantic & SQLAlchemy)
│   │   ├── services/        # 业务逻辑 (Memory, LLM, TTS, History)
│   │   ├── api/             # API路由
│   │   └── utils/
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # React前端
│   ├── src/
│   │   ├── components/      # UI组件 (Chat, GraphViewer, Sidebar)
│   │   ├── services/        # API封装
│   │   ├── hooks/
│   │   └── types/
│   └── package.json
└── README.md
```

## 快速开始

### 环境要求

- Python 3.8+
- Node.js 18+
- GPT-SoVITS服务运行在 `http://127.0.0.1:9880`
- Neo4j Aura 实例 (可选，用于长期记忆功能)

### 后端设置

1. 进入后端目录：
```bash
cd backend
```

2. 创建并激活虚拟环境：
```bash
python -m venv venv
# Windows
venv\Scripts\Activate.ps1
# Linux/Mac
source venv/bin/activate
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

4. 配置环境变量：
```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件，设置以下关键配置：
# - OPENAI_API_KEY / GEMINI_API_KEY: LLM密钥
# - GPT_SOVITS_BASE_URL: 语音服务地址
# - NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD: 图数据库配置 (Phase 3B)
# - GRAPH_MEMORY_ENABLED=true: 启用图记忆
```

5. 启动服务：
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端设置

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

4. 访问 `http://localhost:5173`

## 功能指南

1. **聊天与语音**: 在主界面输入文本，AI将回复并自动朗读。点击输入框旁的设置图标可调整TTS参数。
2. **切换角色**: 点击顶部的角色名称，选择或创建新的AI角色。
3. **查看历史**: 点击左上角菜单图标，打开侧边栏查看和管理历史对话。
4. **知识图谱**: 在设置面板中选择"知识图谱"标签页，查看AI构建的关于你的知识网络。
   - **橙色节点**: 话题/领域
   - **蓝色节点**: 项目
   - **绿色节点**: 技能
   - **节点大小**: 代表重要性评分

## 开发说明

### 数据库迁移
后端启动时会自动检查并创建SQLite表结构。如果修改了 `app/models/db.py`，可能需要手动处理迁移或重置数据库 (`epsilon.db`)。

### 记忆系统
记忆系统采用"缓冲-处理"机制。对话内容会先在内存中缓冲，积累一定数量（默认5条）后触发后台任务，提取实体并写入Neo4j。

## 许可证

MIT License
