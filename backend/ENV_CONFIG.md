# 环境变量配置说明

## 必需配置

在 `backend/.env` 文件中需要配置以下环境变量：

### OpenAI API配置（必需）

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

获取API密钥：https://platform.openai.com/api-keys

### GPT-SoVITS配置（必需）

```bash
GPT_SOVITS_BASE_URL=http://127.0.0.1:9880
```

### OpenAI模型配置（可选）

```bash
OPENAI_MODEL=gpt-3.5-turbo
```

可选值：
- `gpt-3.5-turbo` (默认，推荐)
- `gpt-4`
- `gpt-4-turbo-preview`
- 其他OpenAI支持的模型

## 完整配置示例

```bash
# GPT-SoVITS API Configuration
GPT_SOVITS_BASE_URL=http://127.0.0.1:9880

# OpenAI API Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-3.5-turbo

# Frontend Configuration
FRONTEND_URL=http://localhost:5173

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Neo4j Aura Configuration (Phase 3B - Graph Memory)
# Enable graph memory system (optional, default: false)
GRAPH_MEMORY_ENABLED=true

# Neo4j Aura connection (encrypted connection using neo4j+s://)
NEO4J_URI=neo4j+s://c9810bad.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=hbfLim4NAijBbiJoiOJk6NtBGjk7B8fVmAKveWfA1XY
NEO4J_DATABASE=neo4j
```

## 注意事项

1. **OPENAI_API_KEY** 是必需的，如果没有配置，后端启动时会报错
2. 确保GPT-SoVITS服务已启动并运行在指定地址
3. 不要将 `.env` 文件提交到版本控制系统（已在.gitignore中排除）

## Neo4j配置说明（Phase 3B）

### 启用Graph Memory系统

要启用长期记忆与知识图谱功能，需要配置以下环境变量：

1. **GRAPH_MEMORY_ENABLED**: 设置为 `true` 启用记忆系统（默认 `false`）
2. **NEO4J_URI**: Neo4j Aura连接URI（使用加密连接 `neo4j+s://`）
3. **NEO4J_USERNAME**: Neo4j用户名（通常是 `neo4j`）
4. **NEO4J_PASSWORD**: Neo4j密码（从 `Neo4j-c9810bad-Created-2025-12-10.txt` 读取）
5. **NEO4J_DATABASE**: 数据库名称（通常是 `neo4j`）

### 重要提示

- Neo4j Aura实例创建后需要等待60秒才能连接
- 连接信息保存在项目根目录的 `Neo4j-c9810bad-Created-2025-12-10.txt` 文件中
- 如果 `GRAPH_MEMORY_ENABLED=false` 或未配置Neo4j密码，记忆系统将不会初始化，但不会影响其他功能
- 密码不要硬编码，使用环境变量管理

