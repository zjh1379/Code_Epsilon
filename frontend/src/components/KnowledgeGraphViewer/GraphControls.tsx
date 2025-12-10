/**
 * Graph controls component for filtering and searching
 */
import React, { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { getThemeClasses } from '../../utils/theme'

interface GraphControlsProps {
  onSearch: (query: string) => void
  onToggleEntityType: (type: string) => void
  onToggleRelationType: (type: string) => void
  entityTypes: string[]
  relationTypes: string[]
  selectedEntityTypes: string[]
  selectedRelationTypes: string[]
  stats?: {
    total_nodes: number
    total_relations: number
  }
}

export default function GraphControls({
  onSearch,
  onToggleEntityType,
  onToggleRelationType,
  entityTypes,
  relationTypes,
  selectedEntityTypes,
  selectedRelationTypes,
  stats,
}: GraphControlsProps) {
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  return (
    <div className={`${themeClasses.bg.panel} p-4 border-b-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-200'} space-y-4`}>
      {/* Stats */}
      {stats && (
        <div className={`flex items-center space-x-4 text-sm ${themeClasses.text.secondary}`}>
          <span>节点: <span className={theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'}>{stats.total_nodes}</span></span>
          <span>关系: <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}>{stats.total_relations}</span></span>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索节点..."
          className={`flex-1 px-3 py-2 border-2 ${theme === 'dark' ? 'border-emerald-500/30 focus:border-emerald-500/50' : 'border-gray-300 focus:border-blue-500'} rounded-lg ${themeClasses.bg.inputField} ${themeClasses.text.primary} ${themeClasses.text.placeholder} focus:outline-none focus:ring-2 transition-all`}
        />
        <button
          type="submit"
          className={`px-4 py-2 ${theme === 'dark' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-all duration-200`}
        >
          搜索
        </button>
      </form>

      {/* Entity Type Filter */}
      {entityTypes.length > 0 && (
        <div>
          <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
            实体类型过滤
          </label>
          <div className="flex flex-wrap gap-2">
            {entityTypes.map((type) => (
              <label
                key={type}
                className={`flex items-center px-3 py-1 rounded-lg cursor-pointer transition-all ${
                  selectedEntityTypes.includes(type)
                    ? theme === 'dark'
                      ? 'bg-emerald-600/30 text-emerald-300'
                      : 'bg-blue-100 text-blue-700'
                    : theme === 'dark'
                    ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedEntityTypes.includes(type)}
                  onChange={() => onToggleEntityType(type)}
                  className="mr-2"
                />
                <span className="text-sm">{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Relation Type Filter */}
      {relationTypes.length > 0 && (
        <div>
          <label className={`block text-sm font-medium ${themeClasses.text.primary} mb-2`}>
            关系类型过滤
          </label>
          <div className="flex flex-wrap gap-2">
            {relationTypes.map((type) => (
              <label
                key={type}
                className={`flex items-center px-3 py-1 rounded-lg cursor-pointer transition-all ${
                  selectedRelationTypes.includes(type)
                    ? theme === 'dark'
                      ? 'bg-purple-600/30 text-purple-300'
                      : 'bg-purple-100 text-purple-700'
                    : theme === 'dark'
                    ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedRelationTypes.includes(type)}
                  onChange={() => onToggleRelationType(type)}
                  className="mr-2"
                />
                <span className="text-sm">{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

