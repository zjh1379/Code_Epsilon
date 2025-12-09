/**
 * Character switcher component with inline editing
 * Displays current character and allows switching and editing
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getCurrentCharacter, getAllCharacters, activateCharacter, updateCharacter, createCharacter, deleteCharacter } from '../services/api'
import type { Character } from '../types'

interface CharacterSwitcherProps {
  onCharacterChange?: (character: Character) => void
}

// Debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

export default function CharacterSwitcher({ onCharacterChange }: CharacterSwitcherProps) {
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddCharacter, setShowAddCharacter] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingPrompt, setEditingPrompt] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    loadCharacters()
  }, [])

  useEffect(() => {
    // Load editing values when character changes
    if (showAddCharacter) {
      // Adding new character - clear fields
      setEditingName('')
      setEditingPrompt('')
    } else if (currentCharacter && !currentCharacter.is_default) {
      // Editing existing custom character
      setEditingName(currentCharacter.name)
      setEditingPrompt(currentCharacter.system_prompt)
    } else {
      // Default character or no character - clear fields
      setEditingName('')
      setEditingPrompt('')
    }
  }, [currentCharacter, showAddCharacter])

  const loadCharacters = async () => {
    try {
      setIsLoading(true)
      const [current, all] = await Promise.all([
        getCurrentCharacter(),
        getAllCharacters()
      ])
      setCurrentCharacter(current)
      setCharacters(all)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchCharacter = async (characterId: string) => {
    try {
      if (characterId === 'new') {
        setShowAddCharacter(true)
        setEditingName('')
        setEditingPrompt('')
        return
      }
      
      const activated = await activateCharacter(characterId)
      setCurrentCharacter(activated)
      setShowAddCharacter(false)
      if (onCharacterChange) {
        onCharacterChange(activated)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Auto-save function with debounce
  const saveCharacter = useCallback(async (id: string, name: string, prompt: string) => {
    if (!name.trim() || !prompt.trim()) {
      return
    }

    try {
      setSaveStatus('saving')
      const updated = await updateCharacter(id, {
        name: name.trim(),
        system_prompt: prompt.trim()
      })
      setSaveStatus('saved')
      // Update current character if it's the one being edited
      if (currentCharacter && currentCharacter.id === id) {
        setCurrentCharacter(updated)
      }
      // Reload characters list (but not current character to avoid extra request)
      const all = await getAllCharacters()
      setCharacters(all)
      // Clear saved status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      setSaveStatus('error')
      setError((err as Error).message)
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [currentCharacter])

  // Debounced save function
  const debouncedSave = useMemo(
    () => debounce((id: string, name: string, prompt: string) => {
      saveCharacter(id, name, prompt)
    }, 1000),
    [saveCharacter]
  )

  const handleNameChange = (value: string) => {
    setEditingName(value)
    if (currentCharacter && !currentCharacter.is_default && !showAddCharacter) {
      debouncedSave(currentCharacter.id, value, editingPrompt)
    }
  }

  const handlePromptChange = (value: string) => {
    setEditingPrompt(value)
    if (currentCharacter && !currentCharacter.is_default && !showAddCharacter) {
      debouncedSave(currentCharacter.id, editingName, value)
    }
  }

  const handleCreateCharacter = async () => {
    if (!editingName.trim() || !editingPrompt.trim()) {
      setError('角色名称和System Prompt不能为空')
      return
    }

    try {
      setIsLoading(true)
      const newCharacter = await createCharacter({
        name: editingName.trim(),
        system_prompt: editingPrompt.trim()
      })
      const activated = await activateCharacter(newCharacter.id)
      // Update state without reloading everything
      setCurrentCharacter(activated)
      const all = await getAllCharacters()
      setCharacters(all)
      setShowAddCharacter(false)
      setEditingName('')
      setEditingPrompt('')
      if (onCharacterChange) {
        onCharacterChange(activated)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCharacter = async () => {
    if (!currentCharacter || currentCharacter.is_default) {
      return
    }

    if (!confirm(`确定要删除角色"${currentCharacter.name}"吗？此操作不可撤销。`)) {
      return
    }

    try {
      setIsLoading(true)
      await deleteCharacter(currentCharacter.id)
      // Update characters list
      const all = await getAllCharacters()
      setCharacters(all)
      // Switch to epsilon after deletion
      const epsilon = all.find(c => c.is_default)
      if (epsilon) {
        const activated = await activateCharacter(epsilon.id)
        setCurrentCharacter(activated)
        setShowAddCharacter(false)
        if (onCharacterChange) {
          onCharacterChange(activated)
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !currentCharacter) {
    return (
      <div className="text-sm text-gray-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Character Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          当前助手
        </label>
        <select
          value={showAddCharacter ? 'new' : (currentCharacter?.id || '')}
          onChange={(e) => handleSwitchCharacter(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {characters.map((char) => (
            <option key={char.id} value={char.id}>
              {char.name} {char.is_default ? '(默认)' : ''}
            </option>
          ))}
          <option value="new">+ 添加新角色</option>
        </select>
      </div>

      {/* Save Status Indicator */}
      {saveStatus === 'saving' && (
        <div className="text-xs text-blue-600">
          正在保存...
        </div>
      )}
      {saveStatus === 'saved' && (
        <div className="text-xs text-green-600">
          已自动保存
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="text-xs text-red-600">
          保存失败，请重试
        </div>
      )}

      {/* Character Editor (for custom characters or new character) */}
      {(showAddCharacter || (currentCharacter && !currentCharacter.is_default)) && (
        <div className="border-t pt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              角色名称
            </label>
            <input
              type="text"
              value={editingName}
              onChange={(e) => {
                const value = e.target.value
                if (showAddCharacter) {
                  setEditingName(value)
                } else {
                  handleNameChange(value)
                }
              }}
              placeholder="输入角色名称"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!showAddCharacter && currentCharacter?.is_default}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              System Prompt
            </label>
            <textarea
              value={editingPrompt}
              onChange={(e) => {
                const value = e.target.value
                if (showAddCharacter) {
                  setEditingPrompt(value)
                } else {
                  handlePromptChange(value)
                }
              }}
              placeholder="输入角色的System Prompt内容..."
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
              disabled={!showAddCharacter && currentCharacter?.is_default}
            />
            <p className="text-xs text-gray-500 mt-1">
              字符数: {editingPrompt.length} / 10000
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            {showAddCharacter ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCreateCharacter}
                  disabled={isLoading || !editingName.trim() || !editingPrompt.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-50"
                >
                  {isLoading ? '创建中...' : '创建角色'}
                </button>
                <button
                  onClick={() => {
                    setShowAddCharacter(false)
                    setEditingName('')
                    setEditingPrompt('')
                    setError(null)
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                {currentCharacter && !currentCharacter.is_default && (
                  <button
                    onClick={handleDeleteCharacter}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-50"
                  >
                    {isLoading ? '删除中...' : '删除角色'}
                  </button>
                )}
                {!currentCharacter?.is_default && (
                  <div className="text-xs text-gray-500">
                    修改后会自动保存
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Epsilon Info */}
      {currentCharacter && currentCharacter.is_default && (
        <div className="border-t pt-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">默认角色 Epsilon (ε)</p>
            <p className="text-xs text-gray-500">
              这是系统默认角色，不可编辑或删除。你可以创建自定义角色来使用不同的System Prompt。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
