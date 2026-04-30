export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const SIZE = 8;
export const CELLS = SIZE * SIZE;

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

export function opponent(player) {
  return player === BLACK ? WHITE : BLACK;
}

export function createInitialBoard() {
  const board = Array(CELLS).fill(EMPTY);
  board[indexOf(3, 3)] = WHITE;
  board[indexOf(3, 4)] = BLACK;
  board[indexOf(4, 3)] = BLACK;
  board[indexOf(4, 4)] = WHITE;
  return board;
}

export function indexOf(row, col) {
  return row * SIZE + col;
}

export function toRowCol(index) {
  return [Math.floor(index / SIZE), index % SIZE];
}

export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function getFlips(board, move, player) {
  return getFlipLines(board, move, player).flat();
}

export function getFlipLines(board, move, player) {
  if (board[move] !== EMPTY) return [];
  const [row, col] = toRowCol(move);
  const foe = opponent(player);
  const lines = [];

  for (const [dr, dc] of DIRECTIONS) {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[indexOf(r, c)] === foe) {
      line.push(indexOf(r, c));
      r += dr;
      c += dc;
    }
    if (line.length && inBounds(r, c) && board[indexOf(r, c)] === player) {
      lines.push(line);
    }
  }

  return lines;
}

export function getLegalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < CELLS; i += 1) {
    if (getFlips(board, i, player).length) moves.push(i);
  }
  return moves;
}

export function applyMove(board, move, player) {
  const lines = getFlipLines(board, move, player);
  const flips = lines.flat();
  if (!flips.length) return null;
  const next = board.slice();
  next[move] = player;
  for (const index of flips) next[index] = player;
  return { board: next, flips, lines };
}

export function countPieces(board) {
  return board.reduce(
    (score, cell) => {
      if (cell === BLACK) score.black += 1;
      if (cell === WHITE) score.white += 1;
      return score;
    },
    { black: 0, white: 0 }
  );
}

export function isGameOver(board) {
  return board.every(Boolean) || (!getLegalMoves(board, BLACK).length && !getLegalMoves(board, WHITE).length);
}
