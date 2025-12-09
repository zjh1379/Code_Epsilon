# GPT-SoVITS 流式音频开发指南

## 【重要提示】

本文档基于 GPT-SoVITS API v2 (`api_v2.py`) 的实际实现，提供了流式音频功能的完整开发指南。**请仔细阅读 streaming_mode 参数的使用说明，这是实现流式音频的关键**。

---

## 【一、streaming_mode 参数详解】

### 1.1 参数取值和含义

**⚠️ 关键信息**：`streaming_mode` 必须使用**整数**，不能使用布尔值！

| 值 | 类型 | 内部处理 | 响应速度 | 音频质量 | 使用场景 |
|---|------|---------|---------|---------|---------|
| `0` | int | `streaming_mode=False`<br>`return_fragment=False` | - | 最高 | 非流式场景，一次性返回完整音频 |
| `1` | int | `streaming_mode=False`<br>`return_fragment=True` | **慢** | 最高 | **不推荐**，需先跑完一大段后才开始返回chunk |
| `2` | int | `streaming_mode=True`<br>`return_fragment=False` | **中等** | 中等 | **推荐使用**，真流式边算边推，chunk可变长 |
| `3` | int | `streaming_mode=True`<br>`return_fragment=False`<br>`fixed_length_chunk=True` | **快** | 较低 | 需要固定长度chunk时使用 |
| `True` | bool | **等同于1** | 慢 | 最高 | **不要使用**，会走模式1而不是模式2 |
| `False` | bool | 等同于0 | - | 最高 | 非流式场景 |

**重要说明**：
- 模式1虽然也会走流式响应（因为 `streaming_mode = streaming_mode or return_fragment`），但它是 `return_fragment` 模式，需要等待TTS生成一大段音频后才开始返回，**不是真正的实时流式**。
- 模式2和3才是真正的流式模式（`streaming_mode=True`），边算边推，延迟低。

### 1.2 常见错误

❌ **错误示例**：

```python
payload = {
    "streaming_mode": True,  # ❌ 这会走模式1，不是模式2！
    "streaming_mode": 1,     # ❌ 这是return_fragment模式，需要等待较长时间才开始返回！
}
```

✅ **正确示例**：

```python
payload = {
    "streaming_mode": 2,  # ✅ 真流式，边算边推，推荐
    # 或
    "streaming_mode": 3,  # ✅ 真流式，固定长度chunk
}
```

---

## 【二、流式响应格式】

### 2.1 响应格式说明

当 `streaming_mode=2` 或 `streaming_mode=3` 且 `media_type="wav"` 时：

1. **第一个chunk**：包含完整的WAV文件头（44字节），由 `wave_header_chunk()` 生成
2. **后续chunk**：裸PCM数据（无文件头），由 `pack_raw()` 直接转换numpy array为bytes

**重要细节**：
- 服务端在发送第一个chunk后，会将内部变量 `media_type` 切换为 `"raw"`（用于后续chunk的打包），但**HTTP响应的 `Content-Type` 始终是 `audio/wav`**（从原始请求参数 `media_type` 获取）
- 第一个chunk是完整的WAV header（44字节），包含采样率、声道数等信息
- 后续chunk是16位有符号小端整数PCM数据，需要直接追加到第一个chunk后面

### 2.2 客户端处理逻辑

```python
# 伪代码示例
is_first_chunk = True
audio_buffer = BytesIO()

async for chunk in response.content.iter_chunked(8192):
    if chunk:
        if is_first_chunk:
            # 第一个chunk包含WAV header（44字节），直接写入
            audio_buffer.write(chunk)
            is_first_chunk = False
            # 此时可以开始播放（但建议等待至少第二个chunk以确保有音频数据）
        else:
            # 后续chunk是裸PCM数据，直接追加
            audio_buffer.write(chunk)
            # 可以实时播放或追加到播放缓冲区
```

**播放建议**：
- 收到第一个chunk（WAV header）后，可以立即开始准备播放器
- 建议等待收到至少第二个chunk（包含实际音频数据）后再开始播放
- 后续chunk可以边收边播，实现真正的流式播放

---

## 【三、完整实现示例】

### 3.1 后端实现（Python aiohttp）

#### 最小可行示例

```python
import aiohttp
from io import BytesIO

async def stream_text_to_speech(
    text: str,
    text_lang: str,
    ref_audio_path: str,
    prompt_lang: str,
    prompt_text: str = "",
    **kwargs
) -> AsyncIterator[bytes]:
    """
    Stream TTS audio chunks from GPT-SoVITS API
    
    Args:
        text: Text to synthesize
        text_lang: Text language (zh/en/ja/ko/yue, 需要小写)
        ref_audio_path: Reference audio file path
        prompt_lang: Prompt language (zh/en/ja/ko/yue, 需要小写)
        prompt_text: Prompt text (optional)
        **kwargs: Other TTS parameters
    
    Yields:
        Audio chunks as bytes
    """
    url = "http://127.0.0.1:9880/tts"
    
    # 构建请求payload
    payload = {
        "text": text.strip(),
        "text_lang": text_lang.lower(),  # ⚠️ 必须小写
        "ref_audio_path": ref_audio_path,
        "prompt_lang": prompt_lang.lower(),  # ⚠️ 必须小写
        "prompt_text": prompt_text.strip() if prompt_text else "",
        "media_type": "wav",
        "streaming_mode": 2,  # ⚠️ 必须使用整数2或3，不能用True
        # 其他参数使用默认值或从kwargs传入
        "text_split_method": kwargs.get("text_split_method", "cut5"),
        "top_k": kwargs.get("top_k", 5),
        "top_p": kwargs.get("top_p", 1.0),
        "temperature": kwargs.get("temperature", 1.0),
        "speed_factor": kwargs.get("speed_factor", 1.0),
        "fragment_interval": kwargs.get("fragment_interval", 0.3),
        "overlap_length": kwargs.get("overlap_length", 2),
        "min_chunk_length": kwargs.get("min_chunk_length", 16),
        # 其他必需参数
        "batch_size": 1,
        "batch_threshold": 0.75,
        "split_bucket": True,
        "seed": -1,
        "parallel_infer": True,
        "repetition_penalty": 1.35,
        "sample_steps": 32,
        "super_sampling": False,
    }
    
    # 设置较长的超时时间（流式响应可能需要较长时间）
    timeout = aiohttp.ClientTimeout(total=300)  # 5分钟
    
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as response:
                # 检查HTTP状态码
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"TTS API error {response.status}: {error_text}")
                
                # 流式读取音频chunk
                chunk_count = 0
                async for chunk in response.content.iter_chunked(8192):
                    if chunk:
                        chunk_count += 1
                        yield chunk
                        
                if chunk_count == 0:
                    raise Exception("No audio chunks received")
                    
    except aiohttp.ClientError as e:
        raise Exception(f"TTS API request failed: {str(e)}")
    except Exception as e:
        raise Exception(f"TTS streaming error: {str(e)}")
```

#### 完整实现（带错误处理和重试）

```python
import aiohttp
import asyncio
import logging
from typing import AsyncIterator, Optional

logger = logging.getLogger(__name__)

class TTSService:
    """GPT-SoVITS TTS服务封装"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:9880"):
        self.base_url = base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=300)  # 5分钟超时
    
    async def stream_text_to_speech(
        self,
        text: str,
        text_lang: str,
        ref_audio_path: str,
        prompt_lang: str,
        prompt_text: str = "",
        streaming_mode: int = 2,  # 默认使用模式2（真流式）
        media_type: str = "wav",
        text_split_method: str = "cut5",
        top_k: int = 5,
        top_p: float = 1.0,
        temperature: float = 1.0,
        speed_factor: float = 1.0,
        fragment_interval: float = 0.3,
        overlap_length: int = 2,
        min_chunk_length: int = 16,
        max_retries: int = 3
    ) -> AsyncIterator[bytes]:
        """
        流式TTS音频生成
        
        Args:
            text: 要合成的文本
            text_lang: 文本语言 (zh/en/ja/ko/yue, 需要小写)
            ref_audio_path: 参考音频路径
            prompt_lang: 提示语言 (zh/en/ja/ko/yue, 需要小写)
            prompt_text: 提示文本
            streaming_mode: 流式模式 (2=真流式可变长, 3=真流式固定长度)
            media_type: 媒体类型 (wav/raw/ogg/aac)
            max_retries: 最大重试次数
        
        Yields:
            音频数据块（bytes）
        """
        url = f"{self.base_url}/tts"
        
        # 参数验证
        if not text or not text.strip():
            raise ValueError("text不能为空")
        if not ref_audio_path:
            raise ValueError("ref_audio_path不能为空")
        if streaming_mode not in [0, 1, 2, 3]:
            raise ValueError(f"streaming_mode必须是0/1/2/3，当前值: {streaming_mode}")
        if media_type not in ["wav", "raw", "ogg", "aac"]:
            raise ValueError(f"不支持的media_type: {media_type}")
        
        # 注意：text_lang和prompt_lang的实际支持值取决于tts_config.languages
        # 这里只做基本验证，实际验证由API服务器完成
        
        # 构建请求payload
        payload = {
            "text": text.strip(),
            "text_lang": text_lang.lower(),  # ⚠️ 必须小写
            "ref_audio_path": ref_audio_path,
            "prompt_lang": prompt_lang.lower(),  # ⚠️ 必须小写
            "prompt_text": prompt_text.strip() if prompt_text else "",
            "media_type": media_type,
            "streaming_mode": streaming_mode,  # ⚠️ 必须是整数
            "text_split_method": text_split_method,
            "top_k": top_k,
            "top_p": top_p,
            "temperature": temperature,
            "speed_factor": speed_factor,
            "fragment_interval": fragment_interval,
            "overlap_length": overlap_length,
            "min_chunk_length": min_chunk_length,
            # 其他默认参数
            "batch_size": 1,
            "batch_threshold": 0.75,
            "split_bucket": True,
            "seed": -1,
            "parallel_infer": True,
            "repetition_penalty": 1.35,
            "sample_steps": 32,
            "super_sampling": False,
        }
        
        # 重试逻辑
        for attempt in range(max_retries):
            try:
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.post(url, json=payload) as response:
                        # 检查HTTP状态码
                        if response.status != 200:
                            error_text = await response.text()
                            try:
                                import json
                                error_json = json.loads(error_text)
                                error_msg = error_json.get("message", "Unknown error")
                                error_exception = error_json.get("Exception", "")
                            except:
                                error_msg = error_text
                            
                            logger.error(f"TTS API error {response.status}: {error_msg}")
                            if error_exception:
                                logger.error(f"Exception details: {error_exception}")
                            
                            # 400错误不重试，其他错误重试
                            if response.status == 400:
                                raise Exception(f"TTS API错误: {error_msg}")
                            elif attempt < max_retries - 1:
                                wait_time = 2 ** attempt
                                logger.info(f"重试TTS请求，等待{wait_time}秒...")
                                await asyncio.sleep(wait_time)
                                continue
                            else:
                                raise Exception(f"TTS API错误: {error_msg}")
                        
                        # 流式读取音频chunk
                        chunk_count = 0
                        first_chunk_size = 0
                        async for chunk in response.content.iter_chunked(8192):
                            if chunk:
                                chunk_count += 1
                                if chunk_count == 1:
                                    first_chunk_size = len(chunk)
                                    logger.debug(f"收到第一个chunk (WAV header), 大小: {len(chunk)} bytes")
                                else:
                                    logger.debug(f"收到音频chunk #{chunk_count}, 大小: {len(chunk)} bytes")
                                yield chunk
                        
                        if chunk_count == 0:
                            logger.warning("未收到任何音频chunk")
                            if attempt < max_retries - 1:
                                wait_time = 2 ** attempt
                                await asyncio.sleep(wait_time)
                                continue
                            else:
                                raise Exception("TTS流式响应未返回任何数据")
                        
                        # 验证第一个chunk是WAV header（约44字节）
                        if first_chunk_size > 0 and first_chunk_size < 50:
                            logger.info(f"成功接收{chunk_count}个音频chunk，第一个chunk大小: {first_chunk_size} bytes (WAV header)")
                        else:
                            logger.warning(f"第一个chunk大小异常: {first_chunk_size} bytes")
                        
                        return  # 成功，退出重试循环
                        
            except asyncio.TimeoutError:
                logger.error(f"TTS API超时 (尝试 {attempt + 1}/{max_retries})")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                raise Exception("TTS API请求超时")
                
            except Exception as e:
                logger.error(f"TTS流式请求异常: {str(e)}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                    continue
                raise
        
        raise Exception("TTS流式请求失败，已达到最大重试次数")
```

### 3.2 在聊天API中集成流式TTS

```python
import json
import base64
import logging

logger = logging.getLogger(__name__)

async def generate_chat_stream(request: ChatRequest, tts_service: TTSService):
    """生成流式聊天响应（文本+音频）"""
    full_text = ""
    
    try:
        # 1. 流式生成文本
        async for chunk in llm_service.stream_chat(...):
            full_text += chunk
            yield f"data: {json.dumps({'type': 'text', 'content': chunk}, ensure_ascii=False)}\n\n"
        
        # 2. 发送文本完成信号
        yield f"data: {json.dumps({'type': 'complete', 'text': full_text}, ensure_ascii=False)}\n\n"
        
        # 3. 开始流式音频生成
        yield f"data: {json.dumps({'type': 'audio_start'}, ensure_ascii=False)}\n\n"
        
        chunk_index = 0
        async for audio_chunk in tts_service.stream_text_to_speech(
            text=full_text,
            text_lang=request.config.text_lang.lower(),  # ⚠️ 必须小写
            ref_audio_path=request.config.ref_audio_path,
            prompt_lang=request.config.prompt_lang.lower(),  # ⚠️ 必须小写
            prompt_text=request.config.prompt_text,
            streaming_mode=2,  # ⚠️ 使用整数2
            media_type="wav"
        ):
            # 将音频chunk编码为base64
            audio_chunk_base64 = base64.b64encode(audio_chunk).decode('utf-8')
            
            # 通过SSE发送音频chunk
            yield f"data: {json.dumps({
                'type': 'audio_chunk',
                'data': audio_chunk_base64,
                'index': chunk_index,
                'size': len(audio_chunk)
            }, ensure_ascii=False)}\n\n"
            
            chunk_index += 1
        
        # 4. 发送音频完成信号
        yield f"data: {json.dumps({'type': 'audio_complete', 'total_chunks': chunk_index}, ensure_ascii=False)}\n\n"
        
    except Exception as e:
        logger.error(f"流式生成错误: {str(e)}")
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)}, ensure_ascii=False)}\n\n"
```

---

## 【四、前端实现（TypeScript/React）】

### 4.1 接收和处理音频chunk

```typescript
// useChat.ts 或类似的文件

interface AudioChunkMessage {
  type: 'audio_chunk'
  data: string  // base64编码的音频数据
  index: number
  size: number
}

const handleAudioChunk = (chunk: AudioChunkMessage) => {
  // 将base64解码为Uint8Array
  const binaryString = atob(chunk.data)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  // 处理音频chunk
  if (chunk.index === 0) {
    // 第一个chunk包含WAV header（44字节），创建新的音频数组
    setAudioChunks([bytes])
    console.log(`收到第一个chunk (WAV header), 大小: ${chunk.size} bytes`)
  } else {
    // 后续chunk是裸PCM数据，追加到数组
    setAudioChunks(prev => [...prev, bytes])
    console.log(`收到音频chunk #${chunk.index}, 大小: ${chunk.size} bytes`)
  }
}
```

### 4.2 流式音频播放实现

#### 方案A：使用Blob URL（推荐，简单）

```typescript
import { useState, useRef, useEffect } from 'react'

const [audioChunks, setAudioChunks] = useState<Uint8Array[]>([])
const [audioUrl, setAudioUrl] = useState<string | null>(null)
const audioRef = useRef<HTMLAudioElement | null>(null)
const [isPlaying, setIsPlaying] = useState(false)

// 当收到新的音频chunk时
useEffect(() => {
  if (audioChunks.length > 0) {
    // 合并所有chunk为单个Uint8Array
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of audioChunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    
    // 创建Blob
    const combinedBlob = new Blob([combined], { type: 'audio/wav' })
    const url = URL.createObjectURL(combinedBlob)
    
    // 更新音频URL
    setAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)  // 清理旧的URL
      return url
    })
    
    // 如果音频还未播放，开始播放
    if (audioRef.current && !isPlaying) {
      audioRef.current.src = url
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true)
          console.log('开始播放音频')
        })
        .catch(err => {
          console.error('音频播放失败:', err)
        })
    }
  }
}, [audioChunks])

// 组件中使用
<audio
  ref={audioRef}
  src={audioUrl || undefined}
  controls
  onEnded={() => {
    // 播放结束后清理
    setIsPlaying(false)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setAudioChunks([])
  }}
/>
```

#### 方案B：使用Web Audio API（更高级，支持真正的流式播放）

```typescript
import { useState, useRef, useEffect } from 'react'

const useStreamingAudio = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const audioChunksRef = useRef<Uint8Array[]>([])
  const playStartTimeRef = useRef<number>(0)
  
  // 初始化AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])
  
  // 添加音频chunk
  const addAudioChunk = async (chunk: Uint8Array, index: number) => {
    audioChunksRef.current.push(chunk)
    
    // 如果还未开始播放，且至少收到2个chunk（header + 第一个音频chunk），开始播放
    if (!isPlaying && audioChunksRef.current.length >= 2) {
      await startPlayback()
    } else if (isPlaying) {
      // 如果正在播放，追加到当前播放（需要重新解码和播放）
      // 注意：这是一个简化实现，更高级的实现可以使用AudioWorklet实现真正的流式播放
      await restartPlayback()
    }
  }
  
  // 开始播放
  const startPlayback = async () => {
    if (!audioContextRef.current) return
    
    try {
      // 合并所有chunk
      const totalLength = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of audioChunksRef.current) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      
      // 解码音频
      const audioBuffer = await audioContextRef.current.decodeAudioData(combined.buffer)
      
      // 创建源节点
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      
      sourceNodeRef.current = source
      setIsPlaying(true)
      playStartTimeRef.current = audioContextRef.current.currentTime
      
      // 播放
      source.start(0)
      
      // 播放结束处理
      source.onended = () => {
        setIsPlaying(false)
        audioChunksRef.current = []
      }
    } catch (error) {
      console.error('音频播放错误:', error)
      setIsPlaying(false)
    }
  }
  
  // 重新播放（追加新chunk后）
  const restartPlayback = async () => {
    // 停止当前播放
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch (e) {
        // 忽略已停止的错误
      }
      sourceNodeRef.current = null
    }
    
    // 重新开始播放
    await startPlayback()
  }
  
  return {
    addAudioChunk,
    isPlaying,
    stop: () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          // 忽略已停止的错误
        }
        sourceNodeRef.current = null
      }
      setIsPlaying(false)
      audioChunksRef.current = []
    }
  }
}
```

### 4.3 EventSource处理流式响应

```typescript
const eventSource = new EventSource('/api/chat', {
  method: 'POST',
  body: JSON.stringify(request)
})

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch (data.type) {
    case 'text':
      // 处理文本chunk
      setCurrentText(prev => prev + data.content)
      break
      
    case 'complete':
      // 文本生成完成
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.text
      }])
      break
      
    case 'audio_start':
      // 音频生成开始
      setAudioChunks([])
      setIsGeneratingAudio(true)
      break
      
    case 'audio_chunk':
      // 处理音频chunk
      handleAudioChunk(data)
      break
      
    case 'audio_complete':
      // 音频生成完成
      setIsGeneratingAudio(false)
      break
      
    case 'error':
      // 处理错误
      setError(data.error)
      break
  }
}
```

---

## 【五、参数验证和错误处理】

### 5.1 必需参数

以下参数**必须**提供：

- `text`: 要合成的文本（不能为空）
- `text_lang`: 文本语言（**必须小写**，实际支持值取决于 `tts_config.languages`，常见值: zh/en/ja/ko/yue）
- `ref_audio_path`: 参考音频路径（不能为空）
- `prompt_lang`: 提示语言（**必须小写**，实际支持值取决于 `tts_config.languages`，常见值: zh/en/ja/ko/yue）

### 5.2 可选参数限制

- `text_split_method`: 必须在 `cut_method_names` 列表中（通常是: "cut0", "cut1", "cut2", "cut3", "cut4", "cut5"）
- `media_type`: 仅支持 `wav` / `raw` / `ogg` / `aac`
- `streaming_mode`: 必须是 `0` / `1` / `2` / `3`（整数）或 `True` / `False`（布尔值，但不推荐）

### 5.3 错误处理

```python
# 检查API返回的错误
if response.status != 200:
    try:
        error_data = await response.json()
        error_message = error_data.get("message", "Unknown error")
        error_exception = error_data.get("Exception", "")
    except:
        error_text = await response.text()
        error_message = error_text
    
    # 常见错误：
    # - "ref_audio_path is required"
    # - "text is required"
    # - "text_lang: xx is not supported in version v4"
    # - "prompt_lang: xx is not supported in version v4"
    # - "media_type: xx is not supported"
    # - "text_split_method: xx is not supported"
    # - "the value of streaming_mode must be 0, 1, 2, 3(int) or true/false(bool)"
    
    raise Exception(f"TTS API错误: {error_message}")
```

---

## 【六、常见问题和解决方案】

### Q1: 为什么传 `streaming_mode=True` 没有实现真流式？

**A**: `True` 会被转换为模式1（`return_fragment` 模式），不是模式2（真流式）。必须使用整数 `2` 或 `3`。

### Q2: 第一个chunk和后续chunk格式不同怎么办？

**A**: 
- 第一个chunk包含WAV header（44字节），直接使用
- 后续chunk是裸PCM数据（16位有符号小端整数），直接追加到第一个chunk后面
- 客户端不需要特殊处理，直接拼接即可形成完整的WAV文件

### Q3: 如何选择合适的chunk大小？

**A**: 
- `iter_chunked(8192)` 是常用值（8KB）
- 可以尝试 `4096`（4KB）或 `16384`（16KB）
- 较小的chunk延迟更低，但网络开销更大
- 建议根据实际网络情况调整

### Q4: 流式模式下音频质量如何？

**A**: 
- 模式2：中等质量，中等速度（**推荐**）
- 模式3：较低质量，较快速度
- 模式1：最高质量，但需要等待较长时间才开始返回（不推荐）

### Q5: 如何处理网络中断？

**A**: 
- 实现重试机制（指数退避）
- 记录已接收的chunk，断线重连后可以续传（如果API支持）
- 设置合理的超时时间（建议300秒）

### Q6: 收到第一个chunk就播放是否现实？

**A**: 
- **技术上可行**：第一个chunk包含WAV header（44字节），可以立即创建播放器
- **实际建议**：等待至少第二个chunk（包含实际音频数据）后再开始播放，确保有足够的音频数据缓冲
- 如果立即播放第一个chunk，播放器可能会因为缺少音频数据而暂停或报错

### Q7: 如何验证流式响应是否正常工作？

**A**: 
- 检查第一个chunk大小是否为44字节左右（WAV header）
- 检查后续chunk是否持续到达
- 检查HTTP响应头 `Content-Type` 是否为 `audio/wav`
- 检查是否有错误响应（status != 200）

---

## 【七、测试建议】

### 7.1 单元测试

```python
import pytest
from app.services.tts_service import TTSService

@pytest.mark.asyncio
async def test_stream_text_to_speech():
    """测试流式TTS"""
    service = TTSService()
    
    chunks = []
    async for chunk in service.stream_text_to_speech(
        text="测试文本",
        text_lang="zh",
        ref_audio_path="/path/to/ref.wav",
        prompt_lang="zh",
        streaming_mode=2
    ):
        chunks.append(chunk)
    
    assert len(chunks) > 0
    assert len(chunks[0]) >= 44  # 第一个chunk应该包含WAV header（44字节）
    assert len(chunks) > 1  # 应该至少有两个chunk（header + 音频数据）
```

### 7.2 集成测试

```python
@pytest.mark.asyncio
async def test_chat_with_streaming_audio():
    """测试聊天接口的流式音频"""
    # 发送聊天请求
    # 验证收到文本chunk
    # 验证收到音频chunk
    # 验证第一个音频chunk是WAV header
    # 验证音频可以播放
    pass
```

---

## 【八、性能优化建议】

1. **使用连接池**：复用HTTP连接，减少连接开销
2. **调整chunk大小**：根据网络情况调整 `iter_chunked` 的大小（建议8KB-16KB）
3. **并行处理**：文本生成和音频生成可以并行（如果API支持）
4. **缓存**：相同文本的音频可以缓存（注意：流式模式下缓存策略需要特殊处理）
5. **预加载**：在用户可能需要的场景下，提前预加载参考音频

---

## 【九、总结】

### 关键要点

1. ✅ **streaming_mode必须使用整数2或3**，不能使用布尔值 `True`
2. ✅ **第一个chunk包含WAV header（44字节）**，后续chunk是裸PCM数据
3. ✅ **text_lang和prompt_lang必须小写**，实际支持值取决于服务器配置
4. ✅ **使用iter_chunked持续读取**，不要一次性读取全部
5. ✅ **设置合理的超时时间**（建议300秒）
6. ✅ **实现错误处理和重试机制**
7. ✅ **收到第一个chunk后可以准备播放器，但建议等待第二个chunk再开始播放**

### 推荐配置

```python
payload = {
    "text": "要合成的文本",
    "text_lang": "zh",  # ⚠️ 必须小写
    "ref_audio_path": "参考音频路径",
    "prompt_lang": "zh",  # ⚠️ 必须小写
    "prompt_text": "提示文本",
    "media_type": "wav",
    "streaming_mode": 2,  # ⚠️ 真流式，推荐使用整数2
    "text_split_method": "cut5",
    "top_k": 5,
    "top_p": 1.0,
    "temperature": 1.0,
    "speed_factor": 1.0,
    "fragment_interval": 0.3,
    "overlap_length": 2,
    "min_chunk_length": 16,
}
```

---

**文档版本**: v2.0  
**最后更新**: 2025-01-XX  
**基于**: GPT-SoVITS API v2 (`api_v2.py`) 实现  
**兼容性**: GPT-SoVITS v2pro-20250604

