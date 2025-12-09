/**
 * Character profile configuration panel component
 */
import React, { useState, useEffect } from 'react'
import { getCharacter, updateCharacter } from '../services/api'
import type { CharacterProfile } from '../types/character'

interface CharacterProfilePanelProps {
  onClose?: () => void
}

export default function CharacterProfilePanel({ onClose }: CharacterProfilePanelProps) {
  const [name, setName] = useState('')
  const [personality, setPersonality] = useState('')
  const [background, setBackground] = useState('')
  const [speakingStyle, setSpeakingStyle] = useState('')
  const [appearance, setAppearance] = useState('')
  const [relationships, setRelationships] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load character profile from backend
    getCharacter()
      .then((character) => {
        setName(character.name)
        setPersonality(character.personality)
        setBackground(character.background || '')
        setSpeakingStyle(character.speaking_style || '')
        setAppearance(character.appearance || '')
        setRelationships(character.relationships || '')
      })
      .catch((err) => {
        console.error('Failed to load character:', err)
        setError('加载角色设定失败')
      })
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('角色名称不能为空')
      return
    }

    if (!personality.trim()) {
      setError('性格描述不能为空')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await updateCharacter({
        name: name.trim(),
        personality: personality.trim(),
        background: background.trim() || undefined,
        speaking_style: speakingStyle.trim() || undefined,
        appearance: appearance.trim() || undefined,
        relationships: relationships.trim() || undefined,
      })

      if (onClose) {
        onClose()
      }
    } catch (err) {
      setError((err as Error).message || '保存角色设定失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: Epsilon"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          性格描述 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          placeholder="例如: 温柔、善解人意、喜欢倾听"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          描述角色的性格特点，这将影响AI的回复风格
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          背景故事
        </label>
        <textarea
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          placeholder="例如: 来自异世界的魔法师，拥有治愈能力"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          角色的背景设定，帮助AI理解角色的世界观
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          说话风格
        </label>
        <textarea
          value={speakingStyle}
          onChange={(e) => setSpeakingStyle(e.target.value)}
          placeholder="例如: 使用敬语，语气温和，偶尔会使用魔法术语"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          角色的说话方式和语言习惯
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          外观描述
        </label>
        <textarea
          value={appearance}
          onChange={(e) => setAppearance(e.target.value)}
          placeholder="例如: 身穿白色魔法袍，拥有一头银色的长发"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          与用户的关系
        </label>
        <textarea
          value={relationships}
          onChange={(e) => setRelationships(e.target.value)}
          placeholder="例如: 你是我的魔法导师"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          定义角色与用户的关系，影响对话的亲密程度
        </p>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '保存中...' : '保存'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            取消
          </button>
        )}
      </div>
    </div>
  )
}

