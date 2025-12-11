import axios from 'axios'
import type { Conversation, ConversationDetail, HistoryMessage } from '../types'

const API_BASE_URL = 'http://localhost:8000/api'

export const fetchConversations = async (userId: string = 'default_user', limit: number = 20): Promise<Conversation[]> => {
  const response = await axios.get(`${API_BASE_URL}/history/conversations`, {
    params: { user_id: userId, limit }
  })
  return response.data
}

export const fetchConversationDetail = async (conversationId: string): Promise<ConversationDetail> => {
  const response = await axios.get(`${API_BASE_URL}/history/conversations/${conversationId}`)
  return response.data
}

export const fetchMessages = async (conversationId: string): Promise<HistoryMessage[]> => {
  const response = await axios.get(`${API_BASE_URL}/history/conversations/${conversationId}/messages`)
  return response.data
}

export const deleteConversation = async (conversationId: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/history/conversations/${conversationId}`)
}

