import * as THREE from "three";
import { BLACK, SIZE } from "./othello.js";

const FLIP_START_DELAY = 300;
const STONE_GEOMETRY_SEGMENTS = 64;
const STONE_GEOMETRY_RINGS = 28;

export class ThreeBoardScene {
  constructor(host, sounds = {}) {
    this.host = host;
    this.meshes = new Map();
    this.flips = [];
    this.placePulses = [];
    this.sounds = sounds;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "board-webgl";
    host.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-4.33, 4.33, 4.33, -4.33, 0.1, 100);
    this.camera.position.set(0, 8.8, 2.45);
    this.camera.lookAt(0, 0, 0);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hitPoint = new THREE.Vector3();

    this.blackMaterial = createGlossyStoneMaterial(0x06191d, {
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.82,
      clearcoatRoughness: 0.08
    });
    this.whiteMaterial = createGlossyStoneMaterial(0xf2fbfa, {
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 0.72,
      clearcoatRoughness: 0.06
    });
    this.hints = new THREE.Group();
    this.secretTiles = new THREE.Group();
    this.secretTilePhases = new Map();
    this.scene.add(this.hints);
    this.scene.add(this.secretTiles);
    this.secretTileTexture = createSecretTileTexture();

    this.buildBoard();
    this.buildLights();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.animate();
  }

  update(board, legalMoves, lastMove, previousBoard, flipped, secretMoves = []) {
    this.hints.clear();
    this.secretTiles.clear();
    for (const move of legalMoves) this.addHint(move, "legal");
    for (const move of secretMoves) this.addSecretTile(move);
    const orderedFlips = flipped
      .slice()
      .sort((a, b) => distanceFromMove(a, lastMove) - distanceFromMove(b, lastMove));
    const flipDelays = new Map(orderedFlips.map((index, order) => [index, FLIP_START_DELAY + order * 100]));
    const flipOrders = new Map(orderedFlips.map((index, order) => [index, order]));

    const live = new Set();
    const now = performance.now();
    for (let i = 0; i < board.length; i += 1) {
      if (!board[i]) continue;
      live.add(i);
      const mesh = this.ensureStone(i, board[i]);
      const material = board[i] === BLACK ? this.blackMaterial : this.whiteMaterial;
      if (flipped.includes(i)) {
        mesh.material = previousBoard[i] === BLACK ? this.blackMaterial : this.whiteMaterial;
        this.flips.push({
          mesh,
          to: material,
          start: now + (flipDelays.get(i) || 0),
          swapped: false,
          sounded: false,
          volume: flipVolume(flipOrders.get(i) || 0)
        });
      } else {
        mesh.material = material;
        mesh.rotation.z = 0;
      }
      mesh.userData.targetScale = 1;
      if (i === lastMove && previousBoard[i] === 0 && flipped.length) {
        this.placePulses.push({ mesh, start: now, sounded: false });
      }
    }

    for (const [index, mesh] of this.meshes) {
      if (!live.has(index)) {
        this.scene.remove(mesh);
        this.meshes.delete(index);
      }
    }
  }

  reset() {
    this.hints.clear();
    this.secretTiles.clear();
    this.flips = [];
    this.placePulses = [];
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry?.dispose();
    }
    this.meshes.clear();
  }

  buildBoard() {
    const shadowMaterial = new THREE.ShadowMaterial({ color: 0x062f34, opacity: 0.2 });
    const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(9.1, 9.1), shadowMaterial);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -0.28;
    shadowCatcher.receiveShadow = true;
    this.scene.add(shadowCatcher);

    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x127595, roughness: 0.78 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.16, 8.2), boardMaterial);
    board.position.y = -0.1;
    board.castShadow = true;
    board.receiveShadow = true;
    this.scene.add(board);

    const tileMaterials = [
      new THREE.MeshStandardMaterial({ color: cssHexColor("--board-tile-a", 0x23d4d0), roughness: 0.82 }),
      new THREE.MeshStandardMaterial({ color: cssHexColor("--board-tile-b", 0x17bfc2), roughness: 0.82 })
    ];
    const tileGeometry = new THREE.PlaneGeometry(0.985, 0.985);
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const tile = new THREE.Mesh(tileGeometry, tileMaterials[(row + col) % 2]);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(col - 3.5, 0.004, row - 3.5);
        tile.receiveShadow = true;
        this.scene.add(tile);
      }
    }

  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x087d83, 0.9));
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
    this.scene.add(light);

    const rimLight = new THREE.DirectionalLight(0xb8fff5, 1.25);
    rimLight.position.set(4.5, 4.4, 4.8);
    this.scene.add(rimLight);
  }

  ensureStone(index, value) {
    if (this.meshes.has(index)) return this.meshes.get(index);
    const geometry = new THREE.SphereGeometry(0.4, STONE_GEOMETRY_SEGMENTS, STONE_GEOMETRY_RINGS);
    geometry.scale(1, 0.22, 1);
    const mesh = new THREE.Mesh(geometry, value === BLACK ? this.blackMaterial : this.whiteMaterial);
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    mesh.position.set(col - 3.5, 0.18, row - 3.5);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    this.meshes.set(index, mesh);
    this.scene.add(mesh);
    return mesh;
  }

  addHint(index, kind) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const group = new THREE.Group();
    group.position.set(col - 3.5, 0, row - 3.5);
    group.userData.phase = Math.random() * Math.PI * 2;
    group.userData.fadeStart = performance.now() + 300;

    const hintMaterial = new THREE.MeshBasicMaterial({
      color: kind === "secret" ? 0xffef63 : 0xb7fff1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });
    const hint = new THREE.Mesh(new THREE.CircleGeometry(kind === "secret" ? 0.34 : 0.17, 40), hintMaterial);
    hint.rotation.x = -Math.PI / 2;
    hint.position.y = 0.032;
    hint.renderOrder = 1;
    hint.userData.baseOpacity = kind === "secret" ? 0.86 : 0.72;
    group.add(hint);

    this.hints.add(group);
  }

  addSecretTile(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const material = new THREE.MeshBasicMaterial({
      map: this.secretTileTexture,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.985, 0.985), material);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(col - 3.5, 0.02, row - 3.5);
    if (!this.secretTilePhases.has(index)) this.secretTilePhases.set(index, Math.random() * Math.PI * 2);
    tile.userData.phase = this.secretTilePhases.get(index);
    this.secretTiles.add(tile);
  }

  indexFromClientPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.boardPlane, this.hitPoint)) return null;
    const col = Math.floor(this.hitPoint.x + 4);
    const row = Math.floor(this.hitPoint.z + 4);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return row * SIZE + col;
  }

  screenPointForIndex(index) {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const point = new THREE.Vector3(col - 3.5, 0.035, row - 3.5).project(this.camera);
    return {
      x: ((point.x + 1) / 2) * 100,
      y: ((1 - point.y) / 2) * 100
    };
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    this.flips = this.flips.filter((flip) => {
      const t = Math.max(0, Math.min(1, (now - flip.start) / 372));
      flip.mesh.rotation.z = Math.PI * easeFlip1231(t);
      flip.mesh.position.y = 0.18 + Math.sin(Math.PI * t) * 0.18;
      if (t >= 0.5 && !flip.swapped) {
        flip.mesh.material = flip.to;
        flip.swapped = true;
      }
      if (t >= 1) {
        flip.mesh.rotation.z = 0;
        flip.mesh.position.y = 0.18;
        if (!flip.sounded) {
          this.sounds.onFlip?.(flip.volume);
          flip.sounded = true;
        }
        return false;
      }
      return true;
    });
    this.placePulses = this.placePulses.filter((pulse) => {
      const t = Math.max(0, Math.min(1, (now - pulse.start) / 260));
      const scale = t < 0.42 ? 1 + 0.05 * easeOut(t / 0.42) : 1.05 - 0.05 * easeInOut((t - 0.42) / 0.58);
      pulse.mesh.scale.setScalar(scale);
      if (t >= 1) {
        pulse.mesh.scale.setScalar(1);
        return false;
      }
      return true;
    });
    for (const mesh of this.meshes.values()) {
      if (this.placePulses.some((pulse) => pulse.mesh === mesh)) continue;
      const target = mesh.userData.targetScale || 1;
      mesh.scale.lerp(new THREE.Vector3(target, target, target), 0.18);
    }
    for (const hint of this.hints.children) {
      const pulse = (Math.sin(now * 0.0032 + hint.userData.phase) + 1) * 0.5;
      const fade = Math.max(0, Math.min(1, (now - hint.userData.fadeStart) / 360));
      for (const child of hint.children) {
        if (child.material?.transparent && child.userData.baseOpacity) {
          child.material.opacity = child.userData.baseOpacity * fade * (0.45 + pulse * 0.55);
        }
      }
    }
    for (const tile of this.secretTiles.children) {
      const pulse = (Math.sin(now * 0.0032 + tile.userData.phase) + 1) * 0.5;
      tile.material.opacity = 0.28 + pulse * 0.36;
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const rect = this.host.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    this.renderer.setSize(size, size, false);
  }
}

function createGlossyStoneMaterial(color, options) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness,
    metalness: options.metalness,
    clearcoat: options.clearcoat,
    clearcoatRoughness: options.clearcoatRoughness,
    reflectivity: 0.64,
    specularIntensity: 1.15,
    specularColor: 0xffffff
  });
}

function easeFlip1231(t) {
  const segments = [
    { end: 1 / 7, distance: 1 / 7 },
    { end: 3 / 7, distance: 2 / 7 },
    { end: 6 / 7, distance: 3 / 7 },
    { end: 1, distance: 1 / 7 }
  ];
  let start = 0;
  let value = 0;
  for (const segment of segments) {
    if (t <= segment.end) {
      const local = (t - start) / (segment.end - start);
      return value + segment.distance * smoothStep(local);
    }
    start = segment.end;
    value += segment.distance;
  }
  return 1;
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function flipVolume(order) {
  return Math.max(0.22, 1 - order * 0.12);
}

function distanceFromMove(index, move) {
  if (move === null || move === undefined) return 0;
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const moveRow = Math.floor(move / SIZE);
  const moveCol = move % SIZE;
  return Math.max(Math.abs(row - moveRow), Math.abs(col - moveCol));
}

function createSecretTileTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const glow = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size * 0.72);
  glow.addColorStop(0, "rgba(194, 255, 244, 0.42)");
  glow.addColorStop(0.46, "rgba(90, 240, 218, 0.24)");
  glow.addColorStop(1, "rgba(194, 255, 244, 0.08)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.lineWidth = 8;
  for (let x = -size; x < size * 2; x += 22) {
    ctx.strokeStyle = "rgba(194, 255, 244, 0.68)";
    ctx.beginPath();
    ctx.moveTo(x, size);
    ctx.lineTo(x + size, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(58, 218, 205, 0.52)";
    ctx.beginPath();
    ctx.moveTo(x + 10, size);
    ctx.lineTo(x + size + 10, 0);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function cssHexColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!/^#[0-9a-f]{6}$/i.test(value)) return fallback;
  return Number(`0x${value.slice(1)}`);
}
