# 异界声律·Epsilon - Phase 2 开发提示词

## 【项目概述】

**项目名称**: 异界声律·Epsilon - Phase 2

**当前状态**: 
MVP基础功能已完成，包括：
- LLM文本聊天（流式输出）
- GPT-SoVITS文本转语音集成
- 基础配置管理
- 对话历史管理

**Phase 2 目标**:
1. **角色人物设定功能**：让用户能够配置虚拟角色的性格、背景、说话风格等，使对话更具角色特色
2. **流式语音输出优化**：实现音频流式输出和播放，提升用户体验，减少等待时间

**核心改进点**:
- 添加角色设定管理（名字、性格、背景故事、说话风格等）
- 将角色设定集成到LLM的system prompt中
- 实现GPT-SoVITS流式音频输出
- 前端支持流式音频播放

---

## 【技术架构】

### 新增技术组件

**后端**:
- 角色设定数据模型（Character Profile）
- System Prompt构建器（集成角色设定）
- 流式TTS服务（支持streaming_mode）

**前端**:
- 角色设定配置界面
- 流式音频播放组件（支持音频流拼接和播放）

### 数据流设计

#### 1. 角色设定流程
```
用户配置角色设定 → 保存到配置/数据库
→ LLM服务加载角色设定 → 构建System Prompt
→ 每次对话时应用System Prompt → LLM按角色风格回复
```

#### 2. 流式语音输出流程
```
文本生成完成 → 启动TTS流式请求（streaming_mode=true）
→ GPT-SoVITS流式返回音频块 → 后端转发音频块到前端
→ 前端接收音频块 → 拼接并实时播放
```

---

## 【功能需求】

### 第一部分：角色人物设定功能

#### 1.1 角色设定数据结构

**角色设定字段**:
- `name`: 角色名称（字符串，必填）
- `personality`: 性格描述（字符串，必填，例如："温柔、善解人意、喜欢倾听"）
- `background`: 背景故事（字符串，可选，例如："来自异世界的魔法师，拥有治愈能力"）
- `speaking_style`: 说话风格（字符串，可选，例如："使用敬语，语气温和，偶尔会使用魔法术语"）
- `appearance`: 外观描述（字符串，可选）
- `relationships`: 与用户的关系设定（字符串，可选，例如："你是我的魔法导师"）

#### 1.2 功能点列表

**后端功能**:
- [ ] 创建角色设定数据模型（`CharacterProfile`）
- [ ] 实现角色设定存储（当前使用内存存储，后续可扩展为数据库）
- [ ] 实现System Prompt构建器
  - 将角色设定转换为格式化的System Prompt
  - 确保角色设定影响LLM的回复风格
- [ ] 添加角色设定API端点
  - `GET /api/character` - 获取当前角色设定
  - `POST /api/character` - 更新角色设定
- [ ] 修改LLM服务，集成System Prompt
  - 在每次对话时自动添加System Prompt
  - 确保对话历史中包含角色设定上下文

**前端功能**:
- [ ] 创建角色设定配置组件（`CharacterProfilePanel.tsx`）
  - 角色名称输入
  - 性格描述输入（多行文本）
  - 背景故事输入（多行文本）
  - 说话风格输入（多行文本）
  - 外观描述输入（可选）
  - 关系设定输入（可选）
- [ ] 在配置面板中添加"角色设定"标签页
- [ ] 实现角色设定的保存和加载
- [ ] 显示当前激活的角色名称（在聊天界面顶部）

#### 1.3 System Prompt模板设计

**模板结构**:
```
你是一个名为{name}的虚拟角色。

【性格】
{personality}

【背景】
{background}

【说话风格】
{speaking_style}

【与用户的关系】
{relationships}

请严格按照以上设定来回复用户的消息，保持角色的一致性。你的回复应该：
1. 符合角色的性格特点
2. 使用设定的说话风格
3. 自然地融入背景设定
4. 保持与用户的关系设定

现在开始对话吧。
```

**实现要点**:
- System Prompt应该作为第一条消息插入到对话历史中
- 或者在每次LLM调用时作为system message传递
- 需要根据LangChain的具体实现方式调整

### 第二部分：流式语音输出优化

#### 2.1 GPT-SoVITS流式模式

**API参数调整**:
- `streaming_mode`: 设置为`true`或整数（如`1`）启用流式模式
- 流式模式下，API会分块返回音频数据

**技术实现要点**:
- GPT-SoVITS的流式模式可能返回多个音频块
- 需要处理音频块的拼接
- 需要考虑音频格式（WAV）的头部信息处理

#### 2.2 功能点列表

**后端功能**:
- [ ] 修改TTS服务，支持流式模式
  - 添加`stream_text_to_speech_stream()`方法
  - 使用`streaming_mode=True`参数
  - 处理流式音频响应
- [ ] 修改聊天API，支持流式音频输出
  - 在文本生成完成后，启动流式TTS
  - 将音频块通过SSE流式发送到前端
  - 音频块格式：`{"type": "audio_chunk", "data": "base64_encoded_chunk", "index": 0}`
  - 音频完成格式：`{"type": "audio_complete"}`
- [ ] 处理音频格式问题
  - WAV文件头处理（第一个块包含文件头）
  - 后续块直接拼接音频数据

**前端功能**:
- [ ] 修改音频播放组件，支持流式播放
  - 接收音频块并拼接
  - 使用`MediaSource API`或`AudioContext`实现流式播放
  - 或者使用临时Blob URL，不断更新音频源
- [ ] 优化用户体验
  - 显示"正在生成语音..."状态
  - 音频开始播放时显示播放进度
  - 处理音频播放错误

#### 2.3 流式音频播放实现方案

**方案A：使用MediaSource Extensions (MSE)**
- 适用于支持MSE的浏览器
- 可以真正实现流式播放
- 需要处理音频格式转换（可能需要转换为MP3或其他格式）

**方案B：使用AudioContext + 临时Blob**
- 接收音频块后创建临时Blob
- 使用AudioContext播放
- 每次收到新块时更新音频源
- 实现相对简单，但可能不是真正的流式播放

**方案C：使用Web Audio API**
- 接收音频块后解码
- 使用AudioBuffer播放
- 可以实现真正的流式播放
- 需要处理WAV格式解码

**推荐方案**：先实现方案B（简单快速），如果GPT-SoVITS支持真正的流式输出，再考虑升级到方案C。

---

## 【API集成】

### 新增后端API接口

#### 1. GET /api/character
**功能**: 获取当前角色设定

**响应**:
```json
{
  "name": "角色名称",
  "personality": "性格描述",
  "background": "背景故事",
  "speaking_style": "说话风格",
  "appearance": "外观描述",
  "relationships": "关系设定"
}
```

#### 2. POST /api/character
**功能**: 更新角色设定

**请求体**:
```json
{
  "name": "角色名称",
  "personality": "性格描述",
  "background": "背景故事（可选）",
  "speaking_style": "说话风格（可选）",
  "appearance": "外观描述（可选）",
  "relationships": "关系设定（可选）"
}
```

**响应**: 同GET接口

#### 3. 修改 POST /api/chat
**功能**: 聊天接口，支持流式音频输出

**响应流式格式**（新增音频块类型）:
```
data: {"type": "text", "content": "文本块"}
data: {"type": "complete", "text": "完整文本"}
data: {"type": "audio_start"}  // 音频生成开始
data: {"type": "audio_chunk", "data": "base64_audio_chunk", "index": 0}
data: {"type": "audio_chunk", "data": "base64_audio_chunk", "index": 1}
...
data: {"type": "audio_complete"}  // 音频生成完成
```

### GPT-SoVITS API流式模式

#### POST /tts (流式模式)
**请求参数**:
```json
{
  "text": "要转换的文本",
  "text_lang": "zh",
  "ref_audio_path": "参考音频路径",
  "streaming_mode": true,  // 或 1
  "media_type": "wav",
  // ... 其他参数
}
```

**响应**: 
- Content-Type: 可能是`multipart/x-mixed-replace`或分块传输
- 需要根据GPT-SoVITS实际实现调整
- 如果返回的是多个音频块，需要处理每个块的接收和转发

---

## 【开发任务】

### 分阶段开发计划

#### 阶段1: 角色设定功能（2-3小时）

**步骤1.1: 后端数据模型和API**
- [ ] 创建`CharacterProfile`数据模型（`backend/app/models/character.py`）
- [ ] 创建角色设定API端点（`backend/app/api/character.py`）
- [ ] 实现角色设定存储（内存存储，后续可扩展）
- [ ] 实现System Prompt构建器（`backend/app/utils/prompt_builder.py`）

**步骤1.2: LLM服务集成**
- [ ] 修改`LLMService`，支持System Prompt
- [ ] 在`stream_chat`方法中集成角色设定
- [ ] 确保System Prompt正确传递到LLM

**步骤1.3: 前端角色设定界面**
- [ ] 创建`CharacterProfilePanel.tsx`组件
- [ ] 在`ConfigPanel`中添加"角色设定"标签页
- [ ] 实现角色设定的保存和加载
- [ ] 在聊天界面显示当前角色名称

**步骤1.4: 测试和验证**
- [ ] 测试角色设定的保存和加载
- [ ] 验证System Prompt是否正确应用
- [ ] 测试不同角色设定对LLM回复的影响

#### 阶段2: 流式语音输出（3-4小时）

**步骤2.1: 后端流式TTS实现**
- [ ] 研究GPT-SoVITS流式模式的响应格式
- [ ] 修改`TTSService`，添加`stream_text_to_speech()`方法
- [ ] 实现音频块的接收和处理
- [ ] 处理WAV文件头（第一个块）

**步骤2.2: 聊天API流式音频集成**
- [ ] 修改`generate_chat_stream()`函数
- [ ] 在文本生成完成后启动流式TTS
- [ ] 实现音频块的流式转发（通过SSE）
- [ ] 添加音频开始和完成的标记

**步骤2.3: 前端流式音频播放**
- [ ] 修改`useChat` hook，处理音频块消息
- [ ] 实现音频块拼接逻辑
- [ ] 修改`AudioPlayer`组件，支持流式播放
- [ ] 实现音频播放状态管理

**步骤2.4: 测试和优化**
- [ ] 测试流式音频的接收和播放
- [ ] 优化音频播放的流畅度
- [ ] 处理网络异常情况
- [ ] 优化用户体验（加载状态、错误提示）

### 代码结构变更

#### 新增文件
```
backend/
├── app/
│   ├── models/
│   │   └── character.py          # 角色设定数据模型
│   ├── api/
│   │   └── character.py          # 角色设定API端点
│   └── utils/
│       └── prompt_builder.py     # System Prompt构建器

frontend/
├── src/
│   ├── components/
│   │   └── CharacterProfilePanel.tsx  # 角色设定配置组件
│   └── types/
│       └── character.ts          # 角色设定类型定义
```

#### 修改文件
```
backend/
├── app/
│   ├── services/
│   │   ├── llm_service.py        # 添加System Prompt支持
│   │   └── tts_service.py        # 添加流式TTS方法
│   └── api/
│       └── chat.py               # 添加流式音频输出

frontend/
├── src/
│   ├── components/
│   │   ├── ConfigPanel.tsx      # 添加角色设定标签页
│   │   ├── ChatInterface.tsx    # 显示角色名称
│   │   └── AudioPlayer.tsx      # 支持流式播放
│   ├── hooks/
│   │   └── useChat.ts           # 处理音频块消息
│   └── types/
│       └── index.ts             # 添加角色设定和音频块类型
```

### 关键实现点

#### 1. System Prompt构建示例
```python
def build_system_prompt(character: CharacterProfile) -> str:
    """Build system prompt from character profile"""
    prompt_parts = [
        f"你是一个名为{character.name}的虚拟角色。",
        "",
        "【性格】",
        character.personality,
        ""
    ]
    
    if character.background:
        prompt_parts.extend([
            "【背景】",
            character.background,
            ""
        ])
    
    if character.speaking_style:
        prompt_parts.extend([
            "【说话风格】",
            character.speaking_style,
            ""
        ])
    
    if character.relationships:
        prompt_parts.extend([
            "【与用户的关系】",
            character.relationships,
            ""
        ])
    
    prompt_parts.extend([
        "请严格按照以上设定来回复用户的消息，保持角色的一致性。",
        "现在开始对话吧。"
    ])
    
    return "\n".join(prompt_parts)
```

#### 2. LLM服务集成System Prompt
```python
async def stream_chat(
    self,
    message: str,
    history: List[Message] = None,
    system_prompt: str = None
) -> AsyncIterator[str]:
    """Stream chat with optional system prompt"""
    messages = []
    
    # Add system prompt if provided
    if system_prompt:
        messages.append({
            "role": "system",
            "content": system_prompt
        })
    
    # Add history and current message
    messages.extend(self._build_messages_from_history(history or [], message))
    
    # Stream response
    async for chunk in self.llm.astream(messages):
        # ... existing chunk handling
```

#### 3. 流式TTS实现示例
```python
async def stream_text_to_speech(
    self,
    text: str,
    text_lang: str,
    ref_audio_path: str,
    **kwargs
) -> AsyncIterator[bytes]:
    """Stream TTS audio chunks"""
    url = f"{self.base_url}/tts"
    payload = {
        "text": text,
        "text_lang": text_lang,
        "ref_audio_path": ref_audio_path,
        "streaming_mode": True,  # Enable streaming
        "media_type": "wav",
        **kwargs
    }
    
    async with aiohttp.ClientSession(timeout=self.timeout) as session:
        async with session.post(url, json=payload) as response:
            if response.status == 200:
                # Stream audio chunks
                async for chunk in response.content.iter_chunked(8192):
                    if chunk:
                        yield chunk
            else:
                raise Exception(f"TTS API error: {response.status}")
```

#### 4. 前端音频块处理示例
```typescript
// In useChat.ts
const handleAudioChunk = (chunk: string, index: number) => {
  // Convert base64 to blob
  const audioData = base64ToBlob(chunk, 'audio/wav')
  
  // Append to audio buffer
  if (index === 0) {
    // First chunk - create new audio source
    setCurrentAudioChunks([audioData])
  } else {
    // Append chunk
    setCurrentAudioChunks(prev => [...prev, audioData])
  }
  
  // If we have enough chunks, start playing
  if (index === 0) {
    playAudioStream(currentAudioChunks)
  }
}

const playAudioStream = (chunks: Blob[]) => {
  // Combine chunks into single blob
  const combinedBlob = new Blob(chunks, { type: 'audio/wav' })
  const audioUrl = URL.createObjectURL(combinedBlob)
  
  // Play audio
  const audio = new Audio(audioUrl)
  audio.play()
  
  // Clean up
  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(audioUrl)
  })
}
```

---

## 【验收标准】

### 角色设定功能验收

#### 功能验收
- [ ] 用户可以配置角色的所有基本信息（名称、性格、背景等）
- [ ] 角色设定能够正确保存和加载
- [ ] LLM的回复符合角色设定（性格、说话风格等）
- [ ] 角色名称显示在聊天界面
- [ ] 不同角色设定会产生不同的回复风格

#### 技术验收
- [ ] System Prompt正确构建和传递
- [ ] 角色设定数据模型完整
- [ ] API接口正常工作
- [ ] 前端界面友好易用

### 流式语音输出验收

#### 功能验收
- [ ] 音频能够流式输出（不需要等待完整音频生成）
- [ ] 音频播放流畅，无明显卡顿
- [ ] 音频块正确拼接
- [ ] 音频播放状态正确显示
- [ ] 网络异常时能够正确处理

#### 性能验收
- [ ] 音频开始播放时间 < 文本生成完成后3秒
- [ ] 音频播放延迟 < 500ms（相对于音频生成）
- [ ] 内存占用合理（音频块及时清理）

#### 技术验收
- [ ] GPT-SoVITS流式模式正确调用
- [ ] 音频块正确接收和转发
- [ ] 前端音频播放实现正确
- [ ] 错误处理完善

---

## 【技术难点和注意事项】

### 角色设定相关

1. **System Prompt长度限制**
   - 某些LLM对System Prompt长度有限制
   - 如果角色设定过长，需要截断或优化
   - 建议限制每个字段的最大长度

2. **角色一致性**
   - 需要确保角色设定在整个对话中保持一致
   - System Prompt应该在每次对话开始时应用
   - 对话历史中不应该重复添加System Prompt

3. **默认角色设定**
   - 如果没有配置角色设定，应该使用默认设定
   - 或者提示用户先配置角色设定

### 流式音频相关

1. **GPT-SoVITS流式模式实现**
   - 需要先测试GPT-SoVITS的流式模式实际行为
   - 确认返回格式（分块、multipart等）
   - 确认音频格式（WAV头部处理）

2. **音频格式处理**
   - WAV文件有文件头，第一个块需要包含文件头
   - 后续块直接拼接音频数据
   - 如果GPT-SoVITS返回的格式不同，需要相应调整

3. **浏览器兼容性**
   - MediaSource API需要现代浏览器支持
   - 需要提供降级方案（完整音频播放）
   - 测试不同浏览器的音频播放表现

4. **网络异常处理**
   - 音频流中断时的处理
   - 部分音频块丢失时的处理
   - 超时和重试机制

---

## 【测试建议】

### 角色设定测试

1. **基础功能测试**
   - 创建、保存、加载角色设定
   - 修改角色设定后验证LLM回复变化
   - 清空角色设定后使用默认设定

2. **角色一致性测试**
   - 多轮对话中角色设定保持一致
   - 不同话题下角色设定仍然有效
   - 长时间对话后角色设定不丢失

3. **边界情况测试**
   - 超长角色设定（需要截断）
   - 空角色设定（使用默认）
   - 特殊字符处理

### 流式音频测试

1. **基础功能测试**
   - 短文本的流式音频生成和播放
   - 长文本的流式音频生成和播放
   - 不同语言的流式音频

2. **性能测试**
   - 音频开始播放时间
   - 音频播放流畅度
   - 内存占用情况

3. **异常情况测试**
   - 网络中断时的处理
   - GPT-SoVITS服务异常时的处理
   - 音频块丢失时的处理
   - 浏览器不支持流式播放时的降级

---

## 【后续优化方向】

1. **角色设定增强**
   - 支持多个角色切换
   - 角色设定模板库
   - 角色设定导入/导出

2. **流式音频优化**
   - 真正的实时流式播放（零延迟）
   - 音频质量优化
   - 支持更多音频格式

3. **用户体验优化**
   - 角色设定可视化编辑器
   - 音频播放进度条
   - 音频播放速度控制

---

**提示词生成时间**: 2025-01-XX
**版本**: Phase 2 v1.0
**基于**: MVP v1.0

