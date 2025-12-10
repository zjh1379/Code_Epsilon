/**
 * Configuration panel component with file upload support
 */
import React, { useState, useEffect, useRef } from 'react'
import { getConfig, updateConfig, uploadAudioFile } from '../services/api'
import CharacterSwitcher from './CharacterSwitcher'
import KnowledgeGraphViewer from './KnowledgeGraphViewer/KnowledgeGraphViewer'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'
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
  const [textSplitMethod, setTextSplitMethod] = useState(config.text_split_method || 'cut3')
  const [speedFactor, setSpeedFactor] = useState(config.speed_factor || 1.0)
  const [fragmentInterval, setFragmentInterval] = useState(config.fragment_interval || 0.2)
  const [topK, setTopK] = useState(config.top_k || 5)
  const [topP, setTopP] = useState(config.top_p || 1.0)
  const [temperature, setTemperature] = useState(config.temperature || 1.0)
  const [streamingMode, setStreamingMode] = useState(config.streaming_mode ?? 2)
  const [gptWeightsPath, setGptWeightsPath] = useState('')
  const [sovitsWeightsPath, setSovitsWeightsPath] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeTab, setActiveTab] = useState<'tts' | 'llm' | 'character' | 'graph'>('tts')
  const [llmProvider, setLlmProvider] = useState('openai')
  const [llmModel, setLlmModel] = useState('gpt-3.5-turbo')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [isEditingGeminiKey, setIsEditingGeminiKey] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  const AVAILABLE_MODELS = [
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai" },
    { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
    { id: "gemini-3-pro", name: "Gemini 3 Pro", provider: "gemini" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini" },
    { id: "gemini-2.5-flash-tts", name: "Gemini 2.5 Flash TTS", provider: "gemini" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "gemini" },
  ]

  useEffect(() => {
    // Load config from backend only once when component mounts
    let isMounted = true
    
    getConfig().then((backendConfig) => {
        if (!isMounted) return
        
        setRefAudioPath(backendConfig.ref_audio_path)
        setPromptText(backendConfig.prompt_text || '')
        setPromptLang((backendConfig.prompt_lang || 'zh') as ChatConfig['prompt_lang'])
        setTextLang(backendConfig.text_lang as ChatConfig['text_lang'])
        setTextSplitMethod(backendConfig.text_split_method || 'cut3')
        setSpeedFactor(backendConfig.speed_factor || 1.0)
        setFragmentInterval(backendConfig.fragment_interval || 0.2)
        setTopK(backendConfig.top_k || 5)
        setTopP(backendConfig.top_p || 1.0)
        setTemperature(backendConfig.temperature || 1.0)
        setStreamingMode(backendConfig.streaming_mode ?? 2)
        setGptWeightsPath(backendConfig.gpt_weights_path || '')
        setSovitsWeightsPath(backendConfig.sovits_weights_path || '')
        setLlmProvider(backendConfig.llm_provider || 'openai')
        setLlmModel(backendConfig.llm_model || 'gpt-3.5-turbo')
        const apiKey = backendConfig.gemini_api_key || ''
        setGeminiApiKey(apiKey)
        setIsEditingGeminiKey(!apiKey) // If key exists, not editing by default
        
        onConfigChange({
          ref_audio_path: backendConfig.ref_audio_path,
          prompt_text: backendConfig.prompt_text || '',
          prompt_lang: (backendConfig.prompt_lang || 'zh') as ChatConfig['prompt_lang'],
          text_lang: backendConfig.text_lang as ChatConfig['text_lang'],
          text_split_method: backendConfig.text_split_method || 'cut3',
          speed_factor: backendConfig.speed_factor || 1.0,
          fragment_interval: backendConfig.fragment_interval || 0.2,
          top_k: backendConfig.top_k || 5,
          top_p: backendConfig.top_p || 1.0,
          temperature: backendConfig.temperature || 1.0,
          streaming_mode: backendConfig.streaming_mode ?? 2,
          media_type: 'fmp4' as ChatConfig['media_type'],
        })
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load config:', err)
        }
      })
    
    return () => {
      isMounted = false
    }
  }, []) // Remove onConfigChange from dependencies to prevent infinite loop

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
        streaming_mode: streamingMode,
        media_type: 'fmp4',
        gpt_weights_path: gptWeightsPath.trim() || undefined,
        sovits_weights_path: sovitsWeightsPath.trim() || undefined,
        llm_provider: llmProvider,
        llm_model: llmModel,
        gemini_api_key: geminiApiKey.trim() || undefined,
      })

      onConfigChange({
        ref_audio_path: updated.ref_audio_path,
        prompt_text: updated.prompt_text,
        prompt_lang: (updated.prompt_lang || 'zh') as ChatConfig['prompt_lang'],
        text_lang: updated.text_lang as ChatConfig['text_lang'],
        text_split_method: updated.text_split_method || 'cut3',
        speed_factor: updated.speed_factor || 1.0,
        fragment_interval: updated.fragment_interval || 0.2,
        top_k: updated.top_k || 5,
        top_p: updated.top_p || 1.0,
        temperature: updated.temperature || 1.0,
          streaming_mode: updated.streaming_mode ?? 2,
          media_type: 'fmp4' as ChatConfig['media_type'],
      })

      onClose()
    } catch (err) {
      setError((err as Error).message || '保存配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCharacterChange = async () => {
    // Character changed - notify parent if needed
    // This callback is called when character is switched in CharacterSwitcher
    // No need to reload anything here, CharacterSwitcher handles its own state
  }

  const panelBorder = theme === 'dark' 
    ? 'border-emerald-500/30 shadow-emerald-500/20'
    : 'border-gray-300 shadow-gray-500/20'

  const tabActiveClasses = theme === 'dark'
    ? 'bg-gradient-to-r from-emerald-600/40 to-purple-600/40 text-emerald-300 border-b-2 border-emerald-400'
    : 'bg-blue-50 text-blue-600 border-b-2 border-blue-500'

  const tabInactiveClasses = theme === 'dark'
    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'

  return (
    <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-black/60' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center z-50 p-4`}>
      <div className={`${themeClasses.bg.panel} backdrop-blur-md rounded-2xl p-6 w-full ${activeTab === 'graph' ? 'max-w-6xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto border-2 ${panelBorder} shadow-2xl`} style={{ scrollbarGutter: 'stable' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-bold ${themeClasses.titleGradient} bg-clip-text text-transparent`}>
            配置
          </h2>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center ${themeClasses.text.secondary} hover:${themeClasses.text.primary} ${theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-100'} rounded-lg transition-all duration-200`}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-200'} mb-6 space-x-1`}>
          <button
            onClick={() => setActiveTab('tts')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
              activeTab === 'tts' ? tabActiveClasses : tabInactiveClasses
            }`}
          >
            TTS配置
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
              activeTab === 'llm' ? tabActiveClasses : tabInactiveClasses
            }`}
          >
            LLM设置
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
              activeTab === 'character' ? tabActiveClasses : tabInactiveClasses
            }`}
          >
            切换助手
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
              activeTab === 'graph' ? tabActiveClasses : tabInactiveClasses
            }`}
          >
            知识图谱
          </button>
        </div>

        {/* TTS Config Tab */}
        {activeTab === 'tts' && (
        <div className="space-y-4">
          {/* Reference Audio File Selection */}
          <div>
            <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
              参考音频文件
            </label>
            
            {/* Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? theme === 'dark' 
                    ? 'bg-gradient-to-br from-emerald-500/20 to-purple-500/20 shadow-lg shadow-emerald-500/20 shadow-purple-500/20'
                    : 'bg-blue-50 shadow-lg shadow-blue-500/20'
                  : isUploading
                  ? 'border-yellow-400 bg-yellow-500/10'
                  : theme === 'dark'
                    ? 'border-emerald-500/30 bg-zinc-950/50 hover:border-emerald-400/50 hover:bg-zinc-950/70'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-gray-100'
              }`}
              style={isDragging && theme === 'dark' ? {
                borderColor: 'rgb(34, 197, 94)',
                boxShadow: '0 0 0 2px rgb(168, 85, 247), 0 0 20px rgba(34, 197, 94, 0.3), 0 0 20px rgba(168, 85, 247, 0.3)'
              } : {}}
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
                    <div className={`mx-auto h-12 w-12 border-4 ${theme === 'dark' ? 'border-emerald-400 border-purple-400' : 'border-blue-400'} border-t-transparent rounded-full animate-spin`} />
                    <div className={`text-sm ${themeClasses.text.primary}`}>正在上传...</div>
                  </>
                ) : (
                  <>
                    <svg
                      className={`mx-auto h-12 w-12 ${theme === 'dark' ? 'text-emerald-400/60' : 'text-blue-400/60'}`}
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
                    <div className={`text-sm ${themeClasses.text.primary}`}>
                      <span className={`${theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'} font-medium`}>点击选择文件</span> 或拖拽文件到此处
                    </div>
                    <div className={`text-xs ${themeClasses.text.muted}`}>
                      支持格式: .wav, .mp3, .flac, .ogg, .m4a
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {uploadedFileName && (
              <div className={`mt-2 text-sm ${theme === 'dark' ? 'text-emerald-400' : 'text-green-600'} flex items-center space-x-2`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>已上传: {uploadedFileName}</span>
              </div>
            )}

            {/* File Path Input */}
            <input
              type="text"
              value={refAudioPath}
              onChange={(e) => setRefAudioPath(e.target.value)}
              placeholder="或直接输入音频文件路径"
              className={`w-full mt-3 border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 transition-all`}
            />
            <p className={`text-xs ${themeClasses.text.secondary} mt-1`}>
              用于音色克隆的参考音频文件路径
            </p>
          </div>

          {/* Prompt Text */}
          <div>
            <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
              参考音频文本内容
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="请输入参考音频对应的文本内容（用于TTS提示）"
              rows={4}
              className={`w-full border-2 ${theme === 'dark' ? 'border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 resize-none transition-all`}
            />
            <p className={`text-xs ${themeClasses.text.secondary} mt-1`}>
              参考音频中说的文本内容，用于GPT-SoVITS的提示文本
            </p>
          </div>

          {/* Prompt Language */}
          <div>
            <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
              参考音频语种
            </label>
            <select
              value={promptLang}
              onChange={(e) =>
                setPromptLang(e.target.value as ChatConfig['prompt_lang'])
              }
              className={`w-full border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} focus:outline-none focus:ring-2 transition-all`}
            >
              <option value="zh" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>中文</option>
              <option value="en" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>English</option>
              <option value="ja" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>日本語</option>
              <option value="ko" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>한국어</option>
              <option value="yue" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>粤语</option>
            </select>
          </div>

          {/* Text Language */}
          <div>
            <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
              合成文本语种
            </label>
            <select
              value={textLang}
              onChange={(e) =>
                setTextLang(e.target.value as ChatConfig['text_lang'])
              }
              className={`w-full border-2 ${theme === 'dark' ? 'border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} focus:outline-none focus:ring-2 transition-all`}
            >
              <option value="zh" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>中文</option>
              <option value="en" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>English</option>
              <option value="ja" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>日本語</option>
              <option value="ko" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>한국어</option>
              <option value="yue" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>粤语</option>
            </select>
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`w-full text-left text-sm ${theme === 'dark' ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-600 hover:text-blue-700'} font-medium flex items-center space-x-2 transition-colors`}
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              <span>高级参数</span>
            </button>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className={`space-y-4 border-t-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-200'} pt-4`}>
              {/* Streaming Mode */}
              <div>
                <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                  流式模式
                </label>
                <select
                  value={streamingMode}
                  onChange={(e) => setStreamingMode(parseInt(e.target.value))}
                  className={`w-full border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} focus:outline-none focus:ring-2 transition-all`}
                >
                  <option value={0} className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>0 - 非流式</option>
                  <option value={1} className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>1 - 片段返回模式</option>
                  <option value={2} className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>2 - 真流式模式</option>
                  <option value={3} className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>3 - 固定长度chunk流式模式</option>
                </select>
                <p className={`text-xs ${themeClasses.text.secondary} mt-1`}>
                  模式2和3为真流式，延迟低；模式1需要等待较长时间才开始返回；模式0为非流式
                </p>
              </div>

              {/* Text Split Method */}
              <div>
                <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                  文本切分方法
                </label>
                <select
                  value={textSplitMethod}
                  onChange={(e) => setTextSplitMethod(e.target.value)}
                  className={`w-full border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} focus:outline-none focus:ring-2 transition-all`}
                >
                  <option value="cut0" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>不切</option>
                  <option value="cut1" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>凑四句一切</option>
                  <option value="cut2" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>凑50字一切</option>
                  <option value="cut3" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>按中文句号。切</option>
                  <option value="cut4" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>按英文句号.切</option>
                  <option value="cut5" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>按标点符号切</option>
                </select>
              </div>

              {/* Speed Factor */}
              <div>
                <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                  语速调整: <span className={theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'}>{speedFactor.toFixed(1)}</span> (高为更快)
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
                <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                  句间停顿: <span className={theme === 'dark' ? 'text-purple-400' : 'text-gray-600'}>{fragmentInterval.toFixed(1)}</span> 秒
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
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${themeClasses.text.primary}`}>
                  GPT采样参数
                </label>
                <div>
                  <label className={`block text-xs ${themeClasses.text.secondary} mb-2`}>
                    top_k: <span className={theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'}>{topK}</span>
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
                  <label className={`block text-xs ${themeClasses.text.secondary} mb-2`}>
                    top_p: <span className={theme === 'dark' ? 'text-purple-400' : 'text-gray-600'}>{topP.toFixed(2)}</span>
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
                  <label className={`block text-xs ${themeClasses.text.secondary} mb-2`}>
                    temperature: <span className={theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'}>{temperature.toFixed(2)}</span>
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
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${themeClasses.text.primary}`}>
                  模型权重 (可选)
                </label>
                <div>
                  <label className={`block text-xs ${themeClasses.text.secondary} mb-2`}>
                    GPT模型路径
                  </label>
                  <input
                    type="text"
                    value={gptWeightsPath}
                    onChange={(e) => setGptWeightsPath(e.target.value)}
                    placeholder="例如: GPT_SoVITS/pretrained_models/model.ckpt"
                    className={`w-full border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 text-sm ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-xs ${themeClasses.text.secondary} mb-2`}>
                    SoVITS模型路径
                  </label>
                  <input
                    type="text"
                    value={sovitsWeightsPath}
                    onChange={(e) => setSovitsWeightsPath(e.target.value)}
                    placeholder="例如: GPT_SoVITS/pretrained_models/model.pth"
                    className={`w-full border-2 ${theme === 'dark' ? 'border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 text-sm ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 transition-all`}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className={`text-sm ${theme === 'dark' ? 'text-red-400 bg-red-900/30 border-red-500/30' : 'text-red-600 bg-red-50 border-red-300'} px-3 py-2 rounded-lg border mt-4`}>
              {error}
            </div>
          )}
        </div>
        )}

        {/* LLM Config Tab */}
        {activeTab === 'llm' && (
          <div className="space-y-4">
            {/* LLM Provider */}
            <div>
              <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                LLM 提供商
              </label>
              <select
                value={llmProvider}
                onChange={(e) => {
                  setLlmProvider(e.target.value)
                  // Reset model selection when provider changes if current model doesn't match provider
                  const defaultModel = e.target.value === 'gemini' ? 'gemini-1.5-pro' : 'gpt-3.5-turbo'
                  setLlmModel(defaultModel)
                }}
                className={`w-full border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} focus:outline-none focus:ring-2 transition-all`}
              >
                <option value="openai" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>OpenAI (兼容)</option>
                <option value="gemini" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>Google Gemini</option>
              </select>
            </div>

            {/* Model Selection */}
            <div>
              <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                模型选择
              </label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className={`w-full border-2 ${theme === 'dark' ? 'border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} focus:outline-none focus:ring-2 transition-all mb-2`}
              >
                {AVAILABLE_MODELS.filter(m => m.provider === llmProvider).map(model => (
                  <option key={model.id} value={model.id} className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>
                    {model.name}
                  </option>
                ))}
                <option value="custom" className={theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}>自定义模型...</option>
              </select>
              
              {/* Custom Model Input */}
              {(!AVAILABLE_MODELS.find(m => m.id === llmModel) || llmModel === 'custom') && (
                <input
                  type="text"
                  value={llmModel === 'custom' ? '' : llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="输入模型名称 (如 gpt-4o-mini)"
                  className={`w-full border-2 ${theme === 'dark' ? 'border-purple-500/30 focus:border-purple-500/50 focus:ring-purple-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 transition-all`}
                />
              )}
            </div>

            {/* Gemini API Key */}
            {llmProvider === 'gemini' && (
              <div>
                <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
                  Gemini API Key
                </label>
                
                {!isEditingGeminiKey ? (
                  <div className="flex items-center space-x-2">
                    <div className={`flex-1 px-3 py-2 border-2 ${theme === 'dark' ? 'border-emerald-500/30 bg-emerald-900/20' : 'border-green-200 bg-green-50'} rounded-lg flex items-center text-sm ${theme === 'dark' ? 'text-emerald-400' : 'text-green-700'}`}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      已配置 (Configured)
                    </div>
                    <button
                      onClick={() => {
                        setGeminiApiKey('') // Clear to force input
                        setIsEditingGeminiKey(true)
                      }}
                      className={`px-4 py-2 text-sm font-medium border-2 ${themeClasses.border.buttonSecondary} rounded-lg ${themeClasses.bg.button} ${themeClasses.text.primary} ${themeClasses.bg.buttonHover} transition-all`}
                    >
                      修改
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <div className="relative">
                      <input
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="输入 Google Gemini API Key"
                        className={`w-full border-2 ${theme === 'dark' ? 'border-yellow-500/30 focus:border-yellow-500/50 focus:ring-yellow-500/50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'} rounded-lg px-3 py-2 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 transition-all`}
                      />
                    </div>
                    {/* Helper text only when editing */}
                    <p className={`text-xs ${themeClasses.text.secondary}`}>
                      如果没有 API Key，请访问 Google AI Studio 获取。
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* OpenAI Key Note */}
            {llmProvider === 'openai' && (
              <p className={`text-sm ${themeClasses.text.secondary}`}>
                OpenAI API Key 已在后端 .env 文件中配置。如需更改，请修改配置文件。
              </p>
            )}
          </div>
        )}

        {/* Character Management Tab */}
        {activeTab === 'character' && (
          <div className="space-y-4">
            <CharacterSwitcher onCharacterChange={handleCharacterChange} />
          </div>
        )}

        {/* Knowledge Graph Tab */}
        {activeTab === 'graph' && (
          <div className="h-[600px] -mx-6 -mb-6">
            <KnowledgeGraphViewer />
          </div>
        )}

        {/* Shared Action Buttons */}
        {activeTab !== 'graph' && (
          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 ${themeClasses.bg.button} ${themeClasses.text.primary} ${themeClasses.bg.buttonHover} disabled:${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-gray-200'} disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-medium border-2 ${themeClasses.border.button} hover:${theme === 'dark' ? 'border-emerald-400' : 'border-blue-500'} disabled:${theme === 'dark' ? 'border-zinc-700' : 'border-gray-300'}`}
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className={`px-4 py-2.5 border-2 ${themeClasses.border.buttonSecondary} rounded-lg ${themeClasses.bg.button} ${themeClasses.text.primary} ${themeClasses.bg.buttonHover} hover:${theme === 'dark' ? 'border-zinc-500/50' : 'border-gray-400'} disabled:cursor-not-allowed transition-all duration-200`}
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
