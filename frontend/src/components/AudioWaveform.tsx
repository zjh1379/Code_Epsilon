/**
 * Audio waveform animation component
 */
import React, { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface AudioWaveformProps {
  isPlaying: boolean
}

export default function AudioWaveform({ isPlaying }: AudioWaveformProps) {
  const { theme } = useTheme()
  const [heights, setHeights] = useState<number[]>([])

  // Initialize bars with random heights
  useEffect(() => {
    const initialHeights = Array.from({ length: 20 }, () => 
      Math.random() * 40 + 20 // Height between 20-60%
    )
    setHeights(initialHeights)
  }, [])

  // Animate bars when playing
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setHeights((prev) => 
        prev.map(() => Math.random() * 50 + 25) // Animate to random heights
      )
    }, 150) // Update every 150ms for smooth animation

    return () => clearInterval(interval)
  }, [isPlaying])

  const barColor = theme === 'dark' 
    ? 'bg-gradient-to-t from-emerald-400 to-purple-400'
    : 'bg-blue-500'

  return (
    <div className="flex items-center justify-center space-x-0.5 h-10 px-3">
      {heights.map((height, index) => (
        <div
          key={index}
          className={`w-0.5 ${barColor} rounded-full transition-all duration-150 ease-out ${
            isPlaying ? '' : 'opacity-40'
          }`}
          style={{
            height: isPlaying ? `${height}%` : '30%',
            minHeight: '4px',
          }}
        />
      ))}
    </div>
  )
}

