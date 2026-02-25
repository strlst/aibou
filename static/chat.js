const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const emptyEl = document.getElementById('empty');
const thinkLog = document.getElementById('think-log');
const thinkEmpty = document.getElementById('think-empty');

let turnCounter = 0;

// chat helpers
function appendMsg(role, text) {
    if (emptyEl) emptyEl.remove();

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
    messagesEl.scrollTop = messagesEl.scrollHeight;

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
    if (thinkEmpty) thinkEmpty.remove();

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
            addThinkEntry(thinkEntries, '返信が配信されました.', 'done');
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
inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
});