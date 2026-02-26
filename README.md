# Aibou | 相棒

Simple proof-of-concept Flask chat application created to test the @groq [inference API free-tier](https://console.groq.com/home) using the surprisingly capable `qwen/qwen3-32b` model.

Dockerized for reproducibility, ease-of-use and production readiness.
Uses [gunicorn](https://github.com/benoitc/gunicorn) to serve the Flask application and [valkey](https://github.com/valkey-io/valkey) (an open community Redis fork) to store session histories in append-only files.

相棒は色々な使い方があります。
例えば、日本語を練習するためにとても良いパトナです。
ぜひ、試してみてください。

## Video Demo

Aibou serves on `localhost:4200` by default.

![Watch the video demo here.](demo.avif)

## Limitations

Due to a lack of compute, constrained to a simple chat interface.
However this project could easily be extended to support speech-to-text (STT) and text-to-speech (TTS) in order to create a live conversation partner.
One great target is the superb, small and locally runnable [Qwen3-TTS-0.6B model](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice).

Separate sentiment analysis requests on user-generated prompts could be used and bundled within requests to keep output tone consistent.
In the future, this might even be used to instruct the TTS model on what tone to speak in.