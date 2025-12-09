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

  useEffect(() => {
    // Reset state when audioUrl changes
    if (audioRef.current && audioRef.current.src !== audioUrl) {
      setIsPlaying(false)
      setIsExpanded(false)
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
    } else {
      audioRef.current.src = audioUrl
    }

    const audio = audioRef.current

    const handleEnded = () => {
      setIsPlaying(false)
      setIsExpanded(false)
    }
    const handlePlay = () => {
      setIsPlaying(true)
      setIsExpanded(true)
    }
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    // Auto play when audio is ready and autoPlay is enabled
    const handleCanPlay = () => {
      if (autoPlay && hasAutoPlayedRef.current !== audioUrl) {
        hasAutoPlayedRef.current = audioUrl
        audio.play().catch((e) => {
          console.error('Auto-play failed:', e)
        })
      }
    }

    audio.addEventListener('canplay', handleCanPlay)

    // Try to play immediately if audio is already loaded
    if (autoPlay && hasAutoPlayedRef.current !== audioUrl && audio.readyState >= 2) {
      hasAutoPlayedRef.current = audioUrl
      audio.play().catch((e) => {
        console.error('Auto-play failed:', e)
      })
    }

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('canplay', handleCanPlay)
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
      })
    }
  }

  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

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
            onClick={() => {
              if (isPlaying) {
                audioRef.current?.pause()
              }
              setIsExpanded(false)
            }}
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

