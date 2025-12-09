/**
 * Single message item component
 */
import React from 'react'
import AudioPlayer from './AudioPlayer'
import type { Message } from '../types'

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
  streamingText?: string
}

export default function MessageItem({
  message,
  isStreaming = false,
  streamingText = '',
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const displayText = isStreaming ? streamingText : message.content

  return (
    <div
      className={`flex mb-4 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-800'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {displayText}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
        
        {!isUser && message.audioUrl && (
          <div className="mt-2">
            <AudioPlayer 
              audioUrl={message.audioUrl} 
              isLoading={message.isLoading}
              autoPlay={false}
            />
          </div>
        )}
        
        {message.isLoading && !message.audioUrl && (
          <div className="mt-2 text-sm text-gray-500">
            正在生成语音...
          </div>
        )}
        
        {message.error && (
          <div className="mt-2 text-sm text-red-500">
            {message.error}
          </div>
        )}
      </div>
    </div>
  )
}

