/**
 * Theme utility functions for getting theme-specific class names
 */
import { Theme } from '../contexts/ThemeContext'

export function getThemeClasses(theme: Theme) {
  return {
    // Background colors
    bg: {
      main: theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-50',
      header: theme === 'dark' ? 'bg-zinc-800/90' : 'bg-white/90',
      input: theme === 'dark' ? 'bg-zinc-900/80' : 'bg-white/80',
      inputField: theme === 'dark' ? 'bg-zinc-950/80' : 'bg-white',
      messageUser: theme === 'dark' 
        ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' 
        : 'bg-blue-500',
      messageAssistant: theme === 'dark' 
        ? 'bg-zinc-900/90' 
        : 'bg-gray-100',
      panel: theme === 'dark' ? 'bg-zinc-900/95' : 'bg-white/95',
      button: theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100',
      buttonHover: theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-gray-200',
    },
    // Text colors
    text: {
      primary: theme === 'dark' ? 'text-zinc-200' : 'text-gray-900',
      secondary: theme === 'dark' ? 'text-zinc-400' : 'text-gray-600',
      muted: theme === 'dark' ? 'text-zinc-500' : 'text-gray-500',
      user: theme === 'dark' ? 'text-white' : 'text-white',
      assistant: theme === 'dark' ? 'text-zinc-100' : 'text-gray-900',
      placeholder: theme === 'dark' ? 'placeholder-zinc-500' : 'placeholder-gray-400',
    },
    // Border colors
    border: {
      header: theme === 'dark' ? 'border-zinc-700/50' : 'border-gray-200',
      input: theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-300',
      inputFocus: theme === 'dark' ? 'border-emerald-500/60' : 'border-blue-500',
      messageUser: theme === 'dark' 
        ? 'border-emerald-400/50' 
        : 'border-blue-400/50',
      messageAssistant: theme === 'dark' 
        ? 'border-purple-500/40' 
        : 'border-gray-300',
      button: theme === 'dark' ? 'border-emerald-500/50' : 'border-gray-300',
      buttonSecondary: theme === 'dark' ? 'border-zinc-600/30' : 'border-gray-300',
    },
    // Shadow colors
    shadow: {
      messageUser: theme === 'dark' 
        ? 'shadow-emerald-500/30' 
        : 'shadow-blue-500/20',
      messageAssistant: theme === 'dark' 
        ? 'shadow-purple-500/20' 
        : 'shadow-gray-500/10',
    },
    // Title gradient
    titleGradient: theme === 'dark' 
      ? 'bg-gradient-to-r from-emerald-400 via-purple-400 to-emerald-400' 
      : 'bg-gradient-to-r from-blue-600 to-gray-700',
  }
}

