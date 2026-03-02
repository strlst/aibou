"""
Simple, elegant Japanese conversation partner demo.
@strlst
"""

import os
from flask import Flask
from flask_session import Session


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.environ.get("FLASK_SECRET") or os.urandom(24),
        SESSION_TYPE="redis",
        SESSION_PERMANENT=False,
        SESSION_USE_SIGNER=True,
        SESSION_KEY_PREFIX="chat:",
        SESSION_REDIS=__import__("redis").from_url(
            os.environ.get("SESSION_VALKEY_URL", "redis://localhost:6379/0")
        ),
    )
    Session(app)

    # register blueprints
    from routes.chat import chat_bp
    from routes.audio import audio_bp
    app.register_blueprint(chat_bp)
    app.register_blueprint(audio_bp)

    return app


app = create_app()

if __name__ == "__main__":
    import sys
    import config
    if not config.API_KEY:
        print(
            "GROQ_API_KEY is not set. Set it before sending messages.", file=sys.stderr
        )
    app.run(debug=True, port=5000)
