# Aibou | 相棒

Simple proof-of-concept Flask chat application created to test the @groq [inference API free-tier](https://console.groq.com/home) using the surprisingly capable `qwen/qwen3-32b` model.

Besides AI-powered chat, speech capabilities are integrated, in particular using `whisper-large-v3-turbo` (also hosted @groq) for speech-to-text (STT) and the package [`edge-tts`](https://github.com/rany2/edge-tts) for text-to-speech (TTS).

Dockerized for reproducibility, ease of use and deployment.
Uses [gunicorn](https://github.com/benoitc/gunicorn) to serve the Flask application and [valkey](https://github.com/valkey-io/valkey) (an open community Redis fork) to store session histories in append-only files.

相棒は色々な使い方があります。
例えば、日本語を練習するためにとても良いパトナです。
ぜひ、試してみてください。

## Video Demo

Aibou serves on `localhost:4200` by default.

![Watch the video demo here.](demo.avif)

*NOTE: demo does not yet showcase new audio features*

## Limitations

Currently STT and TTS are offloaded to external providers, but in theory, small, locally runnable models such as [Qwen3-TTS-0.6B model](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice) could be used to replace `edge-tts`.
Perhaps there are even equivalent edge STT models that could be utilized.

TTS must currently be configured to the correct target language beforehand `config.py`.
Since the TTS voice parameter is passed every request, simple language detection could be used to select an appropriate voice output.
For consistent cross-language voice output, a voice-cloned omni-lingual TTS model becomes necessary.
STT is currently also hinted towards Japanese, but STT works fine even if other languages are spoken.

Separate sentiment analysis requests on user-generated prompts could be used and bundled within requests to keep output tone consistent.
In the future, this might even be used to instruct the TTS model on what tone to speak in.