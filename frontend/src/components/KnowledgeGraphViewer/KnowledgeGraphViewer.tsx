/**
 * Main knowledge graph viewer component
 */
import React, { useState, useEffect, useCallback } from 'react'
import GraphCanvas from './GraphCanvas'
import GraphControls from './GraphControls'
import NodeDetailPanel from './NodeDetailPanel'
import GraphLegend from './GraphLegend'
import { fetchGraphData, fetchGraphStats, fetchNodeDetails } from '../../services/graph'
import type { GraphData, GraphNode, NodeDetails } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'
import { getThemeClasses } from '../../utils/theme'

export default function KnowledgeGraphViewer() {
  const { theme } = useTheme()
  const themeClasses = getThemeClasses(theme)
  const [baseGraphData, setBaseGraphData] = useState<GraphData>({ nodes: [], links: [] }) // Store raw data
  const [filteredGraphData, setFilteredGraphData] = useState<GraphData>({ nodes: [], links: [] }) // Store filtered data for display
  const [selectedNode, setSelectedNode] = useState<NodeDetails | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  
  // Initialize with empty arrays (meaning select all)
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([])
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([])

  // Load initial graph data (all data, or limited by backend)
  const loadGraphData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const userId = 'zhu_jinghua_001'
      // Fetch data WITHOUT filters to get everything
      const data = await fetchGraphData({
        user_id: userId,
        depth: 2,
        limit: 100, // Reasonable limit for client-side filtering
      })
      setBaseGraphData(data)
      
      // Initial filtered data is same as base data
      setFilteredGraphData(data)
      
      // Initialize selected types based on data content (select all by default)
      const entityTypes = Array.from(new Set(data.nodes.map(n => n.type)))
      const relationTypes = Array.from(new Set(data.links.map(l => l.type)))
      setSelectedEntityTypes(entityTypes)
      setSelectedRelationTypes(relationTypes)
      
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to load graph data'
      if (errorMessage.includes('503') || errorMessage.includes('Memory service not initialized')) {
        setError('记忆系统未初始化。请在backend/.env文件中配置GRAPH_MEMORY_ENABLED=true和Neo4j连接信息。')
      } else {
        setError(errorMessage)
      }
      console.error('Failed to load graph data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const statsData = await fetchGraphStats('zhu_jinghua_001')
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }, [])

  useEffect(() => {
    loadGraphData()
    loadStats()
  }, [loadGraphData, loadStats])

  // Apply filters client-side whenever selection or base data changes
  useEffect(() => {
    if (!baseGraphData.nodes.length) return

    const newNodes = baseGraphData.nodes.filter(node => 
      selectedEntityTypes.includes(node.type)
    )
    
    // Filter links: both source and target must be visible, AND relation type must be selected
    const nodeIds = new Set(newNodes.map(n => n.id))
    const newLinks = baseGraphData.links.filter(link => 
      nodeIds.has(link.source) && 
      nodeIds.has(link.target) &&
      selectedRelationTypes.includes(link.type)
    )

    setFilteredGraphData({
      nodes: newNodes,
      links: newLinks
    })
  }, [baseGraphData, selectedEntityTypes, selectedRelationTypes])

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    try {
      const details = await fetchNodeDetails(node.id)
      setSelectedNode(details)
    } catch (err) {
      console.error('Failed to load node details:', err)
    }
  }, [])

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHighlightedNodeId(node?.id || null)
  }, [])

  const handleSearch = useCallback((query: string) => {
    const matchingNode = baseGraphData.nodes.find(
      (node) =>
        node.label.toLowerCase().includes(query.toLowerCase()) ||
        node.type.toLowerCase().includes(query.toLowerCase())
    )
    if (matchingNode) {
      setHighlightedNodeId(matchingNode.id)
      setSelectedNode(null)
      // If node is hidden, maybe show it? For now just highlight.
    }
  }, [baseGraphData.nodes])

  // Handlers for toggling types (updates state, no API call)
  const handleToggleEntityType = useCallback((type: string) => {
    setSelectedEntityTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }, [])

  const handleToggleRelationType = useCallback((type: string) => {
    setSelectedRelationTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }, [])

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${themeClasses.text.secondary}`}>
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-96 p-8 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-center mb-2">{error}</p>
        <p className={`text-sm text-center ${themeClasses.text.secondary} mt-4`}>
          请检查后端服务日志以获取更多信息，或参考backend/ENV_CONFIG.md配置说明。
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <GraphControls
        onSearch={handleSearch}
        onToggleEntityType={handleToggleEntityType}
        onToggleRelationType={handleToggleRelationType}
        entityTypes={stats?.node_types ? Object.keys(stats.node_types) : []}
        relationTypes={stats?.relation_types ? Object.keys(stats.relation_types) : []}
        selectedEntityTypes={selectedEntityTypes}
        selectedRelationTypes={selectedRelationTypes}
        stats={stats}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph canvas */}
        <div className="flex-1 relative">
          <GraphCanvas
            data={filteredGraphData}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            highlightedNodeId={highlightedNodeId}
          />
          {/* Legend */}
          <div className="absolute top-4 right-4 z-10">
            <GraphLegend />
          </div>
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div className="w-80">
            <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

