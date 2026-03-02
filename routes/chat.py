"""
chat routes: serves the main page and handles LLM completions.
@strlst
"""

import sys
import re
import time
from flask import Blueprint, request, jsonify, session, render_template

import config as cfg

chat_bp = Blueprint("chat", __name__)


def extract_text_match(text, regex_str, err_message="could not extract text"):
    match = re.search(regex_str, text, re.DOTALL)
    if not match:
        print(err_message, file=sys.stderr)
    return match.group(1).strip() if match else None


@chat_bp.route("/")
def index():
    # rely on client-side session storage for now
    # clearly, needs to be changed for a production env
    session.setdefault("history", [])
    return render_template("chat.html", **cfg.context)


@chat_bp.route("/chat", methods=["POST"])
def chat():
    if not cfg.API_KEY:
        return jsonify({"error": "GROQ_API_KEY env var not set."}), 500

    data = request.get_json(force=True)
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Empty message."}), 400

    # reconstruct full message list: system prompt + history + new user message
    history = session.get("history", [])
    messages = (
        [{"role": "system", "content": cfg.SYSTEM}]
        + history
        + [{"role": "user", "content": message}]
    )

    start = time.time()
    try:
        response = cfg.client.chat.completions.create(
            model=cfg.MODEL,
            messages=messages,
        )
        model_reply = response.choices[0].message.content
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    print(f"chat completion took {time.time() - start:.2f}s")

    thinking_text = extract_text_match(
        model_reply,
        r"<think>(.*?)</think>",
        "could not extract thinking text from reply",
    )
    reply_text = extract_text_match(
        model_reply,
        r"</think>\s*(.*)",
        "could not extract actual response text from reply",
    )

    # persist updated history (omit the system message)
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": model_reply})
    session["history"] = history

    return jsonify({"thinking": thinking_text, "reply": reply_text})
