import { joinRoom } from 'trystero';

const params = new URLSearchParams(window.location.search);
const matchId = params.get('matchId');
const variantId = params.get('variant');
const playerId = params.get('playerId');
const displayName = params.get('displayName');

// UI Elements
document.getElementById('match-id').textContent = matchId;
document.getElementById('variant-id').textContent = variantId;
document.getElementById('my-id').textContent = playerId;
document.getElementById('my-name').textContent = displayName;

const statusEl = document.getElementById('connection-status');
const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');

if (!matchId) {
    statusEl.textContent = 'Error: No Match ID provided.';
    statusEl.style.color = 'red';
    throw new Error('No match ID');
}

// Connect to Trystero
const config = { appId: 'lobby-system-game-' + variantId }; // Unique App ID per game/variant? Or just use matchId as room?
// Using matchId as room is safer to avoid collisions, but we need a consistent App ID.
// Let's use a generic App ID for the "Test Game" and use matchId as the room.
const room = joinRoom({ appId: 'lobby-test-game' }, matchId);

const [sendMsg, getMsg] = room.makeAction('chat');

// Events
room.onPeerJoin(peerId => {
    log(`Peer joined: ${peerId}`);
    updateStatus();
});

room.onPeerLeave(peerId => {
    log(`Peer left: ${peerId}`);
    updateStatus();
});

getMsg((data, peerId) => {
    log(`${data.name}: ${data.text}`);
});

function updateStatus() {
    const count = Object.keys(room.getPeers()).length + 1; // +1 for self
    statusEl.textContent = `Connected to ${count - 1} peers.`;
}

function log(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Sending
function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const data = { name: displayName, text };
    sendMsg(data);
    log(`Me: ${text}`);
    msgInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

log('Joined room. Waiting for peers...');
