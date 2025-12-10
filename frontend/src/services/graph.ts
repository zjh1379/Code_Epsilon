/**
 * Graph API service for knowledge graph visualization
 */
import type { GraphData, GraphStats, NodeDetails } from '../types'

const API_BASE_URL = '/api'

/**
 * Query graph data for visualization
 */
export async function fetchGraphData(params?: {
  user_id?: string
  entity_types?: string[]
  relation_types?: string[]
  depth?: number
  limit?: number
}): Promise<GraphData> {
  const queryParams = new URLSearchParams()
  
  if (params?.user_id) {
    queryParams.append('user_id', params.user_id)
  } else {
    // Default to demo user if not specified
    queryParams.append('user_id', 'zhu_jinghua_001')
  }
  
  if (params?.entity_types && params.entity_types.length > 0) {
    queryParams.append('entity_types', params.entity_types.join(','))
  }
  
  if (params?.relation_types && params.relation_types.length > 0) {
    queryParams.append('relation_types', params.relation_types.join(','))
  }
  
  if (params?.depth) {
    queryParams.append('depth', params.depth.toString())
  }
  
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString())
  }
  
  const response = await fetch(`${API_BASE_URL}/graph/query?${queryParams.toString()}`)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Graph query failed: ${response.status}, ${errorText}`)
  }
  
  return response.json()
}

/**
 * Get graph statistics
 */
export async function fetchGraphStats(user_id: string = 'zhu_jinghua_001'): Promise<GraphStats> {
  const response = await fetch(`${API_BASE_URL}/graph/stats?user_id=${user_id}`)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Graph stats failed: ${response.status}, ${errorText}`)
  }
  
  return response.json()
}

/**
 * Get node details
 */
export async function fetchNodeDetails(node_id: string): Promise<NodeDetails> {
  const response = await fetch(`${API_BASE_URL}/graph/node/${node_id}`)
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Node details failed: ${response.status}, ${errorText}`)
  }
  
  return response.json()
}

