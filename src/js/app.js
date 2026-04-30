import { BLACK, WHITE, applyMove, countPieces, createInitialBoard, getLegalMoves, isGameOver } from "./othello.js";
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
let threeBoard;
let effectsLayerEl;

let board = createInitialBoard();
let currentPlayer = BLACK;
let legalMoves = [];
let turnNumber = 0;
let locked = false;
let lastMove = null;
let lastFlips = [];
let lastComboFlips = [];
let previousBoard = board.slice();
let opponentSkill = 1;
let undoStack = [];

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
  undoBtn.addEventListener("click", undoMove);
  renderScoreDiscs();
  window.addEventListener("resize", renderScoreDiscs);
  render();
}

function renderScoreDiscs() {
  renderDisc(blackScoreDiscEl, BLACK, 0);
  renderDisc(whiteScoreDiscEl, WHITE, 0);
}

function resetGame() {
  board = createInitialBoard();
  currentPlayer = BLACK;
  turnNumber = 0;
  locked = false;
  lastMove = null;
  lastFlips = [];
  lastComboFlips = [];
  previousBoard = board.slice();
  opponentSkill = 1;
  undoStack = [];
  render("你的回合");
}

function handleBoardPointer(event) {
  const index = threeBoard.indexFromClientPoint(event.clientX, event.clientY);
  if (index === null) return;
  event.preventDefault();
  playHumanMove(index);
}

function playHumanMove(index) {
  if (locked || currentPlayer !== BLACK || !legalMoves.includes(index)) return;
  undoStack.push({ board: board.slice(), currentPlayer, turnNumber, lastMove, lastFlips: lastFlips.slice(), lastComboFlips: lastComboFlips.slice(), previousBoard: previousBoard.slice(), opponentSkill });
  opponentSkill = opponentSkill * 0.58 + assessOpponentMove(board, index) * 0.42;
  placeMove(index, BLACK);
  advanceTurn();
}

function placeMove(index, player) {
  const result = applyMove(board, index, player);
  if (!result) return false;
  previousBoard = board.slice();
  board = result.board;
  lastMove = index;
  lastFlips = result.flips;
  lastComboFlips = result.lines.length >= 2 ? result.flips : [];
  turnNumber += 1;
  return true;
}

function advanceTurn() {
  if (isGameOver(board)) {
    currentPlayer = null;
    renderGameOver();
    return;
  }

  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
  const moves = getLegalMoves(board, currentPlayer);
  if (!moves.length) {
    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    const otherMoves = getLegalMoves(board, currentPlayer);
    if (!otherMoves.length) {
      renderGameOver();
      return;
    }
    render(currentPlayer === BLACK ? "ミク没有可下位置，轮到你" : "你没有可下位置，ミク继续");
    if (currentPlayer === WHITE) queueCpuMove();
    return;
  }

  render(currentPlayer === BLACK ? "你的回合" : "ミク思考中");
  if (currentPlayer === WHITE) queueCpuMove();
}

function queueCpuMove() {
  locked = true;
  window.setTimeout(() => {
    const move = chooseMove(board, difficultyEl.value, turnNumber, opponentSkill);
    if (move !== null) placeMove(move, WHITE);
    locked = false;
    advanceTurn();
  }, randomBetween(1400, 3200));
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
  previousBoard = state.previousBoard;
  opponentSkill = state.opponentSkill;
  render("已悔棋");
}

function render(statusText) {
  if (effectsLayerEl) effectsLayerEl.innerHTML = "";
  legalMoves = currentPlayer ? getLegalMoves(board, currentPlayer) : [];
  const scores = countPieces(board);
  blackScoreEl.textContent = String(scores.black);
  whiteScoreEl.textContent = String(scores.white);
  turnBubbleEl.textContent = statusText || (currentPlayer === BLACK ? "你的回合" : "ミク思考中");
  humanPanelEl.classList.toggle("active-turn", currentPlayer === BLACK);
  cpuPanelEl.classList.toggle("active-turn", currentPlayer === WHITE);
  messageEl.textContent = legalMoves.length ? `${legalMoves.length} 个可落子位置` : "无可落子位置";
  undoBtn.disabled = locked || !undoStack.length;
  threeBoard.update(board, currentPlayer === BLACK ? legalMoves : [], lastMove, previousBoard, lastFlips);

  for (const cell of boardEl.children) {
    if (!cell.dataset.index) continue;
    const index = Number(cell.dataset.index);
    const value = board[index];
    cell.className = "cell";
    cell.disabled = locked || currentPlayer !== BLACK || !legalMoves.includes(index);
    cell.innerHTML = "";

    if (value && lastComboFlips.includes(index)) {
      appendNotes(index);
    }
    if (index === lastMove) cell.classList.add("last");
    if (lastFlips.includes(index)) cell.classList.add("flip-flash");
  }
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
  let text = "DRAW";
  if (scores.black > scores.white) text = `YOU WIN +${(scores.black - scores.white) * 10} MP`;
  if (scores.white > scores.black) text = `MIKU WIN +${(scores.white - scores.black) * 6} MP`;
  render(text);
  turnBubbleEl.textContent = text;
  messageEl.textContent = `最终比分 ${scores.black}:${scores.white}`;
}

init();
