const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic');
const emptyEl = document.getElementById('empty');
const thinkLog = document.getElementById('think-log');
const thinkEmpty = document.getElementById('think-empty');
const clearBtn = document.getElementById('clear-history');

let turnCounter = 0;

// audio state

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentAudio = null;
// track the currently playing tts audio so we can stop it

async function loadHistory() {
    try {
        const res = await fetch('/history');
        const data = await res.json();
        if (!data.history || data.history.length === 0) return;

        if (emptyEl) emptyEl.remove();

        for (const msg of data.history) {
            if (msg.role === 'user') {
                appendMsg('user', msg.content, /* skipScroll */ true);
            } else {
                turnCounter++;
                const thinkEntries = startThinkBlock(turnCounter);
                if (msg.thinking) {
                    const live = addLiveThinkEntry(thinkEntries);
                    for (const ch of msg.thinking) {
                        live.append(ch);
                    }
                    live.finish();
                }
                addThinkEntry(thinkEntries, '返信が配信されました。', 'done');
                appendMsg('ai', msg.reply, /* skipScroll */ true);
            }
        }

        messagesEl.scrollTop = messagesEl.scrollHeight;
        thinkLog.scrollTop = thinkLog.scrollHeight;
    } catch (e) {
        console.warn('could not load history:', e);
    }
}

async function clearHistory() {
    if (!confirm('会話履歴を削除しますか？')) return;
    try {
        await fetch('/history/clear', { method: 'POST' });
    } catch (e) {
        console.warn('could not clear history:', e);
    }
    messagesEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.id = 'empty';
    empty.innerHTML = `
        <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
        </div>
        <p>会話を始めましょう</p>`;
    messagesEl.appendChild(empty);
    turnCounter = 0;
    thinkLog.innerHTML = `<div class="think-empty" id="think-empty">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>思考なし</p>
    </div>`;
}

// chat helpers
function appendMsg(role, text, skipScroll = false) {
    const existingEmpty = document.getElementById('empty');
    if (existingEmpty) existingEmpty.remove();

    const wrap = document.createElement('div');
    wrap.className = `msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? 'U' : 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);

    if (!skipScroll) messagesEl.scrollTop = messagesEl.scrollHeight;

    return wrap;
}

function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg ai typing';
    wrap.innerHTML = `<div class="avatar">AI</div><div class="bubble"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
}

// thinking panel helpers
function startThinkBlock(turnN) {
    const existingThinkEmpty = document.getElementById('think-empty');
    if (existingThinkEmpty) existingThinkEmpty.remove();

    const block = document.createElement('div');
    block.className = 'think-block';
    block.innerHTML = `<div class="think-turn-label">turn ${turnN}</div>
                     <div class="think-entries"></div>`;

    thinkLog.appendChild(block);
    thinkLog.scrollTop = thinkLog.scrollHeight;

    return block.querySelector('.think-entries');
}

function addThinkEntry(container, text, variant = 'info') {
    const icons = { info: '·', active: '>', done: '' };

    const entry = document.createElement('div');
    entry.className = `think-entry ${variant}`;
    entry.innerHTML = `<span class="think-icon">${icons[variant]}</span>
                     <span class="think-text">${escHtml(text)}</span>`;

    container.appendChild(entry);
    thinkLog.scrollTop = thinkLog.scrollHeight;
    return entry;
}

// live-streaming entry, returns an updater function
function addLiveThinkEntry(container) {
    const entry = document.createElement('div');
    entry.className = 'think-entry active';
    entry.innerHTML = `<span class="think-icon">▸</span>
                     <span class="think-text"><span class="think-cursor"></span></span>`;

    container.appendChild(entry);
    thinkLog.scrollTop = thinkLog.scrollHeight;

    const textSpan = entry.querySelector('.think-text');
    const cursor = entry.querySelector('.think-cursor');
    let buf = '';

    return {
        append(chunk) {
            buf += chunk;
            textSpan.textContent = buf;
            // don't forget to keep the cursor active
            textSpan.appendChild(cursor);
            thinkLog.scrollTop = thinkLog.scrollHeight;
        },
        finish() {
            cursor.remove();
            entry.className = 'think-entry done';
            entry.querySelector('.think-icon').textContent = '✓';
        }
    };
}

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// until the backend exposes real chain-of-thought tokens, we simulate a
// plausible reasoning trace that animates while the real API call is in flight
const THINK_PHRASES = [
    // japanese versions
    "考え中。。。",
    "生成中。。。",
    "方法を探し中。。。",
    "準備する中。。。",
    "理解する中。。。",
    "確認する中。。。",
];

async function runThinkingAnimation(container, doneSignal) {
    // doneSignal is a promise that resolves when the real reply arrives
    let isDone = false;
    doneSignal.then(() => { isDone = true; });

    for (const phrase of THINK_PHRASES) {
        if (isDone) break;
        const live = addLiveThinkEntry(container);

        // stream the phrase character by character
        for (const ch of phrase) {
            if (isDone) break;
            live.append(ch);
            await sleep(28 + Math.random() * 30);
        }

        live.finish();
        if (!isDone) await sleep(120 + Math.random() * 200);
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// stop any tts audio that is currently playing
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
}

// play tts audio for the given text by fetching /speak
async function speakText(text) {
    // stop whatever is playing before starting a new utterance
    stopCurrentAudio();

    try {
        const res = await fetch('/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!res.ok) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
            URL.revokeObjectURL(url);
            currentAudio = null;
        };
        audio.play();
    } catch (e) {
        console.warn('TTS playback failed:', e);
    }
}

// mic recording: toggle on/off, send webm blob to /transcribe, fill input
async function toggleMic() {
    // pressing mic while audio is playing counts as an interrupt, stop the voice
    stopCurrentAudio();

    if (isRecording) {
        // stop recording, the onstop handler will do the rest
        mediaRecorder.stop();
        return;
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
        appendMsg('ai', '! マイクへのアクセスが拒否されました。');
        return;
    }

    audioChunks = [];
    // prefer webm/opus; fall back to whatever the browser supports
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
        // release the mic
        stream.getTracks().forEach(t => t.stop());

        setMicState(false);
        micBtn.disabled = true;
        micBtn.title = '文字起こし中。。。';

        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'recording.webm');

        try {
            const res = await fetch('/transcribe', { method: 'POST', body: form });
            const data = await res.json();
            if (data.text && data.text.trim()) {
                // place transcribed text into the input field, then send
                inputEl.value = data.text.trim();
                inputEl.style.height = 'auto';
                inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
                send();
            } else {
                appendMsg('ai', '! 音声を認識できませんでした。');
            }
        } catch (e) {
            appendMsg('ai', '! 文字起こしに失敗しました。');
        }

        micBtn.disabled = false;
        micBtn.title = '録音';
    };

    mediaRecorder.start();
    setMicState(true);
}

function setMicState(recording) {
    isRecording = recording;
    micBtn.classList.toggle('recording', recording);
    micBtn.title = recording ? '録音を停止' : '録音';
}

// the flow for actual message sending, the heart of chat
async function send() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    inputEl.style.height = '';
    sendBtn.disabled = true;

    appendMsg('user', text);
    const typing = showTyping();

    turnCounter++;
    const thinkEntries = startThinkBlock(turnCounter);

    // promise that resolves when fetch completes
    let resolveReply;
    const replyReady = new Promise(r => { resolveReply = r; });

    // start animated thinking in parallel with the real fetch
    runThinkingAnimation(thinkEntries, replyReady);

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        // DEBUG
        console.log(data);

        // stop the thinking animation
        resolveReply();
        typing.remove();

        if (data.error) {
            appendMsg('ai', '! ' + data.error);
            //addThinkEntry(thinkEntries, 'Error received from API.', 'info');
            addThinkEntry(thinkEntries, 'APIからエラーが来ました.', 'info');
        } else {
            appendMsg('ai', data.reply);
            // speak the ai reply aloud via edge-tts
            if (data.reply) speakText(data.reply);
            // if the backend eventually returns thinking tokens, show them here
            if (data.thinking) {
                const live = addLiveThinkEntry(thinkEntries);
                for (const ch of data.thinking) {
                    live.append(ch);
                    await sleep(4);
                }
                live.finish();
            }
            //addThinkEntry(thinkEntries, 'Reply delivered.', 'done');
            addThinkEntry(thinkEntries, '返信が配信されました。', 'done');
        }
    } catch (e) {
        resolveReply();
        typing.remove();
        //appendMsg('ai', '! Network error, is the server running?');
        appendMsg('ai', '! ネットワークエラー、サーバーが生きていきますか？');
        //addThinkEntry(thinkEntries, 'Network error.', 'info');
        addThinkEntry(thinkEntries, 'ネットワークエラーがありました.', 'info');
    }

    sendBtn.disabled = false;
    inputEl.focus();
}

// finally add appropriate listeners to elements
sendBtn.addEventListener('click', send);
micBtn.addEventListener('click', toggleMic);
if (clearBtn) clearBtn.addEventListener('click', clearHistory);

inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
});

loadHistory();