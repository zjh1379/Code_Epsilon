/**
 * Message list component
 */
import React, { useEffect, useRef } from 'react'
import MessageItem from './MessageItem'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'
import type { Message } from '../types'

interface MessageListProps {
  messages: Message[]
  currentStreamingText: string
  isLoading: boolean
}

export default function MessageList({
  messages,
  currentStreamingText,
  isLoading,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamingText])

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 relative w-full min-w-0" style={{ scrollbarGutter: 'stable' }}>
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center animate-fade-in">
            <p className={`text-xl mb-2 ${themeClasses.titleGradient} bg-clip-text text-transparent font-semibold`}>
              欢迎使用异界声律·Epsilon
            </p>
            <p className={`text-sm ${themeClasses.text.secondary}`}>开始对话吧！</p>
          </div>
        </div>
      )}
      
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1
        const isStreaming = isLastMessage &&
          message.role === 'assistant' &&
          isLoading &&
          currentStreamingText.length > 0
        
        return (
          <div
            key={index}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <MessageItem
              message={message}
              isStreaming={isStreaming}
              streamingText={currentStreamingText}
              isLastMessage={isLastMessage}
            />
          </div>
        )
      })}
      
      {isLoading && messages.length > 0 && currentStreamingText.length === 0 && (
        <div className="flex justify-start animate-fade-in">
          <div className={`${themeClasses.bg.messageAssistant} backdrop-blur-sm rounded-xl px-4 py-3 border-2 ${theme === 'dark' ? 'border-purple-500/30 shadow-purple-500/20' : 'border-gray-300'} shadow-lg`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 ${theme === 'dark' ? 'bg-emerald-400' : 'bg-blue-400'} rounded-full animate-bounce`} />
              <div className={`w-2 h-2 ${theme === 'dark' ? 'bg-purple-400' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }} />
              <div className={`w-2 h-2 ${theme === 'dark' ? 'bg-emerald-400' : 'bg-blue-400'} rounded-full animate-bounce`} style={{ animationDelay: '0.4s' }} />
              <span className={`ml-2 ${themeClasses.text.primary}`}>正在思考...</span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )
}

