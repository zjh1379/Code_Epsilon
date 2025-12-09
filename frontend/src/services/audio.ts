/**
 * Audio utility functions
 */

/**
 * Convert base64 audio data to Blob URL
 */
export function base64ToAudioUrl(base64Data: string, mimeType: string = 'audio/wav'): string {
  // Remove data URL prefix if present
  const base64 = base64Data.replace(/^data:audio\/\w+;base64,/, '')
  
  // Convert base64 to binary
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  // Create Blob and URL
  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

/**
 * Play audio from URL
 */
export function playAudio(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url)
    
    audio.onended = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    
    audio.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    
    audio.play().catch(reject)
  })
}

/**
 * Create audio element for playback control
 */
export function createAudioElement(url: string): HTMLAudioElement {
  const audio = new Audio(url)
  return audio
}

