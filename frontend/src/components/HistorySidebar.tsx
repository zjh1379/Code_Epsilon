import React, { useEffect, useState } from 'react'
import { fetchConversations, deleteConversation } from '../services/history'
import type { Conversation } from '../types'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'

interface HistorySidebarProps {
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  isOpen: boolean
  onClose: () => void
}

export default function HistorySidebar({
  currentConversationId,
  onSelectConversation,
  onNewChat,
  isOpen,
  onClose
}: HistorySidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  const loadConversations = async () => {
    try {
      setIsLoading(true)
      const data = await fetchConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadConversations()
    }
  }, [isOpen])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('确定要删除这个对话吗？')) return
    
    try {
      await deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (currentConversationId === id) {
        onNewChat()
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed top-0 left-0 h-full w-80 ${themeClasses.bg.panel} shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} border-r ${themeClasses.border.panel}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className={`p-4 border-b ${themeClasses.border.panel} flex items-center justify-between`}>
            <h2 className={`text-lg font-bold ${themeClasses.text.primary}`}>历史对话</h2>
            <button 
              onClick={onClose}
              className={`p-1 rounded-full hover:${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'} ${themeClasses.text.secondary}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <button
              onClick={() => {
                onNewChat()
                if (window.innerWidth < 768) onClose()
              }}
              className={`w-full py-2 px-4 rounded-lg flex items-center justify-center space-x-2 ${theme === 'dark' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'} transition-colors shadow-sm font-medium`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>新对话</span>
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${themeClasses.text.primary}`}></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className={`text-center py-8 ${themeClasses.text.secondary} text-sm`}>
                暂无历史对话
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id)
                    if (window.innerWidth < 768) onClose()
                  }}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                    currentConversationId === conv.id
                      ? theme === 'dark' 
                        ? 'bg-emerald-500/20 border-emerald-500/50' 
                        : 'bg-blue-50 border-blue-200'
                      : `border-transparent hover:${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className={`text-sm font-medium truncate ${
                        currentConversationId === conv.id ? themeClasses.text.primary : themeClasses.text.secondary
                      }`}>
                        {conv.title || '新对话'}
                      </h3>
                      <p className={`text-xs mt-1 ${themeClasses.text.muted}`}>
                        {formatDate(conv.updated_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className={`absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-red-500 transition-all`}
                      title="删除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

