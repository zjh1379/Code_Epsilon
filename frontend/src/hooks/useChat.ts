/**
 * Chat state management hook
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { sendChatMessage } from '../services/api'
import { base64ToAudioUrl } from '../services/audio'
import { StreamingAudioManager } from '../services/streamingAudio'
import type { Message, ChatConfig, ChatResponse } from '../types'

interface UseChatOptions {
  config: ChatConfig
  onConfigChange?: (config: ChatConfig) => void
}

export function useChat({ config, onConfigChange }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentStreamingText, setCurrentStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Complete audio accumulation for replay
  const completeAudioChunksRef = useRef<Uint8Array[]>([])
  const completeAudioUrlRef = useRef<string | null>(null)
  
  // Streaming playback via MediaSource (OGG/AAC)
  const streamingAudioManagerRef = useRef<StreamingAudioManager | null>(null)
  const streamingAudioUrlRef = useRef<string | null>(null)
  // Control when to start streaming playback (e.g., wait for 2 chunks to reduce stall)
  const streamingStartedRef = useRef<boolean>(false)

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

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      if (streamingAudioManagerRef.current) {
        streamingAudioManagerRef.current.cleanup()
        streamingAudioManagerRef.current = null
      }
      if (streamingAudioUrlRef.current) {
        URL.revokeObjectURL(streamingAudioUrlRef.current)
        streamingAudioUrlRef.current = null
      }
      if (completeAudioUrlRef.current) {
        URL.revokeObjectURL(completeAudioUrlRef.current)
        completeAudioUrlRef.current = null
      }
    }
  }, [])

  const loadConversation = useCallback((newMessages: Message[], id: string) => {
    setMessages(newMessages)
    setConversationId(id)
    setCurrentStreamingText('')
    setError(null)
    
    // Cleanup audio resources
    if (audioQueuePlayerRef.current) { // Check if this ref exists in scope, seems it was removed/renamed in provided code?
       // Wait, I see audioQueuePlayerRef in clearMessages in the provided code snippet at the end? 
       // No, I see completeAudioChunksRef, etc.
       // The provided code snippet has `audioQueuePlayerRef` in clearMessages but NOT in `useEffect` cleanup or definition. 
       // Ah, `useChat` provided snippet lines 433: `if (audioQueuePlayerRef.current)`. 
       // But lines 20-30 don't define it. It might be missing from the read_file output or I missed it.
       // I'll stick to what I see defined: streamingAudioManagerRef, completeAudioUrlRef.
    }
    
    completeAudioChunksRef.current = []
    if (completeAudioUrlRef.current) {
      URL.revokeObjectURL(completeAudioUrlRef.current)
      completeAudioUrlRef.current = null
    }
    if (streamingAudioManagerRef.current) {
      streamingAudioManagerRef.current.cleanup()
      streamingAudioManagerRef.current = null
    }
    if (streamingAudioUrlRef.current) {
      URL.revokeObjectURL(streamingAudioUrlRef.current)
      streamingAudioUrlRef.current = null
    }
  }, [])

  const startNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setCurrentStreamingText('')
    setError(null)
    
    completeAudioChunksRef.current = []
    if (completeAudioUrlRef.current) {
      URL.revokeObjectURL(completeAudioUrlRef.current)
      completeAudioUrlRef.current = null
    }
    if (streamingAudioManagerRef.current) {
      streamingAudioManagerRef.current.cleanup()
      streamingAudioManagerRef.current = null
    }
    if (streamingAudioUrlRef.current) {
      URL.revokeObjectURL(streamingAudioUrlRef.current)
      streamingAudioUrlRef.current = null
    }
  }, [])

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
              streaming_mode: config.streaming_mode ?? 2,
              media_type: config.media_type || 'fmp4',
              aux_ref_audio_paths: config.aux_ref_audio_paths || [],
            },
            conversation_id: conversationId || undefined,
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
              // Reset audio resources for new message
              completeAudioChunksRef.current = []
              if (completeAudioUrlRef.current) {
                URL.revokeObjectURL(completeAudioUrlRef.current)
                completeAudioUrlRef.current = null
              }
              if (streamingAudioManagerRef.current) {
                streamingAudioManagerRef.current.cleanup()
                streamingAudioManagerRef.current = null
              }
              if (streamingAudioUrlRef.current) {
                URL.revokeObjectURL(streamingAudioUrlRef.current)
                streamingAudioUrlRef.current = null
              }
            } else if (response.type === 'audio_start') {
              // Audio generation started - initialize streaming playback (MediaSource) if supported
              const mediaType = config.media_type || 'fmp4'
              
              // Clean up previous audio resources
              completeAudioChunksRef.current = []
              if (completeAudioUrlRef.current) {
                URL.revokeObjectURL(completeAudioUrlRef.current)
                completeAudioUrlRef.current = null
              }
              streamingStartedRef.current = false
              if (streamingAudioManagerRef.current) {
                streamingAudioManagerRef.current.cleanup()
                streamingAudioManagerRef.current = null
              }
              if (streamingAudioUrlRef.current) {
                URL.revokeObjectURL(streamingAudioUrlRef.current)
                streamingAudioUrlRef.current = null
              }
              
              if ((mediaType === 'ogg' || mediaType === 'aac' || mediaType === 'fmp4') && typeof MediaSource !== 'undefined') {
                try {
                  const manager = new StreamingAudioManager()
                  manager.setOnError((error) => {
                    console.error('MediaSource error:', error)
                    streamingAudioManagerRef.current = null
                    if (streamingAudioUrlRef.current) {
                      URL.revokeObjectURL(streamingAudioUrlRef.current)
                      streamingAudioUrlRef.current = null
                    }
                    // Mark message as not streaming to avoid repeat autoplay attempts
                    setMessages((prev) => {
                      const updated = [...prev]
                      const lastIndex = updated.length - 1
                      if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                        updated[lastIndex] = {
                          ...updated[lastIndex],
                          isStreamingPlayback: false,
                        }
                      }
                      return updated
                    })
                  })
                  manager.setOnReady(() => {
                    // MediaSource open; audio element can start
                    setMessages((prev) => {
                      const updated = [...prev]
                      const lastIndex = updated.length - 1
                      if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                        updated[lastIndex] = {
                          ...updated[lastIndex],
                          isStreamingPlayback: true,
                          streamingAudioUrl: streamingAudioUrlRef.current || updated[lastIndex].streamingAudioUrl,
                        }
                      }
                      return updated
                    })
                  })
                  const url = manager.initialize(mediaType as 'ogg' | 'aac' | 'fmp4')
                  streamingAudioManagerRef.current = manager
                  streamingAudioUrlRef.current = url
                  
                  // Set streaming URL immediately to trigger AudioPlayer autoplay
                  setMessages((prev) => {
                    const updated = [...prev]
                    const lastIndex = updated.length - 1
                    if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                      updated[lastIndex] = {
                        ...updated[lastIndex],
                        isStreamingPlayback: true,
                        streamingAudioUrl: url,
                        isLoading: true,
                      }
                    }
                    return updated
                  })
                  
                  console.log('MediaSource streaming initialized')
                } catch (e) {
                  console.warn('MediaSource init failed, will fallback to blob aggregation for complete audio only:', e)
                  streamingAudioManagerRef.current = null
                }
              } else {
                // For wav/raw or unsupported, we'll only build complete audio later; no streaming playback
                console.log('MediaSource not used for this media type, streaming playback disabled')
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastIndex = updated.length - 1
                  if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      isStreamingPlayback: false,
                    }
                  }
                  return updated
                })
              }
            } else if (response.type === 'audio_chunk' && response.data) {
              // Streaming audio chunk received
              try {
                // Decode base64 to Uint8Array
                const binaryString = atob(response.data)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i)
                }
                
                const mediaType = config.media_type || 'fmp4'
                
                // Accumulate chunk for complete audio (for replay)
                completeAudioChunksRef.current.push(new Uint8Array(bytes))
                
                // Streaming playback via MediaSource (for ogg/aac/fmp4)
                if (streamingAudioManagerRef.current && (mediaType === 'ogg' || mediaType === 'aac' || mediaType === 'fmp4')) {
                  const chunkCount = completeAudioChunksRef.current.length
                  streamingAudioManagerRef.current.appendChunk(bytes)
                  
                  // Start playback as soon as first chunk is appended to MediaSource
                  // MediaSource will buffer internally, reducing gaps between sentences
                  if (!streamingStartedRef.current) {
                    streamingStartedRef.current = true
                    setMessages((prev) => {
                      const updated = [...prev]
                      const lastIndex = updated.length - 1
                      if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                        updated[lastIndex] = {
                          ...updated[lastIndex],
                          isLoading: false,
                          isStreamingPlayback: true,
                          streamingAudioUrl: streamingAudioUrlRef.current || updated[lastIndex].streamingAudioUrl,
                        }
                      }
                      return updated
                    })
                    console.log('First streaming chunk appended, starting playback (MediaSource will buffer internally)')
                  }
                } else {
                  // No streaming playback (e.g., wav/raw). We cannot play partial chunks reliably; only build complete audio.
                  const isFirstChunk = completeAudioChunksRef.current.length === 1
                  if (isFirstChunk) {
                    console.log('First chunk received (non-streaming media), waiting for complete audio to enable replay')
                  }
                }
              } catch (e) {
                console.error('Failed to process audio chunk:', e)
              }
            } else if (response.type === 'audio_complete') {
              // Audio generation complete - create complete audio URL for replay
              const mediaType = config.media_type || 'fmp4'
              
              // End MediaSource stream to trigger ended event when playback finishes
              if (streamingAudioManagerRef.current && (mediaType === 'ogg' || mediaType === 'aac' || mediaType === 'fmp4')) {
                try {
                  streamingAudioManagerRef.current.endStream()
                  console.log('MediaSource stream ended, waiting for playback to finish')
                } catch (e) {
                  console.error('Failed to end MediaSource stream:', e)
                }
              }
              
              // Create complete audio URL from all accumulated chunks (for replay)
              if (completeAudioChunksRef.current.length > 0) {
                try {
                  const totalLength = completeAudioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0)
                  const combined = new Uint8Array(totalLength)
                  let offset = 0
                  for (const chunk of completeAudioChunksRef.current) {
                    combined.set(chunk, offset)
                    offset += chunk.length
                  }
                  
                  const mimeType = mediaType === 'wav' ? 'audio/wav' : 
                                   mediaType === 'ogg' ? 'audio/ogg' :
                                   mediaType === 'aac' ? 'audio/mp4' :
                                   mediaType === 'fmp4' ? 'video/mp4' : 'audio/raw'
                  const blob = new Blob([combined], { type: mimeType })
                  const completeUrl = URL.createObjectURL(blob)
                  
                  if (completeAudioUrlRef.current) {
                    URL.revokeObjectURL(completeAudioUrlRef.current)
                  }
                  completeAudioUrlRef.current = completeUrl
                  
                  // Update message with complete audio URL (for replay)
                  // IMPORTANT: do NOT swap the currently playing streaming URL to avoid interruption.
                  // For streaming-capable types (ogg/aac/fmp4), keep streamingAudioUrl and isStreamingPlayback true.
                  // The streaming playback will finish naturally and trigger ended event.
                  // For non-streaming types (wav/raw), set audioUrl for playback.
                  setMessages((prev) => {
                    const updated = [...prev]
                    const lastIndex = updated.length - 1
                    if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                      const isStreamingType = mediaType === 'ogg' || mediaType === 'aac' || mediaType === 'fmp4'
                      updated[lastIndex] = {
                        ...updated[lastIndex],
                        completeAudioUrl: completeUrl,
                        // keep legacy field only for non-streaming types to allow replay
                        audioUrl: isStreamingType ? updated[lastIndex].audioUrl : completeUrl,
                        // Keep isStreamingPlayback true for streaming types - it will be set to false when playback ends
                        isStreamingPlayback: isStreamingType ? updated[lastIndex].isStreamingPlayback : false,
                        isLoading: false,
                      }
                    }
                    return updated
                  })
                  
                  console.log('Audio generation complete, complete audio URL created for replay')
                } catch (e) {
                  console.error('Failed to create complete audio URL:', e)
                }
              }
              
              setIsLoading(false)
            } else if (response.type === 'audio' && response.data) {
              // Non-streaming audio received (fallback)
              const audioUrl = base64ToAudioUrl(response.data)
              setMessages((prev) => {
                const updated = [...prev]
                const lastIndex = updated.length - 1
                if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    audioUrl: audioUrl,
                    isLoading: false,
                    isStreamingPlayback: false,
                  }
                }
                return updated
              })
              setIsLoading(false)
            } else if (response.type === 'error') {
              // Error occurred
              setError(response.error || '发生未知错误')
              setMessages((prev) => {
                const updated = [...prev]
                const lastIndex = updated.length - 1
                if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    isLoading: false,
                    error: response.error,
                    isStreamingPlayback: false,
                  }
                }
                return updated
              })
              setIsLoading(false)
              // Clean up audio resources on error
              if (audioQueuePlayerRef.current) {
                audioQueuePlayerRef.current.cleanup()
                audioQueuePlayerRef.current = null
              }
              completeAudioChunksRef.current = []
              if (completeAudioUrlRef.current) {
                URL.revokeObjectURL(completeAudioUrlRef.current)
                completeAudioUrlRef.current = null
              }
              if (streamingAudioManagerRef.current) {
                streamingAudioManagerRef.current.cleanup()
                streamingAudioManagerRef.current = null
              }
              if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current)
                audioUrlRef.current = null
              }
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
    [messages, config, isLoading, conversationId]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setCurrentStreamingText('')
    setError(null)
    // Clean up all audio resources
    if (audioQueuePlayerRef.current) {
      audioQueuePlayerRef.current.cleanup()
      audioQueuePlayerRef.current = null
    }
    completeAudioChunksRef.current = []
    if (completeAudioUrlRef.current) {
      URL.revokeObjectURL(completeAudioUrlRef.current)
      completeAudioUrlRef.current = null
    }
    if (streamingAudioManagerRef.current) {
      streamingAudioManagerRef.current.cleanup()
      streamingAudioManagerRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  return {
    messages,
    isLoading,
    currentStreamingText,
    error,
    conversationId,
    loadConversation,
    startNewConversation,
    sendMessage,
    clearMessages,
  }
}

