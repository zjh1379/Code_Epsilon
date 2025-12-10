# Memory Service 故障排除指南

## 错误信息

如果看到以下错误：
```
Graph query failed: 503, {"detail":"Memory service not initialized"}
```

这表示Memory Service（Neo4j图数据库服务）未初始化。

## 可能的原因和解决方案

### 1. GRAPH_MEMORY_ENABLED 未启用

**问题**: 记忆系统被禁用

**解决方案**: 在 `backend/.env` 文件中添加或修改：

```bash
GRAPH_MEMORY_ENABLED=true
```

### 2. Neo4j密码未配置

**问题**: NEO4J_PASSWORD环境变量未设置

**解决方案**: 在 `backend/.env` 文件中添加Neo4j密码：

```bash
NEO4J_PASSWORD=hbfLim4NAijBbiJoiOJk6NtBGjk7B8fVmAKveWfA1XY
```

**注意**: 密码可以从项目根目录的 `Neo4j-c9810bad-Created-2025-12-10.txt` 文件中获取。

### 3. Neo4j连接失败

**问题**: Neo4j Aura实例未启动或连接失败

**解决方案**:

1. **检查Neo4j Aura实例状态**:
   - 访问 https://console.neo4j.io
   - 登录并检查实例是否运行

2. **等待实例启动**:
   - Neo4j Aura实例创建后需要等待60秒才能连接
   - 如果刚创建实例，请等待一段时间后重试

3. **检查连接信息**:
   确保 `backend/.env` 文件中的连接信息正确：
   ```bash
   NEO4J_URI=neo4j+s://c9810bad.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=<从Neo4j-c9810bad-Created-2025-12-10.txt读取>
   NEO4J_DATABASE=neo4j
   ```

4. **检查后端日志**:
   查看后端服务启动时的日志，查找Neo4j连接相关的错误信息：
   ```bash
   # 如果看到以下日志，说明连接成功：
   INFO: Neo4j connected successfully: neo4j+s://...
   INFO: Neo4j indexes created/verified
   INFO: Memory service initialized successfully
   
   # 如果看到以下日志，说明未初始化：
   INFO: Graph memory is disabled, skipping initialization
   # 或
   WARNING: NEO4J_PASSWORD not configured, skipping memory service initialization
   # 或
   ERROR: Failed to connect to Neo4j: ...
   ```

## 完整配置示例

在 `backend/.env` 文件中添加以下配置：

```bash
# Enable graph memory system
GRAPH_MEMORY_ENABLED=true

# Neo4j Aura connection (encrypted connection using neo4j+s://)
NEO4J_URI=neo4j+s://c9810bad.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=hbfLim4NAijBbiJoiOJk6NtBGjk7B8fVmAKveWfA1XY
NEO4J_DATABASE=neo4j
```

## 验证配置

配置完成后，重启后端服务并检查日志：

```bash
cd backend
python start.py
```

如果看到以下日志，说明配置成功：
```
INFO: Initializing services...
INFO: Neo4j connected successfully: neo4j+s://c9810bad.databases.neo4j.io
INFO: Neo4j indexes created/verified
INFO: Memory service initialized successfully
```

## 注意事项

1. **密码安全**: 不要将 `.env` 文件提交到版本控制系统
2. **实例状态**: 确保Neo4j Aura实例处于运行状态
3. **连接等待**: 新创建的实例需要等待60秒才能连接
4. **可选功能**: 如果不需要记忆功能，可以保持 `GRAPH_MEMORY_ENABLED=false`，其他功能不受影响

## 相关文档

- `backend/ENV_CONFIG.md` - 环境变量配置说明
- `backend/PHASE3B_README.md` - Phase 3B开发文档
- `Neo4j-c9810bad-Created-2025-12-10.txt` - Neo4j连接信息

