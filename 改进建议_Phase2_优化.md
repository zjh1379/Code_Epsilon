# 异界声律·Epsilon - Phase 2 优化改进建议

## 【改进概述】

本文档描述Phase 2阶段的三个优化改进需求，旨在提升用户体验和界面可用性。

---

## 【改进需求1：默认配置功能】

### 需求描述

用户希望应用提供一套默认的TTS配置，避免每次启动都需要重复填写相同的配置项。

### 默认配置值

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ref_audio_path` | `C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\output_100isekai\参考音频\vocal_3year.wav.reformatted_vocals.flac_main_vocal.flac_10.flac_0007446080_0007595520.wav` | 参考音频文件路径 |
| `prompt_text` | `こちらの楽曲は春巻ごはんさんに作っていただいた楽曲なんですけど` | 参考音频文本内容 |
| `prompt_lang` | `ja` | 参考音频语种（日语） |
| `text_lang` | `zh` | 合成音频语种（中英混合，使用zh表示） |
| `top_k` | `15` | Top K采样参数 |
| `gpt_weights_path` | `C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\GPT_weights_v2Pro\isekai60-e15.ckpt` | GPT模型权重路径 |
| `sovits_weights_path` | `C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\SoVITS_weights_v2Pro\isekai60_e8_s248.pth` | SoVITS模型权重路径 |

### 实现要求

#### 后端实现
1. **默认配置定义**
   - 在`backend/app/api/config.py`中定义`DEFAULT_CONFIG`常量字典
   - 包含上述所有默认配置值
   - 使用原始字符串（raw string）处理Windows路径

2. **配置初始化逻辑**
   - 应用启动时，检查当前配置是否为空
   - 如果配置为空（特别是`ref_audio_path`为空），自动使用默认配置填充
   - 记录日志，标识使用了默认配置

3. **配置更新逻辑**
   - 用户仍可以修改所有配置项
   - 修改后的配置正常保存
   - 默认配置不影响用户自定义配置

#### 前端实现
1. **配置面板加载**
   - 配置面板打开时，如果后端返回的配置为空，自动填充默认值
   - 显示默认值，用户可以修改

2. **用户体验**
   - 首次使用用户看到的是默认配置，可以直接开始使用
   - 配置项旁边可以添加"重置为默认"按钮（可选）

### 代码示例

#### 后端默认配置定义
```python
# backend/app/api/config.py

# Default configuration constants
DEFAULT_CONFIG = {
    "ref_audio_path": r"C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\output_100isekai\参考音频\vocal_3year.wav.reformatted_vocals.flac_main_vocal.flac_10.flac_0007446080_0007595520.wav",
    "prompt_text": "こちらの楽曲は春巻ごはんさんに作っていただいた楽曲なんですけど",
    "prompt_lang": "ja",
    "text_lang": "zh",
    "text_split_method": "cut5",
    "speed_factor": 1.0,
    "fragment_interval": 0.3,
    "top_k": 15,
    "top_p": 1.0,
    "temperature": 1.0,
    "gpt_weights_path": r"C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\GPT_weights_v2Pro\isekai60-e15.ckpt",
    "sovits_weights_path": r"C:\GPT-SoVITS\GPT-SoVITS-v2pro-20250604\SoVITS_weights_v2Pro\isekai60_e8_s248.pth"
}

# Initialize config with defaults if empty
def _initialize_config_with_defaults():
    """Initialize config cache with default values if empty"""
    global _config_cache
    if not _config_cache.get("ref_audio_path"):
        _config_cache.update(DEFAULT_CONFIG)
        logger.info("Configuration initialized with default values")
```

### 验收标准

- [ ] 应用首次启动时，如果配置为空，自动使用默认配置
- [ ] 默认配置包含所有必需字段
- [ ] 用户仍可以修改所有配置项
- [ ] 修改后的配置正确保存和应用
- [ ] 默认配置值正确（路径、文本、参数等）

---

## 【改进需求2：切换助手界面优化】

### 需求描述

优化"切换助手"界面，改进角色选择和管理的用户体验。

### 具体需求

#### 2.1 下拉框选择角色
- **当前问题**：角色选择方式不明确
- **改进方案**：使用HTML `<select>`下拉框显示所有可用角色
- **实现要求**：
  - 下拉框显示所有角色（Epsilon + 自定义角色）
  - 每个选项显示角色名称
  - Epsilon角色显示为"Epsilon (ε) (默认)"

#### 2.2 默认选择Epsilon
- **当前问题**：需要明确默认角色
- **改进方案**：下拉框默认选中Epsilon角色
- **实现要求**：
  - 应用启动时，Epsilon自动激活
  - 下拉框默认选中Epsilon
  - 如果用户切换了角色，记住用户的选择（可选）

#### 2.3 添加角色功能
- **当前问题**：添加角色的入口不明确
- **改进方案**：提供"添加新角色"按钮
- **实现要求**：
  - 点击按钮后，显示角色编辑界面
  - 可以输入角色名称和System Prompt
  - 创建后自动添加到下拉框

#### 2.4 角色编辑界面
- **当前问题**：角色编辑方式需要优化
- **改进方案**：选择自定义角色后，显示编辑界面
- **实现要求**：
  - 角色名称输入框（单行文本）
  - System Prompt输入框（多行文本区域，支持大文本）
  - 编辑后自动保存（见2.5）

#### 2.5 自动保存（无保存按钮）
- **当前问题**：需要点击保存按钮才能保存
- **改进方案**：移除保存按钮，实现自动保存
- **实现要求**：
  - 用户修改角色名称或System Prompt后，自动保存
  - 使用防抖（debounce）机制，避免频繁保存
  - 保存成功后可以显示短暂的成功提示（可选）
  - 删除按钮仍然保留（仅用于自定义角色）

### 界面布局建议

```
┌─────────────────────────────────────┐
│  切换助手                            │
├─────────────────────────────────────┤
│  当前角色:                           │
│  ┌─────────────────────────────┐   │
│  │ ▼ Epsilon (ε) (默认)        │   │  ← 下拉框
│  └─────────────────────────────┘   │
│                                     │
│  [+ 添加新角色]                     │  ← 添加按钮
│                                     │
│  ───────────────────────────────  │
│                                     │
│  [如果选择了自定义角色，显示编辑区] │
│                                     │
│  角色名称:                          │
│  ┌─────────────────────────────┐   │
│  │ 自定义角色1                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  System Prompt:                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │  [多行文本区域]              │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [删除角色]                         │  ← 仅自定义角色显示
└─────────────────────────────────────┘
```

### 实现要点

#### 前端实现
```typescript
// CharacterSwitcher组件示例

const [characters, setCharacters] = useState<Character[]>([])
const [currentCharacterId, setCurrentCharacterId] = useState('epsilon')
const [editingName, setEditingName] = useState('')
const [editingPrompt, setEditingPrompt] = useState('')

// 下拉框选择角色
<select
  value={currentCharacterId}
  onChange={(e) => {
    const newCharacterId = e.target.value
    // 立即切换角色
    activateCharacter(newCharacterId)
  }}
  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800"
>
  {characters.map(char => (
    <option key={char.id} value={char.id}>
      {char.name} {char.is_default ? '(默认)' : ''}
    </option>
  ))}
</select>

// 添加新角色按钮
<button
  onClick={() => setShowAddCharacter(true)}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  + 添加新角色
</button>

// 角色编辑区域（选择自定义角色后显示）
{currentCharacter && !currentCharacter.is_default && (
  <div className="mt-4 space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        角色名称
      </label>
      <input
        type="text"
        value={editingName}
        onChange={(e) => {
          setEditingName(e.target.value)
          // 自动保存（防抖）
          debouncedSaveCharacter(currentCharacter.id, e.target.value, editingPrompt)
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        System Prompt
      </label>
      <textarea
        value={editingPrompt}
        onChange={(e) => {
          setEditingPrompt(e.target.value)
          // 自动保存（防抖）
          debouncedSaveCharacter(currentCharacter.id, editingName, e.target.value)
        }}
        rows={10}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800"
      />
    </div>
    <button
      onClick={() => deleteCharacter(currentCharacter.id)}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
    >
      删除角色
    </button>
  </div>
)}
```

#### 防抖实现
```typescript
// 使用lodash或自定义防抖函数
import { debounce } from 'lodash'

const debouncedSaveCharacter = useMemo(
  () => debounce(async (id: string, name: string, prompt: string) => {
    try {
      await updateCharacter(id, { name, system_prompt: prompt })
      // 可选：显示成功提示
      showToast('角色已自动保存', 'success')
    } catch (error) {
      showToast('保存失败，请重试', 'error')
    }
  }, 1000), // 1秒防抖
  []
)
```

### 验收标准

- [ ] 下拉框正确显示所有角色
- [ ] Epsilon作为默认选择
- [ ] 可以添加新角色
- [ ] 选择自定义角色后显示编辑界面
- [ ] 修改角色信息后自动保存（无保存按钮）
- [ ] 删除按钮仅对自定义角色显示
- [ ] Epsilon角色不可编辑（不显示编辑界面）

---

## 【改进需求3：UI颜色优化】

### 需求描述

修复白色按钮和文字与白色背景冲突的问题，确保所有UI元素都有足够的视觉对比度。

### 问题分析

**当前问题**：
- 部分按钮使用白色背景和白色文字，导致不可见
- 部分文字使用白色，在白色背景上不可见
- 输入框、下拉框等组件的文字颜色可能不够清晰

### 优化方案

#### 3.1 按钮颜色优化

**原则**：按钮应该使用深色背景和白色文字，或浅色背景和深色文字

**推荐颜色方案**：
- **主要按钮**：深蓝色背景 + 白色文字
  - `bg-blue-600 text-white hover:bg-blue-700`
- **次要按钮**：深灰色背景 + 白色文字
  - `bg-gray-700 text-white hover:bg-gray-800`
- **危险按钮**（删除等）：红色背景 + 白色文字
  - `bg-red-600 text-white hover:bg-red-700`
- **取消按钮**：浅灰色背景 + 深色文字
  - `bg-gray-200 text-gray-800 hover:bg-gray-300`

**禁止使用**：
- ❌ `bg-white text-white`（白色背景 + 白色文字）
- ❌ `bg-gray-100 text-white`（浅灰背景 + 白色文字）

#### 3.2 文字颜色优化

**原则**：文字颜色应该与背景形成足够的对比度

**推荐颜色方案**：
- **主要文字**：深灰色或黑色
  - `text-gray-800` 或 `text-gray-900`
- **次要文字**：中灰色
  - `text-gray-600` 或 `text-gray-700`
- **提示文字**：浅灰色
  - `text-gray-500`
- **白色背景上的文字**：必须使用深色
  - `text-gray-800` 或 `text-gray-900`

**禁止使用**：
- ❌ 在白色背景上使用 `text-white`
- ❌ 在浅色背景上使用 `text-white`

#### 3.3 输入框和下拉框优化

**原则**：确保输入框和下拉框的文字清晰可见

**推荐样式**：
```typescript
// 输入框
className="bg-white text-gray-800 border border-gray-300"

// 下拉框
className="bg-white text-gray-800 border border-gray-300"

// 文本区域
className="bg-white text-gray-800 border border-gray-300"
```

#### 3.4 需要检查的组件

1. **配置面板（ConfigPanel）**
   - 所有按钮的颜色
   - 标签文字的颜色
   - 输入框文字的颜色

2. **聊天界面（ChatInterface）**
   - 发送按钮的颜色
   - 配置按钮的颜色
   - 清空按钮的颜色
   - 消息文字的颜色

3. **角色切换界面**
   - 下拉框文字的颜色
   - 添加按钮的颜色
   - 删除按钮的颜色
   - 输入框文字的颜色

### 具体修改示例

#### 修改前（错误）
```typescript
// ❌ 白色按钮，不可见
<button className="bg-white text-white">
  保存
</button>

// ❌ 白色文字在白色背景上，不可见
<div className="bg-white">
  <p className="text-white">这是文字</p>
</div>
```

#### 修改后（正确）
```typescript
// ✅ 深色按钮，清晰可见
<button className="bg-blue-600 text-white hover:bg-blue-700">
  保存
</button>

// ✅ 深色文字在白色背景上，清晰可见
<div className="bg-white">
  <p className="text-gray-800">这是文字</p>
</div>
```

### 全局样式检查清单

- [ ] 检查所有按钮的背景色和文字色
- [ ] 检查所有标签和提示文字的颜色
- [ ] 检查所有输入框的文字颜色
- [ ] 检查所有下拉框的文字颜色
- [ ] 检查所有文本区域的文字颜色
- [ ] 确保白色背景上不使用白色文字
- [ ] 确保浅色背景上不使用白色文字
- [ ] 测试不同浏览器的显示效果

### 验收标准

- [ ] 所有按钮在白色背景上清晰可见
- [ ] 所有文字在白色背景上清晰可见
- [ ] 输入框和下拉框的文字清晰可见
- [ ] 所有交互元素有足够的视觉对比度
- [ ] 按钮样式统一且美观
- [ ] 在不同浏览器中显示正常

---

## 【实施优先级】

1. **高优先级**：改进需求3（UI颜色优化）
   - 影响用户体验，需要立即修复
   - 实施难度低，主要是样式修改

2. **中优先级**：改进需求1（默认配置功能）
   - 提升用户体验，减少重复操作
   - 实施难度中等，需要前后端配合

3. **中优先级**：改进需求2（切换助手界面优化）
   - 提升角色管理体验
   - 实施难度中等，需要前端重构

---

## 【实施建议】

### 开发顺序

1. **第一步**：UI颜色优化（1-2小时）
   - 快速修复，立即改善用户体验
   - 可以独立完成，不影响其他功能

2. **第二步**：默认配置功能（1-2小时）
   - 后端定义默认配置
   - 前端显示默认配置
   - 测试配置初始化

3. **第三步**：切换助手界面优化（2-3小时）
   - 重构角色切换界面
   - 实现下拉框选择
   - 实现自动保存功能
   - 测试角色管理流程

### 注意事项

1. **默认配置路径**
   - Windows路径使用原始字符串（raw string）
   - 确保路径中的反斜杠正确转义
   - 考虑路径不存在时的错误处理

2. **自动保存防抖**
   - 使用合适的防抖时间（建议1秒）
   - 处理保存失败的情况
   - 避免用户快速输入时的频繁请求

3. **UI颜色一致性**
   - 建立统一的颜色规范
   - 使用Tailwind CSS的颜色类
   - 确保所有组件遵循相同的颜色方案

---

**文档生成时间**: 2025-01-XX
**版本**: Phase 2 优化 v1.0

