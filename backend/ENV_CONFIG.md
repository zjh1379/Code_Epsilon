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
```

## 注意事项

1. **OPENAI_API_KEY** 是必需的，如果没有配置，后端启动时会报错
2. 确保GPT-SoVITS服务已启动并运行在指定地址
3. 不要将 `.env` 文件提交到版本控制系统（已在.gitignore中排除）

