/**
 * TypeScript type definitions
 */

export interface Message {
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
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
  aux_ref_audio_paths?: string[]
}

export interface ChatRequest {
  message: string
  history: Message[]
  config: ChatConfig
}

export interface ChatResponse {
  type: 'text' | 'complete' | 'audio' | 'error'
  content?: string
  text?: string
  data?: string  // Base64 audio data
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

