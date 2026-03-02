"""
Audio routes: speech-to-text via groq whisper and text-to-speech via edge-tts.
@strlst
"""

import os
import sys
import time
import asyncio
import tempfile
from flask import Blueprint, request, jsonify, Response

import edge_tts

import config as cfg

audio_bp = Blueprint("audio", __name__)


@audio_bp.route("/transcribe", methods=["POST"])
def transcribe():
    # speech-to-text using groq whisper, supports japanese well
    if not cfg.API_KEY:
        return jsonify({"error": "GROQ_API_KEY env var not set."}), 500

    audio_file = request.files.get("audio")
    if not audio_file:
        return jsonify({"error": "No audio file provided."}), 400

    # write to a temp file so groq client can read it with a proper filename
    suffix = ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        start = time.time()
        with open(tmp_path, "rb") as f:
            transcription = cfg.client.audio.transcriptions.create(
                model=cfg.STT_MODEL,
                file=(f"audio{suffix}", f, "audio/webm"),
                # hint the model toward japanese, it still detects other langs fine
                language="ja",
            )
        print(f"transcription took {time.time() - start:.2f}s")
        return jsonify({"text": transcription.text})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        os.unlink(tmp_path)


@audio_bp.route("/speak", methods=["POST"])
def speak():
    # text-to-speech using edge-tts (microsoft neural voices, no api key needed)
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided."}), 400

    async def synthesize():
        start = time.time()
        communicate = edge_tts.Communicate(text, cfg.TTS_VOICE)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        print(f"speech generation took {time.time() - start:.2f}s")
        return b"".join(audio_chunks)

    try:
        audio_bytes = asyncio.run(synthesize())
        return Response(audio_bytes, mimetype="audio/mpeg")
    except Exception as exc:
        print(f"error speech generation {str(exc)}")
        return jsonify({"error": str(exc)}), 500
