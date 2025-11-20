import { joinRoom } from 'trystero';
import { getBestMove } from './ai.js';

const APP_ID = 'connect4-lobby-game';
const ROWS = 6;
const COLS = 7;

// DOM Elements
const boardEl = document.getElementById('game-board');
const statusEl = document.getElementById('status-display');
const playerMeEl = document.getElementById('player-me');
const playerOpponentEl = document.getElementById('player-opponent');
const playerInfoEl = document.getElementById('player-info');
const rematchBtn = document.getElementById('rematch-btn');
const surrenderBtn = document.getElementById('surrender-btn');
const lobbyBtn = document.getElementById('lobby-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalRematchBtn = document.getElementById('modal-rematch-btn');
const modalLobbyBtn = document.getElementById('modal-lobby-btn');

// Game State
let board = [];
let currentPlayer = 1; // 1 or 2
let myPlayerId = 1; // 1 or 2 (assigned at start)
let gameActive = false;
let gameMode = 'pvp'; // 'pvp' or 'pve'
let difficulty = 'medium';
let room = null;
let sendMove = null;
let sendRematch = null;
let sendSurrender = null;
let sendPlayerInfo = null;

// Rematch State
let myRematchRequested = false;
let opponentRematchRequested = false;

// User Info
let myName = 'Player';
let myId = '';
let opponentName = 'Opponent';
let opponentId = '';

// Initialize
function init() {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('matchId');
    const variant = params.get('variant'); // 'pvp' or 'pve'
    myId = params.get('playerId') || 'guest-' + Math.floor(Math.random() * 1000);
    myName = params.get('displayName') || 'Guest';

    gameMode = variant === 'pve' ? 'pve' : 'pvp';

    // Setup UI
    lobbyBtn.onclick = () => window.location.href = '/index.html';
    modalLobbyBtn.onclick = () => window.location.href = '/index.html';

    rematchBtn.onclick = handleRematchRequest;
    modalRematchBtn.onclick = handleRematchRequest;

    surrenderBtn.onclick = () => {
        if (gameMode === 'pvp' && sendSurrender) {
            if (confirm("Are you sure you want to surrender?")) {
                sendSurrender({ surrender: true });
                endGame(myPlayerId === 1 ? 2 : 1, "You surrendered."); // Opponent wins
            }
        }
    };

    createBoard();

    if (gameMode === 'pve') {
        startPvE();
    } else {
        if (!matchId) {
            statusEl.textContent = 'Error: No match ID provided.';
            return;
        }
        startPvP(matchId);
    }
}

function createBoard() {
    boardEl.innerHTML = '';
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.onclick = () => handleCellClick(c);
            boardEl.appendChild(cell);
        }
    }
}

function startPvE() {
    gameActive = true;
    myPlayerId = 1; // Player is always 1 in PvE for now
    currentPlayer = 1;
    statusEl.textContent = "Your Turn";
    playerInfoEl.classList.remove('hidden');
    updatePlayerInfo();

    // Apply color classes to player cards
    playerMeEl.classList.add('is-p1');
    playerOpponentEl.classList.add('is-p2');
    updateActivePlayerCard();
}

function startPvP(matchId) {
    statusEl.textContent = "Connecting to opponent...";
    const config = { appId: APP_ID };
    room = joinRoom(config, matchId);

    const [sendMoveAction, getMoveAction] = room.makeAction('move');
    const [sendRematchAction, getRematchAction] = room.makeAction('rematch');
    const [sendSurrenderAction, getSurrenderAction] = room.makeAction('surrender');
    const [sendInfoAction, getInfoAction] = room.makeAction('playerInfo');

    sendMove = sendMoveAction;
    sendRematch = sendRematchAction;
    sendSurrender = sendSurrenderAction;
    sendPlayerInfo = sendInfoAction;

    room.onPeerJoin(peerId => {
        console.log('Peer joined:', peerId);
        // Send my info
        sendPlayerInfo({ name: myName, id: myId });

        // Reset disconnect state if any
        playerOpponentEl.classList.remove('opponent-left');
        statusEl.textContent = "Opponent connected. Exchanging info...";
    });

    room.onPeerLeave(peerId => {
        console.log('Peer left:', peerId);
        gameActive = false;
        statusEl.textContent = "Opponent left the game.";
        playerOpponentEl.classList.add('opponent-left');
        modalTitle.textContent = "Opponent Disconnected";
        modalMessage.textContent = "The opponent has left the game.";
        modalOverlay.classList.remove('hidden');
        rematchBtn.classList.add('hidden'); // Disable rematch
        modalRematchBtn.classList.add('hidden');
    });

    getInfoAction((data, peerId) => {
        console.log('Received player info:', data);
        opponentName = data.name;
        opponentId = data.id;

        // Simple P1/P2 resolution for now:
        // If myId < opponentId string comparison, I am P1.
        if (myId < opponentId) {
            myPlayerId = 1;
            statusEl.textContent = "You are Player 1 (Red). Your Turn.";
        } else {
            myPlayerId = 2;
            statusEl.textContent = "You are Player 2 (Yellow). Waiting for opponent.";
        }

        // Update UI classes
        playerMeEl.classList.remove('is-p1', 'is-p2');
        playerOpponentEl.classList.remove('is-p1', 'is-p2');

        if (myPlayerId === 1) {
            playerMeEl.classList.add('is-p1');
            playerOpponentEl.classList.add('is-p2');
        } else {
            playerMeEl.classList.add('is-p2');
            playerOpponentEl.classList.add('is-p1');
        }

        updatePlayerInfo();
        currentPlayer = 1;
        gameActive = true;
        playerInfoEl.classList.remove('hidden');
        surrenderBtn.classList.remove('hidden');
        updateActivePlayerCard();
        loadStats();
    });

    getMoveAction((col, peerId) => {
        if (!gameActive) return;
        makeMove(col, currentPlayer);
    });

    getSurrenderAction((data, peerId) => {
        endGame(myPlayerId, "Opponent surrendered!"); // I win
    });

    getRematchAction((data, peerId) => {
        if (data.request) {
            opponentRematchRequested = true;
            playerOpponentEl.querySelector('.rematch-indicator').classList.add('visible');
            statusEl.textContent = "Opponent wants a rematch!";

            if (myRematchRequested) {
                // Both agreed
                startRematch();
            }
        } else if (data.start) {
            // Opponent triggered start (should be redundant if logic is symmetric, but good for safety)
            startRematch();
        }
    });
}

function handleRematchRequest() {
    if (gameMode === 'pve') {
        restartGame(true);
        return;
    }

    if (myRematchRequested) return; // Already requested

    myRematchRequested = true;
    playerMeEl.querySelector('.rematch-indicator').classList.add('visible');
    rematchBtn.textContent = "Waiting for Opponent...";
    modalRematchBtn.textContent = "Waiting...";

    if (sendRematch) {
        sendRematch({ request: true });
    }

    if (opponentRematchRequested) {
        startRematch();
    } else {
        statusEl.textContent = "Waiting for opponent to accept rematch...";
        modalMessage.textContent = "Waiting for opponent...";
    }
}

function startRematch() {
    // Reset rematch state
    myRematchRequested = false;
    opponentRematchRequested = false;
    playerMeEl.querySelector('.rematch-indicator').classList.remove('visible');
    playerOpponentEl.querySelector('.rematch-indicator').classList.remove('visible');
    rematchBtn.textContent = "Rematch";
    modalRematchBtn.textContent = "Rematch";

    // Swap sides logic
    // If I was P1 (1), I become P2 (2).
    // If I was P2 (2), I become P1 (1).
    myPlayerId = myPlayerId === 1 ? 2 : 1;

    // Update UI classes for new roles
    playerMeEl.classList.remove('is-p1', 'is-p2');
    playerOpponentEl.classList.remove('is-p1', 'is-p2');

    if (myPlayerId === 1) {
        playerMeEl.classList.add('is-p1');
        playerOpponentEl.classList.add('is-p2');
        statusEl.textContent = "Rematch! You are Player 1 (Red). Your Turn.";
    } else {
        playerMeEl.classList.add('is-p2');
        playerOpponentEl.classList.add('is-p1');
        statusEl.textContent = "Rematch! You are Player 2 (Yellow). Waiting for opponent.";
    }

    restartGame(false); // Don't swap again inside, we handled it
}

function handleCellClick(col) {
    if (!gameActive) return;
    if (currentPlayer !== myPlayerId) return;

    if (makeMove(col, myPlayerId)) {
        if (gameMode === 'pvp' && sendMove) {
            sendMove(col);
        } else if (gameMode === 'pve') {
            // AI Turn
            setTimeout(() => {
                const aiMove = getBestMove(board, difficulty);
                makeMove(aiMove, 2);
            }, 500);
        }
    }
}

function makeMove(col, player) {
    // Find lowest empty row in col
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            board[r][col] = player;
            updateBoardUI(r, col, player);

            if (checkWin(r, col, player)) {
                endGame(player, player === myPlayerId ? "You Win!" : "You Lose!");
            } else if (checkDraw()) {
                endGame(0, "Draw!");
            } else {
                currentPlayer = currentPlayer === 1 ? 2 : 1;
                updateStatus();
                updateActivePlayerCard();
            }
            return true;
        }
    }
    return false;
}

function updateBoardUI(row, col, player) {
    const cell = boardEl.children[row * COLS + col];
    cell.classList.add(player === 1 ? 'p1' : 'p2');
}

function updateStatus() {
    if (currentPlayer === myPlayerId) {
        statusEl.textContent = "Your Turn";
    } else {
        statusEl.textContent = `${opponentName}'s Turn`;
    }
}

function updateActivePlayerCard() {
    playerMeEl.classList.remove('active');
    playerOpponentEl.classList.remove('active');

    if (currentPlayer === myPlayerId) {
        playerMeEl.classList.add('active');
    } else {
        playerOpponentEl.classList.add('active');
    }
}

function checkWin(r, c, player) {
    // Directions: [row_delta, col_delta]
    const directions = [
        [0, 1],  // Horizontal
        [1, 0],  // Vertical
        [1, 1],  // Diagonal /
        [1, -1]  // Diagonal \
    ];

    for (const [dr, dc] of directions) {
        let count = 1; // Count the current piece

        // Check positive direction
        for (let i = 1; i < 4; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === player) {
                count++;
            } else {
                break;
            }
        }

        // Check negative direction
        for (let i = 1; i < 4; i++) {
            const nr = r - dr * i;
            const nc = c - dc * i;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === player) {
                count++;
            } else {
                break;
            }
        }

        if (count >= 4) return true;
    }

    return false;
}

function checkDraw() {
    return board[0].every(cell => cell !== 0);
}

function endGame(winner, message) {
    gameActive = false;
    statusEl.textContent = message;

    if (winner === myPlayerId) {
        saveStats(true);
    } else if (winner !== 0) {
        saveStats(false);
    }

    modalTitle.textContent = message;
    modalMessage.textContent = winner === myPlayerId ? "Great job!" : "Better luck next time.";
    modalOverlay.classList.remove('hidden');
    rematchBtn.classList.remove('hidden');
}

function updatePlayerInfo() {
    playerMeEl.querySelector('.name').textContent = myName;
    playerOpponentEl.querySelector('.name').textContent = opponentName;
    loadStats();
}

function loadStats() {
    if (!opponentId) return;
    const key = `connect4_stats_${myId}_${opponentId}`;
    const stats = JSON.parse(localStorage.getItem(key) || '{"wins": 0, "losses": 0}');

    playerMeEl.querySelector('.stats').textContent = `Wins: ${stats.wins}`;
    // Opponent wins are my losses
    playerOpponentEl.querySelector('.stats').textContent = `Wins: ${stats.losses}`;
}

function saveStats(isWin) {
    if (!opponentId) return;
    const key = `connect4_stats_${myId}_${opponentId}`;
    const stats = JSON.parse(localStorage.getItem(key) || '{"wins": 0, "losses": 0}');

    if (isWin) stats.wins++;
    else stats.losses++;

    localStorage.setItem(key, JSON.stringify(stats));
    loadStats();
}

function restartGame(swapSides = false) {
    // Reset board
    createBoard();
    modalOverlay.classList.add('hidden');

    if (swapSides) {
        myPlayerId = myPlayerId === 1 ? 2 : 1;
    }

    currentPlayer = 1; // Always P1 starts
    gameActive = true;
    updateStatus();
    updateActivePlayerCard();
}

// Start
init();
