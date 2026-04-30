import { BLACK, WHITE, applyMove, countPieces, createInitialBoard, getLegalMoves, isGameOver, opponent } from "./othello.js";
import { assessOpponentMove, chooseMove } from "./ai.js";
import { renderDisc } from "./disc3d.js";
import { ThreeBoardScene } from "./threeScene.js";

const boardEl = document.querySelector("#board");
const messageEl = document.querySelector("#message");
const blackScoreEl = document.querySelector("#blackScore");
const whiteScoreEl = document.querySelector("#whiteScore");
const blackScoreDiscEl = document.querySelector("#blackScoreDisc");
const whiteScoreDiscEl = document.querySelector("#whiteScoreDisc");
const turnBubbleEl = document.querySelector("#turnBubble");
const humanPanelEl = document.querySelector(".score-panel.human");
const cpuPanelEl = document.querySelector(".score-panel.cpu");
const difficultyEl = document.querySelector("#difficulty");
const newGameBtn = document.querySelector("#newGameBtn");
const undoBtn = document.querySelector("#passBtn");
const settlementEl = document.querySelector("#settlement");
const settlementTitleEl = document.querySelector("#settlementTitle");
const settlementRestartBtn = document.querySelector("#settlementRestartBtn");
const firstPlayerScreenEl = document.querySelector("#firstPlayerScreen");
const firstChoiceDiscEl = document.querySelector("#firstChoiceDisc");
const secondChoiceDiscEl = document.querySelector("#secondChoiceDisc");
const pageEl = document.body;
const resultPiecesEl = document.querySelector("#resultPieces");
const resultBaseEl = document.querySelector("#resultBase");
const resultNoUndoEl = document.querySelector("#resultNoUndo");
const resultMultiEl = document.querySelector("#resultMulti");
const resultPerfectEl = document.querySelector("#resultPerfect");
const resultSecretEl = document.querySelector("#resultSecret");
const resultTotalEl = document.querySelector("#resultTotal");
let threeBoard;
let effectsLayerEl;
let cpuTimerId = null;
let turnSwitchTimerId = null;

const TURN_SWITCH_DELAY = 800;
const SELECTION_EXIT_DELAY = 520;
const RESTART_EXIT_DELAY = 460;
const PIECE_SCORE = 10;
const NO_UNDO_BONUS = 100;
const MULTI_LINE_BONUS = 10;
const PERFECT_WIN_BONUS = 1000;
const SECRET_BONUS = 500;
const SECRET_SPAWN_BLACK_MOVE = 10;
const SECRET_COUNT = 2;

let board = createInitialBoard();
let currentPlayer = BLACK;
let humanPlayer = BLACK;
let cpuPlayer = WHITE;
let legalMoves = [];
let turnNumber = 0;
let locked = true;
let lastMove = null;
let lastFlips = [];
let lastComboFlips = [];
let pendingAnimatedFlips = [];
let pendingComboFlips = [];
let previousBoard = board.slice();
let opponentSkill = 1;
let undoStack = [];
let moveCounts = { [BLACK]: 0, [WHITE]: 0 };
let hasUndone = false;
let multiLineMoves = { [BLACK]: 0, [WHITE]: 0 };
let secretScores = { [BLACK]: 0, [WHITE]: 0 };
let secretPrizeCells = [];
let secretCells = [];
let secretCellsSpawned = false;

function init() {
  boardEl.innerHTML = "";
  threeBoard = new ThreeBoardScene(boardEl);
  effectsLayerEl = document.createElement("div");
  effectsLayerEl.className = "effects-layer";
  boardEl.appendChild(effectsLayerEl);
  boardEl.addEventListener("pointerdown", handleBoardPointer, true);
  for (let i = 0; i < 64; i += 1) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.type = "button";
    cell.dataset.index = String(i);
    cell.setAttribute("aria-label", `格子 ${i + 1}`);
    cell.addEventListener("click", () => playHumanMove(i));
    boardEl.appendChild(cell);
  }
  newGameBtn.addEventListener("click", resetGame);
  settlementRestartBtn.addEventListener("click", resetGame);
  undoBtn.addEventListener("click", undoMove);
  firstPlayerScreenEl.addEventListener("click", handleFirstPlayerChoice);
  renderScoreDiscs();
  window.addEventListener("resize", renderScoreDiscs);
  render();
}

function renderScoreDiscs() {
  renderDisc(blackScoreDiscEl, humanPlayer, 0);
  renderDisc(whiteScoreDiscEl, cpuPlayer, 0);
  renderDisc(firstChoiceDiscEl, BLACK, 0);
  renderDisc(secondChoiceDiscEl, WHITE, 0);
}

function resetGame() {
  clearCpuTimer();
  clearTurnSwitchTimer();
  locked = true;
  if (!settlementEl.hidden) {
    pageEl.classList.add("round-restarting");
    settlementEl.classList.add("leaving");
    window.setTimeout(() => {
      settlementEl.hidden = true;
      settlementEl.classList.remove("leaving");
      pageEl.classList.remove("settlement-open", "round-restarting");
      showFirstPlayerScreen();
    }, RESTART_EXIT_DELAY);
    return;
  }
  if (firstPlayerScreenEl.hidden) {
    showFirstPlayerScreen(true);
    return;
  }
  showFirstPlayerScreen();
}

function showFirstPlayerScreen(slideIn = false) {
  clearCpuTimer();
  clearTurnSwitchTimer();
  locked = true;
  settlementEl.hidden = true;
  firstPlayerScreenEl.classList.toggle("entering", slideIn);
  firstPlayerScreenEl.hidden = false;
  firstPlayerScreenEl.classList.remove("leaving");
  if (slideIn) {
    pageEl.classList.add("round-restarting");
    window.requestAnimationFrame(() => {
      firstPlayerScreenEl.classList.remove("entering");
      window.setTimeout(() => {
        pageEl.classList.remove("settlement-open", "round-restarting");
      }, RESTART_EXIT_DELAY);
    });
  } else {
    pageEl.classList.remove("settlement-open", "round-restarting");
  }
  firstPlayerScreenEl.querySelectorAll(".first-player-card").forEach((card) => {
    card.classList.remove("selected");
    card.disabled = false;
  });
  renderScoreDiscs();
  render();
}

function handleFirstPlayerChoice(event) {
  const card = event.target.closest(".first-player-card");
  if (!card || firstPlayerScreenEl.classList.contains("leaving")) return;
  const isFirst = card.dataset.player === "first";
  humanPlayer = isFirst ? BLACK : WHITE;
  cpuPlayer = opponent(humanPlayer);
  card.classList.add("selected");
  firstPlayerScreenEl.querySelectorAll(".first-player-card").forEach((item) => {
    item.disabled = true;
  });

  window.setTimeout(() => {
    firstPlayerScreenEl.classList.add("leaving");
    window.setTimeout(() => {
      firstPlayerScreenEl.hidden = true;
      startRound();
    }, SELECTION_EXIT_DELAY);
  }, SELECTION_EXIT_DELAY);
}

function startRound() {
  clearTurnSwitchTimer();
  pageEl.classList.remove("settlement-open", "round-restarting");
  board = createInitialBoard();
  currentPlayer = BLACK;
  turnNumber = 0;
  locked = false;
  lastMove = null;
  lastFlips = [];
  lastComboFlips = [];
  pendingAnimatedFlips = [];
  pendingComboFlips = [];
  previousBoard = board.slice();
  opponentSkill = 1;
  undoStack = [];
  moveCounts = { [BLACK]: 0, [WHITE]: 0 };
  hasUndone = false;
  multiLineMoves = { [BLACK]: 0, [WHITE]: 0 };
  secretScores = { [BLACK]: 0, [WHITE]: 0 };
  secretPrizeCells = [];
  secretCells = [];
  secretCellsSpawned = false;
  settlementEl.hidden = true;
  locked = false;
  renderScoreDiscs();
  render(currentPlayer === humanPlayer ? "你的回合" : "ミク思考中");
  if (currentPlayer === cpuPlayer) queueCpuMove();
}

function handleBoardPointer(event) {
  const index = threeBoard.indexFromClientPoint(event.clientX, event.clientY);
  if (index === null) return;
  event.preventDefault();
  playHumanMove(index);
}

function playHumanMove(index) {
  if (locked || currentPlayer !== humanPlayer || !legalMoves.includes(index)) return;
  pushUndoState();
  opponentSkill = opponentSkill * 0.58 + assessOpponentMove(board, index, humanPlayer) * 0.42;
  placeMove(index, humanPlayer);
  scheduleAdvanceTurn(currentPlayer === humanPlayer ? "落子完成" : "ミク落子完成");
}

function placeMove(index, player) {
  maybeSpawnSecretCells(player);
  const result = applyMove(board, index, player);
  if (!result) return false;
  previousBoard = board.slice();
  board = result.board;
  lastMove = index;
  lastFlips = result.flips;
  lastComboFlips = result.lines.length >= 2 ? result.flips : [];
  pendingAnimatedFlips = result.flips;
  pendingComboFlips = lastComboFlips;
  if (result.lines.length >= 2) multiLineMoves[player] += 1;
  claimSecretCell(index, player);
  moveCounts[player] += 1;
  turnNumber += 1;
  return true;
}

function advanceTurn() {
  locked = false;
  if (isGameOver(board)) {
    currentPlayer = null;
    renderGameOver();
    return;
  }

  currentPlayer = opponent(currentPlayer);
  const moves = getLegalMoves(board, currentPlayer);
  if (!moves.length) {
    currentPlayer = opponent(currentPlayer);
    const otherMoves = getLegalMoves(board, currentPlayer);
    if (!otherMoves.length) {
      renderGameOver();
      return;
    }
    render(currentPlayer === humanPlayer ? "ミク没有可下位置，轮到你" : "你没有可下位置，ミク继续");
    if (currentPlayer === cpuPlayer) queueCpuMove();
    return;
  }

  render(currentPlayer === humanPlayer ? "你的回合" : "ミク思考中");
  if (currentPlayer === cpuPlayer) queueCpuMove();
}

function queueCpuMove() {
  locked = true;
  clearCpuTimer();
  clearTurnSwitchTimer();
  cpuTimerId = window.setTimeout(() => {
    cpuTimerId = null;
    if (currentPlayer !== cpuPlayer) return;
    const move = chooseMove(board, difficultyEl.value, turnNumber, opponentSkill, cpuPlayer);
    if (move !== null) placeMove(move, cpuPlayer);
    scheduleAdvanceTurn("ミク落子完成");
  }, randomBetween(1400, 3200));
}

function clearCpuTimer() {
  if (cpuTimerId === null) return;
  window.clearTimeout(cpuTimerId);
  cpuTimerId = null;
}

function clearTurnSwitchTimer() {
  if (turnSwitchTimerId === null) return;
  window.clearTimeout(turnSwitchTimerId);
  turnSwitchTimerId = null;
}

function scheduleAdvanceTurn(statusText) {
  locked = true;
  render(statusText);
  clearTurnSwitchTimer();
  turnSwitchTimerId = window.setTimeout(() => {
    turnSwitchTimerId = null;
    advanceTurn();
  }, TURN_SWITCH_DELAY);
}

function undoMove() {
  if (locked || !undoStack.length) return;
  const state = undoStack.pop();
  board = state.board;
  currentPlayer = state.currentPlayer;
  turnNumber = state.turnNumber;
  lastMove = state.lastMove;
  lastFlips = state.lastFlips;
  lastComboFlips = state.lastComboFlips;
  pendingAnimatedFlips = [];
  pendingComboFlips = [];
  previousBoard = state.previousBoard;
  opponentSkill = state.opponentSkill;
  moveCounts = { ...state.moveCounts };
  hasUndone = true;
  multiLineMoves = { ...state.multiLineMoves };
  secretScores = { ...state.secretScores };
  secretCells = state.secretCells.slice();
  secretCellsSpawned = state.secretCellsSpawned;
  render("已悔棋");
}

function pushUndoState() {
  undoStack.push({
    board: board.slice(),
    currentPlayer,
    turnNumber,
    lastMove,
    lastFlips: lastFlips.slice(),
    lastComboFlips: lastComboFlips.slice(),
    previousBoard: previousBoard.slice(),
    opponentSkill,
    moveCounts: { ...moveCounts },
    multiLineMoves: { ...multiLineMoves },
    secretScores: { ...secretScores },
    secretCells: secretCells.slice(),
    secretCellsSpawned
  });
}

function render(statusText) {
  if (effectsLayerEl) effectsLayerEl.innerHTML = "";
  legalMoves = currentPlayer ? getLegalMoves(board, currentPlayer) : [];
  const scores = countPieces(board);
  const humanScore = humanPlayer === BLACK ? scores.black : scores.white;
  const cpuScore = cpuPlayer === BLACK ? scores.black : scores.white;
  blackScoreEl.textContent = String(humanScore);
  whiteScoreEl.textContent = String(cpuScore);
  turnBubbleEl.textContent = statusText || (currentPlayer === humanPlayer ? "你的回合" : "ミク思考中");
  humanPanelEl.classList.toggle("active-turn", currentPlayer === humanPlayer);
  cpuPanelEl.classList.toggle("active-turn", currentPlayer === cpuPlayer);
  messageEl.textContent = legalMoves.length ? `${legalMoves.length} 个可落子位置` : "无可落子位置";
  undoBtn.disabled = locked || !undoStack.length;
  const animatedFlips = pendingAnimatedFlips;
  const comboFlips = pendingComboFlips;
  pendingAnimatedFlips = [];
  pendingComboFlips = [];
  threeBoard.update(board, [], lastMove, previousBoard, animatedFlips, secretCells);
  renderBoardHints();

  for (const cell of boardEl.children) {
    if (!cell.dataset.index) continue;
    const index = Number(cell.dataset.index);
    const value = board[index];
    cell.className = "cell";
    cell.disabled = locked || currentPlayer !== humanPlayer || !legalMoves.includes(index);
    cell.innerHTML = "";

    if (value && comboFlips.includes(index)) {
      appendNotes(index);
    }
    if (index === lastMove) cell.classList.add("last");
    if (animatedFlips.includes(index)) cell.classList.add("flip-flash");
  }
}

function renderBoardHints() {
  if (!effectsLayerEl || locked || currentPlayer !== humanPlayer) return;
  for (const index of legalMoves) {
    const point = threeBoard.screenPointForIndex(index);
    const hint = document.createElement("span");
    hint.className = "board-hint legal";
    hint.style.left = `${point.x}%`;
    hint.style.top = `${point.y}%`;
    effectsLayerEl.appendChild(hint);
  }
}


function claimSecretCell(index, player) {
  if (!secretCells.includes(index)) return;
  secretScores[player] += SECRET_BONUS;
}

function maybeSpawnSecretCells(player) {
  if (player !== humanPlayer || secretCellsSpawned || moveCounts[humanPlayer] !== SECRET_SPAWN_BLACK_MOVE - 1) return;
  if (!secretPrizeCells.length) secretPrizeCells = pickSecretPrizeCells();
  secretCells = secretPrizeCells.filter((index) => board[index] === 0);
  secretCellsSpawned = true;
}

function pickSecretPrizeCells() {
  const emptyCells = board.map((value, index) => (value ? null : index)).filter((index) => index !== null);
  return shuffle(emptyCells).slice(0, SECRET_COUNT);
}

function shuffle(items) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function appendNotes(index) {
  const row = Math.floor(index / 8);
  const col = index % 8;
  const notes = ["♪", "♫", "♪"];
  notes.forEach((note, offset) => {
    const el = document.createElement("span");
    el.className = `note n${offset + 1}`;
    el.style.left = `${(col + 0.5) * 12.5}%`;
    el.style.top = `${(row + 0.5) * 12.5}%`;
    const side = Math.random() > 0.5 ? 1 : -1;
    const startX = randomBetween(-18, 18);
    const endX = side * randomBetween(26, 54);
    const endY = -randomBetween(34, 68);
    const arcX = side * randomBetween(14, 34);
    const arcY = -randomBetween(18, 38);
    el.style.setProperty("--start-x", `${startX}px`);
    el.style.setProperty("--start-y", `${randomBetween(-8, 8)}px`);
    el.style.setProperty("--note-x", `${endX}px`);
    el.style.setProperty("--note-y", `${endY}px`);
    el.style.setProperty("--arc-x", `${arcX}px`);
    el.style.setProperty("--arc-y", `${arcY}px`);
    el.style.setProperty("--note-rot", `${randomBetween(-24, 24)}deg`);
    el.style.setProperty("--note-scale", String(randomBetween(1.02, 1.34)));
    el.innerHTML = `<span class="note-arc"></span><span class="note-glyph">${note}</span>`;
    effectsLayerEl.appendChild(el);
  });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function renderGameOver() {
  currentPlayer = null;
  const scores = countPieces(board);
  let text = "平局";
  const humanScore = humanPlayer === BLACK ? scores.black : scores.white;
  const cpuScore = cpuPlayer === BLACK ? scores.black : scores.white;
  if (humanScore > cpuScore) text = "YOU WIN";
  if (cpuScore > humanScore) text = "MIKU WIN";
  render(text);
  turnBubbleEl.textContent = text;
  messageEl.textContent = `最终比分 ${scores.black}:${scores.white}`;
  renderSettlement(scores, text);
}

function renderSettlement(scores, title) {
  const pieces = humanPlayer === BLACK ? scores.black : scores.white;
  const cpuPieces = cpuPlayer === BLACK ? scores.black : scores.white;
  const baseScore = pieces * PIECE_SCORE;
  const noUndoScore = hasUndone ? 0 : NO_UNDO_BONUS;
  const multiScore = multiLineMoves[humanPlayer] * MULTI_LINE_BONUS;
  const perfectScore = pieces > 0 && cpuPieces === 0 ? PERFECT_WIN_BONUS : 0;
  const secretScore = secretScores[humanPlayer];
  const total = baseScore + noUndoScore + multiScore + perfectScore + secretScore;

  settlementTitleEl.textContent = title;
  resultPiecesEl.textContent = String(pieces);
  resultBaseEl.textContent = String(baseScore);
  resultNoUndoEl.textContent = String(noUndoScore);
  resultMultiEl.textContent = String(multiScore);
  resultPerfectEl.textContent = String(perfectScore);
  resultSecretEl.textContent = String(secretScore);
  resultTotalEl.textContent = String(total);
  pageEl.classList.add("settlement-open");
  settlementEl.hidden = false;
}

init();
