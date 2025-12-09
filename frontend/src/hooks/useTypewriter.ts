/**
 * Typewriter effect hook for character-by-character text display
 * Handles streaming text updates smoothly
 */
import { useState, useEffect, useRef } from 'react'

interface UseTypewriterOptions {
  text: string
  speed?: number // milliseconds per character
  enabled?: boolean
  onComplete?: () => void
}

export function useTypewriter({
  text,
  speed = 20,
  enabled = true,
  onComplete,
}: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef(0)
  const previousTextRef = useRef('')

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text)
      setIsTyping(false)
      currentIndexRef.current = text.length
      previousTextRef.current = text
      return
    }

    // If text is shorter than displayed, reset (new message)
    if (text.length < displayedText.length) {
      setDisplayedText('')
      currentIndexRef.current = 0
      previousTextRef.current = ''
      setIsTyping(false)
    }

    // If text has new characters to display
    if (text.length > currentIndexRef.current) {
      setIsTyping(true)

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Type next character
      const typeNextChar = () => {
        if (currentIndexRef.current < text.length) {
          // Check if text has changed (streaming update)
          const currentText = text
          if (currentText.length > currentIndexRef.current) {
            setDisplayedText(currentText.slice(0, currentIndexRef.current + 1))
            currentIndexRef.current += 1
            timeoutRef.current = setTimeout(typeNextChar, speed)
          } else {
            // Text was reset or changed, stop typing
            setIsTyping(false)
          }
        } else {
          // All characters displayed
          setIsTyping(false)
          previousTextRef.current = text
          if (onComplete) {
            onComplete()
          }
        }
      }

      // Start typing immediately
      typeNextChar()

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    } else if (text.length === currentIndexRef.current && displayedText === text) {
      // Text is complete and displayed
      setIsTyping(false)
      previousTextRef.current = text
    }
  }, [text, enabled, speed, displayedText, onComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    displayedText,
    isTyping,
    isComplete: displayedText === text && !isTyping,
  }
}

