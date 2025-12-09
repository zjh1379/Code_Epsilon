/**
 * Chat state management hook
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { sendChatMessage } from '../services/api'
import { base64ToAudioUrl } from '../services/audio'
import type { Message, ChatConfig, ChatResponse } from '../types'

interface UseChatOptions {
  config: ChatConfig
  onConfigChange?: (config: ChatConfig) => void
}

export function useChat({ config, onConfigChange }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentStreamingText, setCurrentStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('chatConfig')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        if (onConfigChange) {
          onConfigChange(parsed)
        }
      } catch (e) {
        console.error('Failed to load config from localStorage:', e)
      }
    }
  }, [onConfigChange])

  // Save config to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatConfig', JSON.stringify(config))
  }, [config])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) {
        return
      }

      if (!config.ref_audio_path) {
        setError('请先配置参考音频路径')
        return
      }

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: content.trim(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)
      setCurrentStreamingText('')

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController()

      try {
        await sendChatMessage(
          {
            message: content.trim(),
            history: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            config: {
              ref_audio_path: config.ref_audio_path,
              prompt_text: config.prompt_text,
              prompt_lang: config.prompt_lang,
              text_lang: config.text_lang,
              text_split_method: config.text_split_method,
              speed_factor: config.speed_factor,
              fragment_interval: config.fragment_interval,
              top_k: config.top_k,
              top_p: config.top_p,
              temperature: config.temperature,
              aux_ref_audio_paths: config.aux_ref_audio_paths || [],
            },
          },
          (response: ChatResponse) => {
            if (response.type === 'text' && response.content) {
              // Streaming text chunk
              setCurrentStreamingText((prev) => prev + response.content!)
            } else if (response.type === 'complete' && response.text) {
              // Text generation complete
              const assistantMessage: Message = {
                role: 'assistant',
                content: response.text,
                isLoading: true, // Still loading audio
              }
              setMessages((prev) => [...prev, assistantMessage])
              setCurrentStreamingText('')
            } else if (response.type === 'audio' && response.data) {
              // Audio received
              const audioUrl = base64ToAudioUrl(response.data)
              setMessages((prev) => {
                const updated = [...prev]
                const lastMessage = updated[updated.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.audioUrl = audioUrl
                  lastMessage.isLoading = false
                }
                return updated
              })
              setIsLoading(false)
            } else if (response.type === 'error') {
              // Error occurred
              setError(response.error || '发生未知错误')
              setMessages((prev) => {
                const updated = [...prev]
                const lastMessage = updated[updated.length - 1]
                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.isLoading = false
                  lastMessage.error = response.error
                }
                return updated
              })
              setIsLoading(false)
            }
          },
          (error: Error) => {
            setError(error.message || '发送消息失败')
            setIsLoading(false)
            setCurrentStreamingText('')
          },
          abortControllerRef.current.signal
        )
      } catch (err) {
        setError((err as Error).message || '发送消息失败')
        setIsLoading(false)
        setCurrentStreamingText('')
      }
    },
    [messages, config, isLoading]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentStreamingText('')
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    currentStreamingText,
    error,
    sendMessage,
    clearMessages,
  }
}

