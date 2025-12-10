/**
 * Graph canvas component using Neo4j Visualization Library (NVL)
 * Reference: https://neo4j.com/docs/nvl/current/react-wrappers/
 */
import { useCallback, useMemo, useRef, useEffect } from 'react'
import { InteractiveNvlWrapper } from '@neo4j-nvl/react'
import type { Node, Relationship } from '@neo4j-nvl/base'
import type { MouseEventCallbacks } from '@neo4j-nvl/react'
import type { GraphData, GraphNode } from '../../types'

interface GraphCanvasProps {
  data: GraphData
  onNodeClick?: (node: GraphNode) => void
  onNodeHover?: (node: GraphNode | null) => void
  highlightedNodeId?: string | null
}

export default function GraphCanvas({
  data,
  onNodeClick,
  onNodeHover,
}: GraphCanvasProps) {
  const nvlRef = useRef<any>(null)

  // Trigger layout refresh when data changes
  useEffect(() => {
    if (nvlRef.current && data.nodes.length > 0) {
      // Force a re-layout or fit to ensure nodes are separated
      // Note: specific method depends on NVL internal API, fit() usually triggers a view update
      // and force layout should be continuous by default or restart on data change.
      // If force layout is sluggish, we can try to "kick" it if possible, 
      // but fit() ensures we see everything.
      const timer = setTimeout(() => {
        nvlRef.current?.fit(
           data.nodes.map(n => n.id),
           { padding: 50 }
        )
      }, 100) // Small delay to let renderer catch up
      return () => clearTimeout(timer)
    }
  }, [data])

  // Node color mapping based on type
  const getNodeColor = useCallback((nodeType: string) => {
    const colorMap: Record<string, string> = {
      User: '#FF6B6B',
      Topic: '#4ECDC4',
      Project: '#45B7D1',
      Skill: '#96CEB4',
      Resource: '#FFEAA7',
      Conversation: '#DDA0DD',
      Entity: '#95A5A6',
    }
    return colorMap[nodeType] || '#95A5A6'
  }, [])

  // Convert GraphData to NVL format
  const nvlNodes = useMemo<Node[]>(() => {
    return data.nodes.map((node) => {
      // Calculate node size based on connections
      const links = data.links.filter(
        (l) => l.source === node.id || l.target === node.id
      )
      const size = Math.sqrt(links.length) * 5 + 20 // Increase base size for better visibility

      return {
        id: node.id,
        labels: [node.type],
        properties: {
          ...node.properties,
          name: node.label,
          type: node.type,
        },
        size: size,
        color: getNodeColor(node.type),
        caption: node.label, // Explicitly set caption property
      } as Node
    })
  }, [data.nodes, data.links, getNodeColor])

  const nvlRels = useMemo<Relationship[]>(() => {
    return data.links.map((link, index) => ({
      id: `${link.source}-${link.target}-${index}`,
      from: link.source,
      to: link.target,
      type: link.type,
      properties: link.properties || {},
      caption: link.type, // Show relationship type
    } as Relationship))
  }, [data.links])

  // Mouse event callbacks for InteractiveNvlWrapper
  const mouseEventCallbacks: MouseEventCallbacks = useMemo(() => ({
    onNodeClick: (node: Node) => {
      const graphNode: GraphNode = {
        id: node.id,
        label: (node.properties?.name as string) || node.id,
        type: node.labels?.[0] || 'Entity',
        properties: node.properties || {},
      }
      onNodeClick?.(graphNode)
    },
    onHover: (element: Node | Relationship) => {
      if ('labels' in element) {
        // It's a Node
        const graphNode: GraphNode = {
          id: element.id,
          label: (element.properties?.name as string) || element.id,
          type: element.labels?.[0] || 'Entity',
          properties: element.properties || {},
        }
        onNodeHover?.(graphNode)
      } else {
        // It's a Relationship
        onNodeHover?.(null)
      }
    },
    onCanvasClick: () => {
      onNodeHover?.(null)
    },
    onZoom: true,
    onPan: true,
    onDrag: true,
  }), [onNodeClick, onNodeHover])

  // NVL options
  const nvlOptions = useMemo(() => ({
    initialZoom: 1,
    minZoom: 0.1,
    maxZoom: 5,
    layout: 'force',
    renderer: 'canvas',
    physics: {
      stabilization: {
        enabled: true,
        iterations: 1000, // Increase initial iterations for better layout
        fit: true
      },
      // Increase repulsion to separate nodes
      barnesHut: {
        gravitationalConstant: -3000,
        centralGravity: 0.3,
        springLength: 150,
        avoidOverlap: 1
      }
    },
  }), [])

  // Control handlers
  const handleZoomIn = () => {
    if (nvlRef.current) {
      nvlRef.current.setZoom(nvlRef.current.getScale() * 1.2)
    }
  }

  const handleZoomOut = () => {
    if (nvlRef.current) {
      nvlRef.current.setZoom(nvlRef.current.getScale() / 1.2)
    }
  }

  const handleFit = () => {
    if (nvlRef.current) {
      nvlRef.current.fit()
    }
  }

  return (
    <div className="w-full h-full relative group">
      <InteractiveNvlWrapper
        ref={nvlRef}
        nodes={nvlNodes}
        rels={nvlRels}
        mouseEventCallbacks={mouseEventCallbacks}
        nvlOptions={nvlOptions}
      />
      
      {/* Zoom Controls overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white/90 p-2 rounded-lg shadow-lg border border-gray-200 backdrop-blur-sm transition-opacity opacity-50 group-hover:opacity-100">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <div className="h-px bg-gray-200 my-1" />
        <button
          onClick={handleFit}
          className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
          title="Fit to Screen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
