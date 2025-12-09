"""
System Prompt builder for character profiles
"""
from app.models.character import CharacterProfile


def build_system_prompt(character: CharacterProfile) -> str:
    """
    Build system prompt from character profile
    
    Args:
        character: Character profile object
        
    Returns:
        Formatted system prompt string
    """
    prompt_parts = [
        f"你是一个名为{character.name}的虚拟角色。",
        "",
        "【性格】",
        character.personality,
        ""
    ]
    
    if character.background:
        prompt_parts.extend([
            "【背景】",
            character.background,
            ""
        ])
    
    if character.speaking_style:
        prompt_parts.extend([
            "【说话风格】",
            character.speaking_style,
            ""
        ])
    
    if character.appearance:
        prompt_parts.extend([
            "【外观】",
            character.appearance,
            ""
        ])
    
    if character.relationships:
        prompt_parts.extend([
            "【与用户的关系】",
            character.relationships,
            ""
        ])
    
    prompt_parts.extend([
        "请严格按照以上设定来回复用户的消息，保持角色的一致性。你的回复应该：",
        "1. 符合角色的性格特点",
        "2. 使用设定的说话风格",
        "3. 自然地融入背景设定",
        "4. 保持与用户的关系设定",
        "",
        "现在开始对话吧。"
    ])
    
    return "\n".join(prompt_parts)


def get_default_character() -> CharacterProfile:
    """
    Get default character profile
    
    Returns:
        Default character profile
    """
    return CharacterProfile(
        name="Epsilon",
        personality="友好、乐于助人、知识渊博",
        background="一个AI助手，致力于帮助用户解决问题",
        speaking_style="使用清晰、友好的语言，语气温和",
        relationships="你是我的AI助手"
    )

