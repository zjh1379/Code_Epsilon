/**
 * Streaming audio manager using MediaSource API
 * Supports OGG format for true streaming playback without interruption
 */
export class StreamingAudioManager {
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private audioUrl: string | null = null
  private isInitialized: boolean = false
  private chunkQueue: Uint8Array[] = []
  private isUpdating: boolean = false
  private mediaType: string = 'audio/ogg'
  private onReadyCallback?: () => void
  private onErrorCallback?: (error: Error) => void

  /**
   * Initialize MediaSource based on media type
   * Returns URL if successful, throws error if MediaSource is not supported
   */
  initialize(mediaType: 'wav' | 'ogg' | 'aac' | 'raw' | 'fmp4' = 'ogg'): string {
    if (this.audioUrl) {
      return this.audioUrl
    }

    // Check if MediaSource is available
    if (typeof MediaSource === 'undefined') {
      throw new Error('MediaSource API is not supported in this browser')
    }

    // Determine MIME type based on media type
    // Check MediaSource support first
    let mimeType: string | null = null
    
    switch (mediaType) {
      case 'ogg': {
        // Prefer native OGG/Opus (matches backend chunks), then Vorbis, then WebM/Opus as a last resort
        const candidates = [
          'audio/ogg; codecs="opus"',
          'audio/ogg; codecs="vorbis"',
          'audio/ogg',
          'audio/webm; codecs="opus"',
          'audio/webm',
        ]
        for (const candidate of candidates) {
          if (MediaSource.isTypeSupported(candidate)) {
            mimeType = candidate
            break
          }
        }
        break
      }
      case 'aac':
      case 'fmp4':
        if (MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')) {
          mimeType = 'audio/mp4; codecs="mp4a.40.2"'
        } else if (MediaSource.isTypeSupported('video/mp4; codecs="mp4a.40.2"')) {
          mimeType = 'video/mp4; codecs="mp4a.40.2"'
        } else if (MediaSource.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaSource.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4'
        }
        break
      case 'wav':
        // WAV is not supported by MediaSource
        mimeType = null
        break
      default:
        mimeType = null
    }

    // If no supported MIME type found, throw error to trigger fallback
    if (!mimeType) {
      throw new Error(`MediaSource does not support ${mediaType} format (try media_type='aac')`)
    }
    
    console.log(`Using MediaSource with MIME type: ${mimeType}`)

    this.mediaType = mimeType

    // Create MediaSource
    this.mediaSource = new MediaSource()
    this.audioUrl = URL.createObjectURL(this.mediaSource)

    // Handle MediaSource events
    this.mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource sourceopen event')
      this.handleSourceOpen()
    })

    this.mediaSource.addEventListener('sourceended', () => {
      console.log('MediaSource ended')
    })

    this.mediaSource.addEventListener('error', (e) => {
      console.error('MediaSource error:', e)
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('MediaSource error'))
      }
    })

    return this.audioUrl
  }

  /**
   * Handle sourceopen event - create SourceBuffer
   */
  private handleSourceOpen(): void {
    if (!this.mediaSource || this.isInitialized) {
      return
    }

    try {
      console.log(`Creating SourceBuffer with MIME type: ${this.mediaType}`)
      // Create SourceBuffer with the determined MIME type
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mediaType)
      console.log('SourceBuffer created successfully')

      // Use sequence mode to stitch fragmented segments seamlessly (esp. fMP4/WebM)
      try {
        this.sourceBuffer.mode = 'sequence'
        console.log('SourceBuffer mode set to sequence')
      } catch (e) {
        console.warn('Failed to set SourceBuffer mode to sequence (non-fatal):', e)
      }

      this.sourceBuffer.addEventListener('updateend', () => {
        this.isUpdating = false
        console.log('SourceBuffer updateend, processing queue')
        this.processQueue()
      })

      this.sourceBuffer.addEventListener('error', (e) => {
        console.error('SourceBuffer error:', e)
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error('SourceBuffer error'))
        }

        // On error, attempt a soft reset of the queue to avoid stuck state
        this.isUpdating = false
        this.chunkQueue = []
      })

      this.isInitialized = true
      console.log('StreamingAudioManager initialized, processing queue')
      this.processQueue()

      if (this.onReadyCallback) {
        this.onReadyCallback()
      }
    } catch (e) {
      console.error('Failed to create SourceBuffer:', e)
      if (this.onErrorCallback) {
        this.onErrorCallback(e as Error)
      }
    }
  }

  /**
   * Append audio chunk
   */
  appendChunk(chunk: Uint8Array): void {
    if (!this.mediaSource) {
      // Initialize if not already done (default to ogg)
      this.initialize('ogg')
    }

    // Add to queue
    this.chunkQueue.push(chunk)
    console.log(`Added chunk to queue, queue length: ${this.chunkQueue.length}, initialized: ${this.isInitialized}, updating: ${this.isUpdating}`)

    // Process queue immediately if SourceBuffer is ready
    // This ensures chunks are appended as fast as possible to reduce gaps
    if (this.isInitialized) {
      // Try to process immediately if not updating
      if (!this.isUpdating && this.sourceBuffer && !this.sourceBuffer.updating && this.mediaSource?.readyState === 'open') {
        this.processQueue()
      }
      // If updating, the updateend event will trigger processQueue automatically
    }
  }

  /**
   * Process queued chunks
   */
  private processQueue(): void {
    if (!this.sourceBuffer || this.isUpdating || this.chunkQueue.length === 0) {
      return
    }

    // Check if SourceBuffer is ready
    if (this.sourceBuffer.updating) {
      console.log('SourceBuffer is updating, waiting...')
      return
    }
    
    if (this.mediaSource?.readyState !== 'open') {
      console.log(`MediaSource readyState is ${this.mediaSource?.readyState}, not open`)
      return
    }

    try {
      this.isUpdating = true
      const chunk = this.chunkQueue.shift()!
      console.log(`Appending chunk of size ${chunk.length} bytes to SourceBuffer`)
      this.sourceBuffer.appendBuffer(chunk)
    } catch (e) {
      console.error('Failed to append buffer:', e)
      this.isUpdating = false
      
      if (this.onErrorCallback) {
        this.onErrorCallback(e as Error)
      }
    }
  }

  /**
   * End streaming - close MediaSource
   */
  endStream(): void {
    // Process remaining queue first
    if (this.chunkQueue.length > 0 && this.isInitialized && !this.isUpdating) {
      this.processQueue()
    }

    // Wait for queue to be processed, then end stream
    const checkAndEnd = () => {
      if (this.chunkQueue.length === 0 && !this.isUpdating) {
        if (this.sourceBuffer && !this.sourceBuffer.updating && this.mediaSource?.readyState === 'open') {
          try {
            this.mediaSource.endOfStream()
          } catch (e) {
            console.error('Failed to end stream:', e)
          }
        }
      } else {
        // Check again after a short delay
        setTimeout(checkAndEnd, 100)
      }
    }

    checkAndEnd()
  }

  /**
   * Get audio URL
   */
  getUrl(): string | null {
    return this.audioUrl
  }

  /**
   * Set callbacks
   */
  setOnReady(callback: () => void): void {
    this.onReadyCallback = callback
  }

  setOnError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl)
      this.audioUrl = null
    }
    
    if (this.sourceBuffer) {
      try {
        if (this.mediaSource?.readyState === 'open') {
          this.mediaSource.removeSourceBuffer(this.sourceBuffer)
        }
      } catch (e) {
        console.error('Failed to remove SourceBuffer:', e)
      }
      this.sourceBuffer = null
    }

    if (this.mediaSource) {
      try {
        if (this.mediaSource.readyState === 'open') {
          this.mediaSource.endOfStream()
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.mediaSource = null
    }

    this.isInitialized = false
    this.chunkQueue = []
    this.isUpdating = false
  }
}

