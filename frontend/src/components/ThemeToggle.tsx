/**
 * Theme toggle button component
 */
import React from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeClasses } from '../utils/theme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  return (
    <button
      onClick={toggleTheme}
      className={`px-3 py-1.5 text-sm rounded-lg ${themeClasses.bg.button} ${themeClasses.text.primary} ${themeClasses.bg.buttonHover} border ${themeClasses.border.buttonSecondary} transition-all duration-200 whitespace-nowrap`}
      aria-label="Toggle theme"
      title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

