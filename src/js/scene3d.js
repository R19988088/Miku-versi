import { BLACK, WHITE, SIZE } from "./othello.js";

export function renderBoardScene(canvas, board, legalMoves, lastMove) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = rect.width || 720;
  const height = rect.height || 720;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = width * 0.02;
  const cell = (width - pad * 2) / SIZE;
  drawBoard(ctx, pad, cell);

  for (let i = 0; i < board.length; i += 1) {
    if (legalMoves.includes(i) && board[i] === 0) drawHint(ctx, i, pad, cell);
    if (board[i]) drawStone(ctx, i, board[i], pad, cell, i === lastMove);
  }
}

function drawBoard(ctx, pad, cell) {
  ctx.fillStyle = "#16c3c0";
  ctx.fillRect(0, 0, cell * SIZE + pad * 2, cell * SIZE + pad * 2);
  ctx.strokeStyle = "rgba(210, 255, 250, 0.26)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i <= SIZE; i += 1) {
    const p = pad + i * cell;
    ctx.beginPath();
    ctx.moveTo(p, pad);
    ctx.lineTo(p, pad + SIZE * cell);
    ctx.moveTo(pad, p);
    ctx.lineTo(pad + SIZE * cell, p);
    ctx.stroke();
  }
}

function drawHint(ctx, index, pad, cell) {
  const [cx, cy] = center(index, pad, cell);
  ctx.strokeStyle = "rgba(255, 246, 86, 0.78)";
  ctx.lineWidth = Math.max(2, cell * 0.035);
  ctx.setLineDash([cell * 0.08, cell * 0.06]);
  ctx.beginPath();
  ctx.ellipse(cx, cy - cell * 0.02, cell * 0.2, cell * 0.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawStone(ctx, index, value, pad, cell, selected) {
  const [cx, cy] = center(index, pad, cell);
  const rx = cell * 0.33;
  const ry = cell * 0.25;
  const topY = cy - cell * 0.05;
  const bottomY = cy + cell * 0.08;

  ctx.fillStyle = "rgba(3, 43, 47, 0.34)";
  ctx.beginPath();
  ctx.ellipse(cx, bottomY + cell * 0.12, rx * 0.9, ry * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const side = ctx.createLinearGradient(cx, topY, cx, bottomY + ry);
  side.addColorStop(0, value === BLACK ? "#123a40" : "#e6f0ef");
  side.addColorStop(1, value === BLACK ? "#020d10" : "#9db8b6");
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, topY);
  ctx.ellipse(cx, topY, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  const face = ctx.createRadialGradient(cx - rx * 0.32, topY - ry * 0.42, rx * 0.08, cx, topY + ry * 0.1, rx);
  if (value === BLACK) {
    face.addColorStop(0, "#426b70");
    face.addColorStop(0.45, "#08282d");
    face.addColorStop(1, "#010b0e");
  } else {
    face.addColorStop(0, "#ffffff");
    face.addColorStop(0.48, "#eef8f7");
    face.addColorStop(1, "#bdd6d4");
  }
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  if (selected) {
    ctx.strokeStyle = "#ffe64d";
    ctx.lineWidth = Math.max(4, cell * 0.06);
    ctx.strokeRect(cx - cell * 0.43, cy - cell * 0.43, cell * 0.86, cell * 0.86);
  }
}

function center(index, pad, cell) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  return [pad + col * cell + cell / 2, pad + row * cell + cell / 2];
}
