/**
 * Audio queue player for sequential playback of audio chunks
 */
export class AudioQueuePlayer {
  private queue: string[] = [] // Queue of audio URLs (Blob URLs)
  private currentIndex: number = -1
  private currentAudio: HTMLAudioElement | null = null
  private isPlaying: boolean = false
  private onQueueEmpty?: () => void
  private onError?: (error: Error) => void

  /**
   * Add an audio URL to the queue
   */
  enqueue(audioUrl: string): void {
    this.queue.push(audioUrl)
    console.log(`AudioQueuePlayer: Enqueued audio, queue length: ${this.queue.length}`)
    
    // If not currently playing, start playing
    if (!this.isPlaying && this.currentIndex === -1) {
      this.playNext()
    }
  }

  /**
   * Play the next audio in the queue
   */
  private playNext(): void {
    // Check if there are more items in queue
    if (this.currentIndex + 1 >= this.queue.length) {
      console.log('AudioQueuePlayer: Queue empty, waiting for more chunks')
      this.isPlaying = false
      if (this.onQueueEmpty) {
        this.onQueueEmpty()
      }
      return
    }

    this.currentIndex++
    const audioUrl = this.queue[this.currentIndex]
    
    // Clean up previous audio
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio.load()
    }

    // Create new audio element
    const audio = new Audio(audioUrl)
    this.currentAudio = audio
    this.isPlaying = true

    // Set up event handlers
    audio.addEventListener('ended', () => {
      console.log(`AudioQueuePlayer: Chunk ${this.currentIndex + 1}/${this.queue.length} finished`)
      // Revoke the URL to free memory
      URL.revokeObjectURL(audioUrl)
      // Play next chunk
      this.playNext()
    })

    audio.addEventListener('error', (e) => {
      console.error(`AudioQueuePlayer: Error playing chunk ${this.currentIndex + 1}:`, e)
      // Revoke the URL
      URL.revokeObjectURL(audioUrl)
      // Try next chunk
      this.playNext()
    })

    // Start playing
    console.log(`AudioQueuePlayer: Playing chunk ${this.currentIndex + 1}/${this.queue.length}`)
    audio.play().catch((error) => {
      console.error(`AudioQueuePlayer: Failed to play chunk ${this.currentIndex + 1}:`, error)
      // Revoke the URL
      URL.revokeObjectURL(audioUrl)
      // Try next chunk
      this.playNext()
    })
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause()
      this.isPlaying = false
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play()
      this.isPlaying = true
    } else if (!this.isPlaying && this.currentIndex < this.queue.length - 1) {
      // Resume from next item
      this.playNext()
    }
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio.load()
      this.currentAudio = null
    }
    
    // Revoke all URLs
    this.queue.forEach(url => URL.revokeObjectURL(url))
    
    this.queue = []
    this.currentIndex = -1
    this.isPlaying = false
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stop()
  }

  /**
   * Set callback for when queue is empty
   */
  setOnQueueEmpty(callback: () => void): void {
    this.onQueueEmpty = callback
  }

  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback
  }

  /**
   * Get current playing state
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length
  }
}

