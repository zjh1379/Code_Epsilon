/**
 * API service for backend communication
 */
import axios from 'axios'
import type {
  ChatRequest,
  ChatResponse,
  ConfigResponse,
  ConfigUpdateRequest,
} from '../types'
import type { CharacterProfile } from '../types/character'

const API_BASE_URL = '/api'

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Send chat message and receive streaming response
 * Uses Server-Sent Events (SSE) for streaming
 */
export async function sendChatMessage(
  request: ChatRequest,
  onMessage: (response: ChatResponse) => void,
  onError?: (error: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Response body is not readable')
    }

    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as ChatResponse
              onMessage(data)
            } catch (e) {
              console.error('Failed to parse SSE data:', e, line)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was aborted, don't call onError
      return
    }
    if (onError) {
      onError(error as Error)
    } else {
      throw error
    }
  }
}

/**
 * Get current configuration
 */
export async function getConfig(): Promise<ConfigResponse> {
  const response = await apiClient.get<ConfigResponse>('/config')
  return response.data
}

/**
 * Update configuration
 */
export async function updateConfig(
  config: ConfigUpdateRequest
): Promise<ConfigResponse> {
  const response = await apiClient.post<ConfigResponse>('/config', config)
  return response.data
}

/**
 * Upload audio file
 */
export async function uploadAudioFile(file: File): Promise<{ file_path: string; filename: string }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch(`${API_BASE_URL}/upload/audio`, {
    method: 'POST',
    body: formData,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Upload failed: ${response.status}, ${errorText}`)
  }
  
  const data = await response.json()
  return data
}

/**
 * Get current character profile
 */
export async function getCharacter(): Promise<CharacterProfile> {
  const response = await apiClient.get<CharacterProfile>('/character')
  return response.data
}

/**
 * Update character profile
 */
export async function updateCharacter(
  character: CharacterProfile
): Promise<CharacterProfile> {
  const response = await apiClient.post<CharacterProfile>('/character', character)
  return response.data
}

