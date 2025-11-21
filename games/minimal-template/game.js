import { joinRoom } from 'trystero';

const params = new URLSearchParams(window.location.search);
const matchId = params.get('matchId');
const variantId = params.get('variant') || '2p';
const rawPlayerId = params.get('playerId');
const displayName = params.get('displayName') || 'Mystery Player';
const playerId =
    rawPlayerId || `local-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2)}`;

const variantLookup = {
    pve: {
        label: 'PvE Practice',
        note: 'You vs the helper bot. Great for UI smoke tests.',
    },
    '2p': {
        label: '2P PvP',
        note: 'Classic head-to-head. Perfect for quick networking demos.',
    },
    '3p': {
        label: '3P PvP',
        note: 'Free-for-all with up to three players.',
    },
    default: {
        label: 'Template',
        note: 'Use this shell to bootstrap a new multiplayer game.',
    },
};

const variantMeta = variantLookup[variantId] || variantLookup.default;

const matchEl = document.getElementById('match-id');
const variantEl = document.getElementById('variant-id');
const playerNameEl = document.getElementById('player-name');
const variantPillEl = document.getElementById('variant-pill');
const variantNoteEl = document.getElementById('variant-note');
const scoreboardEl = document.getElementById('score-list');
const logEl = document.getElementById('event-log');
const statusEl = document.getElementById('match-status');
const turnIndicatorEl = document.getElementById('turn-indicator');

const winBtn = document.getElementById('win-btn');
const surrenderBtn = document.getElementById('surrender-btn');
const rematchBtn = document.getElementById('rematch-btn');
const endTurnBtn = document.getElementById('end-turn-btn');
const clearLogBtn = document.getElementById('clear-log-btn');
const backBtn = document.getElementById('back-btn');

matchEl.textContent = matchId || 'N/A';
variantEl.textContent = variantId;
playerNameEl.textContent = displayName;
variantPillEl.textContent = variantMeta.label;
variantNoteEl.textContent = variantMeta.note;

backBtn.addEventListener('click', () => {
    window.location.href = '../../index.html';
});

if (!matchId) {
    statusEl.textContent = 'Missing match ID. Please start from the lobby.';
    throw new Error('No match ID detected');
}

const STORAGE_KEY = (id) => `minimal-template:record:${id}`;

const players = new Map();
const peerToPlayer = new Map();
const readinessLog = new Set();

let localRecord = loadLocalRecord();
let currentTurnId = null;
let turnOrder = [];
let turnSyncScheduled = false;
let aiTurnTimeout = null;

function createEmptyRecord() {
    return {
        totalWins: 0,
        totalLosses: 0,
        opponents: {},
    };
}

function loadLocalRecord() {
    try {
        const raw = playerId ? localStorage.getItem(STORAGE_KEY(playerId)) : null;
        if (!raw) return createEmptyRecord();
        const parsed = JSON.parse(raw);
        return {
            totalWins: parsed.totalWins || 0,
            totalLosses: parsed.totalLosses || 0,
            opponents: parsed.opponents || {},
        };
    } catch (error) {
        console.warn('Failed to load record, resetting.', error);
        return createEmptyRecord();
    }
}

function saveLocalRecord() {
    if (!playerId) return;
    try {
        localStorage.setItem(STORAGE_KEY(playerId), JSON.stringify(localRecord));
    } catch (error) {
        console.warn('Failed to persist record.', error);
    }
}

function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
}

function ensureOpponentRecord(map, opponentId) {
    if (!map[opponentId]) {
        map[opponentId] = { wins: 0, losses: 0 };
    }
    return map[opponentId];
}

function upsertPlayer(id, overrides = {}) {
    const existing = players.get(id);
    const nextRecord = overrides.record ?? existing?.record ?? createEmptyRecord();
    const next = {
        id,
        name: overrides.name ?? existing?.name ?? `Player ${players.size + 1}`,
        role: overrides.role ?? existing?.role ?? 'Participant',
        isAi: overrides.isAi ?? existing?.isAi ?? false,
        record: nextRecord,
    };
    players.set(id, next);
    renderScoreboard();
    scheduleTurnSync();
}

function removePlayer(id) {
    if (!id || !players.has(id) || id === playerId) return;
    players.delete(id);
    readinessLog.delete(id);
    renderScoreboard();
    scheduleTurnSync();
}

function syncSelfPlayerRecord() {
    const me = players.get(playerId);
    if (!me) return;
    players.set(playerId, {
        ...me,
        record: cloneRecord(localRecord),
    });
    renderScoreboard();
}

function buildAiRecord() {
    const entry = localRecord.opponents['ai-opponent'] || { wins: 0, losses: 0 };
    return {
        totalWins: entry.losses,
        totalLosses: entry.wins,
        opponents: {
            [playerId]: {
                wins: entry.losses,
                losses: entry.wins,
            },
        },
    };
}

function renderScoreboard() {
    const items = Array.from(players.values()).sort((a, b) => {
        const rank = (player) => {
            if (player.id === playerId) return 0;
            if (player.isAi) return 2;
            return 1;
        };
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
    });

    scoreboardEl.innerHTML = '';

    if (!items.length) {
        scoreboardEl.innerHTML = '<p class="muted">No players yet.</p>';
        return;
    }

    items.forEach((player) => {
        const row = document.createElement('div');
        row.className = `score-row${player.id === playerId ? ' self' : ''}`;
        const summary = formatRecordSummary(player);
        const detail = formatRecordDetail(player);
        row.innerHTML = `
            <div class="player-meta">
                <div class="player-name">${player.name}${player.id === playerId ? ' (You)' : ''}</div>
                <div class="player-tag">${detail}</div>
            </div>
            <div class="score-controls">
                <span class="score-value">${summary}</span>
            </div>
        `;
        scoreboardEl.appendChild(row);
    });
}

function formatRecordSummary(player) {
    const wins = player.record?.totalWins ?? 0;
    const losses = player.record?.totalLosses ?? 0;
    return `${wins}W / ${losses}L`;
}

function formatRecordDetail(player) {
    if (player.isAi) {
        const vs = player.record?.opponents?.[playerId];
        if (vs) {
            return `Local vs You: ${vs.wins}W / ${vs.losses}L`;
        }
        return 'Practice bot (local only)';
    }

    if (player.id === playerId) {
        const summaries = Array.from(players.values())
            .filter((p) => p.id !== playerId)
            .map((opponent) => {
                const entry = localRecord.opponents[opponent.id];
                if (!entry) return `${opponent.name}: 0W / 0L`;
                return `${opponent.name}: ${entry.wins}W / ${entry.losses}L`;
            });
        return summaries.length ? summaries.join(' • ') : 'No opponents in this lobby yet.';
    }

    const vsYou = player.record?.opponents?.[playerId];
    if (vsYou) {
        return `Vs You: ${vsYou.wins}W / ${vsYou.losses}L`;
    }
    return 'No recorded games vs you.';
}

function log(message) {
    const entry = document.createElement('div');
    entry.className = 'log-line';
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(message) {
    statusEl.textContent = message;
}

function updateConnectionStatus() {
    const count = Object.keys(room.getPeers()).length;
    if (count === 0) {
        setStatus('Waiting for peers...');
    } else {
        setStatus(`Connected players: ${count + 1}`);
    }
}

function getOpponentIds() {
    return Array.from(players.keys()).filter((id) => id !== playerId);
}

function updateLocalRecord(outcome, opponentIds = getOpponentIds(), options = {}) {
    const { silent = false, skipBroadcast = false } = options;
    if (!opponentIds.length) {
        if (!silent) {
            log('Need at least one opponent to record a result.');
        }
        return false;
    }

    if (outcome === 'win') {
        localRecord.totalWins += 1;
    } else {
        localRecord.totalLosses += 1;
    }

    opponentIds.forEach((opponentId) => {
        const entry = ensureOpponentRecord(localRecord.opponents, opponentId);
        if (outcome === 'win') {
            entry.wins += 1;
        } else {
            entry.losses += 1;
        }
        localRecord.opponents[opponentId] = entry;
    });

    saveLocalRecord();
    syncSelfPlayerRecord();
    if (variantId === 'pve' && players.has('ai-opponent')) {
        upsertPlayer('ai-opponent', {
            name: 'AI Opponent',
            isAi: true,
            role: 'Built-in AI',
            record: buildAiRecord(),
        });
    }
    if (!skipBroadcast) {
        broadcastRecord(outcome);
    }
    return true;
}

function handleResult(outcome, { reason } = {}) {
    const applied = updateLocalRecord(outcome);
    if (!applied) return;
    let personalText = outcome === 'win' ? 'You declared victory.' : 'You reported a loss.';
    if (reason === 'surrender') {
        personalText = 'You surrendered (counts as a loss).';
    }
    setStatus(personalText);
    log(personalText);
    sendControl({
        type: 'result',
        outcome,
        playerId,
        name: displayName,
        reason,
    });
}

function broadcastRecord(reason = 'record') {
    sendScore({
        type: 'record',
        playerId,
        name: displayName,
        record: cloneRecord(localRecord),
        reason,
    });
}

function applyRemoteResult(data) {
    if (!data?.playerId || data.playerId === playerId || !data.outcome) return;
    upsertPlayer(data.playerId, { name: data.name });
    const mirroredOutcome = data.outcome === 'win' ? 'loss' : 'win';
    const applied = updateLocalRecord(mirroredOutcome, [data.playerId], { silent: true });
    if (applied) {
        const targetName = players.get(data.playerId)?.name || data.name || data.playerId;
        const descriptor = mirroredOutcome === 'win' ? 'Recorded a win' : 'Recorded a loss';
        log(`${descriptor} vs ${targetName}.`);
    }
}

function scheduleTurnSync() {
    if (turnSyncScheduled) return;
    turnSyncScheduled = true;
    queueMicrotask(() => {
        turnSyncScheduled = false;
        syncTurnState();
    });
}

function syncTurnState() {
    const order = computeTurnOrder();
    if (!order.length) return;

    const orderChanged =
        order.length !== turnOrder.length || order.some((value, index) => value !== turnOrder[index]);

    if (!currentTurnId && isHost(order)) {
        turnOrder = order;
        setTurn(order[0], order);
        broadcastTurn('initial');
        return;
    }

    if (orderChanged) {
        turnOrder = order;
        if (isHost(order)) {
            const nextId = order.includes(currentTurnId) ? currentTurnId : order[0];
            setTurn(nextId, order);
            broadcastTurn('order-change');
        } else {
            if (!order.includes(currentTurnId)) {
                currentTurnId = order[0];
            }
            updateTurnIndicator();
        }
    }
}

function computeTurnOrder() {
    return Array.from(players.values())
        .filter((player) => !player.isAi || variantId === 'pve')
        .sort((a, b) => {
            if (a.isAi && !b.isAi) return 1;
            if (!a.isAi && b.isAi) return -1;
            return a.id.localeCompare(b.id);
        })
        .map((player) => player.id);
}

function isHost(sortedOrder) {
    const humans = Array.from(players.values())
        .filter((player) => !player.isAi)
        .sort((a, b) => a.id.localeCompare(b.id));
    const order = sortedOrder || humans.map((player) => player.id);
    if (!order.length) return true;
    return order[0] === playerId;
}

function setTurn(id, order = turnOrder) {
    currentTurnId = id;
    if (order?.length) {
        turnOrder = order;
    } else if (!turnOrder.length) {
        turnOrder = computeTurnOrder();
    }
    updateTurnIndicator();
    handleAiTurn();
}

function updateTurnIndicator() {
    if (!turnIndicatorEl) return;
    turnIndicatorEl.classList.remove('is-own', 'is-waiting');
    if (!currentTurnId) {
        turnIndicatorEl.textContent = 'Determining...';
        turnIndicatorEl.classList.add('is-waiting');
    } else if (currentTurnId === playerId) {
        turnIndicatorEl.textContent = 'Your turn';
        turnIndicatorEl.classList.add('is-own');
    } else {
        const currentPlayer = players.get(currentTurnId);
        turnIndicatorEl.textContent = currentPlayer ? `${currentPlayer.name}'s turn` : 'Waiting on opponent';
        turnIndicatorEl.classList.add('is-waiting');
    }
    endTurnBtn.disabled = currentTurnId !== playerId;
}

function broadcastTurn(reason) {
    if (!currentTurnId) return;
    sendControl({
        type: 'turn',
        current: currentTurnId,
        order: turnOrder,
        actor: displayName,
        reason,
    });
}

function advanceTurn(trigger = 'manual') {
    if (!turnOrder.length) {
        turnOrder = computeTurnOrder();
    }
    if (!turnOrder.length) return;

    const currentIndex = turnOrder.indexOf(currentTurnId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % turnOrder.length;
    const nextId = turnOrder[nextIndex];
    setTurn(nextId, turnOrder);
    broadcastTurn(trigger);
}

function handleAiTurn() {
    if (aiTurnTimeout) {
        clearTimeout(aiTurnTimeout);
        aiTurnTimeout = null;
    }
    if (currentTurnId !== 'ai-opponent') return;
    setStatus('AI opponent is thinking...');
    aiTurnTimeout = setTimeout(() => {
        log('AI passes the turn.');
        advanceTurn('ai-auto');
    }, 1500);
}

clearLogBtn.addEventListener('click', () => {
    logEl.innerHTML = '';
    log('Log cleared.');
});

winBtn.addEventListener('click', () => handleResult('win'));

surrenderBtn.addEventListener('click', () => {
    handleResult('loss', { reason: 'surrender' });
});

rematchBtn.addEventListener('click', () => {
    setStatus('Rematch requested.');
    log(`${displayName} requested a rematch.`);
    sendControl({
        type: 'rematch',
        playerId,
        name: displayName,
    });
});

endTurnBtn.addEventListener('click', () => {
    if (currentTurnId !== playerId) return;
    log('You passed the turn.');
    advanceTurn('manual');
});

const room = joinRoom({ appId: 'minimal-template-game' }, matchId);
const [sendPresence, getPresence] = room.makeAction('presence');
const [sendScore, getScore] = room.makeAction('score');
const [sendControl, getControl] = room.makeAction('control');

function announcePresence() {
    sendPresence({
        playerId,
        displayName,
        variant: variantId,
    });
}

room.onPeerJoin((peerId) => {
    log(`Peer joined (${peerId}).`);
    announcePresence();
    broadcastRecord('peer-join');
    updateConnectionStatus();
});

room.onPeerLeave((peerId) => {
    log(`Peer left (${peerId}).`);
    const participantId = peerToPlayer.get(peerId);
    if (participantId) {
        peerToPlayer.delete(peerId);
        removePlayer(participantId);
    }
    updateConnectionStatus();
});

getPresence((data, peerId) => {
    if (!data?.playerId) return;
    peerToPlayer.set(peerId, data.playerId);
    upsertPlayer(data.playerId, { name: data.displayName });
    if (data.playerId !== playerId && !readinessLog.has(data.playerId)) {
        readinessLog.add(data.playerId);
        log(`${data.displayName} is ready.`);
    }
    updateConnectionStatus();
});

getScore((data) => {
    if (!data || data.type !== 'record' || !data.playerId) return;
    const record = data.record || createEmptyRecord();
    upsertPlayer(data.playerId, {
        name: data.name || players.get(data.playerId)?.name,
        record,
    });
    if (data.playerId !== playerId) {
        log(`Synced record for ${data.name || data.playerId}.`);
    }
});

getControl((data) => {
    if (!data?.type) return;
    switch (data.type) {
        case 'rematch': {
            const message = `${data.name} requested a rematch.`;
            setStatus(message);
            log(message);
            break;
        }
        case 'result': {
            applyRemoteResult(data);
            const message =
                data.reason === 'surrender'
                    ? `${data.name} surrendered (counts as a loss).`
                    : data.outcome === 'win'
                        ? `${data.name} declared victory.`
                        : `${data.name} reported a loss.`;
            setStatus(message);
            log(message);
            break;
        }
        case 'turn': {
            currentTurnId = data.current;
            if (Array.isArray(data.order) && data.order.length) {
                turnOrder = data.order;
            } else if (!turnOrder.length) {
                turnOrder = computeTurnOrder();
            }
            updateTurnIndicator();
            handleAiTurn();
            break;
        }
        default:
            break;
    }
});

function bootstrapPlayers() {
    upsertPlayer(playerId, {
        name: displayName,
        role: 'Participant',
        record: cloneRecord(localRecord),
    });

    if (variantId === 'pve') {
        upsertPlayer('ai-opponent', {
            name: 'AI Opponent',
            role: 'Built-in AI',
            isAi: true,
            record: buildAiRecord(),
        });
    }
}

bootstrapPlayers();
announcePresence();
broadcastRecord('initial');
updateConnectionStatus();
log('Template ready. Invite players via the lobby.');

