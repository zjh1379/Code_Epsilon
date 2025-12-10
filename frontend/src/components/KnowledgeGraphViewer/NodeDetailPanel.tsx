/**
 * Node detail panel component
 */
import React from 'react'
import type { NodeDetails } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'
import { getThemeClasses } from '../../utils/theme'

interface NodeDetailPanelProps {
  node: NodeDetails
  onClose: () => void
}

export default function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)

  return (
    <div className={`h-full flex flex-col ${themeClasses.bg.panel} border-l-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-300'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b-2 ${theme === 'dark' ? 'border-emerald-500/30' : 'border-gray-200'}`}>
        <h3 className={`text-lg font-bold ${themeClasses.text.primary}`}>节点详情</h3>
        <button
          onClick={onClose}
          className={`w-8 h-8 flex items-center justify-center ${themeClasses.text.secondary} hover:${themeClasses.text.primary} ${theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-gray-100'} rounded-lg transition-all duration-200`}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Info */}
        <div>
          <h4 className={`text-sm font-semibold ${themeClasses.text.primary} mb-2`}>基本信息</h4>
          <div className={`space-y-2 ${themeClasses.bg.inputField} p-3 rounded-lg`}>
            <div>
              <span className={`text-xs ${themeClasses.text.secondary}`}>类型:</span>
              <span className={`ml-2 ${themeClasses.text.primary}`}>{node.type}</span>
            </div>
            <div>
              <span className={`text-xs ${themeClasses.text.secondary}`}>名称:</span>
              <span className={`ml-2 ${themeClasses.text.primary}`}>{node.name}</span>
            </div>
            <div>
              <span className={`text-xs ${themeClasses.text.secondary}`}>ID:</span>
              <span className={`ml-2 text-xs ${themeClasses.text.muted} font-mono`}>{node.id}</span>
            </div>
          </div>
        </div>

        {/* Properties */}
        {Object.keys(node.properties).length > 0 && (
          <div>
            <h4 className={`text-sm font-semibold ${themeClasses.text.primary} mb-2`}>属性</h4>
            <div className={`space-y-2 ${themeClasses.bg.inputField} p-3 rounded-lg`}>
              {Object.entries(node.properties).map(([key, value]) => (
                <div key={key}>
                  <span className={`text-xs ${themeClasses.text.secondary}`}>{key}:</span>
                  <span className={`ml-2 ${themeClasses.text.primary}`}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incoming Relations */}
        {node.incoming_relations.length > 0 && (
          <div>
            <h4 className={`text-sm font-semibold ${themeClasses.text.primary} mb-2`}>
              入边关系 ({node.incoming_relations.length})
            </h4>
            <div className={`space-y-2 ${themeClasses.bg.inputField} p-3 rounded-lg`}>
              {node.incoming_relations.map((rel, idx) => (
                <div key={idx} className={`text-sm ${themeClasses.text.primary}`}>
                  <span className={theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'}>
                    {rel.source_name || rel.source}
                  </span>
                  <span className={`mx-2 ${themeClasses.text.secondary}`}>--</span>
                  <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}>
                    [{rel.type}]
                  </span>
                  <span className={`mx-2 ${themeClasses.text.secondary}`}>--&gt;</span>
                  <span className={themeClasses.text.primary}>{node.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing Relations */}
        {node.outgoing_relations.length > 0 && (
          <div>
            <h4 className={`text-sm font-semibold ${themeClasses.text.primary} mb-2`}>
              出边关系 ({node.outgoing_relations.length})
            </h4>
            <div className={`space-y-2 ${themeClasses.bg.inputField} p-3 rounded-lg`}>
              {node.outgoing_relations.map((rel, idx) => (
                <div key={idx} className={`text-sm ${themeClasses.text.primary}`}>
                  <span className={themeClasses.text.primary}>{node.name}</span>
                  <span className={`mx-2 ${themeClasses.text.secondary}`}>--&gt;</span>
                  <span className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}>
                    [{rel.type}]
                  </span>
                  <span className={`mx-2 ${themeClasses.text.secondary}`}>--</span>
                  <span className={theme === 'dark' ? 'text-emerald-400' : 'text-blue-600'}>
                    {rel.target_name || rel.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

