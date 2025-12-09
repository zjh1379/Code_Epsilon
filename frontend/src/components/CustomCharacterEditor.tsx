/**
 * Custom character editor component
 * Allows creating and editing custom characters
 */
import React, { useState, useEffect } from 'react'
import { createCharacter, updateCharacter, deleteCharacter, getAllCharacters } from '../services/api'
import type { Character, CharacterCreateRequest, CharacterUpdateRequest } from '../types'

interface CustomCharacterEditorProps {
  character?: Character | null
  onSave?: (character: Character) => void
  onCancel?: () => void
  onDelete?: () => void
}

export default function CustomCharacterEditor({
  character,
  onSave,
  onCancel,
  onDelete,
}: CustomCharacterEditorProps) {
  const [name, setName] = useState(character?.name || '')
  const [systemPrompt, setSystemPrompt] = useState(character?.system_prompt || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (character) {
      setName(character.name)
      setSystemPrompt(character.system_prompt)
    } else {
      setName('')
      setSystemPrompt('')
    }
  }, [character])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('角色名称不能为空')
      return
    }
    if (!systemPrompt.trim()) {
      setError('System Prompt不能为空')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      let saved: Character
      if (character) {
        // Update existing character
        const updateRequest: CharacterUpdateRequest = {
          name: name.trim(),
          system_prompt: systemPrompt.trim(),
        }
        saved = await updateCharacter(character.id, updateRequest)
      } else {
        // Create new character
        const createRequest: CharacterCreateRequest = {
          name: name.trim(),
          system_prompt: systemPrompt.trim(),
        }
        saved = await createCharacter(createRequest)
      }

      if (onSave) {
        onSave(saved)
      }
    } catch (err) {
      setError((err as Error).message || '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!character || character.is_default) {
      return
    }

    if (!confirm(`确定要删除角色"${character.name}"吗？此操作不可撤销。`)) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteCharacter(character.id)
      if (onDelete) {
        onDelete()
      }
    } catch (err) {
      setError((err as Error).message || '删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色名称
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入角色名称"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={character?.is_default}
        />
        {character?.is_default && (
          <p className="text-xs text-gray-500 mt-1">默认角色不可编辑</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="输入角色的System Prompt内容..."
          rows={12}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
          disabled={character?.is_default}
        />
        <p className="text-xs text-gray-500 mt-1">
          字符数: {systemPrompt.length} / 10000
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {character && !character.is_default && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-50"
            >
              {isDeleting ? '删除中...' : '删除角色'}
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || character?.is_default}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-50"
          >
            {isSaving ? '保存中...' : character ? '更新' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

