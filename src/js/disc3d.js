import * as THREE from "three";
import { BLACK } from "./othello.js";

const SEGMENTS = 72;
const scoreRenderers = new WeakMap();

export function renderDisc(canvas, value, angle = 0) {
  if (angle === 0) {
    renderScoreStone3D(canvas, value);
    return;
  }
  const view = setupCanvas(canvas);
  drawGoStone(view.ctx, view.width, view.height, angle, palette(value), palette(value));
}

export function renderDiscFlip(canvas, fromValue, toValue, duration = 760) {
  const view = setupCanvas(canvas);
  const start = performance.now();
  const from = palette(fromValue);
  const to = palette(toValue);

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeInOutCubic(t);
    drawGoStone(view.ctx, view.width, view.height, Math.PI * eased, from, to);
    if (t < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 80;
  const height = rect.height || 80;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function drawGoStone(ctx, width, height, angle, frontColors, backColors) {
  ctx.clearRect(0, 0, width, height);
  const size = Math.min(width, height);
  const radius = size * 0.32;
  const thickness = size * 0.17;
  const cx = width / 2;
  const cy = height / 2 - size * 0.02;
  const camera = size * 2.8;
  const light = normalize([-0.35, -0.7, 0.62]);
  const faces = [];

  const frontEdge = [];
  const backEdge = [];
  for (let i = 0; i < SEGMENTS; i += 1) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius * 0.96;
    frontEdge.push(makePoint(x, y, convexDepth(x, y, radius, thickness), angle, cx, cy, camera));
    backEdge.push(makePoint(x, y, -convexDepth(x, y, radius, thickness), angle, cx, cy, camera));
  }

  for (let i = 0; i < SEGMENTS; i += 1) {
    const next = (i + 1) % SEGMENTS;
    const mid = ((i + 0.5) / SEGMENTS) * Math.PI * 2;
    const normal = normalize(rotateY([Math.cos(mid), Math.sin(mid) * 0.25, 0.36], angle));
    const shade = Math.max(0.18, dot(normal, light) * 0.56 + 0.48);
    faces.push({
      z: avgZ([frontEdge[i], frontEdge[next], backEdge[next], backEdge[i]]),
      path: [frontEdge[i], frontEdge[next], backEdge[next], backEdge[i]],
      fill: shadeColor("#0f7e82", shade),
      stroke: "rgba(2, 35, 39, 0.22)",
      lineWidth: 1
    });
  }

  const frontNormal = rotateY([0, 0, 1], angle);
  const backNormal = rotateY([0, 0, -1], angle);
  faces.push({
    z: avgZ(frontEdge),
    path: frontEdge,
    fill: faceGradient(ctx, cx, cy, radius, frontNormal[2] >= 0 ? frontColors : backColors),
    stroke: "rgba(0,0,0,0)",
    lineWidth: 0,
    selfShadow: true
  });
  faces.push({
    z: avgZ(backEdge),
    path: backEdge,
    fill: faceGradient(ctx, cx, cy, radius, backNormal[2] >= 0 ? backColors : frontColors),
    stroke: "rgba(0,0,0,0)",
    lineWidth: 0,
    selfShadow: true
  });

  drawShadow(ctx, cx, cy, radius, angle);
  faces.sort((a, b) => a.z - b.z);
  for (const face of faces) drawFace(ctx, face, cx, cy, radius);
}

function renderScoreStone3D(canvas, value) {
  const view = getScoreStoneView(canvas);
  const rect = canvas.getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width || 80, rect.height || 80));
  view.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  view.renderer.setSize(size, size, false);
  view.mesh.material = value === BLACK ? view.blackMaterial : view.whiteMaterial;
  view.renderer.render(view.scene, view.camera);
}

function getScoreStoneView(canvas) {
  if (scoreRenderers.has(canvas)) return scoreRenderers.get(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.56, 0.56, 0.56, -0.56, 0.1, 100);
  camera.position.set(0, 8.8, 2.45);
  camera.lookAt(0, 0, 0);

  const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x06191d, roughness: 0.42, metalness: 0.08 });
  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xf2fbfa, roughness: 0.52, metalness: 0.02 });

  const shadowMaterial = new THREE.ShadowMaterial({ color: 0x032b2f, opacity: 0.34 });
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), shadowMaterial);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.004;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  const geometry = new THREE.SphereGeometry(0.38, 40, 18);
  geometry.scale(1, 0.22, 1);
  const mesh = new THREE.Mesh(geometry, blackMaterial);
  mesh.position.y = 0.18;
  mesh.castShadow = true;
  scene.add(mesh);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x087d83, 0.86));
  const light = new THREE.DirectionalLight(0xffffff, 3.35);
  light.position.set(-3.2, 7.2, -5.4);
  light.castShadow = true;
  light.shadow.mapSize.set(1536, 1536);
  light.shadow.camera.left = -6;
  light.shadow.camera.right = 6;
  light.shadow.camera.top = 6;
  light.shadow.camera.bottom = -6;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 18;
  scene.add(light);

  const view = { renderer, scene, camera, mesh, blackMaterial, whiteMaterial };
  scoreRenderers.set(canvas, view);
  return view;
}

function makePoint(x, y, z, angle, cx, cy, camera) {
  return project(rotateY([x, y, z], angle), cx, cy, camera);
}

function convexDepth(x, y, radius, thickness) {
  const d = Math.min(1, Math.hypot(x / radius, y / (radius * 0.96)));
  return thickness * (0.38 + 0.62 * Math.sqrt(Math.max(0, 1 - d * d)));
}

function drawFace(ctx, face, cx, cy, radius) {
  ctx.beginPath();
  ctx.moveTo(face.path[0].x, face.path[0].y);
  for (let i = 1; i < face.path.length; i += 1) ctx.lineTo(face.path[i].x, face.path[i].y);
  ctx.closePath();
  ctx.fillStyle = face.fill;
  ctx.fill();
  if (face.lineWidth > 0) {
    ctx.lineWidth = face.lineWidth;
    ctx.strokeStyle = face.stroke;
    ctx.stroke();
  }
  if (face.selfShadow) drawLowerSelfShadow(ctx, face.path, cx, cy, radius);
}

function drawLowerSelfShadow(ctx, path, cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
  ctx.closePath();
  ctx.clip();

  const gradient = ctx.createLinearGradient(cx, cy - radius * 0.25, cx, cy + radius * 0.95);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.48, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.78, "rgba(0, 0, 0, 0.22)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 0.34, radius * 0.92, radius * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShadow(ctx, cx, cy, radius, angle) {
  ctx.save();
  ctx.fillStyle = "rgba(5, 43, 48, 0.32)";
  ctx.beginPath();
  ctx.ellipse(cx + radius * 0.28, cy + radius * 0.78, radius * (0.76 + Math.abs(Math.sin(angle)) * 0.18), radius * 0.2, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function project(point, cx, cy, camera) {
  const scale = camera / (camera - point[2]);
  return { x: cx + point[0] * scale, y: cy + point[1] * scale, z: point[2] };
}

function rotateY(point, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [point[0] * c + point[2] * s, point[1], -point[0] * s + point[2] * c];
}

function faceGradient(ctx, cx, cy, radius, colors) {
  const gradient = ctx.createRadialGradient(cx - radius * 0.48, cy - radius * 0.48, radius * 0.08, cx + radius * 0.2, cy + radius * 0.18, radius * 1.08);
  gradient.addColorStop(0, colors.highlight);
  gradient.addColorStop(0.38, colors.mid);
  gradient.addColorStop(1, colors.edge);
  return gradient;
}

function palette(value) {
  return value === BLACK
    ? { highlight: "#40676d", mid: "#08262c", edge: "#010d10" }
    : { highlight: "#ffffff", mid: "#edf8f7", edge: "#b8d4d2" };
}

function shadeColor(hex, shade) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * shade);
  const g = Math.round(((n >> 8) & 255) * shade);
  const b = Math.round((n & 255) * shade);
  return `rgb(${r}, ${g}, ${b})`;
}

function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map((n) => n / length);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function avgZ(points) {
  return points.reduce((sum, point) => sum + point.z, 0) / points.length;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
