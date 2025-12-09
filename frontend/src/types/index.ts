/**
 * TypeScript type definitions
 */

export interface Message {
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string  // Complete audio URL for replay (legacy)
  streamingAudioUrl?: string  // Streaming playback URL (e.g., MediaSource)
  completeAudioUrl?: string  // Complete audio URL for replay
  isStreamingPlayback?: boolean  // Whether currently streaming playback
  isLoading?: boolean
  error?: string
}

export interface ChatConfig {
  ref_audio_path: string
  prompt_text: string
  prompt_lang: 'zh' | 'en' | 'ja' | 'ko' | 'yue'
  text_lang: 'zh' | 'en' | 'ja' | 'ko' | 'yue'
  text_split_method: string
  speed_factor: number
  fragment_interval: number
  top_k: number
  top_p: number
  temperature: number
  streaming_mode: number  // 0=non-streaming, 1=return_fragment, 2=true streaming (recommended), 3=fixed length chunk
  media_type: 'wav' | 'ogg' | 'aac' | 'raw' | 'fmp4'  // Audio format: wav (compatibility), ogg/webm (recommended for streaming), aac/fmp4, raw
  aux_ref_audio_paths?: string[]
}

export interface ChatRequest {
  message: string
  history: Message[]
  config: ChatConfig
}

export interface ChatResponse {
  type: 'text' | 'complete' | 'audio_start' | 'audio_chunk' | 'audio_complete' | 'audio' | 'error'
  content?: string
  text?: string
  data?: string  // Base64 audio data (for non-streaming audio)
  index?: number  // Chunk index (for streaming audio)
  size?: number  // Chunk size in bytes (for streaming audio)
  total_chunks?: number  // Total chunks received (for audio_complete)
  error?: string
}

export interface ConfigResponse {
  ref_audio_path: string
  prompt_text: string
  prompt_lang: string
  text_lang: string
  text_split_method: string
  speed_factor: number
  fragment_interval: number
  top_k: number
  top_p: number
  temperature: number
  streaming_mode: number
  media_type: string
  gpt_weights_path?: string
  sovits_weights_path?: string
}

export interface ConfigUpdateRequest {
  ref_audio_path?: string
  prompt_text?: string
  prompt_lang?: string
  text_lang?: string
  text_split_method?: string
  speed_factor?: number
  fragment_interval?: number
  top_k?: number
  top_p?: number
  temperature?: number
  streaming_mode?: number
  media_type?: string
  gpt_weights_path?: string
  sovits_weights_path?: string
}

export interface Character {
  id: string
  name: string
  system_prompt: string
  is_default: boolean
  created_at?: string
  updated_at?: string
}

export interface CharacterCreateRequest {
  name: string
  system_prompt: string
}

export interface CharacterUpdateRequest {
  name?: string
  system_prompt?: string
}

