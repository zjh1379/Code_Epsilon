/**
 * Configuration panel component with file upload support
 */
import React, { useState, useEffect, useRef } from 'react'
import { getConfig, updateConfig, uploadAudioFile } from '../services/api'
import CharacterProfilePanel from './CharacterProfilePanel'
import type { ChatConfig } from '../types'

interface ConfigPanelProps {
  config: ChatConfig
  onConfigChange: (config: ChatConfig) => void
  onClose: () => void
}

export default function ConfigPanel({
  config,
  onConfigChange,
  onClose,
}: ConfigPanelProps) {
  const [refAudioPath, setRefAudioPath] = useState(config.ref_audio_path)
  const [promptText, setPromptText] = useState(config.prompt_text)
  const [promptLang, setPromptLang] = useState(config.prompt_lang || 'zh')
  const [textLang, setTextLang] = useState(config.text_lang)
  const [textSplitMethod, setTextSplitMethod] = useState(config.text_split_method || 'cut5')
  const [speedFactor, setSpeedFactor] = useState(config.speed_factor || 1.0)
  const [fragmentInterval, setFragmentInterval] = useState(config.fragment_interval || 0.3)
  const [topK, setTopK] = useState(config.top_k || 5)
  const [topP, setTopP] = useState(config.top_p || 1.0)
  const [temperature, setTemperature] = useState(config.temperature || 1.0)
  const [gptWeightsPath, setGptWeightsPath] = useState('')
  const [sovitsWeightsPath, setSovitsWeightsPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeTab, setActiveTab] = useState<'tts' | 'character'>('tts')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load config from backend when panel opens
    getConfig()
      .then((backendConfig) => {
        setRefAudioPath(backendConfig.ref_audio_path || config.ref_audio_path)
        setPromptText(backendConfig.prompt_text || config.prompt_text || '')
        setPromptLang(backendConfig.prompt_lang || config.prompt_lang || 'zh')
        setTextLang((backendConfig.text_lang || config.text_lang) as ChatConfig['text_lang'])
        setTextSplitMethod(backendConfig.text_split_method || config.text_split_method || 'cut5')
        setSpeedFactor(backendConfig.speed_factor || config.speed_factor || 1.0)
        setFragmentInterval(backendConfig.fragment_interval || config.fragment_interval || 0.3)
        setTopK(backendConfig.top_k || config.top_k || 5)
        setTopP(backendConfig.top_p || config.top_p || 1.0)
        setTemperature(backendConfig.temperature || config.temperature || 1.0)
        setGptWeightsPath(backendConfig.gpt_weights_path || '')
        setSovitsWeightsPath(backendConfig.sovits_weights_path || '')
      })
      .catch((err) => {
        console.error('Failed to load config:', err)
        // Use props config as fallback
        setRefAudioPath(config.ref_audio_path)
        setPromptText(config.prompt_text)
        setPromptLang(config.prompt_lang)
        setTextLang(config.text_lang)
        setTextSplitMethod(config.text_split_method)
        setSpeedFactor(config.speed_factor)
        setFragmentInterval(config.fragment_interval)
        setTopK(config.top_k)
        setTopP(config.top_p)
        setTemperature(config.temperature)
      })
  }, []) // Only load once when component mounts

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/flac', 'audio/ogg', 'audio/m4a']
    const allowedExtensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a']
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      setError('请上传音频文件（.wav, .mp3, .flac, .ogg, .m4a）')
      return
    }
    
    setIsUploading(true)
    setError(null)
    
    try {
      // Upload file to backend
      const result = await uploadAudioFile(file)
      // Set the absolute path returned from backend
      setRefAudioPath(result.file_path)
      setUploadedFileName(result.filename)
    } catch (err) {
      setError((err as Error).message || '文件上传失败')
    } finally {
      setIsUploading(false)
    }
    
    // Try to read file as text if it's a text file (for prompt_text)
    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        setPromptText(text.trim())
      }
      reader.readAsText(file)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleSave = async () => {
    if (!refAudioPath.trim()) {
      setError('参考音频路径不能为空')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const updated = await updateConfig({
        ref_audio_path: refAudioPath.trim(),
        prompt_text: promptText.trim(),
        prompt_lang: promptLang,
        text_lang: textLang,
        text_split_method: textSplitMethod,
        speed_factor: speedFactor,
        fragment_interval: fragmentInterval,
        top_k: topK,
        top_p: topP,
        temperature: temperature,
        gpt_weights_path: gptWeightsPath.trim() || undefined,
        sovits_weights_path: sovitsWeightsPath.trim() || undefined,
      })

      onConfigChange({
        ref_audio_path: updated.ref_audio_path,
        prompt_text: updated.prompt_text,
        prompt_lang: updated.prompt_lang || 'zh',
        text_lang: updated.text_lang as ChatConfig['text_lang'],
        text_split_method: updated.text_split_method || 'cut5',
        speed_factor: updated.speed_factor || 1.0,
        fragment_interval: updated.fragment_interval || 0.3,
        top_k: updated.top_k || 5,
        top_p: updated.top_p || 1.0,
        temperature: updated.temperature || 1.0,
      })

      onClose()
    } catch (err) {
      setError((err as Error).message || '保存配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-4">配置</h2>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('tts')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'tts'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            TTS配置
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'character'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            角色设定
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'character' ? (
          <CharacterProfilePanel onClose={onClose} />
        ) : (
          <div className="space-y-4">
          {/* Reference Audio File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              参考音频文件
            </label>
            
            {/* Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : isUploading
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={handleBrowseClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="space-y-2">
                {isUploading ? (
                  <>
                    <div className="mx-auto h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="text-sm text-gray-600">正在上传...</div>
                  </>
                ) : (
                  <>
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-sm text-gray-600">
                      <span className="text-blue-600 font-medium">点击选择文件</span> 或拖拽文件到此处
                    </div>
                    <div className="text-xs text-gray-500">
                      支持格式: .wav, .mp3, .flac, .ogg, .m4a
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {uploadedFileName && (
              <div className="mt-2 text-sm text-green-600">
                已上传: {uploadedFileName}
              </div>
            )}

            {/* File Path Input */}
            <input
              type="text"
              value={refAudioPath}
              onChange={(e) => setRefAudioPath(e.target.value)}
              placeholder="或直接输入音频文件路径"
              className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              用于音色克隆的参考音频文件路径
            </p>
          </div>

          {/* Prompt Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参考音频文本内容
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="请输入参考音频对应的文本内容（用于TTS提示）"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              参考音频中说的文本内容，用于GPT-SoVITS的提示文本
            </p>
          </div>

          {/* Prompt Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              参考音频语种
            </label>
            <select
              value={promptLang}
              onChange={(e) =>
                setPromptLang(e.target.value as ChatConfig['prompt_lang'])
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
              <option value="yue">粤语</option>
            </select>
          </div>

          {/* Text Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              合成文本语种
            </label>
            <select
              value={textLang}
              onChange={(e) =>
                setTextLang(e.target.value as ChatConfig['text_lang'])
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
              <option value="yue">粤语</option>
            </select>
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAdvanced ? '▼' : '▶'} 高级参数
            </button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              {/* Text Split Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文本切分方法
                </label>
                <select
                  value={textSplitMethod}
                  onChange={(e) => setTextSplitMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cut0">不切</option>
                  <option value="cut1">凑四句一切</option>
                  <option value="cut2">凑50字一切</option>
                  <option value="cut3">按中文句号。切</option>
                  <option value="cut4">按英文句号.切</option>
                  <option value="cut5">按标点符号切</option>
                </select>
              </div>

              {/* Speed Factor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  语速调整: {speedFactor.toFixed(1)} (高为更快)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speedFactor}
                  onChange={(e) => setSpeedFactor(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Fragment Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  句间停顿: {fragmentInterval.toFixed(1)} 秒
                </label>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.1"
                  value={fragmentInterval}
                  onChange={(e) => setFragmentInterval(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* GPT Sampling Parameters */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  GPT采样参数
                </label>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    top_k: {topK}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    top_p: {topP.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    temperature: {temperature.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Model Weights */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  模型权重 (可选)
                </label>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    GPT模型路径
                  </label>
                  <input
                    type="text"
                    value={gptWeightsPath}
                    onChange={(e) => setGptWeightsPath(e.target.value)}
                    placeholder="例如: GPT_SoVITS/pretrained_models/model.ckpt"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    SoVITS模型路径
                  </label>
                  <input
                    type="text"
                    value={sovitsWeightsPath}
                    onChange={(e) => setSovitsWeightsPath(e.target.value)}
                    placeholder="例如: GPT_SoVITS/pretrained_models/model.pth"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '保存中...' : '保存'}
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
