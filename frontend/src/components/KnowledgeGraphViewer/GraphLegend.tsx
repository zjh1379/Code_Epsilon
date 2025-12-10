/**
 * Graph legend component
 */
import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { getThemeClasses } from '../../utils/theme'

const NODE_TYPE_COLORS: Record<string, string> = {
  User: '#FF6B6B',
  Topic: '#4ECDC4',
  Project: '#45B7D1',
  Skill: '#96CEB4',
  Resource: '#FFEAA7',
  Conversation: '#DDA0DD',
  Entity: '#95A5A6',
}

export default function GraphLegend() {
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  return (
    <div className={`${themeClasses.bg.panel} p-3 rounded-lg border-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-300'} shadow-lg`}>
      <h4 className={`text-sm font-semibold ${themeClasses.text.primary} mb-2`}>图例</h4>
      <div className="space-y-1">
        {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center space-x-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className={`text-xs ${themeClasses.text.secondary}`}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

