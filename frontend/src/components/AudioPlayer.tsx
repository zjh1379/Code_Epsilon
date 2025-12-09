/**
 * Audio player component with collapsible controls
 */
import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'
import AudioWaveform from './AudioWaveform'

interface AudioPlayerProps {
  audioUrl: string
  autoPlay?: boolean
}

export default function AudioPlayer({
  audioUrl,
  autoPlay = false,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasAutoPlayedRef = useRef<string>('')

  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  useEffect(() => {
    // Check if URL actually changed
    const urlChanged = !audioRef.current || audioRef.current.src !== audioUrl
    
    if (!urlChanged) {
      // URL hasn't changed, don't recreate audio element
      // But ensure event listeners are set up (they should already be)
      return
    }

    // Clean up previous audio instance
    if (audioRef.current) {
      const prevAudio = audioRef.current
      // Remove all event listeners
      prevAudio.pause()
      prevAudio.src = ''
      prevAudio.load()
    }

    // Reset state when audioUrl changes
    setIsPlaying(false)
    setIsExpanded(false)
    hasAutoPlayedRef.current = ''

    // Create new audio element
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    // Event handlers
    const handlePlay = () => {
      setIsPlaying(true)
      setIsExpanded(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setIsExpanded(false)
    }

    // For MediaSource streams, check if buffered data has ended
    // Only close waveform when audio is truly finished (not just buffering)
    const handleTimeUpdate = () => {
      // Don't interfere with streaming playback - only check when paused
      if (!audio.paused) {
        return
      }
      
      // Only check if we're at the end and paused (likely finished)
      if (audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1)
        const currentTime = audio.currentTime
        const duration = audio.duration
        
        // Only consider ended if:
        // 1. We have a valid duration
        // 2. We're very close to the end (within 0.1s)
        // 3. Audio is paused
        if (duration > 0 && currentTime >= duration - 0.1 && audio.paused) {
          setIsPlaying(false)
          setIsExpanded(false)
        }
      }
    }

    const handleError = (e: Event) => {
      console.error('Audio playback error:', e)
      setIsPlaying(false)
      setIsExpanded(false)
    }

    const handleCanPlay = () => {
      // Auto play when audio is ready and autoPlay is enabled
      if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
        hasAutoPlayedRef.current = audioUrl
        console.log('Auto-playing audio on canplay event, readyState:', audio.readyState)
        // Check if already playing to avoid interruption
        if (audioRef.current && !audioRef.current.paused) {
          console.log('Audio already playing, skipping')
          return
        }
        audio.play().catch((e) => {
          // Ignore AbortError (play was interrupted)
          if (e.name !== 'AbortError') {
            console.error('Auto-play failed:', e)
          } else {
            console.log('Play was aborted (normal for streaming)')
          }
        })
      }
    }

    const handleLoadedMetadata = () => {
      // For MediaSource, loadedmetadata fires when source is ready
      if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
        hasAutoPlayedRef.current = audioUrl
        console.log('Auto-playing audio on loadedmetadata event, readyState:', audio.readyState)
        // Check if already playing
        if (audioRef.current && !audioRef.current.paused) {
          console.log('Audio already playing, skipping')
          return
        }
        // Try immediate play for MediaSource
        audio.play().catch((e) => {
          // Ignore AbortError (play was interrupted)
          if (e.name !== 'AbortError') {
            console.error('Auto-play failed:', e)
            // Retry after short delay
            setTimeout(() => {
              if (audioRef.current && !audioRef.current.paused) {
                return
              }
              audio.play().catch((err) => {
                if (err.name !== 'AbortError') {
                  console.error('Retry play failed:', err)
                }
              })
            }, 100)
          } else {
            console.log('Play was aborted (normal for streaming)')
          }
        })
      }
    }

    const handleCanPlayThrough = () => {
      // This fires when enough data is loaded to play through
      if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
        hasAutoPlayedRef.current = audioUrl
        console.log('Auto-playing audio on canplaythrough event')
        // Check if already playing to avoid interruption
        if (audioRef.current && !audioRef.current.paused) {
          return
        }
        audio.play().catch((e) => {
          // Ignore AbortError (play was interrupted)
          if (e.name !== 'AbortError') {
            console.error('Auto-play failed:', e)
          }
        })
      }
    }

    // Add event listeners
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplaythrough', handleCanPlayThrough)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    
    // For MediaSource streams, listen for waiting events
    // But don't close waveform during streaming - waiting is normal during buffering
    const handleWaiting = () => {
      // Only check if audio is paused and we're at the end
      // During streaming, waiting events are normal and shouldn't close the waveform
      if (audio.paused && audio.buffered.length > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1)
        const duration = audio.duration
        
        // Only consider finished if we have a duration and we're at the end
        if (duration > 0 && audio.currentTime >= duration - 0.1) {
          // Double-check after a delay to ensure it's really finished
          setTimeout(() => {
            if (audio.paused && audio.currentTime >= duration - 0.1) {
              setIsPlaying(false)
              setIsExpanded(false)
            }
          }, 500)
        }
      }
    }
    
    audio.addEventListener('waiting', handleWaiting)

    // Try to play immediately if audio is already loaded and autoPlay is enabled
    let playTimeout: NodeJS.Timeout | null = null
    if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
      // Function to attempt playback
      const tryPlay = () => {
        if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
          // Check if already playing to avoid interruption
          if (audioRef.current && !audioRef.current.paused) {
            console.log('Audio already playing, skipping')
            return
          }
          hasAutoPlayedRef.current = audioUrl
          console.log('Attempting to play audio, readyState:', audio.readyState)
          audio.play().then(() => {
            console.log('Audio playback started successfully')
          }).catch((e) => {
            // Ignore AbortError (play was interrupted)
            if (e.name !== 'AbortError') {
              console.error('Auto-play failed:', e)
              // Retry after short delay if failed (but not AbortError)
              setTimeout(() => {
                if (audioRef.current && !audioRef.current.paused) {
                  return
                }
                if (hasAutoPlayedRef.current !== audioUrl) {
                  tryPlay()
                }
              }, 100)
            } else {
              console.log('Play was aborted (normal for streaming)')
            }
          })
        }
      }
      
      // Try immediate play regardless of readyState
      // For streaming audio, we want to start as soon as possible
      tryPlay()
      
      // Also set up timeout as backup for when readyState changes
      playTimeout = setTimeout(() => {
        if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
          tryPlay()
        }
      }, 50) // Very short delay for immediate response
    }

    // Cleanup function
    return () => {
      if (playTimeout) {
        clearTimeout(playTimeout)
      }
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplaythrough', handleCanPlayThrough)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('waiting', handleWaiting)
      
      // Clean up audio element
      audio.pause()
      audio.src = ''
      audio.load()
    }
  }, [audioUrl, autoPlay])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      setIsExpanded(true)
      audioRef.current.play().catch((e) => {
        console.error('Play failed:', e)
        setIsPlaying(false)
        setIsExpanded(false)
      })
    }
  }

  const handleCollapse = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
    }
    setIsExpanded(false)
  }

  const playButtonClasses = theme === 'dark'
    ? 'bg-gradient-to-br from-emerald-500 to-purple-500 hover:from-emerald-400 hover:to-purple-400 border-emerald-400/40 hover:shadow-emerald-500/30 ring-emerald-400/50 ring-purple-400/50'
    : 'bg-blue-500 hover:bg-blue-600 border-blue-400 hover:shadow-blue-500/30 ring-blue-400/50'

  return (
    <div className="relative inline-flex items-center">
      {/* Compact play button */}
      <button
        onClick={togglePlay}
        className={`w-8 h-8 flex items-center justify-center ${playButtonClasses} text-white rounded-full transition-all duration-200 shadow-md border-2 ${
          isPlaying ? 'ring-2' : ''
        }`}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? (
          <svg
            className="w-4 h-4"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M6 4h2v12H6V4zm6 0h2v12h-2V4z" />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 ml-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M6.5 4l9 6-9 6V4z" />
          </svg>
        )}
      </button>
      
      {/* Expanded controls with waveform */}
      {isExpanded && (
        <div className={`ml-3 flex items-center space-x-3 ${themeClasses.bg.messageAssistant} backdrop-blur-sm rounded-lg px-4 py-2 border-2 ${theme === 'dark' ? 'border-purple-500/30 shadow-purple-500/20' : 'border-gray-300'} shadow-lg animate-expand min-w-0 max-w-[calc(100vw-200px)] sm:max-w-none`}>
          <div className="flex-1 min-w-0 flex items-center">
            <AudioWaveform isPlaying={isPlaying} />
          </div>

          {/* Collapse button */}
          <button
            onClick={handleCollapse}
            className={`w-5 h-5 flex items-center justify-center ${themeClasses.text.secondary} hover:${themeClasses.text.primary} transition-colors flex-shrink-0`}
            aria-label="Collapse audio player"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
