import { BLACK, WHITE, applyMove, countPieces, getLegalMoves, isGameOver, opponent } from "./othello.js";

const POSITION_WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120
];

export function chooseMove(board, level, turnNumber, opponentSkill = 1) {
  const moves = getLegalMoves(board, WHITE);
  if (!moves.length) return null;
  const resolvedLevel = adaptLevel(level === "auto" ? autoLevel(board, turnNumber) : level, opponentSkill);
  if (resolvedLevel === "easy") return randomMove(moves);

  const depth = resolvedLevel === "hard" ? 5 : 3;
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of moves) {
    const result = applyMove(board, move, WHITE);
    const score = minimax(result.board, depth - 1, BLACK, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

export function assessOpponentMove(board, move) {
  const moves = getLegalMoves(board, BLACK);
  if (moves.length < 2 || !moves.includes(move)) return 1;

  let bestScore = Infinity;
  let playedScore = Infinity;
  for (const candidate of moves) {
    const score = minimax(applyMove(board, candidate, BLACK).board, 2, WHITE, -Infinity, Infinity);
    if (score < bestScore) bestScore = score;
    if (candidate === move) playedScore = score;
  }

  const gap = playedScore - bestScore;
  if (gap > 95) return 0.25;
  if (gap > 38) return 0.52;
  return 1;
}

function adaptLevel(level, opponentSkill) {
  if (opponentSkill >= 0.72) return level;
  if (opponentSkill < 0.62) return "easy";
  return level === "hard" ? "normal" : level === "normal" ? "easy" : level;
}

function autoLevel(board, turnNumber) {
  const score = countPieces(board);
  const lead = score.white - score.black;
  if (turnNumber < 18 || lead < -4) return "easy";
  if (turnNumber < 52 || lead < 16) return "normal";
  return "hard";
}

function randomMove(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

function minimax(board, depth, player, alpha, beta) {
  if (depth === 0 || isGameOver(board)) return evaluate(board);

  const moves = getLegalMoves(board, player);
  if (!moves.length) return minimax(board, depth - 1, opponent(player), alpha, beta);

  if (player === WHITE) {
    let value = -Infinity;
    for (const move of moves) {
      value = Math.max(value, minimax(applyMove(board, move, player).board, depth - 1, BLACK, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of moves) {
    value = Math.min(value, minimax(applyMove(board, move, player).board, depth - 1, WHITE, alpha, beta));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function evaluate(board) {
  const score = countPieces(board);
  let positional = 0;
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === WHITE) positional += POSITION_WEIGHTS[i];
    if (board[i] === BLACK) positional -= POSITION_WEIGHTS[i];
  }

  const mobility = getLegalMoves(board, WHITE).length - getLegalMoves(board, BLACK).length;
  return (score.white - score.black) * 10 + positional + mobility * 8;
}
