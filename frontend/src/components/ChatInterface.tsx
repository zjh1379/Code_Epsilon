/**
 * Main chat interface component
 */
import React, { useState, useEffect } from 'react'
import MessageList from './MessageList'
import InputArea from './InputArea'
import ConfigPanel from './ConfigPanel'
import { useChat } from '../hooks/useChat'
import { getCharacter, getConfig } from '../services/api'
import type { ChatConfig } from '../types'
import type { CharacterProfile } from '../types/character'

const defaultConfig: ChatConfig = {
  ref_audio_path: '',
  prompt_text: '',
  prompt_lang: 'zh',
  text_lang: 'zh',
  text_split_method: 'cut5',
  speed_factor: 1.0,
  fragment_interval: 0.3,
  top_k: 5,
  top_p: 1.0,
  temperature: 1.0,
}

export default function ChatInterface() {
  const [config, setConfig] = useState<ChatConfig>(defaultConfig)
  const [showConfig, setShowConfig] = useState(false)
  const [character, setCharacter] = useState<CharacterProfile | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const { messages, isLoading, currentStreamingText, error, sendMessage, clearMessages } = useChat({
    config,
    onConfigChange: setConfig,
  })

  // Load configuration and character profile on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load config from backend
        const backendConfig = await getConfig()
        const loadedConfig: ChatConfig = {
          ref_audio_path: backendConfig.ref_audio_path || '',
          prompt_text: backendConfig.prompt_text || '',
          prompt_lang: (backendConfig.prompt_lang || 'zh') as ChatConfig['prompt_lang'],
          text_lang: (backendConfig.text_lang || 'zh') as ChatConfig['text_lang'],
          text_split_method: backendConfig.text_split_method || 'cut5',
          speed_factor: backendConfig.speed_factor || 1.0,
          fragment_interval: backendConfig.fragment_interval || 0.3,
          top_k: backendConfig.top_k || 5,
          top_p: backendConfig.top_p || 1.0,
          temperature: backendConfig.temperature || 1.0,
        }
        setConfig(loadedConfig)

        // Load character profile
        const characterProfile = await getCharacter()
        setCharacter(characterProfile)

        // Only show config panel on first use (when ref_audio_path is empty)
        if (!backendConfig.ref_audio_path) {
          setShowConfig(true)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
        // If backend is not available, show config panel
        setShowConfig(true)
      } finally {
        setIsInitialized(true)
      }
    }

    loadInitialData()
  }, [])

  // Reload character when config panel closes
  const handleConfigClose = () => {
    setShowConfig(false)
    getCharacter()
      .then(setCharacter)
      .catch((err) => {
        console.error('Failed to reload character:', err)
      })
    // Reload config after closing
    getConfig()
      .then((backendConfig) => {
        const updatedConfig: ChatConfig = {
          ref_audio_path: backendConfig.ref_audio_path || '',
          prompt_text: backendConfig.prompt_text || '',
          prompt_lang: (backendConfig.prompt_lang || 'zh') as ChatConfig['prompt_lang'],
          text_lang: (backendConfig.text_lang || 'zh') as ChatConfig['text_lang'],
          text_split_method: backendConfig.text_split_method || 'cut5',
          speed_factor: backendConfig.speed_factor || 1.0,
          fragment_interval: backendConfig.fragment_interval || 0.3,
          top_k: backendConfig.top_k || 5,
          top_p: backendConfig.top_p || 1.0,
          temperature: backendConfig.temperature || 1.0,
        }
        setConfig(updatedConfig)
      })
      .catch((err) => {
        console.error('Failed to reload config:', err)
      })
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold text-gray-800">异界声律·Epsilon</h1>
          {character && (
            <span className="text-sm text-gray-500">
              · {character.name}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConfig(true)}
            className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            配置
          </button>
          <button
            onClick={clearMessages}
            className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            清空
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-2">
          <p>{error}</p>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        currentStreamingText={currentStreamingText}
        isLoading={isLoading}
      />

      {/* Input area */}
      <InputArea 
        onSend={sendMessage} 
        disabled={isLoading || !isInitialized || !config.ref_audio_path} 
      />

      {/* Config panel */}
      {showConfig && (
        <ConfigPanel
          config={config}
          onConfigChange={setConfig}
          onClose={handleConfigClose}
        />
      )}
    </div>
  )
}

