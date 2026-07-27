"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "title" | "playing" | "won" | "dead";
type ZoneId = "grove" | "fields" | "ruins";
type PlayerAction = "idle" | "run" | "slash" | "special" | "dash";
type EnemyKind = "wisp" | "hound" | "golem" | "archer" | "boss";
type Enemy = {
  id: number;
  kind: EnemyKind;
  element: "fire" | "nature" | "water" | "void";
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  cooldown: number;
  hitFlash: number;
  dead?: boolean;
};
type Fx = {
  kind: "slash" | "spin" | "burst" | "beam" | "phantom" | "hit" | "loot" | "projectile";
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life: number;
  max: number;
  radius: number;
  color: string;
};
type SpritePack = {
  warrior?: HTMLImageElement;
  warriorSheet?: HTMLImageElement;
  boss?: HTMLImageElement;
  wisp?: HTMLImageElement;
  hound?: HTMLImageElement;
  golem?: HTMLImageElement;
  archer?: HTMLImageElement;
  luma?: HTMLImageElement;
  vey?: HTMLImageElement;
  elder?: HTMLImageElement;
};
type Game = {
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    angle: number;
    invuln: number;
    action: PlayerAction;
    actionTime: number;
    actionDuration: number;
    combo: number;
    comboTimer: number;
    trail: { x: number; y: number; life: number }[];
  };
  zone: ZoneId;
  zoneEnemies: Record<ZoneId, Enemy[]>;
  enemies: Enemy[];
  fx: Fx[];
  keys: Set<string>;
  pointer: { x: number; y: number; down: boolean };
  cooldowns: number[];
  kills: number;
  shards: number;
  wave: number;
  time: number;
  camera: { x: number; y: number };
  last: number;
  shake: number;
  bossAwake: boolean;
  bossDefeated: boolean;
  chestOpened: boolean;
  discovered: Set<ZoneId>;
};

type DialogueId = "elder" | "luma" | "vey" | "shrine" | "chest" | "archive" | "gate";
type Dialogue = { id: DialogueId; speaker: string; title: string; body: string };
type Point = [number, number];
type Collider =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; x: number; y: number; radius: number };

const W = 1280;
const H = 720;
const WORLD_W = 1800;
const WORLD_H = 1013;
const COLORS = {
  fire: "#ff743d",
  nature: "#9bd04e",
  water: "#55c8ff",
  void: "#b266ff",
};

const rand = (n: number) => {
  const x = Math.sin(n * 999.91) * 43758.5453;
  return x - Math.floor(x);
};

const ZONE_NAMES: Record<ZoneId, { region: string; area: string }> = {
  grove: { region: "WHISPERING GROVE", area: "OVERGROWN PASS" },
  fields: { region: "SILENT FIELDS", area: "WINDMILL CROSSING" },
  ruins: { region: "ANCIENT RUINS", area: "ARCHIVE COURT" },
};

const WALKABLE: Record<ZoneId, Point[][]> = {
  grove: [
    [[110, 365], [310, 250], [530, 150], [760, 220], [990, 145], [1440, 140], [1635, 325], [1745, 470], [1745, 735], [1580, 875], [1210, 900], [900, 850], [600, 950], [275, 865], [95, 665]],
    [[805, 55], [1010, 55], [1060, 280], [770, 285]],
    [[1460, 410], [1745, 410], [1745, 780], [1430, 825]],
  ],
  fields: [
    [[55, 335], [300, 150], [600, 85], [1010, 70], [1370, 125], [1610, 275], [1745, 445], [1745, 735], [1540, 925], [950, 945], [360, 930], [55, 765]],
    [[55, 430], [330, 420], [330, 735], [55, 745]],
  ],
  ruins: [
    [[55, 335], [310, 235], [610, 305], [810, 290], [945, 185], [1240, 180], [1585, 285], [1745, 425], [1700, 640], [1430, 765], [1170, 735], [1090, 925], [735, 925], [640, 805], [245, 835], [55, 675]],
    [[770, 700], [1090, 700], [1090, 958], [770, 958]],
  ],
};

const COLLIDERS: Record<ZoneId, Collider[]> = {
  grove: [
    { kind: "circle", x: 490, y: 250, radius: 78 },
    { kind: "rect", x: 1140, y: 90, w: 330, h: 185 },
    { kind: "circle", x: 1290, y: 610, radius: 125 },
    { kind: "rect", x: 850, y: 790, w: 285, h: 150 },
    { kind: "circle", x: 1160, y: 250, radius: 24 },
  ],
  fields: [
    { kind: "rect", x: 245, y: 75, w: 285, h: 280 },
    { kind: "rect", x: 1120, y: 620, w: 350, h: 240 },
    { kind: "circle", x: 1535, y: 520, radius: 118 },
    { kind: "rect", x: 1460, y: 650, w: 270, h: 260 },
  ],
  ruins: [
    { kind: "circle", x: 1120, y: 300, radius: 68 },
    { kind: "rect", x: 650, y: 55, w: 270, h: 250 },
    { kind: "rect", x: 1210, y: 50, w: 235, h: 270 },
    { kind: "rect", x: 1490, y: 105, w: 310, h: 285 },
    { kind: "rect", x: 1325, y: 570, w: 475, h: 410 },
    { kind: "rect", x: 610, y: 780, w: 210, h: 220 },
    { kind: "rect", x: 1085, y: 760, w: 195, h: 250 },
    { kind: "circle", x: 380, y: 300, radius: 58 },
  ],
};

const FOREGROUND_LAYERS: Record<ZoneId, Point[][]> = {
  grove: [
    [[690, 790], [820, 735], [1040, 720], [1295, 790], [1280, 940], [1050, 855], [820, 860]],
    [[245, 230], [430, 160], [650, 260], [630, 405], [360, 435], [230, 345]],
    [[1125, 145], [1470, 105], [1490, 315], [1160, 315]],
  ],
  fields: [
    [[235, 160], [500, 100], [545, 370], [230, 400]],
    [[1095, 650], [1465, 620], [1490, 900], [1080, 890]],
    [[1370, 440], [1745, 545], [1745, 770], [1510, 700]],
  ],
  ruins: [
    [[1280, 545], [1745, 485], [1800, 1013], [1235, 1013]],
    [[585, 755], [1240, 735], [1320, 1013], [500, 1013]],
    [[625, 40], [930, 30], [945, 315], [625, 330]],
    [[1190, 35], [1465, 30], [1480, 350], [1180, 340]],
  ],
};

const TILE = 60;
const MAP_COLS = 30;
const MAP_ROWS = 17;
type TileCode = "#" | "T" | "~" | "^" | "." | "," | ":" | "=" | "C" | "G" | "W" | "V" | "H" | "B" | "X";

function createTileMap(fill: TileCode) {
  return Array.from({ length: MAP_ROWS }, () => Array<TileCode>(MAP_COLS).fill(fill));
}

function paintEllipse(map: TileCode[][], cx: number, cy: number, rx: number, ry: number, tile: TileCode) {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (((col - cx) / rx) ** 2 + ((row - cy) / ry) ** 2 <= 1) map[row][col] = tile;
    }
  }
}

function paintRect(map: TileCode[][], x: number, y: number, w: number, h: number, tile: TileCode) {
  for (let row = Math.max(0, y); row < Math.min(MAP_ROWS, y + h); row++) {
    for (let col = Math.max(0, x); col < Math.min(MAP_COLS, x + w); col++) map[row][col] = tile;
  }
}

function buildTileMaps(): Record<ZoneId, TileCode[][]> {
  const grove = createTileMap("T");
  paintEllipse(grove, 14, 8, 12, 7, ",");
  paintRect(grove, 13, 0, 3, 7, ":");
  paintRect(grove, 13, 8, 17, 3, ":");
  paintRect(grove, 5, 7, 14, 3, ":");
  paintEllipse(grove, 21, 11, 4, 3, "~");
  paintRect(grove, 17, 10, 9, 2, "=");
  paintRect(grove, 19, 2, 5, 3, ",");
  grove[4][7] = "C";
  grove[4][20] = "H";
  grove[6][4] = "#";
  grove[12][7] = "#";
  grove[5][25] = "#";

  const fields = createTileMap("T");
  paintEllipse(fields, 14, 8, 13, 7, ",");
  paintRect(fields, 0, 8, 18, 3, ":");
  paintRect(fields, 12, 2, 3, 13, ":");
  paintRect(fields, 18, 7, 12, 3, ":");
  paintRect(fields, 26, 5, 4, 9, "~");
  paintRect(fields, 23, 8, 7, 2, "=");
  paintRect(fields, 5, 2, 3, 3, "X");
  fields[3][6] = "W";
  paintRect(fields, 19, 11, 4, 3, "X");
  fields[12][20] = "V";
  fields[2][14] = "B";
  fields[5][4] = "#";
  fields[13][8] = "#";
  fields[4][22] = "#";

  const ruins = createTileMap("^");
  paintEllipse(ruins, 14, 8, 12, 6, ".");
  paintRect(ruins, 2, 7, 13, 3, ".");
  paintRect(ruins, 14, 7, 16, 3, ".");
  paintRect(ruins, 14, 8, 3, 9, ".");
  paintRect(ruins, 15, 3, 4, 6, ".");
  paintRect(ruins, 7, 2, 2, 4, "#");
  paintRect(ruins, 20, 2, 2, 4, "#");
  paintRect(ruins, 5, 11, 3, 2, "#");
  paintRect(ruins, 21, 11, 4, 3, "#");
  ruins[4][17] = "C";
  ruins[7][27] = "G";
  ruins[5][5] = "#";
  ruins[12][12] = "#";
  return { grove, fields, ruins };
}

const TILE_MAPS = buildTileMaps();
const SOLID_TILES = new Set<TileCode>(["#", "T", "~", "^", "C", "G", "W", "V", "H", "B", "X"]);

function pointInPolygon(x: number, y: number, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointBlocked(zone: ZoneId, x: number, y: number) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return true;
  return SOLID_TILES.has(TILE_MAPS[zone][row][col]);
}

function isBlocked(zone: ZoneId, x: number, y: number, radius = 25) {
  const samples: Point[] = [
    [x, y],
    [x + radius, y],
    [x - radius, y],
    [x, y + radius],
    [x, y - radius],
    [x + radius * 0.7, y + radius * 0.7],
    [x - radius * 0.7, y + radius * 0.7],
    [x + radius * 0.7, y - radius * 0.7],
    [x - radius * 0.7, y - radius * 0.7],
  ];
  return samples.some(([sx, sy]) => isPointBlocked(zone, sx, sy));
}

function moveWithCollision(zone: ZoneId, x: number, y: number, dx: number, dy: number, radius = 25) {
  let nextX = x;
  let nextY = y;
  if (!isBlocked(zone, x + dx, y, radius)) nextX = x + dx;
  if (!isBlocked(zone, nextX, y + dy, radius)) nextY = y + dy;
  return { x: nextX, y: nextY, blocked: nextX === x && nextY === y && (dx !== 0 || dy !== 0) };
}

function castVisibility(zone: ZoneId, x: number, y: number, maxDistance = 470) {
  const points: Point[] = [];
  const rays = 112;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    let distance = 28;
    for (; distance < maxDistance; distance += 14) {
      const rx = x + Math.cos(angle) * distance;
      const ry = y + Math.sin(angle) * distance;
      if (isPointBlocked(zone, rx, ry)) break;
    }
    points.push([
      x + Math.cos(angle) * Math.min(distance, maxDistance),
      y + Math.sin(angle) * Math.min(distance, maxDistance),
    ]);
  }
  return points;
}

function drawRaycastLighting(c: CanvasRenderingContext2D, game: Game) {
  const points = castVisibility(game.zone, game.player.x, game.player.y);
  c.save();
  c.fillStyle = "rgba(1,5,8,.28)";
  c.beginPath();
  c.rect(0, 0, WORLD_W, WORLD_H);
  c.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => c.lineTo(x, y));
  c.closePath();
  c.fill("evenodd");
  const light = c.createRadialGradient(game.player.x, game.player.y, 25, game.player.x, game.player.y, 255);
  light.addColorStop(0, "rgba(255,231,165,.12)");
  light.addColorStop(0.55, "rgba(135,187,180,.04)");
  light.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = light;
  c.beginPath();
  c.arc(game.player.x, game.player.y, 255, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function makeEnemies(zone: ZoneId): Enemy[] {
  const kinds: EnemyKind[] = ["wisp", "hound", "golem", "archer"];
  const kindElements: Record<Exclude<EnemyKind, "boss">, Enemy["element"]> = {
    wisp: "void",
    hound: "fire",
    golem: "water",
    archer: "nature",
  };
  const result: Enemy[] = [];
  const count = zone === "grove" ? 6 : zone === "fields" ? 6 : 5;
  const seed = zone === "grove" ? 0 : zone === "fields" ? 100 : 200;
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    const maxHp = kind === "golem" ? 150 : kind === "hound" ? 85 : 65;
    let spawnX = 230 + rand(i + 9 + seed) * (WORLD_W - 460);
    let spawnY = 190 + rand(i + 31 + seed) * (WORLD_H - 380);
    for (let attempt = 0; attempt < 12 && isBlocked(zone, spawnX, spawnY, 34); attempt++) {
      spawnX = 180 + rand(i + seed + attempt * 17) * (WORLD_W - 360);
      spawnY = 170 + rand(i + seed + attempt * 29) * (WORLD_H - 340);
    }
    result.push({
      id: seed + i,
      kind,
      element: kindElements[kind],
      x: spawnX,
      y: spawnY,
      hp: maxHp,
      maxHp,
      radius: kind === "golem" ? 34 : kind === "hound" ? 24 : 20,
      speed: kind === "golem" ? 45 : kind === "hound" ? 105 : 72,
      cooldown: rand(i) * 2,
      hitFlash: 0,
    });
  }
  if (zone === "grove") result.push({
    id: 99,
    kind: "boss",
    element: "nature",
    x: 1450,
    y: 480,
    hp: 950,
    maxHp: 950,
    radius: 67,
    speed: 48,
    cooldown: 2,
    hitFlash: 0,
  });
  return result;
}

function freshGame(): Game {
  const zoneEnemies = {
    grove: makeEnemies("grove"),
    fields: makeEnemies("fields"),
    ruins: makeEnemies("ruins"),
  };
  return {
    player: {
      x: 520,
      y: 610,
      hp: 560,
      maxHp: 560,
      energy: 300,
      maxEnergy: 300,
      angle: 0,
      invuln: 0,
      action: "idle",
      actionTime: 0,
      actionDuration: 0,
      combo: 0,
      comboTimer: 0,
      trail: [],
    },
    zone: "grove",
    zoneEnemies,
    enemies: zoneEnemies.grove,
    fx: [],
    keys: new Set(),
    pointer: { x: W / 2, y: H / 2, down: false },
    cooldowns: [0, 0, 0, 0],
    kills: 0,
    shards: 0,
    wave: 1,
    time: 0,
    camera: { x: 0, y: 0 },
    last: performance.now(),
    shake: 0,
    bossAwake: false,
    bossDefeated: false,
    chestOpened: false,
    discovered: new Set<ZoneId>(["grove"]),
  };
}

function path(
  c: CanvasRenderingContext2D,
  points: [number, number][],
  fill: string,
  stroke?: string,
) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}

function drawWarrior(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  t: number,
  ghost = false,
  sprite?: HTMLImageElement,
  sheet?: HTMLImageElement,
  action: PlayerAction = "idle",
  actionTime = 0,
  actionDuration = 0,
) {
  c.save();
  c.translate(x, y);
  c.globalAlpha = ghost ? 0.18 : 1;
  const bob = action === "run" ? Math.sin(t * 13) * 3 : action === "idle" ? Math.sin(t * 4) * 2 : 0;
  c.translate(0, bob);
  if (sheet?.complete && sheet.naturalWidth) {
    const sw = sheet.naturalWidth / 4;
    const sh = sheet.naturalHeight / 4;
    const row = action === "run" || action === "dash" ? 1 : action === "slash" ? 2 : action === "special" ? 3 : 0;
    const progress = actionDuration > 0 ? 1 - actionTime / actionDuration : 0;
    const frame = action === "idle"
      ? Math.floor(t * 2.4) % 4
      : action === "run" || action === "dash"
        ? Math.floor(t * 10) % 4
        : Math.max(0, Math.min(3, Math.floor(progress * 4)));
    if (action === "run") c.rotate(Math.sin(t * 13) * 0.025);
    if (action === "dash") {
      c.rotate(-0.09);
      c.globalAlpha = ghost ? 0.12 : 0.92;
    }
    if (Math.cos(angle) < 0) c.scale(-1, 1);
    c.fillStyle = ghost ? "rgba(244,234,214,.12)" : "rgba(0,0,0,.42)";
    c.beginPath();
    c.ellipse(0, 34, action === "dash" ? 43 : 34, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = action === "special" ? "#ffe6a0" : "#f6d98e";
    c.shadowBlur = ghost ? 30 : action === "special" ? 28 : 12;
    c.drawImage(sheet, frame * sw, row * sh, sw, sh, -78, -81, 156, 156);
    c.restore();
    return;
  }
  if (sprite?.complete && sprite.naturalWidth) {
    const movingLean = Math.sin(t * 7) * 0.018;
    c.rotate(movingLean);
    if (Math.cos(angle) < 0) c.scale(-1, 1);
    c.fillStyle = ghost ? "rgba(244,234,214,.18)" : "rgba(0,0,0,.38)";
    c.beginPath();
    c.ellipse(0, 31, 37, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = "#f6d98e";
    c.shadowBlur = ghost ? 26 : 12;
    c.drawImage(sprite, -70, -70, 140, 140);
    c.restore();
    return;
  }
  c.rotate(angle + Math.PI / 2);
  c.shadowColor = "#f6d98e";
  c.shadowBlur = ghost ? 22 : 10;
  path(c, [[-29, 14], [-48, 52], [-12, 41], [0, 67], [12, 41], [48, 52], [29, 14]], "#e9dfc8", "#9c7c3d");
  path(c, [[-20, 10], [-17, 45], [0, 28], [17, 45], [20, 10]], "#20242b", "#08090b");
  path(c, [[-31, 4], [-12, -8], [0, 5], [12, -8], [31, 4], [18, 17], [-18, 17]], "#f3ead6", "#b69550");
  path(c, [[-22, -6], [-18, -30], [-8, -47], [-4, -70], [8, -50], [16, -65], [22, -34], [18, -8]], "#f6ead0", "#b69550");
  path(c, [[-13, -29], [-4, -22], [-8, -12], [-18, -18]], "#0a0d11");
  path(c, [[13, -29], [4, -22], [8, -12], [18, -18]], "#0a0d11");
  c.fillStyle = "#d7b96e";
  c.beginPath();
  c.moveTo(0, 8);
  c.lineTo(8, 22);
  c.lineTo(0, 36);
  c.lineTo(-8, 22);
  c.closePath();
  c.fill();
  c.fillStyle = "#20242b";
  c.fillRect(-3, -94, 6, 43);
  path(c, [[0, -110], [-10, -92], [0, -97], [10, -92]], "#d9bd74", "#17191e");
  c.restore();
}

function drawEnemy(c: CanvasRenderingContext2D, e: Enemy, t: number, sprites: SpritePack) {
  const col = COLORS[e.element];
  c.save();
  c.translate(e.x, e.y);
  const pulse = 1 + Math.sin(t * 4 + e.id) * 0.04;
  c.scale(pulse, pulse);
  c.shadowColor = col;
  c.shadowBlur = e.hitFlash > 0 ? 28 : 13;
  c.globalAlpha = e.dead ? Math.max(0, e.hitFlash) : 1;
  const enemySprite = e.kind === "boss" ? sprites.boss : sprites[e.kind];
  if (enemySprite?.complete && enemySprite.naturalWidth) {
    const size = e.kind === "boss" ? 238 : e.kind === "golem" ? 88 : e.kind === "hound" ? 74 : 66;
    c.fillStyle = "rgba(0,0,0,.46)";
    c.beginPath();
    c.ellipse(0, size * 0.21, size * 0.33, size * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = col;
    c.shadowBlur = e.hitFlash > 0 ? 38 : 18;
    c.drawImage(enemySprite, -size / 2, -size / 2, size, size);
  } else if (e.kind === "wisp") {
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, 0, 14, 0, Math.PI * 2);
    c.fill();
    path(c, [[-12, 7], [-22, 23], [-4, 14], [0, 30], [6, 14], [22, 23], [12, 7]], col);
    c.fillStyle = "#071015";
    c.fillRect(-7, -4, 4, 6);
    c.fillRect(4, -4, 4, 6);
  } else if (e.kind === "hound") {
    path(c, [[-30, 9], [-20, -15], [-8, -7], [10, -18], [31, -6], [25, 18], [5, 24], [-19, 21]], "#171b20", col);
    path(c, [[10, -18], [22, -32], [24, -9]], col);
    c.fillStyle = col;
    c.beginPath();
    c.arc(17, -7, 3, 0, 7);
    c.fill();
  } else if (e.kind === "archer") {
    path(c, [[0, -25], [18, -8], [13, 26], [-13, 26], [-18, -8]], "#1a1d22", col);
    c.fillStyle = col;
    c.beginPath();
    c.arc(0, -25, 11, 0, 7);
    c.fill();
    c.strokeStyle = col;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(20, 2, 20, -1.4, 1.4);
    c.stroke();
  } else {
    const s = e.kind === "boss" ? 1.65 : 1;
    c.scale(s, s);
    path(c, [[-28, 25], [-35, -5], [-20, -31], [-4, -21], [8, -38], [28, -22], [37, 1], [29, 28], [7, 35], [-14, 32]], "#1b211b", col);
    path(c, [[-19, -22], [-28, -45], [-8, -31], [4, -52], [16, -29], [34, -43], [25, -17]], "#263020", col);
    c.fillStyle = col;
    c.beginPath();
    c.arc(-7, -18, 4, 0, 7);
    c.arc(10, -20, 4, 0, 7);
    c.fill();
  }
  c.restore();
  const ratio = Math.max(0, e.hp / e.maxHp);
  if (e.kind !== "boss") {
    c.fillStyle = "#090b0d";
    c.fillRect(e.x - 25, e.y - e.radius - 19, 50, 5);
    c.fillStyle = col;
    c.fillRect(e.x - 25, e.y - e.radius - 19, 50 * ratio, 5);
  }
}

const INTERACTIONS: Record<ZoneId, Array<{
  id: DialogueId;
  x: number;
  y: number;
  label: string;
  range?: number;
  sprite?: "luma" | "vey" | "elder";
}>> = {
  grove: [
    { id: "elder", x: 1125, y: 330, label: "Elder Ash", range: 120, sprite: "elder" },
    { id: "shrine", x: 450, y: 270, label: "Luminous Shrine", range: 145 },
  ],
  fields: [
    { id: "luma", x: 1125, y: 750, label: "Luma · Merchant", range: 120, sprite: "luma" },
    { id: "chest", x: 870, y: 150, label: "Hidden Chest", range: 145 },
  ],
  ruins: [
    { id: "vey", x: 390, y: 510, label: "Vey · Cartographer", range: 120, sprite: "vey" },
    { id: "archive", x: 1050, y: 270, label: "Echo Archive", range: 150 },
    { id: "gate", x: 1650, y: 450, label: "Sealed Rune Gate", range: 155 },
  ],
};

function drawNpc(
  c: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  t: number,
  kind: "luma" | "vey" | "elder",
) {
  if (!image?.complete || !image.naturalWidth) return;
  const bob = kind === "luma" ? Math.sin(t * 4.4 + x) * 6 : kind === "vey" ? Math.sin(t * 3 + x) * 2 : Math.sin(t * 1.4) * 1.5;
  const size = kind === "elder" ? 138 : kind === "luma" ? 104 : 98;
  c.save();
  c.translate(x, y + bob);
  if (kind === "luma") c.rotate(Math.sin(t * 3.2) * 0.035);
  if (kind === "vey") c.rotate(Math.sin(t * 5.5) * 0.018);
  c.fillStyle = "rgba(0,0,0,.4)";
  c.beginPath();
  c.ellipse(0, size * 0.27, size * 0.31, size * 0.09, 0, 0, Math.PI * 2);
  c.fill();
  c.shadowColor = kind === "vey" ? "#4e9bd4" : kind === "elder" ? "#8faa55" : "#e4c878";
  c.shadowBlur = kind === "luma" ? 18 + Math.sin(t * 4) * 5 : 12;
  c.drawImage(image, -size / 2, -size * 0.58, size, size);
  c.restore();
}

function drawRoute(c: CanvasRenderingContext2D, x: number, y: number, label: string, angle: number) {
  c.save();
  c.translate(x, y);
  c.shadowColor = "#000";
  c.shadowBlur = 8;
  c.fillStyle = "rgba(8,12,12,.78)";
  c.strokeStyle = "#c5a75d";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, 24, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.rotate(angle);
  path(c, [[-8, -11], [12, 0], [-8, 11], [-3, 0]], "#e6cb83");
  c.rotate(-angle);
  c.font = "600 13px Cinzel, serif";
  c.textAlign = "center";
  c.fillStyle = "#efe0b2";
  c.fillText(label, 0, 46);
  c.restore();
}

function drawGroundTile(
  c: CanvasRenderingContext2D,
  zone: ZoneId,
  tile: TileCode,
  col: number,
  row: number,
  time: number,
) {
  const x = col * TILE;
  const y = row * TILE;
  const noise = rand(col * 41 + row * 97 + (zone === "grove" ? 1 : zone === "fields" ? 2 : 3));
  if (tile === "~") {
    c.fillStyle = zone === "ruins" ? "#102b3c" : "#123c45";
    c.fillRect(x, y, TILE + 1, TILE + 1);
    c.strokeStyle = `rgba(87,190,211,${0.22 + noise * 0.14})`;
    c.lineWidth = 2;
    for (let wave = 0; wave < 2; wave++) {
      c.beginPath();
      const wy = y + 18 + wave * 24 + Math.sin(time * 2 + col + row) * 3;
      c.moveTo(x + 7, wy);
      c.quadraticCurveTo(x + 25, wy - 5, x + 50, wy + 1);
      c.stroke();
    }
    return;
  }
  if (tile === "=") {
    c.fillStyle = "#30291e";
    c.fillRect(x, y, TILE + 1, TILE + 1);
    for (let plank = 0; plank < 4; plank++) {
      c.fillStyle = plank % 2 ? "#755d35" : "#876d3f";
      c.fillRect(x + 2, y + plank * 15 + 2, TILE - 4, 12);
      c.strokeStyle = "#2a2118";
      c.strokeRect(x + 2, y + plank * 15 + 2, TILE - 4, 12);
    }
    return;
  }
  const stone = tile === "." || zone === "ruins";
  if (stone) {
    c.fillStyle = `rgb(${48 + noise * 12},${53 + noise * 12},${51 + noise * 10})`;
    c.fillRect(x, y, TILE + 1, TILE + 1);
    c.strokeStyle = "rgba(15,19,20,.42)";
    c.lineWidth = 2;
    c.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    c.beginPath();
    c.moveTo(x + 30 + noise * 8, y + 3);
    c.lineTo(x + 27, y + 26);
    c.lineTo(x + 37, y + 58);
    c.stroke();
  } else {
    const pathTile = tile === ":";
    c.fillStyle = pathTile
      ? `rgb(${82 + noise * 12},${78 + noise * 10},${56 + noise * 8})`
      : zone === "fields"
        ? `rgb(${52 + noise * 12},${72 + noise * 14},${42 + noise * 9})`
        : `rgb(${39 + noise * 10},${65 + noise * 12},${43 + noise * 8})`;
    c.fillRect(x, y, TILE + 1, TILE + 1);
    if (pathTile) {
      c.fillStyle = "rgba(174,154,105,.18)";
      for (let pebble = 0; pebble < 4; pebble++) {
        const px = x + 8 + rand(col * 17 + row * 13 + pebble) * 44;
        const py = y + 8 + rand(col * 29 + row * 7 + pebble) * 44;
        c.beginPath();
        c.ellipse(px, py, 5 + pebble, 3, noise, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      c.strokeStyle = "rgba(128,164,83,.22)";
      c.lineWidth = 2;
      for (let grass = 0; grass < 3; grass++) {
        const gx = x + 10 + rand(col * 19 + row * 31 + grass) * 40;
        const gy = y + 20 + rand(col * 11 + row * 23 + grass) * 32;
        c.beginPath();
        c.moveTo(gx, gy + 7);
        c.lineTo(gx + Math.sin(time * 1.7 + grass) * 2, gy);
        c.stroke();
      }
    }
  }
}

function drawTallTile(c: CanvasRenderingContext2D, zone: ZoneId, tile: TileCode, col: number, row: number, time: number) {
  const x = col * TILE;
  const y = row * TILE;
  const cx = x + TILE / 2;
  const bottom = y + TILE;
  const seed = rand(col * 53 + row * 71);
  c.save();
  if (tile === "T") {
    c.fillStyle = "#2a2117";
    c.fillRect(cx - 8, bottom - 42, 16, 42);
    const leaf = zone === "fields" ? "#304b29" : "#1d3828";
    c.fillStyle = leaf;
    c.shadowColor = "#07100c";
    c.shadowBlur = 12;
    for (let crown = 0; crown < 5; crown++) {
      c.beginPath();
      c.arc(cx + (crown - 2) * 12, bottom - 58 - Math.abs(crown - 2) * 7, 25 + seed * 5, 0, Math.PI * 2);
      c.fill();
    }
  } else if (tile === "#" || tile === "^") {
    const cliff = tile === "^";
    c.fillStyle = cliff ? "#11191e" : "#242a29";
    path(c, [[x + 3, bottom - 42], [x + 14, bottom - 55], [x + 53, bottom - 51], [x + 59, bottom - 37], [x + 55, bottom], [x + 4, bottom]], cliff ? "#11191e" : "#242a29", "#0c1112");
    c.fillStyle = cliff ? "#263238" : "#3b4240";
    path(c, [[x + 3, bottom - 42], [x + 14, bottom - 55], [x + 53, bottom - 51], [x + 59, bottom - 37], [x + 47, bottom - 28], [x + 12, bottom - 30]], cliff ? "#263238" : "#3b4240", "#111719");
    c.strokeStyle = "rgba(118,129,111,.28)";
    c.beginPath();
    c.moveTo(x + 30, bottom - 50);
    c.lineTo(x + 27, bottom - 5);
    c.stroke();
  } else if (tile === "C") {
    c.fillStyle = "#263337";
    c.fillRect(cx - 26, bottom - 18, 52, 18);
    c.fillStyle = "#38474b";
    c.beginPath();
    c.ellipse(cx, bottom - 18, 27, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = "#55d8ff";
    c.shadowBlur = 26;
    path(c, [[cx, bottom - 86], [cx + 17, bottom - 48], [cx, bottom - 18], [cx - 17, bottom - 48]], "#6fe4ff", "#d5f8ff");
  } else if (tile === "G") {
    c.fillStyle = "#252a2b";
    c.fillRect(x - 6, bottom - 105, TILE + 12, 105);
    c.strokeStyle = "#78623c";
    c.lineWidth = 4;
    c.strokeRect(x + 5, bottom - 90, TILE - 10, 90);
    c.beginPath();
    c.arc(cx, bottom - 56, 18, 0, Math.PI * 2);
    c.stroke();
  } else if (tile === "H") {
    c.fillStyle = "#3a2d24";
    path(c, [[x - 20, bottom - 2], [cx, bottom - 92], [x + 80, bottom - 2]], "#5e4833", "#241b16");
    c.fillStyle = "#1b1714";
    path(c, [[cx, bottom - 74], [cx + 20, bottom - 2], [cx - 5, bottom - 2]], "#241c17");
  } else if (tile === "W") {
    c.fillStyle = "#4b3b2b";
    c.fillRect(cx - 42, bottom - 80, 84, 80);
    path(c, [[cx - 50, bottom - 80], [cx, bottom - 128], [cx + 50, bottom - 80]], "#27231e", "#15120f");
    c.fillStyle = "#d8a24d";
    c.fillRect(cx + 13, bottom - 48, 8, 12);
    c.translate(cx, bottom - 100);
    c.rotate(time * 0.18);
    c.fillStyle = "#44372b";
    for (let blade = 0; blade < 4; blade++) {
      c.rotate(Math.PI / 2);
      path(c, [[-5, -4], [12, -9], [78, -19], [74, 3], [12, 7]], "#44372b", "#171412");
    }
  } else if (tile === "V") {
    c.fillStyle = "#392a20";
    c.fillRect(x - 40, bottom - 68, 140, 58);
    c.fillStyle = "#4d3929";
    c.beginPath();
    c.arc(cx - 10, bottom - 10, 18, 0, Math.PI * 2);
    c.arc(cx + 65, bottom - 10, 18, 0, Math.PI * 2);
    c.fill();
    path(c, [[x - 42, bottom - 68], [x - 18, bottom - 98], [x + 77, bottom - 98], [x + 102, bottom - 68]], "#594431", "#201812");
  } else if (tile === "B") {
    c.fillStyle = "#5a3819";
    c.fillRect(cx - 24, bottom - 32, 48, 30);
    c.strokeStyle = "#d1a44e";
    c.lineWidth = 3;
    c.strokeRect(cx - 24, bottom - 32, 48, 30);
  }
  c.restore();
}

function drawTileMapBase(c: CanvasRenderingContext2D, game: Game) {
  const map = TILE_MAPS[game.zone];
  c.fillStyle = game.zone === "ruins" ? "#0b1217" : "#09130e";
  c.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = map[row][col];
      const groundTile: TileCode = tile === "~" || tile === "=" || tile === "." || tile === ":" || tile === "," ? tile : game.zone === "ruins" ? "." : ",";
      drawGroundTile(c, game.zone, groundTile, col, row, game.time);
    }
  }
}

function drawWorld(c: CanvasRenderingContext2D, game: Game, sprites: SpritePack) {
  const { camera, time } = game;
  c.save();
  const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  c.translate(-camera.x + sx, -camera.y + sy);
  drawTileMapBase(c, game);

  for (let i = 0; i < 70; i++) {
    const x = rand(i + 400) * WORLD_W;
    const y = rand(i + 500) * WORLD_H;
    c.fillStyle = i % 5 === 0 ? "#9c73d9" : "#e5d6a4";
    c.globalAlpha = 0.25 + Math.sin(time * 2 + i) * 0.16;
    c.beginPath();
    c.arc(x, y, 2 + (i % 3), 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;

  if (game.zone === "grove") {
    drawRoute(c, WORLD_W - 72, 590, "SILENT FIELDS", 0);
    drawRoute(c, 900, 70, "ANCIENT RUINS", -Math.PI / 2);
  } else if (game.zone === "fields") {
    drawRoute(c, 72, 585, "WHISPERING GROVE", Math.PI);
  } else {
    drawRoute(c, 900, WORLD_H - 66, "WHISPERING GROVE", Math.PI / 2);
  }

  for (const point of INTERACTIONS[game.zone]) {
    if (point.id === "chest" && game.chestOpened) continue;
    if (!point.sprite) {
      c.save();
      c.translate(point.x, point.y);
      const glow = point.id === "gate" ? "#d3aa50" : point.id === "chest" ? "#f0bd52" : "#65d9ff";
      c.shadowColor = glow;
      c.shadowBlur = 12 + Math.sin(time * 3) * 4;
      if (point.id === "shrine" || point.id === "archive") {
        const aura = c.createRadialGradient(0, 0, 3, 0, 0, 58);
        aura.addColorStop(0, "rgba(120,224,255,.32)");
        aura.addColorStop(1, "rgba(80,190,255,0)");
        c.fillStyle = aura;
        c.beginPath();
        c.arc(0, 0, 58, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.55 + Math.sin(time * 2.6) * 0.18;
        path(c, [[0, -22], [10, 0], [0, 22], [-10, 0]], "rgba(120,226,255,.72)", glow);
      } else if (point.id === "chest") {
        c.translate(0, -18 - Math.sin(time * 2.8) * 3);
        c.fillStyle = glow;
        path(c, [[0, -8], [5, 0], [0, 8], [-5, 0]], glow);
      } else {
        c.strokeStyle = glow;
        c.globalAlpha = 0.45 + Math.sin(time * 2) * 0.15;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, 42, -1.25, 1.25);
        c.stroke();
        c.beginPath();
        c.arc(0, 0, 55, 1.9, 4.35);
        c.stroke();
      }
      c.restore();
    }
  }

  game.player.trail.forEach((p) => drawWarrior(
    c,
    p.x,
    p.y,
    game.player.angle,
    time,
    true,
    sprites.warrior,
    sprites.warriorSheet,
    "dash",
    p.life,
    0.45,
  ));

  const actors: Array<{ y: number; draw: () => void }> = [];
  const map = TILE_MAPS[game.zone];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = map[row][col];
      if (!SOLID_TILES.has(tile) || tile === "~" || tile === "X") continue;
      const tileX = col * TILE;
      const tileY = row * TILE;
      if (
        tileX + 140 < game.camera.x ||
        tileX - 140 > game.camera.x + W ||
        tileY + 160 < game.camera.y ||
        tileY - 160 > game.camera.y + H
      ) continue;
      actors.push({
        y: tileY + TILE,
        draw: () => drawTallTile(c, game.zone, tile, col, row, time),
      });
    }
  }
  for (const point of INTERACTIONS[game.zone]) {
    if (point.sprite) {
      actors.push({
        y: point.y,
        draw: () => drawNpc(c, sprites[point.sprite!], point.x, point.y, time, point.sprite!),
      });
    }
  }
  for (const enemy of game.enemies.filter((e) => !e.dead || e.hitFlash > 0)) {
    actors.push({ y: enemy.y, draw: () => drawEnemy(c, enemy, time, sprites) });
  }
  actors.push({
    y: game.player.y,
    draw: () => drawWarrior(
      c,
      game.player.x,
      game.player.y,
      game.player.angle,
      time,
      false,
      sprites.warrior,
      sprites.warriorSheet,
      game.player.action,
      game.player.actionTime,
      game.player.actionDuration,
    ),
  });
  actors.sort((a, b) => a.y - b.y).forEach((actor) => actor.draw());

  game.fx.forEach((fx) => {
    const a = Math.max(0, fx.life / fx.max);
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = fx.color;
    c.fillStyle = fx.color;
    c.shadowColor = fx.color;
    c.shadowBlur = 18;
    c.lineWidth = fx.kind === "spin" ? 8 : 5;
    if (fx.kind === "projectile") {
      c.beginPath();
      c.arc(fx.x, fx.y, fx.radius, 0, 7);
      c.fill();
    } else if (fx.kind === "beam") {
      const beamHeight = 170 * (1 - a * 0.2);
      const beam = c.createLinearGradient(fx.x, fx.y - beamHeight, fx.x, fx.y + 20);
      beam.addColorStop(0, "rgba(255,244,189,0)");
      beam.addColorStop(0.55, fx.color);
      beam.addColorStop(1, "#fff7d6");
      c.strokeStyle = beam;
      c.lineWidth = 18 * a + 4;
      c.beginPath();
      c.moveTo(fx.x, fx.y - beamHeight);
      c.lineTo(fx.x, fx.y + 8);
      c.stroke();
      c.lineWidth = 5;
      c.beginPath();
      c.arc(fx.x, fx.y + 5, fx.radius * (1.35 - a * 0.35), 0, Math.PI * 2);
      c.stroke();
    } else if (fx.kind === "phantom") {
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(fx.x - (fx.vx || 0) * 0.12, fx.y - (fx.vy || 0) * 0.12);
      c.lineTo(fx.x + (fx.vx || 0) * 0.12, fx.y + (fx.vy || 0) * 0.12);
      c.stroke();
    } else if (fx.kind === "slash") {
      const slashAngle = Math.atan2(fx.vy || 0, fx.vx || 1);
      c.beginPath();
      c.arc(fx.x, fx.y, fx.radius * (1.2 - a * 0.2), slashAngle - 1.25, slashAngle + 1.25);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(fx.x, fx.y, fx.radius * (1.2 - a * 0.2), 0, 7);
      c.stroke();
    }
    c.restore();
  });
  drawRaycastLighting(c, game);
  c.restore();
}

function attack(game: Game, slot: number) {
  const p = game.player;
  const costs = [0, 45, 70, 55];
  const CDs = [0.31, 2.8, 4.5, 2.2];
  if (game.cooldowns[slot] > 0 || p.energy < costs[slot]) return;
  game.cooldowns[slot] = CDs[slot];
  p.energy -= costs[slot];
  const startX = p.x;
  const startY = p.y;
  if (slot === 0) {
    p.combo = p.comboTimer > 0 ? (p.combo % 3) + 1 : 1;
    p.comboTimer = 0.72;
    p.action = "slash";
    p.actionDuration = 0.29;
  } else if (slot === 1) {
    p.action = "slash";
    p.actionDuration = 0.58;
  } else if (slot === 2) {
    p.action = "special";
    p.actionDuration = 0.82;
  } else {
    p.action = "dash";
    p.actionDuration = 0.38;
  }
  p.actionTime = p.actionDuration;
  const radius = slot === 1 ? 145 : slot === 2 ? 165 : slot === 3 ? 72 : 82 + p.combo * 8;
  const comboDamage = p.combo === 3 ? 62 : p.combo === 2 ? 44 : 34;
  const damage = slot === 0 ? comboDamage : slot === 1 ? 68 : slot === 2 ? 112 : 52;
  let tx = slot === 2 ? p.x + Math.cos(p.angle) * 190 : p.x;
  let ty = slot === 2 ? p.y + Math.sin(p.angle) * 190 : p.y;
  if (slot === 3) {
    for (let i = 0; i < 10; i++) {
      const step = moveWithCollision(
        game.zone,
        p.x,
        p.y,
        Math.cos(p.angle) * 18,
        Math.sin(p.angle) * 18,
        26,
      );
      if (step.x === p.x && step.y === p.y) break;
      p.x = step.x;
      p.y = step.y;
      if (i % 2 === 0) p.trail.push({ x: p.x, y: p.y, life: 0.42 - i * 0.02 });
    }
    p.invuln = 0.5;
    tx = (startX + p.x) / 2;
    ty = (startY + p.y) / 2;
  }
  if (slot === 1) {
    game.fx.push(
      { kind: "spin", x: tx, y: ty, life: 0.48, max: 0.48, radius, color: "#f7d77f" },
      { kind: "spin", x: tx, y: ty, life: 0.34, max: 0.34, radius: radius * 0.72, color: "#fff0b0" },
    );
  } else if (slot === 2) {
    game.fx.push(
      { kind: "beam", x: tx, y: ty, life: 0.72, max: 0.72, radius, color: "#ffe39a" },
      { kind: "burst", x: tx, y: ty, life: 0.5, max: 0.5, radius: radius * 1.12, color: "#fff2bd" },
    );
    game.shake = 18;
  } else if (slot === 3) {
    game.fx.push({
      kind: "phantom",
      x: tx,
      y: ty,
      vx: p.x - startX,
      vy: p.y - startY,
      life: 0.35,
      max: 0.35,
      radius,
      color: "#d3a1ff",
    });
  } else {
    game.fx.push({
      kind: "slash",
      x: p.x + Math.cos(p.angle) * 28,
      y: p.y + Math.sin(p.angle) * 28,
      vx: Math.cos(p.angle),
      vy: Math.sin(p.angle),
      life: 0.27,
      max: 0.27,
      radius,
      color: p.combo === 3 ? "#fff3c5" : "#f2d58f",
    });
  }
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - tx, e.y - ty);
    const dashLength = Math.hypot(p.x - startX, p.y - startY) || 1;
    const dashProgress = Math.max(0, Math.min(1, ((e.x - startX) * (p.x - startX) + (e.y - startY) * (p.y - startY)) / (dashLength * dashLength)));
    const dashDistance = Math.hypot(
      e.x - (startX + (p.x - startX) * dashProgress),
      e.y - (startY + (p.y - startY) * dashProgress),
    );
    const directional =
      slot === 1 ||
      slot === 2 ||
      slot === 3 ||
      Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - p.angle) > 0.15;
    const inRange = slot === 3 ? dashDistance < radius + e.radius : d < radius + e.radius;
    if (inRange && directional) {
      e.hp -= damage * (e.kind === "boss" ? 0.72 : 1);
      e.hitFlash = 0.16;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      e.x += Math.cos(ang) * (e.kind === "boss" ? 10 : 30);
      e.y += Math.sin(ang) * (e.kind === "boss" ? 10 : 30);
      game.fx.push({ kind: "hit", x: e.x, y: e.y, life: 0.24, max: 0.24, radius: 32, color: COLORS[e.element] });
      if (e.hp <= 0) {
        e.dead = true;
        e.hitFlash = 0.8;
        if (e.kind === "boss") game.bossDefeated = true;
        game.kills++;
        game.shards += e.kind === "boss" ? 12 : 1;
        p.energy = Math.min(p.maxEnergy, p.energy + 25);
      }
    }
  }
}

export default function AbyssWalkerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(freshGame());
  const spritesRef = useRef<SpritePack>({});
  const rafRef = useRef(0);
  const bossAnnouncedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("title");
  const phaseRef = useRef<Phase>("title");
  const [mapOpen, setMapOpen] = useState(false);
  const mapRef = useRef(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [zone, setZone] = useState<ZoneId>("grove");
  const [nearby, setNearby] = useState<{ id: DialogueId; label: string } | null>(null);
  const nearbyRef = useRef<{ id: DialogueId; label: string } | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const dialogueRef = useRef(false);
  const [toast, setToast] = useState("");
  const [hud, setHud] = useState({
    hp: 560,
    energy: 300,
    boss: 950,
    kills: 0,
    shards: 0,
    bossDefeated: false,
    discovered: ["grove"] as ZoneId[],
    cooldowns: [0, 0, 0, 0],
  });

  const setGamePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startGame = useCallback(() => {
    gameRef.current = freshGame();
    setMapOpen(false);
    mapRef.current = false;
    setZone("grove");
    setNearby(null);
    nearbyRef.current = null;
    setDialogue(null);
    dialogueRef.current = false;
    bossAnnouncedRef.current = false;
    setToast("WHISPERING GROVE · DISCOVERED");
    setHud({
      hp: 560,
      energy: 300,
      boss: 950,
      kills: 0,
      shards: 0,
      bossDefeated: false,
      discovered: ["grove"],
      cooldowns: [0, 0, 0, 0],
    });
    setGamePhase("playing");
  }, [setGamePhase]);

  const useAbility = useCallback((slot: number) => {
    if (phaseRef.current === "playing" && !mapRef.current && !dialogueRef.current) attack(gameRef.current, slot);
  }, []);

  const openInteraction = useCallback(() => {
    const target = nearbyRef.current;
    if (!target || dialogueRef.current) return;
    const g = gameRef.current;
    const copy: Record<DialogueId, Dialogue> = {
      elder: {
        id: "elder",
        speaker: "ELDER ASH",
        title: "Keeper of the Grove",
        body: g.bossDefeated
          ? "The roots breathe freely again. Yet the eastern gate still dreams of a deeper darkness."
          : "A tear in the old song has woken the Forest Brute. Follow the pale road, Silent One—but listen before you strike.",
      },
      luma: {
        id: "luma",
        speaker: "LUMA",
        title: "Lantern Merchant",
        body: "Bright traveler! My wagon carries bottled dawn, old rumors, and exactly one reliable wheel. Three Rift Shards buys a healing nectar.",
      },
      vey: {
        id: "vey",
        speaker: "VEY",
        title: "Cartographer of Lost Roads",
        body: "Maps remember roads that stone has forgotten. I marked the Archive and the sealed eastern gate for you.",
      },
      shrine: {
        id: "shrine",
        speaker: "LUMINOUS SHRINE",
        title: "A Quiet Flame",
        body: "Warm light gathers around your wounds. Your progress echoes here.",
      },
      chest: {
        id: "chest",
        speaker: "HIDDEN CACHE",
        title: "A Forgotten Offering",
        body: g.chestOpened ? "The old coffer is empty." : "Inside: five Rift Shards and a pressed map-petal.",
      },
      archive: {
        id: "archive",
        speaker: "ECHO ARCHIVE",
        title: "Record · The First Silence",
        body: "Before the elements had names, the world spoke in one voice. The Rift is not an invader—it is the hollow left when that voice broke.",
      },
      gate: {
        id: "gate",
        speaker: "RUNE GATE",
        title: g.bossDefeated ? "The Seal Answers" : "A Living Seal",
        body: g.bossDefeated
          ? "The Forest Brute's mark answers your spear. Beyond lies Dawnhold Road—sealed in this prototype."
          : "The runes recoil. A guardian's living mark is required to open the road east.",
      },
    };
    if (target.id === "shrine") {
      g.player.hp = g.player.maxHp;
      g.player.energy = g.player.maxEnergy;
      try {
        localStorage.setItem("abyss-walker-save", JSON.stringify({ zone: g.zone, shards: g.shards, bossDefeated: g.bossDefeated }));
      } catch {}
      setToast("RESTORED · PROGRESS REMEMBERED");
    }
    if (target.id === "chest" && !g.chestOpened) {
      g.chestOpened = true;
      g.shards += 5;
      setToast("+5 RIFT SHARDS · MAP-PETAL FOUND");
    }
    dialogueRef.current = true;
    setDialogue(copy[target.id]);
  }, []);

  const closeDialogue = useCallback(() => {
    dialogueRef.current = false;
    setDialogue(null);
  }, []);

  const dialogueAction = useCallback((action: "buy" | "map" | "listen") => {
    const g = gameRef.current;
    if (action === "buy") {
      if (g.shards >= 3) {
        g.shards -= 3;
        g.player.hp = g.player.maxHp;
        setToast("HEALING NECTAR USED · HEALTH RESTORED");
        closeDialogue();
      } else {
        setDialogue((d) => d ? { ...d, body: "Not enough shimmer, friend. Bring me three Rift Shards and the nectar is yours." } : d);
      }
    } else if (action === "map") {
      g.discovered.add("fields");
      g.discovered.add("ruins");
      setToast("VEY UPDATED YOUR WORLD MAP");
      setDialogue((d) => d ? { ...d, body: "There. The pale ink follows paths your feet have not yet found. The Archive waits north of the Grove." } : d);
    } else {
      setDialogue((d) => d ? { ...d, body: "Do not mistake silence for emptiness. Every root beneath us is listening—and something beneath the roots listens back." } : d);
    }
  }, [closeDialogue]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    canvas.width = W;
    canvas.height = H;
    const loadSprite = (key: keyof SpritePack, src: string) => {
      const image = new Image();
      image.src = src;
      spritesRef.current[key] = image;
    };
    loadSprite("warrior", "/art/sprites/silent-warrior.png");
    loadSprite("warriorSheet", "/art/sprites/warrior-animation-sheet.png");
    loadSprite("boss", "/art/sprites/forest-brute.png");
    loadSprite("wisp", "/art/sprites/wisp.png");
    loadSprite("hound", "/art/sprites/hound.png");
    loadSprite("golem", "/art/sprites/golem.png");
    loadSprite("archer", "/art/sprites/archer.png");
    loadSprite("luma", "/art/sprites/luma.png");
    loadSprite("vey", "/art/sprites/vey-v2.png");
    loadSprite("elder", "/art/sprites/elder-ash-v2.png");

    const keyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "1", "2", "3", "4", "m", "e"].includes(k)) e.preventDefault();
      gameRef.current.keys.add(k);
      if (k === "e") openInteraction();
      if (k === "m" && phaseRef.current === "playing" && !dialogueRef.current) {
        mapRef.current = !mapRef.current;
        setMapOpen(mapRef.current);
      }
      if (k === "1" || k === "j") useAbility(0);
      if (k === "2" || k === "k") useAbility(1);
      if (k === "3" || k === "l") useAbility(2);
      if (k === "4" || k === "shift") useAbility(3);
      if (k === " " && phaseRef.current === "playing") useAbility(3);
      if (k === "escape") {
        mapRef.current = false;
        setMapOpen(false);
        setGuideOpen(false);
        closeDialogue();
      }
    };
    const keyUp = (e: KeyboardEvent) => gameRef.current.keys.delete(e.key.toLowerCase());
    const pointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      gameRef.current.pointer.x = ((e.clientX - r.left) / r.width) * W;
      gameRef.current.pointer.y = ((e.clientY - r.top) / r.height) * H;
    };
    const down = (e: PointerEvent) => {
      pointer(e);
      gameRef.current.pointer.down = true;
      useAbility(0);
    };
    const up = () => (gameRef.current.pointer.down = false);
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointermove", pointer);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);

    const loop = (now: number) => {
      const g = gameRef.current;
      const dt = Math.min(0.033, (now - g.last) / 1000 || 0);
      g.last = now;
      if (phaseRef.current === "playing" && !mapRef.current && !dialogueRef.current) {
        g.time += dt;
        const p = g.player;
        let dx = 0;
        let dy = 0;
        if (g.keys.has("w") || g.keys.has("arrowup")) dy--;
        if (g.keys.has("s") || g.keys.has("arrowdown")) dy++;
        if (g.keys.has("a") || g.keys.has("arrowleft")) dx--;
        if (g.keys.has("d") || g.keys.has("arrowright")) dx++;
        const len = Math.hypot(dx, dy) || 1;
        const moving = dx !== 0 || dy !== 0;
        p.actionTime = Math.max(0, p.actionTime - dt);
        p.comboTimer = Math.max(0, p.comboTimer - dt);
        if (p.comboTimer <= 0) p.combo = 0;
        if (p.actionTime <= 0) p.action = moving ? "run" : "idle";
        const moveMultiplier = p.actionTime > 0
          ? p.action === "special" ? 0.22 : p.action === "slash" ? 0.56 : p.action === "dash" ? 0.18 : 1
          : 1;
        const movement = moveWithCollision(
          g.zone,
          p.x,
          p.y,
          (dx / len) * 210 * moveMultiplier * dt,
          (dy / len) * 210 * moveMultiplier * dt,
          28,
        );
        p.x = movement.x;
        p.y = movement.y;

        let nextZone: ZoneId | null = null;
        if (g.zone === "grove" && p.x >= 1705 && p.y > 400) {
          nextZone = "fields";
          p.x = 94;
          p.y = 585;
        } else if (g.zone === "grove" && p.y <= 90 && p.x > 790 && p.x < 1030) {
          nextZone = "ruins";
          p.x = 900;
          p.y = 920;
        } else if (g.zone === "fields" && p.x <= 90) {
          nextZone = "grove";
          p.x = 1700;
          p.y = 590;
        } else if (g.zone === "ruins" && p.y >= 920 && p.x > 760 && p.x < 1100) {
          nextZone = "grove";
          p.x = 900;
          p.y = 92;
        }
        if (nextZone) {
          g.zone = nextZone;
          g.enemies = g.zoneEnemies[nextZone];
          g.discovered.add(nextZone);
          g.fx = [];
          g.camera.x = Math.max(0, Math.min(WORLD_W - W, p.x - W / 2));
          g.camera.y = Math.max(0, Math.min(WORLD_H - H, p.y - H / 2));
          nearbyRef.current = null;
          setNearby(null);
          setZone(nextZone);
          setToast(`${ZONE_NAMES[nextZone].region} · DISCOVERED`);
        }
        const worldPointerX = g.pointer.x + g.camera.x;
        const worldPointerY = g.pointer.y + g.camera.y;
        p.angle = Math.atan2(worldPointerY - p.y, worldPointerX - p.x);
        p.energy = Math.min(p.maxEnergy, p.energy + 18 * dt);
        p.invuln = Math.max(0, p.invuln - dt);
        g.cooldowns = g.cooldowns.map((v) => Math.max(0, v - dt));
        if (g.pointer.down && g.cooldowns[0] <= 0) attack(g, 0);
        p.trail.forEach((q) => (q.life -= dt));
        p.trail = p.trail.filter((q) => q.life > 0);

        const boss = g.zoneEnemies.grove.find((e) => e.kind === "boss")!;
        if (g.zone === "grove" && !boss.dead) {
          g.bossAwake = g.bossAwake || Math.hypot(boss.x - p.x, boss.y - p.y) < 520 || g.kills >= 8;
        }
        for (const e of g.enemies) {
          if (e.dead) {
            e.hitFlash -= dt;
            continue;
          }
          e.hitFlash = Math.max(0, e.hitFlash - dt);
          e.cooldown -= dt;
          const ex = p.x - e.x;
          const ey = p.y - e.y;
          const dist = Math.hypot(ex, ey);
          const active = e.kind !== "boss" || g.bossAwake;
          if (!active) continue;
          if (e.kind === "archer" && dist < 520 && e.cooldown <= 0) {
            const a = Math.atan2(ey, ex);
            g.fx.push({ kind: "projectile", x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 2.4, max: 2.4, radius: 7, color: COLORS[e.element] });
            e.cooldown = 2.2;
          } else if (dist < (e.kind === "boss" ? 610 : 305) && dist > e.radius + 35) {
            const enemyMove = moveWithCollision(
              g.zone,
              e.x,
              e.y,
              (ex / dist) * e.speed * dt,
              (ey / dist) * e.speed * dt,
              Math.max(16, e.radius * 0.72),
            );
            e.x = enemyMove.x;
            e.y = enemyMove.y;
          }
          if (dist < e.radius + 31 && e.cooldown <= 0 && p.invuln <= 0) {
            p.hp -= e.kind === "boss" ? 38 : e.kind === "golem" ? 18 : 12;
            p.invuln = 0.7;
            g.shake = e.kind === "boss" ? 18 : 8;
            e.cooldown = e.kind === "boss" ? 1.5 : 1.1;
          }
        }
        for (const fx of g.fx) {
          fx.life -= dt;
          if (fx.kind === "projectile") {
            fx.x += (fx.vx || 0) * dt;
            fx.y += (fx.vy || 0) * dt;
            if (isBlocked(g.zone, fx.x, fx.y, fx.radius)) fx.life = 0;
            if (Math.hypot(fx.x - p.x, fx.y - p.y) < 30 && p.invuln <= 0) {
              p.hp -= 14;
              p.invuln = 0.6;
              fx.life = 0;
              g.shake = 7;
            }
          }
        }
        g.fx = g.fx.filter((fx) => fx.life > 0);
        g.shake = Math.max(0, g.shake - 45 * dt);

        const closest = INTERACTIONS[g.zone]
          .filter((point) => !(point.id === "chest" && g.chestOpened))
          .map((point) => ({ ...point, distance: Math.hypot(point.x - p.x, point.y - p.y) }))
          .filter((point) => point.distance < (point.range || 112))
          .sort((a, b) => a.distance - b.distance)[0];
        const nextNearby = closest ? { id: closest.id, label: closest.label } : null;
        if (nextNearby?.id !== nearbyRef.current?.id) {
          nearbyRef.current = nextNearby;
          setNearby(nextNearby);
        }

        g.camera.x += (Math.max(0, Math.min(WORLD_W - W, p.x - W / 2)) - g.camera.x) * Math.min(1, dt * 5);
        g.camera.y += (Math.max(0, Math.min(WORLD_H - H, p.y - H / 2)) - g.camera.y) * Math.min(1, dt * 5);
        if (p.hp <= 0) setGamePhase("dead");
        if (boss.dead && !bossAnnouncedRef.current) {
          bossAnnouncedRef.current = true;
          setToast("FOREST BRUTE VANQUISHED · THE EASTERN SEAL STIRS");
        }
        setHud({
          hp: Math.max(0, p.hp),
          energy: p.energy,
          boss: Math.max(0, boss.hp),
          kills: g.kills,
          shards: g.shards,
          bossDefeated: g.bossDefeated,
          discovered: [...g.discovered],
          cooldowns: [...g.cooldowns],
        });
      }
      c.clearRect(0, 0, W, H);
      drawWorld(c, g, spritesRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointermove", pointer);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [closeDialogue, openInteraction, setGamePhase, useAbility]);

  const holdMove = (key: string, active: boolean) => {
    if (active) gameRef.current.keys.add(key);
    else gameRef.current.keys.delete(key);
  };

  const bossActive = zone === "grove" && gameRef.current.bossAwake && !hud.bossDefeated && phase === "playing";

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Top-down action RPG arena" />

      {phase === "title" && (
        <section className="title-screen">
          <div className="title-vignette" />
          <p className="eyebrow">An elemental action RPG prototype</p>
          <h1>ABYSS <span>WALKER</span></h1>
          <div className="sigil">◇</div>
          <p className="subtitle">THE WHISPERING GROVE</p>
          <p className="prologue">The Rift has learned your name.<br />Teach it silence.</p>
          <button className="gold-button" onClick={startGame}>ENTER THE GROVE</button>
          <button className="text-button" onClick={() => setGuideOpen(true)}>HOW TO PLAY</button>
          <p className="build-mark">PLAYABLE CONCEPT · ACT I</p>
        </section>
      )}

      {phase !== "title" && (
        <>
          <header className="top-hud">
            <div className="portrait"><span>♢</span></div>
            <div className="player-panel">
              <div className="name-row"><strong>SILENT WARRIOR</strong><span>LV. 7</span></div>
              <div className="bar health"><i style={{ width: `${(hud.hp / 560) * 100}%` }} /><b>{Math.ceil(hud.hp)} / 560</b></div>
              <div className="bar energy"><i style={{ width: `${(hud.energy / 300) * 100}%` }} /><b>{Math.ceil(hud.energy)} / 300</b></div>
            </div>
            {bossActive && (
              <div className="boss-panel">
                <span>ELITE · NATURE</span>
                <strong>FOREST BRUTE</strong>
                <div className="bar boss"><i style={{ width: `${(hud.boss / 950) * 100}%` }} /><b>{Math.ceil(hud.boss)} / 950</b></div>
              </div>
            )}
            <nav className="hud-nav">
              <button onClick={() => setGuideOpen(true)}><span>?</span>Guide</button>
              <button onClick={() => { mapRef.current = true; setMapOpen(true); }}><span>⌖</span>Map</button>
            </nav>
          </header>

          <aside className="quest-card">
            <p>MAIN QUEST</p>
            <strong>ECHOES OF THE RIFT</strong>
            <span className={hud.kills >= 8 ? "done" : ""}>◇ Defeat Rift creatures <b>{Math.min(8, hud.kills)}/8</b></span>
            <span className={hud.discovered.includes("ruins") ? "done" : ""}>◇ Find the Ancient Ruins</span>
            <span className={hud.bossDefeated ? "done" : ""}>◇ Break the guardian mark</span>
          </aside>

          <aside className="area-card">
            <span>{ZONE_NAMES[zone].region}</span>
            <strong>{ZONE_NAMES[zone].area}</strong>
            <i>CH. I</i>
          </aside>

          <div className="loot-count">◆ <b>{hud.shards}</b> RIFT SHARDS</div>

          <div className="ability-dock">
            {[
              ["1", "LANCE COMBO", "✦"],
              ["2", "SOLAR CYCLONE", "◌"],
              ["3", "SPEARFALL", "↯"],
              ["4", "PHANTOM STEP", "➤"],
            ].map(([key, label, icon], i) => (
              <button key={key} className={`ability a${i}`} onClick={() => useAbility(i)}>
                <span>{icon}</span>
                <b>{key}</b>
                <small>{label}</small>
                {hud.cooldowns[i] > 0 && <em>{hud.cooldowns[i].toFixed(1)}</em>}
              </button>
            ))}
          </div>

          <div className="touch-stick" aria-label="Movement controls">
            <button onPointerDown={() => holdMove("w", true)} onPointerUp={() => holdMove("w", false)}>▲</button>
            <button onPointerDown={() => holdMove("a", true)} onPointerUp={() => holdMove("a", false)}>◀</button>
            <button onPointerDown={() => holdMove("s", true)} onPointerUp={() => holdMove("s", false)}>▼</button>
            <button onPointerDown={() => holdMove("d", true)} onPointerUp={() => holdMove("d", false)}>▶</button>
          </div>

          {nearby && !dialogue && (
            <button className="interaction-prompt" onClick={openInteraction}>
              <kbd>E</kbd>
              <span>INTERACT<strong>{nearby.label}</strong></span>
            </button>
          )}

          {toast && <div className="zone-toast"><i>◇</i>{toast}</div>}
        </>
      )}

      {mapOpen && (
        <section className="overlay map-overlay">
          <button className="close" onClick={() => { mapRef.current = false; setMapOpen(false); }}>×</button>
          <div className="map-copy">
            <span>WORLD MAP</span>
            <strong>THE ELEMENTAL FRONTIER</strong>
            <p>Current region: {ZONE_NAMES[zone].region}. Pale routes connect every discovered territory.</p>
            <div className="map-discovered">
              {(["grove", "fields", "ruins"] as ZoneId[]).map((id) => (
                <b key={id} className={hud.discovered.includes(id) ? "found" : ""}>
                  {hud.discovered.includes(id) ? "◆" : "◇"} {ZONE_NAMES[id].region}
                </b>
              ))}
            </div>
          </div>
          <img src="/art/world-map.png" alt="Elemental Silent Warrior starter world map" />
          <div className={`map-location zone-${zone}`}><i>◆</i><span>YOU ARE HERE<strong>{ZONE_NAMES[zone].region}</strong></span></div>
        </section>
      )}

      {guideOpen && (
        <section className="overlay guide-overlay">
          <button className="close" onClick={() => setGuideOpen(false)}>×</button>
          <p className="eyebrow">Warrior’s field manual</p>
          <h2>MOVE LIKE LIGHT.<br />STRIKE WITHOUT SOUND.</h2>
          <div className="guide-grid">
            <article><b>WASD / ARROWS</b><span>Move through the grove</span></article>
            <article><b>MOUSE / TAP</b><span>Aim and basic slash</span></article>
            <article><b>1</b><span>Chain three different lance strikes</span></article>
            <article><b>2–4</b><span>Cyclone, Spearfall, and Phantom Step</span></article>
            <article><b>SPACE / SHIFT</b><span>Phantom dash</span></article>
            <article><b>M</b><span>Open the world map</span></article>
            <article><b>E</b><span>Speak, inspect, rest, and trade</span></article>
            <article><b>ROUTES</b><span>Follow gold arrows at the map edges</span></article>
            <article><b>OBJECTIVE</b><span>Explore the routes and break the guardian mark</span></article>
          </div>
          <button className="gold-button" onClick={() => setGuideOpen(false)}>READY</button>
        </section>
      )}

      {dialogue && (
        <section className="dialogue-overlay" role="dialog" aria-label={`Dialogue with ${dialogue.speaker}`}>
          <div className="dialogue-box">
            <div className="dialogue-portrait">
              {dialogue.id === "elder" || dialogue.id === "luma" || dialogue.id === "vey" ? (
                <img
                  src={`/art/sprites/${dialogue.id === "elder" ? "elder-ash-v2" : dialogue.id === "vey" ? "vey-v2" : dialogue.id}.png`}
                  alt={dialogue.speaker}
                />
              ) : <span>{dialogue.id === "chest" ? "◆" : dialogue.id === "gate" ? "◈" : "◇"}</span>}
            </div>
            <div className="dialogue-copy">
              <small>{dialogue.title}</small>
              <h3>{dialogue.speaker}</h3>
              <p>{dialogue.body}</p>
              <div className="dialogue-actions">
                {dialogue.id === "elder" && <button onClick={() => dialogueAction("listen")}>LISTEN TO THE ROOTS</button>}
                {dialogue.id === "luma" && <button onClick={() => dialogueAction("buy")}>BUY NECTAR · 3 SHARDS</button>}
                {dialogue.id === "vey" && <button onClick={() => dialogueAction("map")}>UPDATE MY MAP</button>}
                <button onClick={closeDialogue}>{dialogue.id === "gate" ? "STEP BACK" : "LEAVE"}</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {(phase === "won" || phase === "dead") && (
        <section className={`end-screen ${phase}`}>
          <div className="end-sigil">{phase === "won" ? "✦" : "◇"}</div>
          <p>{phase === "won" ? "THE GROVE FALLS SILENT" : "THE RIFT CLAIMS ANOTHER"}</p>
          <h2>{phase === "won" ? "ELITE VANQUISHED" : "YOU HAVE FALLEN"}</h2>
          <span>{phase === "won" ? `Forest Brute defeated · ${hud.shards} shards recovered` : "Rise again. Learn its rhythm."}</span>
          <button className="gold-button" onClick={startGame}>{phase === "won" ? "PLAY AGAIN" : "RETURN TO BATTLE"}</button>
          {phase === "won" && <button className="text-button" onClick={() => { mapRef.current = true; setMapOpen(true); }}>VIEW WORLD MAP</button>}
        </section>
      )}
    </main>
  );
}
