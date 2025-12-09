/**
 * Main chat interface component
 */
import React, { useState, useEffect } from 'react'
import MessageList from './MessageList'
import InputArea from './InputArea'
import ConfigPanel from './ConfigPanel'
import ThemeToggle from './ThemeToggle'
import { useChat } from '../hooks/useChat'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'
import { getCurrentCharacter } from '../services/api'
import type { ChatConfig, Character } from '../types'

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
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null)
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const { messages, isLoading, currentStreamingText, error, sendMessage, clearMessages } = useChat({
    config,
    onConfigChange: setConfig,
  })

  useEffect(() => {
    // Load current character
    getCurrentCharacter()
      .then(setCurrentCharacter)
      .catch((err) => {
        console.error('Failed to load current character:', err)
      })
  }, [])

  // Show config panel if ref_audio_path is not set
  React.useEffect(() => {
    if (!config.ref_audio_path) {
      setShowConfig(true)
    }
  }, [config.ref_audio_path])

  return (
    <div className={`flex flex-col h-screen ${themeClasses.bg.main} relative overflow-hidden w-full max-w-full`} data-theme={theme}>
      {/* Header */}
      <header className={`relative ${themeClasses.bg.header} backdrop-blur-md border-b ${themeClasses.border.header} px-4 py-3 flex items-center justify-between shadow-lg min-w-0 w-full`}>
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <h1 className={`text-xl font-bold ${themeClasses.titleGradient} bg-clip-text text-transparent whitespace-nowrap`}>
            异界声律·Epsilon
          </h1>
          {currentCharacter && (
            <div className="flex items-center space-x-2 min-w-0">
              <span className={`text-sm ${themeClasses.text.secondary} whitespace-nowrap`}>助手:</span>
              <span className={`text-sm font-medium ${themeClasses.text.primary} truncate`}>
                {currentCharacter.name}
              </span>
              {currentCharacter.is_default && (
                <span className={`text-xs ${theme === 'dark' ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/40' : 'text-blue-600 bg-blue-100 border-blue-300'} px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0`}>
                  默认
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          <ThemeToggle />
          <button
            onClick={() => setShowConfig(true)}
            className={`px-4 py-1.5 text-sm rounded-lg ${themeClasses.bg.button} ${themeClasses.text.primary} ${themeClasses.bg.buttonHover} border ${themeClasses.border.buttonSecondary} transition-all duration-200 whitespace-nowrap`}
          >
            配置
          </button>
          <button
            onClick={clearMessages}
            className={`px-4 py-1.5 text-sm rounded-lg ${themeClasses.bg.button} ${themeClasses.text.primary} ${themeClasses.bg.buttonHover} border ${themeClasses.border.buttonSecondary} transition-all duration-200 whitespace-nowrap`}
          >
            清空
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className={`relative ${theme === 'dark' ? 'bg-red-900/80 text-red-200' : 'bg-red-50 text-red-800'} backdrop-blur-sm border-l-4 border-red-500 px-4 py-2 shadow-lg`}>
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
      <InputArea onSend={sendMessage} disabled={isLoading || !config.ref_audio_path} />

      {/* Config panel */}
      {showConfig && (
        <ConfigPanel
          config={config}
          onConfigChange={(newConfig) => {
            setConfig(newConfig)
          }}
          onClose={() => {
            setShowConfig(false)
            // Only reload character when panel closes, not on every config change
            getCurrentCharacter()
              .then(setCurrentCharacter)
              .catch((err) => {
                console.error('Failed to reload current character:', err)
              })
          }}
        />
      )}
    </div>
  )
}

