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
const difficultyOptionEls = [...document.querySelectorAll(".difficulty-option")];
const newGameBtn = document.querySelector("#newGameBtn");
const undoBtn = document.querySelector("#passBtn");
const undoRemainingEl = document.querySelector("#undoRemaining");
const menuBtn = document.querySelector("#menuBtn");
const menuModalEl = document.querySelector("#menuModal");
const bgmToggleEl = document.querySelector("#bgmToggle");
const aiBattleToggleEl = document.querySelector("#aiBattleToggle");
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
let aiBattleRestartTimerId = null;
let aiBattleChoiceTimerId = null;
let backgroundMusicEl = null;
let placeSoundCursor = 0;
let hasInteracted = false;

const TURN_SWITCH_DELAY = 800;
const AI_BATTLE_RESTART_DELAY = 2600;
const SELECTION_EXIT_DELAY = 520;
const RESTART_EXIT_DELAY = 460;
const PIECE_SCORE = 10;
const NO_UNDO_BONUS = 100;
const MULTI_LINE_BONUS = 10;
const PERFECT_WIN_BONUS = 1000;
const SECRET_BONUS = 500;
const SECRET_SPAWN_BLACK_MOVE = 10;
const SECRET_COUNT = 2;
const MAX_UNDOS = 3;
const SAVE_VERSION = 1;
const GAME_STATE_KEY = "miku-versi.game-state.v1";
const RECORD_KEY = "miku-versi.record.v1";
const PLACE_SOUND_URL = "./audio/001.ogg";
const DIFFICULTY_ORDER = ["easy", "normal", "hard"];
const BACKGROUND_MUSIC_URLS = [
  "./audio/remix_my_room_penthouse_sub.dspadpcm.ogg",
  "./audio/remix_my_room_resort_sub.dspadpcm.ogg"
];

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
let undoUses = 0;
let moveCounts = { [BLACK]: 0, [WHITE]: 0 };
let hasUndone = false;
let aiBattleMode = false;
let multiLineMoves = { [BLACK]: 0, [WHITE]: 0 };
let secretScores = { [BLACK]: 0, [WHITE]: 0 };
let secretPrizeCells = [];
let secretCells = [];
let secretCellsSpawned = false;
let awaitingAdvance = false;
let record = loadRecord();

function init() {
  preloadPlaceSounds();
  backgroundMusicEl = new Audio(pickBackgroundMusicUrl());
  backgroundMusicEl.loop = true;
  backgroundMusicEl.volume = 0.42;
  backgroundMusicEl.preload = "auto";
  window.addEventListener("pointerdown", startBackgroundMusic, { once: true });
  window.addEventListener("keydown", startBackgroundMusic, { once: true });
  boardEl.innerHTML = "";
  threeBoard = new ThreeBoardScene(boardEl, {
    onFlip: playPlaceSound
  });
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
  newGameBtn.addEventListener("click", handleManualRestart);
  settlementRestartBtn.addEventListener("click", handleManualRestart);
  undoBtn.addEventListener("click", undoMove);
  menuBtn.addEventListener("click", toggleMenu);
  menuModalEl.addEventListener("click", closeMenuOnBackdrop);
  difficultyEl.addEventListener("click", handleDifficultyChoice);
  bgmToggleEl.addEventListener("change", handleBgmToggle);
  aiBattleToggleEl.addEventListener("change", handleAiBattleToggle);
  firstPlayerScreenEl.addEventListener("click", handleFirstPlayerChoice);
  renderScoreDiscs();
  window.addEventListener("resize", renderScoreDiscs);
  renderRecord();
  if (restoreGameState()) return;
  showFirstPlayerScreen();
  revealApp();
}

function renderScoreDiscs() {
  renderDisc(blackScoreDiscEl, humanPlayer, 0);
  renderDisc(whiteScoreDiscEl, cpuPlayer, 0);
  renderDisc(firstChoiceDiscEl, BLACK, 0);
  renderDisc(secondChoiceDiscEl, WHITE, 0);
}

function resetGame() {
  restartGame(true);
}

function handleManualRestart() {
  restartGame(true, true);
}

function restartGame(clearAutoRestart = true, showAiChoice = false) {
  clearCpuTimer();
  clearTurnSwitchTimer();
  clearAiBattleChoiceTimer();
  if (clearAutoRestart) clearAiBattleRestartTimer();
  closeMenu();
  clearSavedGame();
  locked = true;
  if (!settlementEl.hidden) {
    pageEl.classList.add("round-restarting");
    settlementEl.classList.add("leaving");
    window.setTimeout(() => {
      settlementEl.hidden = true;
      settlementEl.classList.remove("leaving");
      pageEl.classList.remove("settlement-open", "round-restarting");
      beginNewGameFlow(false, showAiChoice);
    }, RESTART_EXIT_DELAY);
    return;
  }
  if (firstPlayerScreenEl.hidden) {
    beginNewGameFlow(true, showAiChoice);
    return;
  }
  beginNewGameFlow(false, showAiChoice);
}

function beginNewGameFlow(slideIn = false, showAiChoice = false) {
  if (aiBattleMode && !showAiChoice) {
    firstPlayerScreenEl.hidden = true;
    startRound();
    return;
  }
  showFirstPlayerScreen(slideIn);
  if (aiBattleMode) queueAiFirstPlayerChoice();
}

function showFirstPlayerScreen(slideIn = false) {
  clearCpuTimer();
  clearTurnSwitchTimer();
  clearAiBattleRestartTimer();
  clearAiBattleChoiceTimer();
  closeMenu();
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
  chooseFirstPlayerCard(card);
}

function chooseFirstPlayerCard(card) {
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

function queueAiFirstPlayerChoice() {
  clearAiBattleChoiceTimer();
  aiBattleChoiceTimerId = window.setTimeout(() => {
    aiBattleChoiceTimerId = null;
    if (!aiBattleMode || firstPlayerScreenEl.hidden) return;
    const choices = [...firstPlayerScreenEl.querySelectorAll(".first-player-card")];
    chooseFirstPlayerCard(choices[Math.floor(Math.random() * choices.length)]);
  }, randomBetween(820, 1450));
}

function startRound() {
  clearTurnSwitchTimer();
  clearAiBattleRestartTimer();
  awaitingAdvance = false;
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
  undoUses = 0;
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
  render(getTurnStatusText());
  saveActiveGame();
  if (isAiPlayer(currentPlayer)) queueAiMove();
}

function handleBoardPointer(event) {
  const index = threeBoard.indexFromClientPoint(event.clientX, event.clientY);
  if (index === null) return;
  event.preventDefault();
  playHumanMove(index);
}

function playHumanMove(index) {
  if (aiBattleMode || locked || currentPlayer !== humanPlayer || !legalMoves.includes(index)) return;
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
  playPlaceSound(1);
  moveCounts[player] += 1;
  turnNumber += 1;
  return true;
}

function playPlaceSound(volume = 1) {
  const sounds = window.__mikuPlaceSounds || preloadPlaceSounds();
  const sound = sounds[placeSoundCursor % sounds.length];
  placeSoundCursor += 1;
  sound.pause();
  sound.currentTime = 0;
  sound.volume = Math.max(0, Math.min(1, volume));
  sound.play().catch(() => {});
}

function preloadPlaceSounds() {
  if (window.__mikuPlaceSounds) return window.__mikuPlaceSounds;
  window.__mikuPlaceSounds = Array.from({ length: 6 }, () => {
    const sound = new Audio(PLACE_SOUND_URL);
    sound.preload = "auto";
    return sound;
  });
  return window.__mikuPlaceSounds;
}

function pickBackgroundMusicUrl() {
  return BACKGROUND_MUSIC_URLS[Math.floor(Math.random() * BACKGROUND_MUSIC_URLS.length)];
}

function startBackgroundMusic() {
  hasInteracted = true;
  if (!bgmToggleEl.checked) return;
  if (!backgroundMusicEl) return;
  backgroundMusicEl.play().catch(() => {});
}

function handleBgmToggle() {
  if (!backgroundMusicEl) return;
  if (bgmToggleEl.checked) {
    if (hasInteracted) backgroundMusicEl.play().catch(() => {});
  } else {
    backgroundMusicEl.pause();
  }
}

function handleAiBattleToggle() {
  aiBattleMode = aiBattleToggleEl.checked;
  if (!aiBattleMode) clearAiBattleRestartTimer();
  if (awaitingAdvance) {
    saveActiveGame();
    return;
  }
  clearCpuTimer();
  locked = false;
  render(getTurnStatusText());
  saveActiveGame();
  if (isAiPlayer(currentPlayer)) queueAiMove();
}

function isAiPlayer(player) {
  return Boolean(player && (aiBattleMode || player === cpuPlayer));
}

function getTurnStatusText() {
  if (aiBattleMode) return currentPlayer === BLACK ? "黑方 AI 思考中" : "白方 AI 思考中";
  return currentPlayer === humanPlayer ? "你的回合" : "ミク思考中";
}

function getPassStatusText() {
  if (aiBattleMode) return currentPlayer === BLACK ? "白方无路，黑方继续" : "黑方无路，白方继续";
  return currentPlayer === humanPlayer ? "ミク没有可下位置，轮到你" : "你没有可下位置，ミク继续";
}

function getDynamicDifficulty(player) {
  const base = getDifficulty();
  if (!aiBattleMode) return base;
  if (base === "auto") {
    const scores = countPieces(board);
    const lead = player === BLACK ? scores.black - scores.white : scores.white - scores.black;
    if (turnNumber < 12) return Math.random() < 0.6 ? "easy" : "normal";
    if (lead < -6) return Math.random() < 0.58 ? "hard" : "normal";
    if (lead > 8) return Math.random() < 0.52 ? "easy" : "normal";
    const roll = Math.random();
    if (roll < 0.2) return "easy";
    if (roll < 0.72) return "normal";
    return "hard";
  }
  const index = DIFFICULTY_ORDER.indexOf(base);
  if (index === -1) return "normal";
  const offsetRoll = Math.random();
  const offset = offsetRoll < 0.18 ? -1 : offsetRoll > 0.82 ? 1 : 0;
  const nextIndex = Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, index + offset));
  return DIFFICULTY_ORDER[nextIndex];
}

function advanceTurn() {
  locked = false;
  awaitingAdvance = false;
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
    render(getPassStatusText());
    saveActiveGame();
    if (isAiPlayer(currentPlayer)) queueAiMove();
    return;
  }

  render(getTurnStatusText());
  saveActiveGame();
  if (isAiPlayer(currentPlayer)) queueAiMove();
}

function queueAiMove() {
  locked = true;
  clearCpuTimer();
  clearTurnSwitchTimer();
  cpuTimerId = window.setTimeout(() => {
    cpuTimerId = null;
    const aiPlayer = currentPlayer;
    if (!isAiPlayer(aiPlayer)) return;
    const skill = aiBattleMode ? randomBetween(0.68, 1.04) : opponentSkill;
    const move = chooseMove(board, getDynamicDifficulty(aiPlayer), turnNumber, skill, aiPlayer);
    if (move !== null) placeMove(move, aiPlayer);
    scheduleAdvanceTurn(aiBattleMode ? "AI 落子完成" : "ミク落子完成");
  }, aiBattleMode ? randomBetween(760, 1650) : randomBetween(1400, 3200));
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

function clearAiBattleRestartTimer() {
  if (aiBattleRestartTimerId === null) return;
  window.clearTimeout(aiBattleRestartTimerId);
  aiBattleRestartTimerId = null;
}

function clearAiBattleChoiceTimer() {
  if (aiBattleChoiceTimerId === null) return;
  window.clearTimeout(aiBattleChoiceTimerId);
  aiBattleChoiceTimerId = null;
}

function scheduleAdvanceTurn(statusText) {
  locked = true;
  awaitingAdvance = true;
  render(statusText);
  saveActiveGame(statusText);
  clearTurnSwitchTimer();
  turnSwitchTimerId = window.setTimeout(() => {
    turnSwitchTimerId = null;
    advanceTurn();
  }, TURN_SWITCH_DELAY);
}

function undoMove() {
  if (aiBattleMode || locked || !undoStack.length || undoUses >= MAX_UNDOS) return;
  const nextUndoUses = undoUses + 1;
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
  undoUses = nextUndoUses;
  hasUndone = true;
  multiLineMoves = { ...state.multiLineMoves };
  secretScores = { ...state.secretScores };
  secretCells = state.secretCells.slice();
  secretCellsSpawned = state.secretCellsSpawned;
  awaitingAdvance = false;
  render("已悔棋");
  saveActiveGame();
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
    undoUses,
    moveCounts: { ...moveCounts },
    multiLineMoves: { ...multiLineMoves },
    secretScores: { ...secretScores },
    secretCells: secretCells.slice(),
    secretCellsSpawned,
    awaitingAdvance
  });
}

function loadRecord() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECORD_KEY) || "null");
    if (!saved || typeof saved !== "object") return { games: 0, totalScore: 0 };
    return {
      games: Number.isFinite(saved.games) ? saved.games : 0,
      totalScore: Number.isFinite(saved.totalScore) ? saved.totalScore : 0
    };
  } catch {
    return { games: 0, totalScore: 0 };
  }
}

function saveRecord() {
  window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
}

function renderRecord() {
  return record;
}

function toggleMenu() {
  menuModalEl.hidden = !menuModalEl.hidden;
}

function closeMenuOnBackdrop(event) {
  if (event.target === menuModalEl) closeMenu();
}

function closeMenu() {
  menuModalEl.hidden = true;
}

function handleDifficultyChoice(event) {
  const option = event.target.closest(".difficulty-option");
  if (!option) return;
  setDifficulty(option.dataset.value);
  saveActiveGame();
  closeMenu();
}

function getDifficulty() {
  return difficultyOptionEls.find((option) => option.classList.contains("selected"))?.dataset.value || "auto";
}

function setDifficulty(value) {
  for (const option of difficultyOptionEls) {
    const selected = option.dataset.value === value;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-checked", selected ? "true" : "false");
  }
}

function addRecord(score) {
  record = {
    games: record.games + 1,
    totalScore: record.totalScore + score
  };
  saveRecord();
  renderRecord();
}

function saveActiveGame(statusText = "") {
  if (!firstPlayerScreenEl.hidden || !settlementEl.hidden) return;
  const state = {
    version: SAVE_VERSION,
    board,
    currentPlayer,
    humanPlayer,
    cpuPlayer,
    turnNumber,
    lastMove,
    lastFlips,
    lastComboFlips,
    previousBoard,
    opponentSkill,
    undoStack,
    undoUses,
    moveCounts,
    hasUndone,
    multiLineMoves,
    secretScores,
    secretPrizeCells,
    secretCells,
    secretCellsSpawned,
    awaitingAdvance,
    aiBattleMode,
    difficulty: getDifficulty(),
    statusText
  };
  window.localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

function clearSavedGame() {
  window.localStorage.removeItem(GAME_STATE_KEY);
}

function restoreGameState() {
  let saved;
  try {
    saved = JSON.parse(window.localStorage.getItem(GAME_STATE_KEY) || "null");
  } catch {
    clearSavedGame();
    return false;
  }
  if (!isValidSavedGame(saved)) {
    clearSavedGame();
    return false;
  }

  board = saved.board.slice();
  currentPlayer = saved.currentPlayer;
  humanPlayer = saved.humanPlayer;
  cpuPlayer = saved.cpuPlayer;
  turnNumber = saved.turnNumber;
  locked = false;
  lastMove = saved.lastMove;
  lastFlips = saved.lastFlips.slice();
  lastComboFlips = saved.lastComboFlips.slice();
  pendingAnimatedFlips = [];
  pendingComboFlips = [];
  previousBoard = saved.previousBoard.slice();
  opponentSkill = saved.opponentSkill;
  undoStack = saved.undoStack;
  undoUses = Number.isFinite(saved.undoUses) ? saved.undoUses : 0;
  moveCounts = { ...saved.moveCounts };
  hasUndone = saved.hasUndone;
  multiLineMoves = { ...saved.multiLineMoves };
  secretScores = { ...saved.secretScores };
  secretPrizeCells = saved.secretPrizeCells.slice();
  secretCells = saved.secretCells.slice();
  secretCellsSpawned = saved.secretCellsSpawned;
  awaitingAdvance = Boolean(saved.awaitingAdvance);
  aiBattleMode = Boolean(saved.aiBattleMode);
  aiBattleToggleEl.checked = aiBattleMode;
  setDifficulty(saved.difficulty || getDifficulty());
  settlementEl.hidden = true;
  firstPlayerScreenEl.hidden = true;
  pageEl.classList.remove("settlement-open", "round-restarting");
  renderScoreDiscs();

  if (awaitingAdvance) {
    scheduleAdvanceTurn(saved.statusText || "落子完成");
  } else {
    render(saved.statusText || getTurnStatusText());
    saveActiveGame(saved.statusText);
    if (isAiPlayer(currentPlayer)) queueAiMove();
  }
  revealApp();
  return true;
}

function revealApp() {
  window.requestAnimationFrame(() => {
    pageEl.classList.remove("app-booting");
  });
}

function isValidSavedGame(saved) {
  return Boolean(
    saved &&
      saved.version === SAVE_VERSION &&
      Array.isArray(saved.board) &&
      saved.board.length === 64 &&
      Array.isArray(saved.previousBoard) &&
      saved.previousBoard.length === 64 &&
      [BLACK, WHITE].includes(saved.humanPlayer) &&
      [BLACK, WHITE].includes(saved.cpuPlayer) &&
      (saved.currentPlayer === null || [BLACK, WHITE].includes(saved.currentPlayer))
  );
}

function render(statusText) {
  if (effectsLayerEl) effectsLayerEl.innerHTML = "";
  legalMoves = currentPlayer ? getLegalMoves(board, currentPlayer) : [];
  const scores = countPieces(board);
  const humanScore = humanPlayer === BLACK ? scores.black : scores.white;
  const cpuScore = cpuPlayer === BLACK ? scores.black : scores.white;
  blackScoreEl.textContent = String(humanScore);
  whiteScoreEl.textContent = String(cpuScore);
  turnBubbleEl.textContent = statusText || getTurnStatusText();
  humanPanelEl.classList.toggle("active-turn", currentPlayer === humanPlayer);
  cpuPanelEl.classList.toggle("active-turn", currentPlayer === cpuPlayer);
  messageEl.textContent = legalMoves.length ? `${legalMoves.length} 个可落子位置` : "无可落子位置";
  const remainingUndos = Math.max(0, MAX_UNDOS - undoUses);
  undoRemainingEl.textContent = String(remainingUndos);
  undoBtn.disabled = aiBattleMode || locked || !undoStack.length || remainingUndos <= 0;
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
    cell.disabled = aiBattleMode || locked || currentPlayer !== humanPlayer || !legalMoves.includes(index);
    cell.innerHTML = "";

    if (value && comboFlips.includes(index)) {
      appendNotes(index);
    }
    if (index === lastMove) cell.classList.add("last");
    if (animatedFlips.includes(index)) cell.classList.add("flip-flash");
  }
}

function renderBoardHints() {
  if (!effectsLayerEl || aiBattleMode || locked || currentPlayer !== humanPlayer) return;
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
  awaitingAdvance = false;
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
  clearSavedGame();
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
  addRecord(total);

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
  if (aiBattleMode) {
    clearAiBattleRestartTimer();
    aiBattleRestartTimerId = window.setTimeout(() => {
      aiBattleRestartTimerId = null;
      if (aiBattleMode && !settlementEl.hidden) restartGame(false, true);
    }, AI_BATTLE_RESTART_DELAY);
  }
}

init();
