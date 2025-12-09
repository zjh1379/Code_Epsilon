/**
 * Message list component
 */
import React, { useEffect, useRef } from 'react'
import MessageItem from './MessageItem'
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

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamingText])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <p className="text-lg mb-2">欢迎使用异界声律·Epsilon</p>
            <p className="text-sm">开始对话吧！</p>
          </div>
        </div>
      )}
      
      {messages.map((message, index) => (
        <MessageItem
          key={index}
          message={message}
          isStreaming={
            index === messages.length - 1 &&
            message.role === 'assistant' &&
            isLoading &&
            currentStreamingText.length > 0
          }
          streamingText={currentStreamingText}
        />
      ))}
      
      {isLoading && messages.length > 0 && currentStreamingText.length === 0 && (
        <div className="flex justify-start">
          <div className="bg-gray-200 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              <span className="ml-2 text-gray-600">正在思考...</span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )
}

