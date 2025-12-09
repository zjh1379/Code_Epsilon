# 异界声律·Epsilon - MVP开发提示词

## 【项目概述】

**项目名称**: 异界声律·Epsilon

**项目背景**: 
这是一个将本地LLM文本对话与GPT-SoVITS语音合成技术结合的Web应用。项目目标是打造一个可扩展的虚拟角色对话系统，当前阶段专注于MVP实现。

**核心功能描述**:
- Web界面的LLM文本聊天（参考主流LLM聊天界面设计）
- 用户通过文本输入与系统对话
- LLM生成文本回复后，自动调用GPT-SoVITS将文本转换为特定角色音色的语音
- 前端同时显示LLM文本回复和播放对应的语音音频
- 支持流式文本输出
- 支持多轮对话历史

**MVP范围定义**:
- 基础文本聊天功能（使用本地LLM）
- GPT-SoVITS文本转语音集成
- 用户可配置参考音频路径（音色）
- 用户可选择文本语言（中文/日语/英文）
- 流式响应支持
- 对话历史管理
- 基础错误处理和用户反馈

**非MVP范围**（暂不实现）:
- 用户账户系统
- 多角色切换
- 音频编辑功能
- 高级TTS参数调整界面

---

## 【技术架构】

### 技术栈选择

**后端**:
- Python 3.8+
- FastAPI（异步Web框架）
- LangChain（LLM集成框架）
- aiohttp/httpx（异步HTTP客户端，用于调用GPT-SoVITS API）
- python-dotenv（环境变量管理）

**前端**:
- React 18+
- TypeScript
- Tailwind CSS（样式框架）
- Vite（构建工具）
- axios/fetch（HTTP客户端）

### 系统架构设计

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ HTTP/WebSocket
       │
┌──────▼──────────────────┐
│   FastAPI Backend        │
│  ┌────────────────────┐  │
│  │  LangChain LLM     │  │
│  │  (Local Model)     │  │
│  └─────────┬──────────┘  │
│            │              │
│  ┌─────────▼──────────┐  │
│  │  TTS Service       │  │
│  │  (GPT-SoVITS API)  │  │
│  └────────────────────┘  │
└──────────────────────────┘
       │ HTTP
       │
┌──────▼──────────────┐
│  GPT-SoVITS Service │
│  http://127.0.0.1:  │
│      9880           │
└─────────────────────┘
```

### 数据流设计

1. **用户输入流程**:
   ```
   用户输入文本 → 前端发送POST请求 → 后端接收
   → LangChain处理（包含对话历史）→ LLM生成回复
   → 流式返回文本 → 同时调用GPT-SoVITS API
   → 返回音频数据 → 前端显示文本并播放音频
   ```

2. **流式响应流程**:
   ```
   LLM生成token → Server-Sent Events (SSE) 或 WebSocket
   → 前端实时更新UI → 文本生成完成后触发TTS
   ```

3. **对话历史管理**:
   ```
   前端维护消息列表 → 每次请求携带历史消息
   → 后端使用LangChain Memory管理上下文
   ```

---

## 【功能需求】

### 详细功能点列表

#### 1. 聊天界面功能
- [ ] 消息列表显示（用户消息和AI回复）
- [ ] 文本输入框（支持多行输入）
- [ ] 发送按钮
- [ ] 流式文本显示（逐字显示效果）
- [ ] 音频播放控件（播放/暂停/进度条）
- [ ] 加载状态指示（文本生成中、音频生成中）
- [ ] 错误提示显示

#### 2. 配置功能
- [ ] 参考音频路径配置（用户可输入或选择文件）
- [ ] 文本语言选择（中文/日语/英文，下拉选择）
- [ ] 配置保存（使用localStorage或后端存储）

#### 3. LLM集成功能
- [ ] LangChain对话链构建
- [ ] 本地LLM模型加载和调用
- [ ] 流式响应实现（SSE或WebSocket）
- [ ] 对话历史管理（Memory组件）
- [ ] 错误处理和重试机制

#### 4. TTS集成功能
- [ ] GPT-SoVITS API调用封装
- [ ] 文本转语音请求构建
- [ ] 音频流接收和处理
- [ ] 音频格式转换（如需要）
- [ ] 错误处理和重试机制（最多3次，指数退避）

#### 5. 前端交互功能
- [ ] 消息列表滚动（自动滚动到最新消息）
- [ ] 音频自动播放（可选，用户可控制）
- [ ] 响应式布局（移动端适配）
- [ ] 键盘快捷键（Enter发送，Shift+Enter换行）

### 用户交互流程

1. **首次使用**:
   - 用户打开页面
   - 系统提示配置参考音频路径和文本语言
   - 用户完成配置后开始对话

2. **正常对话流程**:
   - 用户在输入框输入文本
   - 点击发送或按Enter键
   - 前端显示"正在思考..."状态
   - LLM开始流式返回文本，前端实时显示
   - 文本生成完成后，显示"正在生成语音..."状态
   - TTS服务生成音频
   - 前端显示完整文本并自动播放音频（或显示播放按钮）

3. **多轮对话**:
   - 系统自动维护对话历史
   - 每次回复都基于历史上下文
   - 用户可查看历史消息

### 异常处理要求

1. **网络错误**:
   - LLM调用失败：显示友好错误提示，允许重试
   - TTS API调用失败：显示错误提示，文本回复仍正常显示
   - 网络超时：实现超时机制（LLM 60秒，TTS 30秒）

2. **API错误**:
   - GPT-SoVITS API返回错误：记录错误信息，提示用户检查配置
   - 音频生成失败：显示错误提示，不影响文本显示

3. **用户输入错误**:
   - 空输入：前端验证，不允许发送
   - 参考音频路径无效：后端验证，返回错误提示

4. **资源限制**:
   - 音频文件过大：限制最大长度或分段处理
   - 对话历史过长：实现历史截断机制（保留最近N轮）

---

## 【API集成】

### 后端API接口设计

#### 1. POST /api/chat
**功能**: 发送用户消息，获取LLM回复和语音

**请求体**:
```json
{
  "message": "用户输入的文本",
  "history": [
    {"role": "user", "content": "之前的用户消息"},
    {"role": "assistant", "content": "之前的AI回复"}
  ],
  "config": {
    "ref_audio_path": "参考音频路径",
    "text_lang": "zh|en|ja"
  }
}
```

**响应** (流式):
```
Content-Type: text/event-stream

data: {"type": "text", "content": "部分文本"}
data: {"type": "text", "content": "更多文本"}
data: {"type": "complete", "text": "完整文本"}
data: {"type": "audio", "url": "音频URL或base64数据"}
```

#### 2. GET /api/config
**功能**: 获取当前配置

**响应**:
```json
{
  "ref_audio_path": "当前参考音频路径",
  "text_lang": "zh"
}
```

#### 3. POST /api/config
**功能**: 更新配置

**请求体**:
```json
{
  "ref_audio_path": "新的参考音频路径",
  "text_lang": "zh|en|ja"
}
```

### GPT-SoVITS API集成

**基础URL**: `http://127.0.0.1:9880/`（通过环境变量配置）

#### POST /tts
**功能**: 文本转语音

**请求体** (JSON):
```json
{
  "text": "要转换的文本",
  "text_lang": "zh|en|ja",
  "ref_audio_path": "参考音频文件路径",
  "prompt_lang": "zh|en|ja",
  "prompt_text": "",
  "media_type": "wav"
}
```

**其他参数使用默认值**:
- `top_k`: 5
- `top_p`: 1.0
- `temperature`: 1.0
- `text_split_method`: "cut5"
- `batch_size`: 1
- `speed_factor`: 1.0
- `media_type`: "wav"
- 其他参数参考OpenAPI规范使用默认值

**响应**: 
- Content-Type: audio/wav（二进制流）
- 需要将音频流保存为临时文件或转换为Base64返回给前端

**错误处理**:
- 网络错误：重试最多3次，指数退避（1秒、2秒、4秒）
- API错误：返回错误信息，记录日志
- 超时：30秒超时限制

#### GET /set_refer_audio
**功能**: 设置参考音频（可选，如果GPT-SoVITS支持全局设置）

**参数**: `refer_audio_path` (查询参数)

---

## 【开发任务】

### 分阶段开发计划

#### 阶段1: 项目基础搭建（1-2小时）
- [ ] 创建项目目录结构
- [ ] 初始化后端FastAPI项目
- [ ] 初始化前端React+TypeScript项目
- [ ] 配置环境变量文件（.env）
- [ ] 配置Tailwind CSS
- [ ] 创建基础README

#### 阶段2: 后端核心功能（3-4小时）
- [ ] 实现配置管理模块（config.py）
- [ ] 实现LLM服务封装（llm_service.py）
  - LangChain对话链构建
  - 本地LLM模型加载
  - 流式响应实现
  - 对话历史管理
- [ ] 实现TTS服务封装（tts_service.py）
  - GPT-SoVITS API调用
  - 错误处理和重试机制
  - 音频流处理
- [ ] 实现聊天API端点（api/chat.py）
  - POST /api/chat（流式响应）
  - 集成LLM和TTS服务
- [ ] 实现配置API端点（api/config.py）
  - GET /api/config
  - POST /api/config

#### 阶段3: 前端核心功能（3-4小时）
- [ ] 创建TypeScript类型定义（types/index.ts）
- [ ] 实现API调用封装（services/api.ts）
- [ ] 实现音频处理工具（services/audio.ts）
- [ ] 实现聊天状态管理Hook（hooks/useChat.ts）
- [ ] 实现消息列表组件（components/MessageList.tsx）
- [ ] 实现输入区域组件（components/InputArea.tsx）
- [ ] 实现音频播放组件（components/AudioPlayer.tsx）
- [ ] 实现配置界面组件（components/ConfigPanel.tsx）
- [ ] 实现主聊天界面（components/ChatInterface.tsx）
- [ ] 集成到App.tsx

#### 阶段4: 流式响应和优化（2-3小时）
- [ ] 实现Server-Sent Events (SSE) 流式响应
- [ ] 前端流式文本显示效果
- [ ] 音频自动播放逻辑
- [ ] 加载状态和错误提示优化
- [ ] 响应式布局优化

#### 阶段5: 测试和优化（1-2小时）
- [ ] 端到端功能测试
- [ ] 错误场景测试
- [ ] 性能优化（如需要）
- [ ] 代码清理和文档完善

### 代码结构建议

```
epsilon/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI应用入口
│   │   ├── config.py               # 配置管理（环境变量、默认值）
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py             # 聊天请求/响应模型
│   │   │   └── config.py           # 配置模型
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── llm_service.py      # LLM服务封装（LangChain）
│   │   │   └── tts_service.py      # GPT-SoVITS API封装
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── chat.py             # 聊天API端点
│   │   │   └── config.py           # 配置API端点
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── audio.py            # 音频处理工具函数
│   ├── requirements.txt
│   ├── .env.example                # 环境变量示例
│   └── .env                        # 实际环境变量（gitignore）
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx   # 主聊天界面
│   │   │   ├── MessageList.tsx     # 消息列表
│   │   │   ├── MessageItem.tsx     # 单条消息组件
│   │   │   ├── InputArea.tsx       # 输入区域
│   │   │   ├── AudioPlayer.tsx     # 音频播放器
│   │   │   └── ConfigPanel.tsx     # 配置面板
│   │   ├── services/
│   │   │   ├── api.ts              # API调用封装
│   │   │   └── audio.ts            # 音频处理
│   │   ├── hooks/
│   │   │   └── useChat.ts          # 聊天状态管理Hook
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript类型定义
│   │   ├── App.tsx                 # 根组件
│   │   └── main.tsx                # 入口文件
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── .gitignore
└── README.md                       # 项目说明文档
```

### 关键实现点

#### 1. 后端流式响应实现
```python
# 使用FastAPI的StreamingResponse和Server-Sent Events
from fastapi.responses import StreamingResponse
import json

async def chat_stream(request: ChatRequest):
    async def generate():
        async for chunk in llm_service.stream_chat(request.message, request.history):
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
        
        # 文本生成完成后，调用TTS
        audio_data = await tts_service.text_to_speech(
            text=full_text,
            text_lang=request.config.text_lang,
            ref_audio_path=request.config.ref_audio_path
        )
        yield f"data: {json.dumps({'type': 'audio', 'data': audio_base64})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

#### 2. LangChain对话链构建
```python
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain.llms import ...  # 根据实际本地模型选择

memory = ConversationBufferMemory()
chain = ConversationChain(
    llm=local_llm,
    memory=memory,
    verbose=True
)
```

#### 3. GPT-SoVITS API调用
```python
import aiohttp
import base64

async def text_to_speech(text: str, text_lang: str, ref_audio_path: str):
    url = f"{GPT_SOVITS_BASE_URL}/tts"
    payload = {
        "text": text,
        "text_lang": text_lang,
        "ref_audio_path": ref_audio_path,
        "prompt_lang": text_lang,
        "media_type": "wav"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload) as response:
            if response.status == 200:
                audio_data = await response.read()
                return base64.b64encode(audio_data).decode('utf-8')
            else:
                raise Exception(f"TTS API error: {response.status}")
```

#### 4. 前端流式文本显示
```typescript
const eventSource = new EventSource(`/api/chat`, {
  method: 'POST',
  body: JSON.stringify(request)
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'text') {
    setCurrentMessage(prev => prev + data.content);
  } else if (data.type === 'complete') {
    setMessages(prev => [...prev, {role: 'assistant', text: data.text}]);
  } else if (data.type === 'audio') {
    playAudio(data.url);
  }
};
```

#### 5. 环境变量配置
```bash
# backend/.env.example
GPT_SOVITS_BASE_URL=http://127.0.0.1:9880
LLM_MODEL_PATH=path/to/local/model
LLM_MODEL_TYPE=llama|chatglm|qwen  # 根据实际模型选择
FRONTEND_URL=http://localhost:5173
```

---

## 【验收标准】

### 功能验收清单

#### 核心功能
- [ ] 用户可以通过文本输入与系统对话
- [ ] LLM能够基于对话历史生成上下文相关的回复
- [ ] 文本回复能够流式显示（逐字显示效果）
- [ ] 文本生成完成后自动调用GPT-SoVITS生成语音
- [ ] 前端能够正确播放生成的音频
- [ ] 用户可以配置参考音频路径
- [ ] 用户可以选择文本语言（中文/日语/英文）
- [ ] 配置能够正确保存和加载

#### 交互体验
- [ ] 界面布局清晰，参考主流LLM聊天界面
- [ ] 加载状态明确（文本生成中、音频生成中）
- [ ] 错误提示友好且明确
- [ ] 音频播放控件功能正常（播放/暂停）
- [ ] 支持键盘快捷键（Enter发送）
- [ ] 移动端布局适配良好

#### 技术实现
- [ ] 流式响应正常工作
- [ ] 对话历史正确维护
- [ ] API错误处理完善
- [ ] 网络错误有重试机制
- [ ] 代码结构清晰，注释完整

### 性能要求

- [ ] 文本生成响应时间：首次响应 < 2秒
- [ ] 音频生成响应时间：< 10秒（取决于文本长度）
- [ ] 前端页面加载时间：< 3秒
- [ ] 流式文本更新流畅，无明显卡顿

### 用户体验要求

- [ ] 界面美观，符合现代Web应用标准
- [ ] 操作直观，无需额外说明即可使用
- [ ] 错误提示清晰，用户知道如何解决问题
- [ ] 音频播放流畅，无明显延迟
- [ ] 支持多轮对话，上下文理解准确

### 代码质量要求

- [ ] 代码遵循PEP 8（Python）和ESLint（TypeScript）规范
- [ ] 代码注释使用英文，清晰说明关键逻辑
- [ ] 错误处理完善，覆盖主要异常场景
- [ ] 代码结构清晰，易于维护和扩展

---

## 【补充说明】

### 开发注意事项

1. **环境配置**:
   - GPT-SoVITS服务需要提前启动在 `http://127.0.0.1:9880`
   - 本地LLM模型需要正确配置路径和类型
   - 环境变量文件需要正确设置

2. **API调用顺序**:
   - 先完成LLM文本生成
   - 文本生成完成后才调用TTS
   - 如果TTS失败，文本回复仍应正常显示

3. **错误处理优先级**:
   - LLM错误 > TTS错误（LLM是核心功能）
   - 网络错误需要重试
   - 用户输入错误需要前端验证

4. **性能优化建议**:
   - 音频可以异步生成，不阻塞文本显示
   - 考虑实现音频缓存（相同文本不重复生成）
   - 对话历史过长时考虑截断

5. **测试建议**:
   - 测试不同长度的文本输入
   - 测试多轮对话的上下文理解
   - 测试网络异常情况
   - 测试不同语言的TTS生成

### 参考资源

- GPT-SoVITS GitHub: https://github.com/RVC-Boss/GPT-SoVITS
- LangChain文档: https://python.langchain.com/
- FastAPI文档: https://fastapi.tiangolo.com/
- React文档: https://react.dev/
- Tailwind CSS文档: https://tailwindcss.com/

---

**提示词生成时间**: 2025-01-XX
**版本**: MVP v1.0

