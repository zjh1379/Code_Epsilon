/**
 * Single message item component with typewriter effect
 */
import React, { useMemo } from 'react'
import AudioPlayer from './AudioPlayer'
import { useTypewriter } from '../hooks/useTypewriter'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'
import type { Message } from '../types'

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
  streamingText?: string
  isLastMessage?: boolean
}

export default function MessageItem({
  message,
  isStreaming = false,
  streamingText = '',
  isLastMessage = false,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  
  // Determine the full text to display
  const fullText = useMemo(() => {
    return isStreaming ? streamingText : message.content
  }, [isStreaming, streamingText, message.content])

  // Use typewriter effect for assistant messages
  const { displayedText, isTyping } = useTypewriter({
    text: fullText,
    speed: isUser ? 0 : 20, // Instant for user messages, 20ms per char for assistant
    enabled: !isUser && fullText.length > 0, // Only enable for assistant messages
  })

  // For user messages, display immediately
  const displayText = isUser ? fullText : displayedText
  const showCursor = !isUser && (isTyping || (isStreaming && streamingText.length > 0))

  const userMessageClasses = theme === 'dark'
    ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-2 border-emerald-400/50 shadow-emerald-500/30'
    : 'bg-blue-500 text-white border-2 border-blue-400/50 shadow-blue-500/20'

  const assistantMessageClasses = theme === 'dark'
    ? 'bg-zinc-900/90 backdrop-blur-sm text-zinc-100 border-2 border-purple-500/40 shadow-purple-500/20'
    : 'bg-gray-100 text-gray-900 border-2 border-gray-300 shadow-gray-500/10'

  return (
    <div
      className={`flex mb-4 w-full min-w-0 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-lg min-w-0 ${
          isUser ? userMessageClasses : assistantMessageClasses
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-relaxed relative overflow-wrap-anywhere">
          {/* Render text with smooth character reveal */}
          <span className="typewriter-text">
          {displayText}
          </span>
          {showCursor && (
            <span 
              className={`inline-block w-0.5 h-4 ml-1 ${theme === 'dark' ? 'bg-gradient-to-b from-emerald-400 via-purple-400 to-emerald-400' : 'bg-gray-600'} animate-cursor-blink align-middle rounded-sm`}
              style={theme === 'dark' ? {
                boxShadow: '0 0 6px rgba(34, 197, 94, 0.8), 0 0 12px rgba(168, 85, 247, 0.6)',
              } : {
                boxShadow: '0 0 4px rgba(75, 85, 99, 0.6)',
              }}
            />
          )}
        </div>
        
        {!isUser && message.audioUrl && (
          <div className="mt-3 flex items-center">
            <AudioPlayer 
              audioUrl={message.audioUrl} 
              autoPlay={isLastMessage && !isStreaming}
            />
          </div>
        )}
        
        {message.isLoading && !message.audioUrl && (
          <div className={`mt-3 text-sm ${themeClasses.text.secondary} flex items-center space-x-2`}>
            <div className={`w-1.5 h-1.5 ${theme === 'dark' ? 'bg-purple-400' : 'bg-gray-400'} rounded-full animate-pulse`} />
            <span>正在生成语音...</span>
          </div>
        )}
        
        {message.error && (
          <div className={`mt-3 text-sm ${theme === 'dark' ? 'text-red-400 bg-red-900/30 border-red-500/30' : 'text-red-600 bg-red-50 border-red-300'} px-2 py-1 rounded border`}>
            {message.error}
          </div>
        )}
      </div>
    </div>
  )
}

