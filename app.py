"""
Simple, elegant Japanese conversation partner demo.
@strlst
"""

import sys
import os
import re
import time
from flask import Flask, request, jsonify, session, render_template
from groq import Groq

# configuration
API_KEY = os.environ.get("GROQ_API_KEY", "")
MODEL = "qwen/qwen3-32b"
PROVIDER = "groq"
SYSTEM = (
    # "You are a thoughtful, concise conversation partner. "
    # "Respond naturally and keep replies focused."
    # 日本語にしましょう！
    "あなたは優しくて簡明的な相棒だ。"
    "自然に返答し、返信は要点を絞る。"
    "必ず日本語で考えてほしい。"
)

client = Groq(api_key=API_KEY)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET") or os.urandom(24)
context = {
    "chat_model": MODEL,
    "chat_provider": PROVIDER,
    "localization_info_please_type": "メッセージを入力してください。。。",
    "localization_info_start": "会話を始めましょう",
}


def extract_text_match(text, regex_str, err_message="could not extract text"):
    match = re.search(regex_str, text, re.DOTALL)
    if not match:
        print(err_message, file=sys.stderr)
    return match.group(1).strip() if match else None


@app.route("/")
def index():
    # rely on client-side session storage for now
    # clearly, needs to be changed for a production env
    session.setdefault("history", [])
    return render_template("chat.html", **context)


@app.route("/chat", methods=["POST"])
def chat():
    if not API_KEY:
        return jsonify({"error": "GROQ_API_KEY env var not set."}), 500

    data = request.get_json(force=True)
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Empty message."}), 400

    # reconstruct full message list: system prompt + history + new user message
    history = session.get("history", [])
    messages = (
        [{"role": "system", "content": SYSTEM}]
        + history
        + [{"role": "user", "content": message}]
    )

    start = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
        )
        model_reply = response.choices[0].message.content
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    print(f"chat completion took {time.time() - start:.2f}s")

    thinking_text = extract_text_match(
        model_reply,
        r"<think>(.*?)</think>",
        f"could not extract thinking text from reply",
    )
    reply_text = extract_text_match(
        model_reply,
        r"</think>\s*(.*)",
        f"could not extract actual response text from reply",
    )

    # persist updated history (omit the system message)
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": model_reply})
    session["history"] = history

    # return jsonify({"reply": model_reply})
    return jsonify({"thinking": thinking_text, "reply": reply_text})


if __name__ == "__main__":
    if not API_KEY:
        print(
            "GROQ_API_KEY is not set. Set it before sending messages.", file=sys.stderr
        )
    app.run(debug=True, port=5000)
