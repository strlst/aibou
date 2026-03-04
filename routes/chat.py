"""
Chat routes: serves the main page and handles LLM completions.
@strlst
"""

import sys
import re
import json
import time
import uuid
from flask import Blueprint, request, jsonify, render_template, make_response
from typing import List

import config as cfg

chat_bp = Blueprint("chat", __name__)


def _history_key(user_id: str) -> str:
    return f"history:{user_id}"


def _load_history(user_id: str) -> list:
    raw = cfg.valkey.get(_history_key(user_id))
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


def _save_history(user_id: str, history: list):
    cfg.valkey.setex(_history_key(user_id), cfg.HISTORY_TTL, json.dumps(history))


def extract_text_match(text: str, regex_str: str, err_message: str = "could not extract text"):
    match = re.search(regex_str, text, re.DOTALL)
    if not match:
        print(err_message, file=sys.stderr)
    return match.group(1).strip() if match else None


def reconstruct_llm_messages(history: List, message: str) -> List:
    # reconstruct llm context: system + interleaved user/assistant turns
    # assistant entries are stored as {thinking, reply}, but the model
    # only sees the full reply content per message
    llm_messages = [{"role": "system", "content": cfg.SYSTEM}]
    for entry in history:
        if entry["role"] == "user":
            llm_messages.append({"role": "user", "content": entry["content"]})
        else:
            reconstructed = (
                f"<think>\n{entry['thinking']}\n</think>\n\n{entry['reply']}"
            )
            llm_messages.append({"role": "assistant", "content": reconstructed})
    llm_messages.append({"role": "user", "content": message})

    return llm_messages

@chat_bp.route("/")
def index():
    uid = request.cookies.get(cfg.USER_COOKIE) or str(uuid.uuid4())
    resp = make_response(render_template("chat.html", **cfg.context))
    if not request.cookies.get(cfg.USER_COOKIE):
        resp.set_cookie(
            cfg.USER_COOKIE,
            uid,
            max_age=cfg.COOKIE_MAX_AGE,
            httponly=True,
            samesite="Lax",
        )
    return resp


@chat_bp.route("/chat", methods=["POST"])
def chat():
    if not cfg.API_KEY:
        return jsonify({"error": "GROQ_API_KEY env var not set."}), 500

    data = request.get_json(force=True)
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Empty message."}), 400

    uid = request.cookies.get(cfg.USER_COOKIE)
    if not uid:
        return (
            jsonify({"error": "No user session cookie found. Please reload the page."}),
            400,
        )

    history = _load_history(uid)
    start = time.time()
    try:
        response = cfg.client.chat.completions.create(
            model=cfg.MODEL,
            messages=reconstruct_llm_messages(history, message),
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

    history.append({"role": "user", "content": message})
    history.append(
        {"role": "assistant", "thinking": thinking_text, "reply": reply_text}
    )
    _save_history(uid, history)

    return jsonify({"thinking": thinking_text, "reply": reply_text})


@chat_bp.route("/history", methods=["GET"])
def get_history():
    uid = request.cookies.get(cfg.USER_COOKIE)
    if not uid:
        return jsonify({"history": []})
    return jsonify({"history": _load_history(uid)})


@chat_bp.route("/history/clear", methods=["POST"])
def clear_history():
    uid = request.cookies.get(cfg.USER_COOKIE)
    if uid:
        cfg.valkey.delete(_history_key(uid))
    return jsonify({"ok": True})
