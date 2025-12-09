/**
 * Audio player component with streaming support
 */
import React, { useState, useRef, useEffect } from 'react'

interface AudioPlayerProps {
  audioUrl: string
  autoPlay?: boolean
  isLoading?: boolean  // For streaming audio
}

export default function AudioPlayer({
  audioUrl,
  autoPlay = false,
  isLoading = false,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previousUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Clean up previous audio URL
    if (previousUrlRef.current && previousUrlRef.current !== audioUrl) {
      URL.revokeObjectURL(previousUrlRef.current)
    }
    previousUrlRef.current = audioUrl

    if (!audioUrl) return

    // Create new audio element or update existing one
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl)
    } else {
      // For streaming audio, we need to update the source
      const wasPlaying = !audioRef.current.paused
      const currentTime = audioRef.current.currentTime
      
      audioRef.current.pause()
      audioRef.current.src = audioUrl
      audioRef.current.load()
      
      // Restore playback state if it was playing
      if (wasPlaying) {
        audioRef.current.currentTime = currentTime
        audioRef.current.play().catch((e) => {
          console.error('Resume play failed:', e)
        })
      }
    }

    const audio = audioRef.current

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleLoadedData = () => {
      updateDuration()
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('loadeddata', handleLoadedData)
    audio.addEventListener('durationchange', updateDuration)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    // Try to load the audio
    audio.load()

    if (autoPlay && !isLoading) {
      audio.play().catch((e) => {
        console.error('Auto-play failed:', e)
      })
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('loadeddata', handleLoadedData)
      audio.removeEventListener('durationchange', updateDuration)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [audioUrl, autoPlay, isLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current)
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((e) => {
        console.error('Play failed:', e)
      })
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return
    const newTime = parseFloat(e.target.value)
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center space-x-2 bg-white rounded-lg p-2 border border-gray-300">
      <button
        onClick={togglePlay}
        disabled={isLoading || !audioUrl}
        className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : isPlaying ? (
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
      
      <div className="flex-1">
        {isLoading && duration === 0 ? (
          <div className="text-xs text-gray-500 py-1">正在生成语音...</div>
        ) : (
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading || duration === 0}
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
        )}
      </div>
      
      <span className="text-xs text-gray-500 min-w-[40px] text-right">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  )
}

