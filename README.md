# Aibou | 相棒

Simple proof-of-concept Flask chat application created to test the @groq [inference API free-tier](https://console.groq.com/home) using the surprisingly capable `qwen/qwen3-32b` model.

## Video Demo

![Watch the video demo here.](demo.avif)

## Limitations

Due to a lack of compute, constrained to a simple chat interface.
However this project could easily be extended to support speech-to-text (STT) and text-to-speech (TTS) in order to create a live conversation partner.
One great target is the superb, small and locally runnable [Qwen3-TTS-0.6B model](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice).

Separate sentiment analysis requests on user-generated prompts could be used and bundled within requests to keep output tone consistent.
In the future, this might even be used to instruct the TTS model on what tone to speak in.

Currently only intended as a locally run debug application.
Needs to be extended with real session (e.g. Valkey) storage before deployment to production.