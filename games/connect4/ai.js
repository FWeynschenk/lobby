const ROWS = 6;
const COLS = 7;
const EMPTY = 0;

export function getBestMove(board, difficulty, aiPlayerId = 2) {
    const aiPiece = aiPlayerId;
    const playerPiece = aiPlayerId === 1 ? 2 : 1;

    let depth;
    switch (difficulty) {
        case 'easy': depth = 2; break;
        case 'medium': depth = 4; break;
        case 'hard': depth = 6; break;
        default: depth = 4;
    }

    // For easy difficulty, sometimes make a random move
    if (difficulty === 'easy' && Math.random() < 0.3) {
        const validMoves = getValidMoves(board);
        if (validMoves.length > 0) {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }

    const [score, col] = minimax(board, depth, -Infinity, Infinity, true, aiPiece, playerPiece);
    return col;
}

function minimax(board, depth, alpha, beta, maximizingPlayer, aiPiece, playerPiece) {
    const validMoves = getValidMoves(board);
    const isTerminal = isTerminalNode(board, aiPiece, playerPiece);

    if (depth === 0 || isTerminal) {
        if (isTerminal) {
            if (checkWin(board, aiPiece)) return [1000000, null];
            if (checkWin(board, playerPiece)) return [-1000000, null];
            return [0, null]; // Draw
        } else {
            return [scorePosition(board, aiPiece, playerPiece), null];
        }
    }

    if (maximizingPlayer) {
        let value = -Infinity;
        let bestCol = validMoves[0]; // Default to first valid move
        // Sort moves to improve pruning (center columns first)
        validMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));

        for (const col of validMoves) {
            const bCopy = board.map(row => [...row]);
            dropPiece(bCopy, col, aiPiece);
            const [newScore] = minimax(bCopy, depth - 1, alpha, beta, false, aiPiece, playerPiece);
            if (newScore > value) {
                value = newScore;
                bestCol = col;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return [value, bestCol];
    } else {
        let value = Infinity;
        let bestCol = validMoves[0];
        validMoves.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3));

        for (const col of validMoves) {
            const bCopy = board.map(row => [...row]);
            dropPiece(bCopy, col, playerPiece);
            const [newScore] = minimax(bCopy, depth - 1, alpha, beta, true, aiPiece, playerPiece);
            if (newScore < value) {
                value = newScore;
                bestCol = col;
            }
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return [value, bestCol];
    }
}

function getValidMoves(board) {
    const moves = [];
    for (let c = 0; c < COLS; c++) {
        if (board[0][c] === EMPTY) {
            moves.push(c);
        }
    }
    return moves;
}

function dropPiece(board, col, piece) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === EMPTY) {
            board[r][col] = piece;
            return;
        }
    }
}

function isTerminalNode(board, aiPiece, playerPiece) {
    return checkWin(board, playerPiece) || checkWin(board, aiPiece) || getValidMoves(board).length === 0;
}

function checkWin(board, piece) {
    // Horizontal
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS; r++) {
            if (board[r][c] === piece && board[r][c + 1] === piece && board[r][c + 2] === piece && board[r][c + 3] === piece) return true;
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (board[r][c] === piece && board[r + 1][c] === piece && board[r + 2][c] === piece && board[r + 3][c] === piece) return true;
        }
    }
    // Diagonal /
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (board[r][c] === piece && board[r + 1][c + 1] === piece && board[r + 2][c + 2] === piece && board[r + 3][c + 3] === piece) return true;
        }
    }
    // Diagonal \
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 3; r < ROWS; r++) {
            if (board[r][c] === piece && board[r - 1][c + 1] === piece && board[r - 2][c + 2] === piece && board[r - 3][c + 3] === piece) return true;
        }
    }
    return false;
}

function scorePosition(board, aiPiece, playerPiece) {
    let score = 0;
    const centerArray = [];
    for (let r = 0; r < ROWS; r++) {
        centerArray.push(board[r][3]);
    }
    const centerCount = centerArray.filter(x => x === aiPiece).length;
    score += centerCount * 3;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        const rowArray = board[r];
        for (let c = 0; c < COLS - 3; c++) {
            const window = rowArray.slice(c, c + 4);
            score += evaluateWindow(window, aiPiece, playerPiece);
        }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
        const colArray = [];
        for (let r = 0; r < ROWS; r++) {
            colArray.push(board[r][c]);
        }
        for (let r = 0; r < ROWS - 3; r++) {
            const window = colArray.slice(r, r + 4);
            score += evaluateWindow(window, aiPiece, playerPiece);
        }
    }

    // Diagonal /
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            const window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
            score += evaluateWindow(window, aiPiece, playerPiece);
        }
    }

    // Diagonal \
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            const window = [board[r + 3][c], board[r + 2][c + 1], board[r + 1][c + 2], board[r][c + 3]];
            score += evaluateWindow(window, aiPiece, playerPiece);
        }
    }

    return score;
}

function evaluateWindow(window, aiPiece, playerPiece) {
    let score = 0;
    const pieceCount = window.filter(x => x === aiPiece).length;
    const emptyCount = window.filter(x => x === EMPTY).length;
    const oppCount = window.filter(x => x === playerPiece).length;

    if (pieceCount === 4) {
        score += 100;
    } else if (pieceCount === 3 && emptyCount === 1) {
        score += 5;
    } else if (pieceCount === 2 && emptyCount === 2) {
        score += 2;
    }

    if (oppCount === 3 && emptyCount === 1) {
        score -= 4;
    }

    return score;
}
