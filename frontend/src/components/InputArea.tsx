/**
 * Input area component for message input
 */
import React, { useState, KeyboardEvent } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'

interface InputAreaProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function InputArea({ onSend, disabled = false }: InputAreaProps) {
  const [input, setInput] = useState('')
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input)
      setInput('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const inputBorderClasses = theme === 'dark' 
    ? 'border-emerald-500/30 focus:border-emerald-500/60 focus:ring-emerald-500/50'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/50'

  const sendButtonBaseClasses = theme === 'dark'
    ? 'bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 border-emerald-400/40 hover:border-purple-400/50 hover:shadow-emerald-500/30'
    : 'bg-blue-600 hover:bg-blue-500 border-blue-400 hover:border-blue-500 hover:shadow-blue-500/30'

  const sendButtonDisabledClasses = theme === 'dark'
    ? 'disabled:from-zinc-700 disabled:to-zinc-700'
    : 'disabled:bg-gray-300'

  return (
    <div className={`relative border-t-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-200'} p-4 ${themeClasses.bg.input} backdrop-blur-md w-full min-w-0`}>
      <div className="flex items-end space-x-3 w-full min-w-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter发送, Shift+Enter换行)"
          disabled={disabled}
          rows={1}
          className={`flex-1 min-w-0 resize-none border-2 ${inputBorderClasses} rounded-xl px-4 py-3 ${themeClasses.bg.inputField} backdrop-blur-sm ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 disabled:cursor-not-allowed transition-all duration-200`}
          style={{ minHeight: '44px', maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className={`px-6 py-3 ${sendButtonBaseClasses} ${sendButtonDisabledClasses} text-white rounded-xl disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg disabled:shadow-none border-2 flex-shrink-0 whitespace-nowrap`}
        >
          发送
        </button>
      </div>
    </div>
  )
}

