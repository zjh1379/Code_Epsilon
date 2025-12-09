# 异界声律·Epsilon

一个将本地LLM文本对话与GPT-SoVITS语音合成技术结合的Web应用。

## 项目概述

异界声律·Epsilon是一个可扩展的虚拟角色对话系统，当前阶段专注于MVP实现。

### 核心功能

- Web界面的LLM文本聊天（参考主流LLM聊天界面设计）
- 用户通过文本输入与系统对话
- LLM生成文本回复后，自动调用GPT-SoVITS将文本转换为特定角色音色的语音
- 前端同时显示LLM文本回复和播放对应的语音音频
- 支持流式文本输出
- 支持多轮对话历史

## 技术栈

### 后端
- Python 3.8+
- FastAPI（异步Web框架）
- LangChain（LLM集成框架）
- aiohttp/httpx（异步HTTP客户端）

### 前端
- React 18+
- TypeScript
- Tailwind CSS（样式框架）
- Vite（构建工具）

## 项目结构

```
epsilon/
├── backend/          # FastAPI后端
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── services/
│   │   ├── api/
│   │   └── utils/
│   ├── requirements.txt
│   └── .env.example
├── frontend/         # React前端
│   ├── src/
│   │   ├── components/
│   │   ├── services/
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

### 后端设置

1. 进入后端目录：
```bash
cd backend
```

2. 创建虚拟环境：
```bash
python -m venv venv
```

3. 激活虚拟环境：
```bash
# Windows PowerShell
venv\Scripts\Activate.ps1
# Windows CMD
venv\Scripts\activate.bat
# Linux/Mac
source venv/bin/activate
```

4. 安装依赖：
```bash
pip install -r requirements.txt
```

5. 配置环境变量：
```bash
# 复制示例文件
Copy-Item .env.example .env  # Windows PowerShell
# 或
cp .env.example .env  # Linux/Mac

# 编辑 .env 文件，设置正确的配置
# 必须设置以下配置：
# - OPENAI_API_KEY: OpenAI API密钥（必需）
# - GPT_SOVITS_BASE_URL: GPT-SoVITS服务地址（必需）
# - OPENAI_MODEL: OpenAI模型名称（可选，默认gpt-3.5-turbo）
```

6. 启动服务：
```bash
# 方式1: 使用启动脚本
python start.py

# 方式2: 直接使用uvicorn
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

4. 打开浏览器访问 `http://localhost:5173`

### 首次使用

1. 启动GPT-SoVITS服务（确保运行在 `http://127.0.0.1:9880`）
2. 启动后端服务
3. 启动前端服务
4. 打开浏览器，首次使用会弹出配置面板
5. 配置参考音频路径和文本语言
6. 开始对话！

## 功能特性

- ✅ Web界面的LLM文本聊天
- ✅ 流式文本输出（逐字显示）
- ✅ GPT-SoVITS文本转语音集成
- ✅ 音频播放控件
- ✅ 多轮对话历史管理
- ✅ 配置管理（参考音频路径、文本语言）
- ✅ 错误处理和重试机制
- ✅ 响应式布局设计

## API文档

启动后端服务后，访问 `http://localhost:8000/docs` 查看Swagger API文档。

## 开发说明

### 环境配置

- GPT-SoVITS服务需要提前启动在 `http://127.0.0.1:9880`
- 本地LLM模型需要正确配置路径和类型
- 环境变量文件需要正确设置

### 代码规范

- 代码注释使用英文
- 变量和函数命名使用英文
- 代码解释和文档使用中文
- 遵循PEP 8（Python）和ESLint（TypeScript）规范

## 许可证

MIT License

