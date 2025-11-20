import { joinRoom, selfId } from 'trystero';
import { gamesConfig } from './games-config.js';

// --- State ---
const state = {
    playerId: null,
    displayName: 'Guest',
    queues: [], // Array of { gameId, variantId, timestamp }
    peers: {} // peerId -> { queues: [] }
};

// --- DOM Elements ---
const gamesGrid = document.getElementById('games-grid');
const displayNameInput = document.getElementById('display-name');
const playerIdDisplay = document.getElementById('player-id-display');
const queueStatus = document.getElementById('queue-status');
const queueMsg = document.getElementById('queue-msg');
const cancelQueueBtn = document.getElementById('cancel-queue');

// --- Initialization ---
function init() {
    // Identity
    let storedId = localStorage.getItem('lobby_playerId');
    if (!storedId) {
        storedId = crypto.randomUUID();
        localStorage.setItem('lobby_playerId', storedId);
    }
    state.playerId = storedId;

    const storedName = localStorage.getItem('lobby_displayName');
    if (storedName) {
        state.displayName = storedName;
    }

    // UI Updates
    displayNameInput.value = state.displayName;
    playerIdDisplay.textContent = `#${state.playerId.slice(0, 4)}`;

    renderGames();
    initLobbyNetwork();
}

// --- UI Logic ---
displayNameInput.addEventListener('change', (e) => {
    const name = e.target.value.trim() || 'Guest';
    state.displayName = name;
    localStorage.setItem('lobby_displayName', name);
    broadcastStatus();
});

function renderGames() {
    gamesGrid.innerHTML = '';

    // Calculate waiting counts
    const counts = {}; // `${gameId}:${variantId}` -> count

    // Count peers
    Object.values(state.peers).forEach(peer => {
        if (peer.queues) {
            peer.queues.forEach(q => {
                const key = `${q.gameId}:${q.variantId}`;
                counts[key] = (counts[key] || 0) + 1;
            });
        }
    });

    // Count self
    state.queues.forEach(q => {
        const key = `${q.gameId}:${q.variantId}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    gamesConfig.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';

        const variantsHtml = game.variants.map(v => {
            const isQueuing = state.queues.some(q => q.gameId === game.id && q.variantId === v.id);
            const activeClass = isQueuing ? 'active' : '';
            const count = counts[`${game.id}:${v.id}`] || 0;
            const countHtml = count > 0 ? `<span class="waiting-count">${count} waiting</span>` : '';

            return `
            <button class="variant-btn ${activeClass}" onclick="window.toggleQueue('${game.id}', '${v.id}')">
                <div style="display: flex; align-items: center;">
                    <span>${v.name}</span>
                    ${countHtml}
                </div>
                <span style="font-size: 0.8rem; opacity: 0.7;">${v.players === 1 ? 'Solo' : v.players + ' Players'}</span>
            </button>
        `}).join('');

        card.innerHTML = `
            <div class="game-title">${game.name}</div>
            <div class="game-desc">${game.description}</div>
            <div class="variants">
                ${variantsHtml}
            </div>
        `;
        gamesGrid.appendChild(card);
    });
}

// Expose toggleQueue to global scope
window.toggleQueue = (gameId, variantId) => {
    const game = gamesConfig.find(g => g.id === gameId);
    const variant = game.variants.find(v => v.id === variantId);

    if (!game || !variant) return;

    // PvE / Solo check - Immediate start
    if (variant.players === 1) {
        startGame(game, variant, [state.playerId]);
        return;
    }

    // Toggle Queue
    const existingIndex = state.queues.findIndex(q => q.gameId === gameId && q.variantId === variantId);

    if (existingIndex >= 0) {
        // Leave queue
        state.queues.splice(existingIndex, 1);
    } else {
        // Join queue
        state.queues.push({ gameId, variantId, timestamp: Date.now() });
    }

    updateQueueUI();
    renderGames(); // Re-render to show active state
    broadcastStatus();
    checkForMatch();
};

cancelQueueBtn.addEventListener('click', () => {
    state.queues = [];
    updateQueueUI();
    renderGames();
    broadcastStatus();
});

function updateQueueUI() {
    if (state.queues.length > 0) {
        queueStatus.classList.add('active');
        const names = state.queues.map(q => {
            const g = gamesConfig.find(x => x.id === q.gameId);
            const v = g.variants.find(x => x.id === q.variantId);
            return `${g.name} (${v.name})`;
        }).join(', ');
        queueMsg.textContent = `Searching for: ${names}`;
    } else {
        queueStatus.classList.remove('active');
    }
}

function startGame(game, variant, playerIds, matchId = null) {
    if (!matchId) matchId = crypto.randomUUID();

    const params = new URLSearchParams();
    params.set('matchId', matchId);
    params.set('variant', variant.id);
    params.set('playerId', state.playerId);
    params.set('displayName', state.displayName);

    const url = `${game.location}?${params.toString()}`;
    window.location.href = url;
}

// --- Network Logic (Trystero) ---
let room;
let sendStatus;
let getStatus;

function initLobbyNetwork() {
    const config = { appId: 'lobby-system-global' };
    room = joinRoom(config, 'lobby-room');

    [sendStatus, getStatus] = room.makeAction('status');

    room.onPeerJoin(peerId => {
        console.log('Peer joined:', peerId);
        broadcastStatus(); // Send them our status
    });

    room.onPeerLeave(peerId => {
        console.log('Peer left:', peerId);
        delete state.peers[peerId];
        renderGames(); // Update counts
    });

    getStatus((data, peerId) => {
        state.peers[peerId] = data;
        renderGames(); // Update counts
        checkForMatch();
    });

    // Periodically broadcast to ensure eventual consistency
    setInterval(broadcastStatus, 5000);
}

function broadcastStatus() {
    if (!sendStatus) return;
    sendStatus({
        playerId: state.playerId,
        displayName: state.displayName,
        queues: state.queues
    });
}

function checkForMatch() {
    if (state.queues.length === 0) return;

    // Check each queue we are in
    for (const myReq of state.queues) {
        const game = gamesConfig.find(g => g.id === myReq.gameId);
        const variant = game.variants.find(v => v.id === myReq.variantId);
        const requiredPlayers = variant.players;

        // Find others queuing for same game/variant
        const candidates = [];
        for (const [peerId, data] of Object.entries(state.peers)) {
            if (data.queues) {
                const peerQueue = data.queues.find(q => q.gameId === myReq.gameId && q.variantId === myReq.variantId);
                if (peerQueue) {
                    candidates.push({ peerId, data, timestamp: peerQueue.timestamp });
                }
            }
        }

        // Sort by timestamp (FCFS)
        const allQueuers = [
            { peerId: 'me', data: { playerId: state.playerId }, timestamp: myReq.timestamp },
            ...candidates
        ];

        allQueuers.sort((a, b) => a.timestamp - b.timestamp);

        // Check if we have enough players
        if (allQueuers.length >= requiredPlayers) {
            const matchGroup = allQueuers.slice(0, requiredPlayers);
            const amIMatched = matchGroup.some(p => p.peerId === 'me');

            if (amIMatched) {
                // Match found!
                const sortedPlayerIds = matchGroup.map(p => p.data.playerId).sort();
                const matchId = sortedPlayerIds.join('-');

                console.log('Match found!', matchId);
                startGame(game, variant, sortedPlayerIds, matchId);
                return; // Exit after first match found
            }
        }
    }
}

init();
