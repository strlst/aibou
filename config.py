"""
Shared configuration and API clients.

@strlst
"""

import os
from groq import Groq

API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL = "qwen/qwen3-32b"
# whisper model used for speech-to-text, excellent Japanese support
STT_MODEL = "whisper-large-v3-turbo"
# edge-tts japanese voice, mayu is younger and cuter than nanami
TTS_VOICE = "ja-JP-NanamiNeural"
PROVIDER = "groq"
SYSTEM = (
    # "You are a thoughtful, concise conversation partner. "
    # "Respond naturally and keep replies focused."
    # 日本語にしましょう！
    "あなたは優しくて簡明的な相棒だ。"
    "自然に返答し、返信は要点を絞る。"
    "必ず日本語で考えてほしい。"
)

# template context passed to all rendered pages
context = {
    "chat_model": MODEL,
    "chat_provider": PROVIDER,
    "localization_info_please_type": "メッセージを入力してください。。。",
    "localization_info_start": "会話を始めましょう",
}

client = Groq(api_key=API_KEY)
