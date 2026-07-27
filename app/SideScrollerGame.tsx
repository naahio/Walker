"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ZoneId = "grove" | "fields" | "ruins";
type Phase = "title" | "playing" | "dead";
type Action = "idle" | "run" | "jump" | "attack" | "dash";
type PlatformKind = "earth" | "stone" | "wood" | "ruin" | "barrier" | "ghost";
type Platform = { x: number; y: number; w: number; h: number; kind: PlatformKind };
type Ramp = { x1: number; y1: number; x2: number; y2: number };
type SideEnemy = {
  id: number;
  kind: "wisp" | "hound" | "golem" | "archer" | "boss";
  x: number;
  y: number;
  baseX: number;
  range: number;
  direction: number;
  hp: number;
  maxHp: number;
  dead?: boolean;
  flash: number;
  cooldown: number;
};
type Effect = {
  kind: "slash" | "cyclone" | "spearfall" | "dash" | "hit";
  x: number;
  y: number;
  life: number;
  max: number;
  radius: number;
  direction: number;
  color: string;
};
type Images = Partial<Record<"hero" | "wisp" | "hound" | "golem" | "archer" | "boss" | "elder" | "luma" | "vey" | "props" | "roomsA" | "roomsB" | "environmentKit", HTMLImageElement>>;
type GroveProp = { x: number; y: number; cell: number; w: number; h: number; flip?: boolean; back?: boolean };
type EnvironmentPiece = { x: number; y: number; cell: number; w: number; h: number; flip?: boolean; alpha?: number };
type SecretWall = { id: string; x: number; y: number; w: number; h: number; hp: number; broken: boolean };
type Relic = { id: "sun" | "tide" | "grub"; x: number; y: number; collected: boolean };
type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  wallDir: number;
  invuln: number;
  action: Action;
  actionTime: number;
  actionDuration: number;
};
type Game = {
  player: Player;
  zone: ZoneId;
  enemies: Record<ZoneId, SideEnemy[]>;
  keys: Set<string>;
  effects: Effect[];
  cooldowns: number[];
  camera: { x: number; y: number };
  time: number;
  last: number;
  shake: number;
  kills: number;
  shards: number;
  secretWalls: SecretWall[];
  relics: Relic[];
  checkpoint: { x: number; y: number };
  rescued: boolean;
  room: string;
};

const W = 1280;
const H = 720;
const WORLD_W = 6800;
const WORLD_H = 1600;
const GRAVITY = 1900;
const PLAYER_W = 34;
const PLAYER_H = 72;

const ZONES: Record<ZoneId, { name: string; area: string; next?: ZoneId; previous?: ZoneId }> = {
  grove: { name: "WHISPERING GROVE", area: "THE ROOTBOUND CROSSROADS" },
  fields: { name: "SILENT FIELDS", area: "WINDSONG REACH", previous: "grove", next: "ruins" },
  ruins: { name: "ANCIENT RUINS", area: "THE SUNKEN ARCHIVE", previous: "fields" },
};

const LEVELS: Record<ZoneId, Platform[]> = {
  grove: [
    // Pilgrim's Mouth — safe arrival chamber
    { x: 0, y: 790, w: 1080, h: 810, kind: "ghost" },
    { x: 35, y: 490, w: 125, h: 28, kind: "ghost" },
    { x: 565, y: 460, w: 145, h: 30, kind: "ghost" },
    { x: 830, y: 700, w: 250, h: 30, kind: "ghost" },
    { x: 1060, y: 0, w: 20, h: 790, kind: "ghost" },
    // The Crossroads — tall central hub with three readable routes
    { x: 1080, y: 1330, w: 1250, h: 270, kind: "earth" },
    { x: 1120, y: 1120, w: 300, h: 36, kind: "stone" },
    { x: 1510, y: 1010, w: 280, h: 36, kind: "stone" },
    { x: 1900, y: 900, w: 280, h: 36, kind: "stone" },
    { x: 1250, y: 770, w: 270, h: 34, kind: "wood" },
    { x: 1660, y: 650, w: 300, h: 36, kind: "stone" },
    { x: 2050, y: 560, w: 280, h: 36, kind: "stone" },
    // Upper route — Bellroot Chapel
    { x: 2330, y: 560, w: 1070, h: 54, kind: "ruin" },
    { x: 2470, y: 410, w: 260, h: 34, kind: "ruin" },
    { x: 2860, y: 340, w: 300, h: 34, kind: "ruin" },
    { x: 3200, y: 500, w: 250, h: 34, kind: "ruin" },
    { x: 3450, y: 720, w: 380, h: 36, kind: "stone" },
    { x: 3700, y: 920, w: 420, h: 36, kind: "stone" },
    // Lower route — Murmuring Cistern
    { x: 2260, y: 1430, w: 520, h: 170, kind: "earth" },
    { x: 2880, y: 1470, w: 350, h: 130, kind: "stone" },
    { x: 3330, y: 1400, w: 440, h: 200, kind: "earth" },
    { x: 2390, y: 1240, w: 230, h: 32, kind: "wood" },
    { x: 2760, y: 1130, w: 250, h: 32, kind: "stone" },
    { x: 3140, y: 1240, w: 230, h: 32, kind: "wood" },
    { x: 3520, y: 1090, w: 300, h: 34, kind: "stone" },
    // Secret rescue gallery and shortcut chamber
    { x: 3820, y: 1350, w: 920, h: 250, kind: "ruin" },
    { x: 3950, y: 1120, w: 300, h: 36, kind: "ruin" },
    { x: 4380, y: 980, w: 300, h: 36, kind: "ruin" },
    { x: 4740, y: 1290, w: 700, h: 310, kind: "stone" },
    { x: 4810, y: 1070, w: 260, h: 34, kind: "wood" },
    { x: 5140, y: 940, w: 300, h: 36, kind: "stone" },
    // Guardian approach and arena
    { x: 5440, y: 1280, w: 1360, h: 320, kind: "ruin" },
    { x: 5600, y: 1080, w: 280, h: 36, kind: "ruin" },
    { x: 6000, y: 980, w: 300, h: 36, kind: "ruin" },
    { x: 6390, y: 1090, w: 300, h: 36, kind: "ruin" },
  ],
  fields: [
    { x: 0, y: 800, w: 780, h: 100, kind: "earth" },
    { x: 890, y: 750, w: 590, h: 150, kind: "earth" },
    { x: 1600, y: 790, w: 730, h: 110, kind: "earth" },
    { x: 2450, y: 735, w: 500, h: 165, kind: "earth" },
    { x: 3060, y: 800, w: 540, h: 100, kind: "earth" },
    { x: 310, y: 610, w: 340, h: 32, kind: "wood" },
    { x: 980, y: 555, w: 260, h: 34, kind: "stone" },
    { x: 1410, y: 650, w: 310, h: 32, kind: "wood" },
    { x: 2030, y: 570, w: 330, h: 34, kind: "stone" },
    { x: 2580, y: 500, w: 260, h: 32, kind: "wood" },
    { x: 3100, y: 620, w: 320, h: 34, kind: "stone" },
  ],
  ruins: [
    { x: 0, y: 800, w: 620, h: 100, kind: "ruin" },
    { x: 730, y: 740, w: 620, h: 160, kind: "ruin" },
    { x: 1480, y: 805, w: 580, h: 95, kind: "ruin" },
    { x: 2170, y: 735, w: 620, h: 165, kind: "ruin" },
    { x: 2900, y: 800, w: 700, h: 100, kind: "ruin" },
    { x: 280, y: 610, w: 300, h: 38, kind: "ruin" },
    { x: 820, y: 540, w: 270, h: 38, kind: "ruin" },
    { x: 1210, y: 430, w: 240, h: 38, kind: "ruin" },
    { x: 1570, y: 600, w: 350, h: 38, kind: "ruin" },
    { x: 2080, y: 485, w: 280, h: 38, kind: "ruin" },
    { x: 2530, y: 580, w: 310, h: 38, kind: "ruin" },
    { x: 3120, y: 610, w: 300, h: 38, kind: "ruin" },
    { x: 1100, y: 250, w: 180, h: 32, kind: "ruin" },
    { x: 2380, y: 315, w: 190, h: 32, kind: "ruin" },
  ],
};

const NPCS: Record<ZoneId, { x: number; y: number; kind: "elder" | "luma" | "vey"; name: string }[]> = {
  grove: [
    { x: 120, y: 790, kind: "elder", name: "Elder Ash" },
    { x: 4510, y: 980, kind: "vey", name: "Caged Vey" },
  ],
  fields: [{ x: 1100, y: 555, kind: "luma", name: "Luma" }],
  ruins: [{ x: 1325, y: 430, kind: "vey", name: "Vey" }],
};

const GROVE_PROPS: GroveProp[] = [
  { x: 70, y: 1285, cell: 0, w: 280, h: 280, back: true },
  { x: 430, y: 1040, cell: 1, w: 90, h: 130 },
  { x: 795, y: 1280, cell: 3, w: 120, h: 150 },
  { x: 1180, y: 1330, cell: 2, w: 140, h: 210, back: true },
  { x: 1440, y: 1325, cell: 4, w: 190, h: 170 },
  { x: 2050, y: 1335, cell: 3, w: 130, h: 160 },
  { x: 2440, y: 560, cell: 8, w: 230, h: 240, back: true },
  { x: 2810, y: 342, cell: 1, w: 86, h: 125 },
  { x: 3090, y: 344, cell: 9, w: 120, h: 145 },
  { x: 3260, y: 500, cell: 5, w: 140, h: 140 },
  { x: 3550, y: 720, cell: 7, w: 150, h: 105 },
  { x: 2320, y: 1430, cell: 12, w: 230, h: 150 },
  { x: 2730, y: 1430, cell: 4, w: 160, h: 145 },
  { x: 3070, y: 1470, cell: 12, w: 220, h: 145, flip: true },
  { x: 3490, y: 1400, cell: 5, w: 150, h: 150 },
  { x: 3795, y: 1350, cell: 6, w: 170, h: 190 },
  { x: 4310, y: 1350, cell: 10, w: 190, h: 220 },
  { x: 4790, y: 1290, cell: 11, w: 180, h: 130 },
  { x: 5090, y: 1290, cell: 1, w: 82, h: 120 },
  { x: 5360, y: 1280, cell: 14, w: 170, h: 240 },
  { x: 5720, y: 1280, cell: 15, w: 140, h: 130 },
  { x: 6160, y: 1280, cell: 2, w: 160, h: 230, back: true },
  { x: 6630, y: 1280, cell: 15, w: 140, h: 130 },
];

const FIRST_ROOM_BACK: EnvironmentPiece[] = [
  { x: 120, y: 790, cell: 1, w: 220, h: 520, alpha: .38 },
  { x: 370, y: 790, cell: 1, w: 220, h: 540, alpha: .34 },
  { x: 650, y: 790, cell: 1, w: 220, h: 530, alpha: .34 },
  { x: 930, y: 790, cell: 1, w: 220, h: 520, alpha: .38 },
  { x: 1030, y: 790, cell: 6, w: 250, h: 400, alpha: .52 },
  { x: 110, y: 535, cell: 11, w: 165, h: 230, alpha: .72 },
];

const FIRST_ROOM_SOLID_ART: EnvironmentPiece[] = [
  { x: 170, y: 790, cell: 0, w: 360, h: 170 },
  { x: 510, y: 790, cell: 0, w: 360, h: 170 },
  { x: 850, y: 790, cell: 0, w: 360, h: 170 },
  { x: 185, y: 790, cell: 3, w: 300, h: 300 },
  { x: 500, y: 790, cell: 2, w: 330, h: 330 },
  { x: 635, y: 460, cell: 4, w: 205, h: 280 },
  { x: 940, y: 700, cell: 5, w: 250, h: 270 },
  { x: 825, y: 790, cell: 14, w: 180, h: 250, alpha: .66 },
  { x: 1030, y: 790, cell: 15, w: 205, h: 135 },
];

const FIRST_ROOM_FRONT: EnvironmentPiece[] = [
  { x: 8, y: 790, cell: 8, w: 250, h: 450, alpha: .88 },
  { x: 1072, y: 790, cell: 10, w: 250, h: 400, alpha: .9 },
  { x: 280, y: 250, cell: 12, w: 360, h: 270, alpha: .72 },
  { x: 765, y: 250, cell: 9, w: 390, h: 270, alpha: .74 },
  { x: 970, y: 825, cell: 13, w: 300, h: 215, alpha: .72 },
];

const ROOMS = [
  { from: 0, to: 1080, name: "PILGRIM'S MOUTH", hint: "A quiet threshold beneath the roots" },
  { from: 1080, to: 2330, name: "ROOTBOUND CROSSROADS", hint: "Three roads, one forgotten promise" },
  { from: 2330, to: 3820, name: "BELLROOT CHAPEL", hint: "Above: the Sun Sigil · Below: the Cistern" },
  { from: 3820, to: 4740, name: "THE HIDDEN GALLERY", hint: "A voice waits behind cracked stone" },
  { from: 4740, to: 5440, name: "OLD ROOT STATION", hint: "Rest, remember, return" },
  { from: 5440, to: 6800, name: "GUARDIAN'S HALL", hint: "The way forward demands two sigils" },
];

const GROVE_RAMPS: Ramp[] = [
  // These slopes trace the painted staircases in Pilgrim's Mouth.
  { x1: 35, y1: 490, x2: 335, y2: 790 },
  { x1: 335, y1: 790, x2: 665, y2: 460 },
  // Crossroads ascent and chapel descent use the same invisible stair logic.
  { x1: 1120, y1: 1330, x2: 1420, y2: 1120 },
  { x1: 1510, y1: 1010, x2: 1790, y2: 900 },
  { x1: 1900, y1: 900, x2: 2180, y2: 560 },
  { x1: 3400, y1: 560, x2: 3820, y2: 920 },
];

const CAVE_PORTALS = [
  { x: 635, y: 460, targetX: 1230, targetY: 1330, name: "ROOTBOUND CROSSROADS" },
  { x: 940, y: 700, targetX: 2450, targetY: 1430, name: "MURMURING CISTERN" },
  { x: 1160, y: 1330, targetX: 635, targetY: 460, name: "PILGRIM'S MOUTH" },
];

function makeEnemies(zone: ZoneId): SideEnemy[] {
  const data = zone === "grove"
    ? [
        ["hound", 1260, 1330, 120, 90],
        ["wisp", 1680, 930, 120, 70],
        ["archer", 2040, 900, 100, 90],
        ["wisp", 2670, 500, 140, 75],
        ["archer", 3140, 340, 100, 95],
        ["hound", 2500, 1430, 100, 95],
        ["golem", 3500, 1400, 120, 180],
        ["wisp", 4140, 1070, 110, 80],
        ["hound", 4980, 1290, 110, 100],
        ["boss", 6250, 1280, 360, 950],
      ]
    : zone === "fields"
      ? [
          ["hound", 470, 800, 180, 90],
          ["archer", 1530, 650, 120, 85],
          ["wisp", 1700, 680, 160, 70],
          ["golem", 2670, 735, 150, 180],
          ["hound", 3210, 800, 130, 100],
        ]
      : [
          ["golem", 440, 800, 140, 190],
          ["wisp", 930, 500, 130, 85],
          ["archer", 1700, 600, 140, 95],
          ["hound", 2300, 735, 170, 110],
          ["golem", 3220, 800, 140, 220],
        ];
  return data.map((item, index) => ({
    id: index + (zone === "grove" ? 0 : zone === "fields" ? 20 : 40),
    kind: item[0] as SideEnemy["kind"],
    x: item[1] as number,
    y: item[2] as number,
    baseX: item[1] as number,
    range: item[3] as number,
    direction: index % 2 ? -1 : 1,
    hp: item[4] as number,
    maxHp: item[4] as number,
    flash: 0,
    cooldown: 0,
  }));
}

function freshGame(): Game {
  return {
    player: {
      x: 220,
      y: 790,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: 560,
      maxHp: 560,
      energy: 300,
      maxEnergy: 300,
      onGround: true,
      coyote: 0.1,
      jumpBuffer: 0,
      wallDir: 0,
      invuln: 0,
      action: "idle",
      actionTime: 0,
      actionDuration: 0,
    },
    zone: "grove",
    enemies: { grove: makeEnemies("grove"), fields: makeEnemies("fields"), ruins: makeEnemies("ruins") },
    keys: new Set(),
    effects: [],
    cooldowns: [0, 0, 0, 0],
    camera: { x: 0, y: 180 },
    time: 0,
    last: performance.now(),
    shake: 0,
    kills: 0,
    shards: 0,
    secretWalls: [
      { id: "gallery", x: 3770, y: 900, w: 54, h: 450, hp: 76, broken: false },
      { id: "entrance-cache", x: 8, y: 1010, w: 46, h: 270, hp: 38, broken: false },
    ],
    relics: [
      { id: "sun", x: 3005, y: 295, collected: false },
      { id: "tide", x: 3530, y: 1350, collected: false },
      { id: "grub", x: 55, y: 430, collected: false },
    ],
    checkpoint: { x: 220, y: 790 },
    rescued: false,
    room: "PILGRIM'S MOUTH",
  };
}

function activePlatforms(game: Game) {
  const walls = game.secretWalls
    .filter((wall) => !wall.broken)
    .map((wall) => ({ x: wall.x, y: wall.y, w: wall.w, h: wall.h, kind: "barrier" as PlatformKind }));
  const hasBothSigils = game.relics.filter((relic) => relic.id !== "grub" && relic.collected).length === 2;
  if (game.zone === "grove" && !hasBothSigils) walls.push({ x: 5392, y: 910, w: 48, h: 370, kind: "barrier" });
  return [...LEVELS[game.zone], ...walls];
}

function overlaps(x: number, y: number, w: number, h: number, platform: Platform) {
  return x < platform.x + platform.w && x + w > platform.x && y < platform.y + platform.h && y + h > platform.y;
}

function movePlayer(game: Game, dt: number) {
  const p = game.player;
  const platforms = activePlatforms(game);
  const left = game.keys.has("a") || game.keys.has("arrowleft");
  const right = game.keys.has("d") || game.keys.has("arrowright");
  const direction = (right ? 1 : 0) - (left ? 1 : 0);
  const acceleration = p.onGround ? 2200 : 1350;
  const maxSpeed = 330;
  if (direction) {
    p.vx += direction * acceleration * dt;
    p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx));
    p.facing = direction;
  } else if (p.action !== "dash") {
    p.vx *= Math.pow(p.onGround ? 0.0007 : 0.07, dt);
  }
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.coyote = p.onGround ? 0.11 : Math.max(0, p.coyote - dt);
  p.wallDir = 0;
  const top = p.y - PLAYER_H;
  const sideProbeLeft = platforms.some((platform) => overlaps(p.x - PLAYER_W / 2 - 4, top + 8, 4, PLAYER_H - 12, platform));
  const sideProbeRight = platforms.some((platform) => overlaps(p.x + PLAYER_W / 2, top + 8, 4, PLAYER_H - 12, platform));
  if (sideProbeLeft) p.wallDir = -1;
  if (sideProbeRight) p.wallDir = 1;
  if (p.jumpBuffer > 0 && (p.coyote > 0 || p.wallDir !== 0)) {
    p.vy = -660;
    if (p.wallDir !== 0 && !p.onGround) {
      p.vx = -p.wallDir * 410;
      p.facing = -p.wallDir;
    }
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
  }
  if (p.action !== "dash") {
    p.vy += GRAVITY * dt;
    if (p.wallDir !== 0 && p.vy > 220) p.vy = 220;
  }
  const oldX = p.x;
  p.x += p.vx * dt;
  for (const platform of platforms) {
    if (!overlaps(p.x - PLAYER_W / 2, p.y - PLAYER_H, PLAYER_W, PLAYER_H, platform)) continue;
    if (p.vx > 0) p.x = platform.x - PLAYER_W / 2;
    else if (p.vx < 0) p.x = platform.x + platform.w + PLAYER_W / 2;
    p.vx = 0;
  }
  if (Math.abs(p.x - oldX) < 0.01 && direction) p.wallDir = direction;
  const oldY = p.y;
  p.y += p.vy * dt;
  p.onGround = false;
  for (const platform of platforms) {
    if (!overlaps(p.x - PLAYER_W / 2, p.y - PLAYER_H, PLAYER_W, PLAYER_H, platform)) continue;
    if (p.vy >= 0 && oldY <= platform.y + 3) {
      p.y = platform.y;
      p.vy = 0;
      p.onGround = true;
    } else if (p.vy < 0 && oldY - PLAYER_H >= platform.y + platform.h - 3) {
      p.y = platform.y + platform.h + PLAYER_H;
      p.vy = 0;
    }
  }
  if (game.zone === "grove" && p.vy >= 0) {
    for (const ramp of GROVE_RAMPS) {
      const minX = Math.min(ramp.x1, ramp.x2);
      const maxX = Math.max(ramp.x1, ramp.x2);
      if (p.x < minX || p.x > maxX) continue;
      const ratio = (p.x - ramp.x1) / (ramp.x2 - ramp.x1);
      const rampY = ramp.y1 + (ramp.y2 - ramp.y1) * ratio;
      if (p.y >= rampY - 8 && oldY <= rampY + 24) {
        p.y = rampY;
        p.vy = 0;
        p.onGround = true;
      }
    }
  }
  p.x = Math.max(18, Math.min(WORLD_W - 18, p.x));
  if (p.y > WORLD_H + 120) {
    p.hp -= 70;
    p.x = game.checkpoint.x;
    p.y = game.checkpoint.y;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.energy = Math.min(p.maxEnergy, p.energy + 17 * dt);
  p.actionTime = Math.max(0, p.actionTime - dt);
  if (p.actionTime <= 0) p.action = !p.onGround ? "jump" : Math.abs(p.vx) > 35 ? "run" : "idle";
}

function hitEnemy(game: Game, enemy: SideEnemy, damage: number) {
  if (enemy.dead) return;
  enemy.hp -= damage * (enemy.kind === "boss" ? 0.7 : 1);
  enemy.flash = 0.16;
  enemy.x += game.player.facing * (enemy.kind === "boss" ? 12 : 34);
  game.effects.push({ kind: "hit", x: enemy.x, y: enemy.y - 45, life: 0.25, max: 0.25, radius: 28, direction: 1, color: "#f5d98e" });
  if (enemy.hp <= 0) {
    enemy.dead = true;
    game.kills++;
    game.shards += enemy.kind === "boss" ? 12 : 1;
    game.player.energy = Math.min(300, game.player.energy + 30);
  }
}

function useAbility(game: Game, slot: number) {
  const p = game.player;
  const costs = [0, 42, 65, 50];
  const cooldowns = [0.34, 2.6, 4.2, 1.8];
  if (game.cooldowns[slot] > 0 || p.energy < costs[slot]) return;
  game.cooldowns[slot] = cooldowns[slot];
  p.energy -= costs[slot];
  if (slot === 3) {
    p.action = "dash";
    p.actionTime = p.actionDuration = 0.19;
    p.vx = p.facing * 900;
    p.vy = 0;
    p.invuln = 0.32;
    game.effects.push({ kind: "dash", x: p.x, y: p.y - 45, life: 0.28, max: 0.28, radius: 130, direction: p.facing, color: "#bc85f4" });
  } else {
    p.action = "attack";
    p.actionTime = p.actionDuration = slot === 2 ? 0.62 : 0.38;
    const kind: Effect["kind"] = slot === 0 ? "slash" : slot === 1 ? "cyclone" : "spearfall";
    const radius = slot === 0 ? 105 : slot === 1 ? 145 : 170;
    const ex = slot === 2 ? p.x : p.x + p.facing * 72;
    const ey = slot === 2 ? p.y + 10 : p.y - 45;
    game.effects.push({ kind, x: ex, y: ey, life: slot === 2 ? 0.7 : 0.38, max: slot === 2 ? 0.7 : 0.38, radius, direction: p.facing, color: "#f3d78a" });
    for (const enemy of game.enemies[game.zone]) {
      if (enemy.dead) continue;
      const dx = Math.abs(enemy.x - ex);
      const dy = Math.abs(enemy.y - 45 - ey);
      const inFront = slot !== 0 || Math.sign(enemy.x - p.x) === p.facing || Math.abs(enemy.x - p.x) < 30;
      if (dx < radius && dy < radius * 0.72 && inFront) hitEnemy(game, enemy, slot === 0 ? 38 : slot === 1 ? 66 : 108);
    }
    for (const wall of game.secretWalls) {
      if (wall.broken) continue;
      const wallCenter = wall.x + wall.w / 2;
      if (Math.abs(wallCenter - ex) < radius + wall.w / 2 && Math.abs(wall.y + wall.h / 2 - ey) < radius + wall.h / 2) {
        wall.hp -= slot === 0 ? 38 : 76;
        game.effects.push({ kind: "hit", x: wallCenter, y: wall.y + wall.h / 2, life: 0.35, max: 0.35, radius: 42, direction: 1, color: "#d4bc82" });
        if (wall.hp <= 0) {
          wall.broken = true;
          game.shards += 3;
        }
      }
    }
  }
}

function drawParallax(c: CanvasRenderingContext2D, game: Game) {
  const zone = game.zone;
  const palette = zone === "grove"
    ? ["#071410", "#10271e", "#244334"]
    : zone === "fields"
      ? ["#0c1717", "#1c3030", "#526048"]
      : ["#080c16", "#171a2c", "#31324a"];
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, palette[0]);
  sky.addColorStop(0.58, palette[1]);
  sky.addColorStop(1, palette[2]);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(-(game.camera.x * 0.12) % 520, -game.camera.y * 0.04);
  c.fillStyle = zone === "ruins" ? "rgba(16,18,34,.92)" : "rgba(8,22,17,.88)";
  for (let i = -1; i < 5; i++) {
    const x = i * 520;
    c.beginPath();
    c.moveTo(x, 610);
    c.quadraticCurveTo(x + 120, 260, x + 245, 590);
    c.quadraticCurveTo(x + 390, 180, x + 540, 610);
    c.lineTo(x + 540, 720);
    c.lineTo(x, 720);
    c.fill();
  }
  c.restore();
  c.save();
  c.translate(-(game.camera.x * 0.28) % 380, 0);
  c.strokeStyle = zone === "fields" ? "rgba(113,139,104,.2)" : "rgba(74,101,86,.22)";
  c.lineWidth = 18;
  for (let i = -1; i < 6; i++) {
    c.beginPath();
    c.moveTo(i * 380 + 40, 720);
    c.bezierCurveTo(i * 380 + 80, 500, i * 380 + 240, 420, i * 380 + 320, 120);
    c.stroke();
  }
  c.restore();
  for (let i = 0; i < 42; i++) {
    const x = ((i * 193 - game.camera.x * (0.18 + (i % 3) * 0.08)) % (W + 100)) - 50;
    const y = 90 + ((i * 79) % 560);
    c.fillStyle = i % 5 === 0 ? "rgba(210,184,105,.38)" : "rgba(109,190,176,.24)";
    c.beginPath();
    c.arc(x, y + Math.sin(game.time * 1.3 + i) * 8, 1.4 + (i % 3), 0, Math.PI * 2);
    c.fill();
  }
}

function drawRoomCell(c: CanvasRenderingContext2D, image: HTMLImageElement | undefined, cell: number, x: number, y: number, w: number, h: number) {
  if (!image?.complete || !image.naturalWidth) return;
  const sw = image.naturalWidth / 2;
  const sh = image.naturalHeight / 2;
  c.drawImage(image, (cell % 2) * sw, Math.floor(cell / 2) * sh, sw, sh, x, y, w, h);
}

function drawGroveArchitecture(c: CanvasRenderingContext2D, game: Game, images: Images) {
  if (game.zone !== "grove") return;
  c.save();
  c.translate(-game.camera.x, -game.camera.y);
  const entranceDepth = c.createLinearGradient(0, 80, 0, 900);
  entranceDepth.addColorStop(0, "#020809");
  entranceDepth.addColorStop(.55, "#09211d");
  entranceDepth.addColorStop(1, "#06100f");
  c.fillStyle = entranceDepth;
  c.fillRect(0, 0, 1080, 900);
  const entranceLight = c.createRadialGradient(620, 470, 40, 620, 470, 520);
  entranceLight.addColorStop(0, "rgba(103,172,154,.34)");
  entranceLight.addColorStop(.45, "rgba(43,95,83,.14)");
  entranceLight.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = entranceLight;
  c.fillRect(0, 0, 1080, 900);
  c.fillStyle = "rgba(1,5,6,.72)";
  c.beginPath();
  c.moveTo(0, 180);
  c.lineTo(210, 180);
  c.bezierCurveTo(300, 330, 315, 540, 410, 690);
  c.bezierCurveTo(540, 500, 590, 300, 720, 180);
  c.lineTo(1080, 180);
  c.lineTo(1080, 410);
  c.bezierCurveTo(880, 330, 785, 520, 680, 690);
  c.bezierCurveTo(510, 545, 360, 420, 0, 520);
  c.closePath();
  c.fill();
  drawRoomCell(c, images.roomsA, 1, 1080, 180, 1250, 1220);
  drawRoomCell(c, images.roomsA, 2, 2330, 0, 1490, 820);
  drawRoomCell(c, images.roomsA, 3, 2260, 800, 1560, 800);
  drawRoomCell(c, images.roomsB, 0, 3820, 220, 920, 1180);
  drawRoomCell(c, images.roomsB, 1, 4740, 250, 700, 1150);
  drawRoomCell(c, images.roomsB, 2, 5440, 160, 1360, 1240);
  for (const room of ROOMS) {
    if (room.from === 0) continue;
    const width = room.to - room.from;
    const glow = room.name.includes("CHAPEL") ? "#c7aa63" : room.name.includes("GALLERY") ? "#725c9d" : "#4c8c7b";
    c.fillStyle = "rgba(4,10,11,.18)";
    c.fillRect(room.from, 120, width, 1480);
    c.strokeStyle = "rgba(111,128,113,.16)";
    c.lineWidth = 18;
    for (let x = room.from + 120; x < room.to; x += 310) {
      c.beginPath();
      c.moveTo(x, 1280);
      c.lineTo(x, 470);
      c.quadraticCurveTo(x + 80, 330, x + 160, 470);
      c.lineTo(x + 160, 1280);
      c.stroke();
    }
    const chamberGlow = c.createRadialGradient(room.from + width / 2, 850, 20, room.from + width / 2, 850, 620);
    chamberGlow.addColorStop(0, `${glow}24`);
    chamberGlow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = chamberGlow;
    c.fillRect(room.from, 180, width, 1320);
  }

  c.strokeStyle = "rgba(178,162,118,.22)";
  c.lineWidth = 22;
  c.beginPath();
  c.arc(2920, 610, 520, Math.PI, Math.PI * 2);
  c.stroke();
  for (let x = 2500; x <= 3300; x += 200) {
    c.fillStyle = "rgba(208,184,108,.07)";
    c.beginPath();
    c.moveTo(x - 55, 530);
    c.quadraticCurveTo(x, 390, x + 55, 530);
    c.lineTo(x + 55, 570);
    c.lineTo(x - 55, 570);
    c.fill();
  }

  const water = c.createLinearGradient(0, 1390, 0, 1600);
  water.addColorStop(0, "rgba(48,154,174,.48)");
  water.addColorStop(1, "rgba(5,35,48,.88)");
  c.fillStyle = water;
  c.fillRect(2200, 1440, 1660, 160);
  c.strokeStyle = "rgba(132,226,231,.42)";
  c.lineWidth = 3;
  for (let x = 2230; x < 3840; x += 110) {
    c.beginPath();
    c.moveTo(x, 1444 + Math.sin(game.time * 2 + x) * 3);
    c.quadraticCurveTo(x + 45, 1436, x + 90, 1444);
    c.stroke();
  }

  c.strokeStyle = "rgba(183,146,70,.2)";
  c.lineWidth = 26;
  for (let x = 5580; x < 6800; x += 280) {
    c.beginPath();
    c.moveTo(x, 1280);
    c.quadraticCurveTo(x + 80, 690, x + 180, 1280);
    c.stroke();
  }
  c.restore();
}

function drawProp(c: CanvasRenderingContext2D, prop: GroveProp, image: HTMLImageElement | undefined, camera: Game["camera"]) {
  if (!image?.complete || !image.naturalWidth) return;
  const sw = image.naturalWidth / 4;
  const sh = image.naturalHeight / 4;
  c.save();
  c.translate(prop.x - camera.x, prop.y - camera.y);
  if (prop.flip) c.scale(-1, 1);
  c.drawImage(image, (prop.cell % 4) * sw, Math.floor(prop.cell / 4) * sh, sw, sh, -prop.w / 2, -prop.h, prop.w, prop.h);
  c.restore();
}

function drawEnvironmentPiece(c: CanvasRenderingContext2D, piece: EnvironmentPiece, image: HTMLImageElement | undefined, camera: Game["camera"]) {
  if (!image?.complete || !image.naturalWidth) return;
  const sw = image.naturalWidth / 4;
  const sh = image.naturalHeight / 4;
  c.save();
  c.globalAlpha = piece.alpha ?? 1;
  c.translate(piece.x - camera.x, piece.y - camera.y);
  if (piece.flip) c.scale(-1, 1);
  c.drawImage(image, (piece.cell % 4) * sw, Math.floor(piece.cell / 4) * sh, sw, sh, -piece.w / 2, -piece.h, piece.w, piece.h);
  c.restore();
}

function drawPlatform(c: CanvasRenderingContext2D, platform: Platform, camera: Game["camera"], time: number) {
  if (platform.kind === "ghost") return;
  const x = platform.x - camera.x;
  const y = platform.y - camera.y;
  if (x > W + 80 || x + platform.w < -80 || y > H + 100 || y + platform.h < -100) return;
  const top = platform.kind === "earth" ? "#51633d" : platform.kind === "wood" ? "#8a6a3e" : platform.kind === "ruin" ? "#555762" : platform.kind === "barrier" ? "#6e6654" : "#62665f";
  const face = platform.kind === "earth" ? "#17271c" : platform.kind === "wood" ? "#34271b" : platform.kind === "ruin" ? "#222532" : platform.kind === "barrier" ? "#282821" : "#292f2e";
  const depth = c.createLinearGradient(0, y, 0, y + Math.max(80, platform.h));
  depth.addColorStop(0, face);
  depth.addColorStop(.38, platform.kind === "earth" ? "#122019" : "#20242a");
  depth.addColorStop(1, "#070b0d");
  c.fillStyle = depth;
  c.fillRect(x, y, platform.w, platform.h);
  c.fillStyle = top;
  c.beginPath();
  c.moveTo(x, y + 13);
  for (let px = 0; px <= platform.w; px += 22) {
    const rough = Math.sin((platform.x + px) * .071) * 3 + Math.sin((platform.x + px) * .19) * 1.5;
    c.lineTo(x + px, y + rough);
  }
  c.lineTo(x + platform.w, y + 18);
  c.lineTo(x, y + 18);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(225,215,172,.18)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y + 2);
  c.lineTo(x + platform.w, y + 2);
  c.stroke();
  if (platform.kind === "earth") {
    c.strokeStyle = "#79905a";
    for (let px = 12; px < platform.w; px += 28) {
      c.beginPath();
      c.moveTo(x + px, y + 9);
      c.quadraticCurveTo(x + px + Math.sin(time + px) * 5, y - 8, x + px + Math.sin(px) * 7, y - 15 - (px % 4) * 3);
      c.stroke();
    }
    c.strokeStyle = "rgba(91,121,73,.3)";
    c.lineWidth = 3;
    for (let px = 35; px < platform.w; px += 92) {
      c.beginPath();
      c.moveTo(x + px, y + 12);
      c.bezierCurveTo(x + px - 18, y + 55, x + px + 35, y + 75, x + px + 8, y + 130);
      c.stroke();
    }
  } else if (platform.kind === "stone" || platform.kind === "ruin" || platform.kind === "barrier") {
    for (let row = 0; row < Math.min(platform.h, 150); row += 34) {
      const offset = row % 68 ? -28 : 0;
      for (let px = offset; px < platform.w; px += 58) {
        c.fillStyle = row % 68 ? "rgba(122,126,119,.08)" : "rgba(8,12,14,.12)";
        c.fillRect(x + px + 2, y + 16 + row, 52, 29);
        c.strokeStyle = "rgba(6,9,10,.48)";
        c.strokeRect(x + px, y + 14 + row, 56, 33);
        c.strokeStyle = "rgba(207,203,177,.08)";
        c.beginPath();
        c.moveTo(x + px + 3, y + 17 + row);
        c.lineTo(x + px + 51, y + 17 + row);
        c.stroke();
      }
    }
    c.strokeStyle = "rgba(29,55,38,.48)";
    c.lineWidth = 4;
    for (let px = 40; px < platform.w; px += 170) {
      c.beginPath();
      c.moveTo(x + px, y);
      c.bezierCurveTo(x + px + 30, y + 30, x + px - 18, y + 70, x + px + 16, y + 112);
      c.stroke();
    }
    if (platform.kind === "barrier") {
      c.strokeStyle = "rgba(225,185,91,.65)";
      c.beginPath();
      c.moveTo(x + platform.w * .2, y + 8);
      c.lineTo(x + platform.w * .7, y + platform.h * .35);
      c.lineTo(x + platform.w * .3, y + platform.h * .7);
      c.lineTo(x + platform.w * .8, y + platform.h - 8);
      c.stroke();
    }
  } else {
    c.strokeStyle = "#21170f";
    for (let px = 0; px < platform.w; px += 36) {
      c.beginPath();
      c.moveTo(x + px, y);
      c.lineTo(x + px, y + platform.h);
      c.stroke();
      c.fillStyle = "rgba(214,172,99,.1)";
      c.fillRect(x + px + 3, y + 5, 2, platform.h - 8);
    }
  }
  if (platform.h < 70) {
    c.fillStyle = "rgba(4,8,9,.82)";
    for (let px = 18; px < platform.w; px += 52) {
      const length = 13 + ((platform.x + px) % 31);
      c.beginPath();
      c.moveTo(x + px - 7, y + platform.h - 1);
      c.lineTo(x + px, y + platform.h + length);
      c.lineTo(x + px + 8, y + platform.h - 1);
      c.fill();
    }
  }
}

function drawHero(c: CanvasRenderingContext2D, player: Player, image: HTMLImageElement | undefined, camera: Game["camera"], time: number) {
  const x = player.x - camera.x;
  const y = player.y - camera.y;
  c.save();
  c.translate(x, y);
  if (player.facing < 0) c.scale(-1, 1);
  c.fillStyle = "rgba(0,0,0,.38)";
  c.beginPath();
  c.ellipse(0, 2, 34, 9, 0, 0, Math.PI * 2);
  c.fill();
  if (image?.complete && image.naturalWidth) {
    const sw = image.naturalWidth / 4;
    const sh = image.naturalHeight / 4;
    const row = player.action === "run" || player.action === "dash" ? 1 : player.action === "jump" ? 2 : player.action === "attack" ? 3 : 0;
    const progress = player.actionDuration ? 1 - player.actionTime / player.actionDuration : 0;
    const frame = player.action === "idle"
      ? Math.floor(time * 2.6) % 4
      : player.action === "run" || player.action === "dash"
        ? Math.floor(time * 10) % 4
        : player.action === "jump"
          ? player.vy < -120 ? 0 : player.vy < 100 ? 1 : player.onGround ? 3 : 2
          : Math.max(0, Math.min(3, Math.floor(progress * 4)));
    c.shadowColor = player.action === "dash" ? "#bd8cff" : "#f5dc9a";
    c.shadowBlur = player.action === "dash" ? 24 : 10;
    c.globalAlpha = player.invuln > 0 && Math.floor(time * 18) % 2 ? 0.45 : 1;
    c.drawImage(image, frame * sw, row * sh, sw, sh, -91, -162, 182, 182);
  }
  c.restore();
}

function drawEnemy(c: CanvasRenderingContext2D, enemy: SideEnemy, image: HTMLImageElement | undefined, camera: Game["camera"], time: number) {
  if (enemy.dead) return;
  const x = enemy.x - camera.x;
  const y = enemy.y - camera.y;
  const size = enemy.kind === "boss" ? 225 : enemy.kind === "golem" ? 104 : 84;
  c.save();
  c.translate(x, y);
  if (enemy.direction < 0) c.scale(-1, 1);
  c.fillStyle = "rgba(0,0,0,.42)";
  c.beginPath();
  c.ellipse(0, 0, size * 0.3, 9, 0, 0, Math.PI * 2);
  c.fill();
  c.shadowColor = enemy.kind === "boss" || enemy.kind === "hound" ? "#8ac34a" : "#6ccff1";
  c.shadowBlur = enemy.flash > 0 ? 30 : 12;
  if (image?.complete && image.naturalWidth) c.drawImage(image, -size / 2, -size, size, size);
  c.restore();
  if (enemy.kind !== "boss") {
    c.fillStyle = "#0a0c0d";
    c.fillRect(x - 27, y - size - 10, 54, 5);
    c.fillStyle = "#8ec64f";
    c.fillRect(x - 27, y - size - 10, 54 * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
}

function drawEffects(c: CanvasRenderingContext2D, game: Game) {
  for (const fx of game.effects) {
    const a = Math.max(0, fx.life / fx.max);
    const x = fx.x - game.camera.x;
    const y = fx.y - game.camera.y;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = fx.color;
    c.fillStyle = fx.color;
    c.shadowColor = fx.color;
    c.shadowBlur = 22;
    c.lineWidth = fx.kind === "cyclone" ? 9 : 6;
    if (fx.kind === "spearfall") {
      c.beginPath();
      c.moveTo(x, y - 310);
      c.lineTo(x, y);
      c.stroke();
      c.beginPath();
      c.arc(x, y, fx.radius * (1 - a * 0.35), 0, Math.PI * 2);
      c.stroke();
    } else if (fx.kind === "dash") {
      c.beginPath();
      c.moveTo(x - fx.direction * 170, y);
      c.lineTo(x + fx.direction * 70, y);
      c.stroke();
    } else if (fx.kind === "hit") {
      c.beginPath();
      c.arc(x, y, fx.radius * (1.4 - a * 0.4), 0, Math.PI * 2);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(x, y, fx.radius, fx.kind === "slash" ? -1.2 : 0, fx.kind === "slash" ? 1.2 : Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }
}

function drawRelics(c: CanvasRenderingContext2D, game: Game) {
  for (const relic of game.relics) {
    if (relic.collected) continue;
    const x = relic.x - game.camera.x;
    const y = relic.y - game.camera.y + Math.sin(game.time * 2.5 + relic.x) * 8;
    const color = relic.id === "sun" ? "#f1d176" : relic.id === "tide" ? "#60d7e8" : "#c8f39b";
    c.save();
    c.translate(x, y);
    c.shadowColor = color;
    c.shadowBlur = 28;
    c.strokeStyle = color;
    c.fillStyle = `${color}44`;
    c.lineWidth = 4;
    c.rotate(game.time * .5);
    c.beginPath();
    c.moveTo(0, -22);
    c.lineTo(17, 0);
    c.lineTo(0, 22);
    c.lineTo(-17, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
}

function drawWorld(c: CanvasRenderingContext2D, game: Game, images: Images) {
  const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  c.save();
  c.translate(sx, sy);
  drawParallax(c, game);
  drawGroveArchitecture(c, game, images);
  if (game.zone === "grove") {
    for (const piece of FIRST_ROOM_BACK) drawEnvironmentPiece(c, piece, images.environmentKit, game.camera);
    for (const piece of FIRST_ROOM_SOLID_ART) drawEnvironmentPiece(c, piece, images.environmentKit, game.camera);
  }
  const hasBothSigils = game.relics.filter((relic) => relic.id !== "grub" && relic.collected).length === 2;
  const visibleProps = GROVE_PROPS.filter((item) => item.x >= 1080 && (item.cell !== 14 || !hasBothSigils));
  if (game.zone === "grove") for (const prop of visibleProps.filter((item) => item.back)) drawProp(c, prop, images.props, game.camera);
  for (const platform of activePlatforms(game)) {
    if (game.zone === "grove" && platform.kind !== "barrier" && platform.kind !== "ghost") continue;
    drawPlatform(c, platform, game.camera, game.time);
  }
  if (game.zone === "grove") for (const prop of visibleProps.filter((item) => !item.back)) drawProp(c, prop, images.props, game.camera);
  drawRelics(c, game);
  for (const npc of NPCS[game.zone]) {
    const image = images[npc.kind];
    if (!image?.complete || !image.naturalWidth) continue;
    const size = npc.kind === "elder" ? 122 : 96;
    c.save();
    c.translate(npc.x - game.camera.x, npc.y - game.camera.y);
    c.shadowColor = npc.kind === "vey" ? "#5fa9dd" : "#d5bb72";
    c.shadowBlur = 14;
    c.drawImage(image, -size / 2, -size, size, size);
    c.restore();
  }
  for (const enemy of game.enemies[game.zone]) drawEnemy(c, enemy, images[enemy.kind], game.camera, game.time);
  drawHero(c, game.player, images.hero, game.camera, game.time);
  drawEffects(c, game);
  if (game.zone === "grove") for (const piece of FIRST_ROOM_FRONT) drawEnvironmentPiece(c, piece, images.environmentKit, game.camera);
  const modularEntrance = game.zone === "grove" && game.camera.x < 940;
  const foregroundOffset = -(game.camera.x * 0.74) % 460;
  c.fillStyle = modularEntrance ? "rgba(1,5,6,.28)" : "rgba(1,5,6,.82)";
  for (let i = -1; i < 5; i++) {
    const x = foregroundOffset + i * 460;
    c.beginPath();
    c.moveTo(x, H);
    c.bezierCurveTo(x + 35, H - 105, x + 95, H - 210, x + 138, H);
    c.bezierCurveTo(x + 220, H - 175, x + 330, H - 125, x + 460, H);
    c.fill();
    if (!modularEntrance) {
      c.beginPath();
      c.moveTo(x + 30, 0);
      c.bezierCurveTo(x + 70, 90, x + 35, 155, x + 120, 220);
      c.bezierCurveTo(x + 150, 130, x + 240, 85, x + 270, 0);
      c.fill();
    }
  }
  c.strokeStyle = modularEntrance ? "rgba(3,8,7,.32)" : "rgba(3,8,7,.88)";
  c.lineWidth = 7;
  for (let i = 0; i < 8; i++) {
    const x = ((i * 191 - game.camera.x * .68) % (W + 180)) - 90;
    const length = 80 + (i % 4) * 42;
    c.beginPath();
    c.moveTo(x, 0);
    c.bezierCurveTo(x + 32, length * .35, x - 22, length * .72, x + Math.sin(game.time + i) * 8, length);
    c.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const x = ((i * 151 - game.camera.x * .22) % (W + 60)) - 30;
    const y = (i * 83 + game.time * (8 + i % 3)) % H;
    c.fillStyle = i % 5 === 0 ? "rgba(244,207,108,.42)" : "rgba(134,208,193,.25)";
    c.beginPath();
    c.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    c.fill();
  }
  const vignette = c.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 760);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.5)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, W, H);
  c.restore();
}

export default function SideScrollerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(freshGame());
  const imagesRef = useRef<Images>({});
  const phaseRef = useRef<Phase>("title");
  const mapRef = useRef(false);
  const rafRef = useRef(0);
  const [phase, setPhaseState] = useState<Phase>("title");
  const [zone, setZone] = useState<ZoneId>("grove");
  const [mapOpen, setMapOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [nearNpc, setNearNpc] = useState<string | null>(null);
  const [hud, setHud] = useState({ hp: 560, energy: 300, boss: 950, kills: 0, shards: 0, cooldowns: [0, 0, 0, 0], sigils: 0, rescued: false, secrets: 0, room: "PILGRIM'S MOUTH" });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const startGame = useCallback(() => {
    gameRef.current = freshGame();
    setZone("grove");
    setToast("ROOTBOUND HOLLOW");
    setMapOpen(false);
    mapRef.current = false;
    setPhase("playing");
  }, [setPhase]);

  const triggerAbility = useCallback((slot: number) => {
    if (phaseRef.current === "playing" && !mapRef.current) useAbility(gameRef.current, slot);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext("2d");
    if (!c) return;
    canvas.width = W;
    canvas.height = H;
    const load = (key: keyof Images, src: string) => {
      const image = new Image();
      image.src = src;
      imagesRef.current[key] = image;
    };
    load("hero", "/art/sprites/warrior-side-animation-sheet.png");
    load("wisp", "/art/sprites/wisp.png");
    load("hound", "/art/sprites/hound.png");
    load("golem", "/art/sprites/golem.png");
    load("archer", "/art/sprites/archer.png");
    load("boss", "/art/sprites/forest-brute.png");
    load("elder", "/art/sprites/elder-ash-v2.png");
    load("luma", "/art/sprites/luma.png");
    load("vey", "/art/sprites/vey-v2.png");
    load("props", "/art/sprites/grove-props-sheet.png");
    load("roomsA", "/art/grove-room-backgrounds-a.png");
    load("roomsB", "/art/grove-room-backgrounds-b.png");
    load("environmentKit", "/art/sprites/grove-modular-environment-kit.png");

    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d", "e", "1", "2", "3", "4", "m"].includes(key)) event.preventDefault();
      gameRef.current.keys.add(key);
      if ((key === " " || key === "w" || key === "arrowup") && phaseRef.current === "playing") gameRef.current.player.jumpBuffer = 0.13;
      if (key === "1" || key === "j") triggerAbility(0);
      if (key === "2" || key === "k") triggerAbility(1);
      if (key === "3" || key === "l") triggerAbility(2);
      if (key === "4" || key === "shift") triggerAbility(3);
      if (key === "e" && phaseRef.current === "playing") {
        const game = gameRef.current;
        const npc = NPCS[game.zone].find((item) => Math.hypot(item.x - game.player.x, item.y - game.player.y) < 110);
        if (npc) {
          if (npc.kind === "vey" && !game.rescued) {
            game.rescued = true;
            game.shards += 5;
            setToast("VEY FREED · A secret route is now marked on your map.");
          } else {
            const line = npc.kind === "elder"
              ? "ELDER ASH · Find the Sun above and the Tide below. Both wake the guardian door."
              : npc.kind === "luma"
                ? "LUMA · Follow the lanterns when the wind goes quiet."
                : "VEY · The cracked walls sing when struck. Listen for the hollow sound.";
            setToast(line);
          }
        } else if (Math.abs(game.player.x - 4880) < 130 && Math.abs(game.player.y - 1290) < 140) {
          game.checkpoint = { x: 4880, y: 1290 };
          game.player.hp = game.player.maxHp;
          game.player.energy = game.player.maxEnergy;
          setToast("OLD ROOT BENCH · REST RESTORES YOUR FLAME");
        } else {
          const portal = CAVE_PORTALS.find((item) => Math.hypot(item.x - game.player.x, item.y - game.player.y) < 105);
          if (portal) {
            game.player.x = portal.targetX;
            game.player.y = portal.targetY;
            game.player.vx = 0;
            game.player.vy = 0;
            game.camera.x = Math.max(0, portal.targetX - W * .42);
            game.camera.y = Math.max(0, Math.min(WORLD_H - H, portal.targetY - H * .62));
            setToast(`ENTERED · ${portal.name}`);
          }
        }
      }
      if (key === "m" && phaseRef.current === "playing") {
        mapRef.current = !mapRef.current;
        setMapOpen(mapRef.current);
      }
      if (key === "escape") {
        mapRef.current = false;
        setMapOpen(false);
        setGuideOpen(false);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      gameRef.current.keys.delete(key);
      if ((key === " " || key === "w" || key === "arrowup") && gameRef.current.player.vy < -240) gameRef.current.player.vy *= 0.48;
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);

    const loop = (now: number) => {
      const game = gameRef.current;
      const dt = Math.min(0.033, (now - game.last) / 1000 || 0);
      game.last = now;
      if (phaseRef.current === "playing" && !mapRef.current) {
        game.time += dt;
        game.cooldowns = game.cooldowns.map((value) => Math.max(0, value - dt));
        movePlayer(game, dt);
        const player = game.player;
        for (const relic of game.relics) {
          if (!relic.collected && Math.hypot(relic.x - player.x, relic.y - (player.y - 38)) < 72) {
            relic.collected = true;
            game.shards += relic.id === "grub" ? 4 : 2;
            setToast(relic.id === "sun"
              ? "SUN SIGIL FOUND · One half of the guardian seal"
              : relic.id === "tide"
                ? "TIDE SIGIL FOUND · The guardian door is awake"
                : "ROOTLING RESCUED · A hidden friend remembers you");
          }
        }
        if (player.x > 3480 && player.x < 3620 && player.y > 650 && player.y < 780 && player.invuln <= 0) {
          player.hp -= 22;
          player.vx = -260;
          player.vy = -300;
          player.invuln = .75;
          game.shake = 8;
        }
        const currentRoom = ROOMS.find((item) => player.x >= item.from && player.x < item.to);
        if (currentRoom && currentRoom.name !== game.room) {
          game.room = currentRoom.name;
          setToast(`${currentRoom.name} · ${currentRoom.hint}`);
        }
        if (player.x > WORLD_W - 48 && ZONES[game.zone].next) {
          const next = ZONES[game.zone].next!;
          game.zone = next;
          player.x = 70;
          player.y = LEVELS[next][0].y;
          player.vx = 0;
          player.vy = 0;
          setZone(next);
          setToast(`${ZONES[next].name} · ${ZONES[next].area}`);
        } else if (player.x < 48 && ZONES[game.zone].previous) {
          const previous = ZONES[game.zone].previous!;
          game.zone = previous;
          player.x = WORLD_W - 70;
          player.y = LEVELS[previous][LEVELS[previous].length > 4 ? 4 : 0].y;
          player.vx = 0;
          player.vy = 0;
          setZone(previous);
          setToast(`${ZONES[previous].name} · ${ZONES[previous].area}`);
        }
        for (const enemy of game.enemies[game.zone]) {
          if (enemy.dead) continue;
          enemy.flash = Math.max(0, enemy.flash - dt);
          enemy.cooldown = Math.max(0, enemy.cooldown - dt);
          if (enemy.kind !== "wisp" && enemy.kind !== "archer") {
            enemy.x += enemy.direction * (enemy.kind === "boss" ? 35 : 58) * dt;
            if (Math.abs(enemy.x - enemy.baseX) > enemy.range) enemy.direction *= -1;
          } else if (enemy.kind === "wisp") {
            enemy.y += Math.sin(game.time * 2 + enemy.id) * 24 * dt;
          }
          const hitDistanceX = Math.abs(enemy.x - player.x);
          const hitDistanceY = Math.abs((enemy.y - 45) - (player.y - 38));
          if (hitDistanceX < (enemy.kind === "boss" ? 92 : 48) && hitDistanceY < 70 && enemy.cooldown <= 0 && player.invuln <= 0) {
            player.hp -= enemy.kind === "boss" ? 42 : 18;
            player.vx = Math.sign(player.x - enemy.x) * 360;
            player.vy = -260;
            player.invuln = 0.75;
            enemy.cooldown = 1.1;
            game.shake = 12;
          }
        }
        for (const fx of game.effects) fx.life -= dt;
        game.effects = game.effects.filter((fx) => fx.life > 0);
        game.shake = Math.max(0, game.shake - 42 * dt);
        game.camera.x += (Math.max(0, Math.min(WORLD_W - W, player.x - W * 0.42)) - game.camera.x) * Math.min(1, dt * 5);
        const desiredCameraY = game.zone === "grove" && player.x < 1080
          ? 100
          : Math.max(0, Math.min(WORLD_H - H, player.y - H * 0.62));
        game.camera.y += (desiredCameraY - game.camera.y) * Math.min(1, dt * 4);
        const nearby = NPCS[game.zone].find((npc) => Math.hypot(npc.x - player.x, npc.y - player.y) < 100);
        const benchNearby = Math.abs(player.x - 4880) < 130 && Math.abs(player.y - 1290) < 140;
        const caveNearby = CAVE_PORTALS.find((portal) => Math.hypot(portal.x - player.x, portal.y - player.y) < 105);
        const promptName = nearby?.name || (benchNearby ? "Old Root Bench" : caveNearby ? "Root Gate" : null);
        setNearNpc((current) => current === promptName ? current : promptName);
        const boss = game.enemies.grove.find((enemy) => enemy.kind === "boss")!;
        setHud({
          hp: Math.max(0, player.hp),
          energy: player.energy,
          boss: Math.max(0, boss.hp),
          kills: game.kills,
          shards: game.shards,
          cooldowns: [...game.cooldowns],
          sigils: game.relics.filter((relic) => relic.id !== "grub" && relic.collected).length,
          rescued: game.rescued,
          secrets: game.secretWalls.filter((wall) => wall.broken).length,
          room: game.room,
        });
        if (player.hp <= 0) setPhase("dead");
      }
      c.clearRect(0, 0, W, H);
      drawWorld(c, game, imagesRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [setPhase, triggerAbility]);

  const holdKey = (key: string, active: boolean) => {
    if (active) gameRef.current.keys.add(key);
    else gameRef.current.keys.delete(key);
  };

  return (
    <main className="game-shell side-scroller">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Side-scrolling metroidvania game" />

      {phase === "title" && (
        <section className="title-screen">
          <p className="eyebrow">An original hand-painted metroidvania prototype</p>
          <h1>ABYSS <span>WALKER</span></h1>
          <div className="sigil">◇</div>
          <p className="subtitle">BENEATH THE ELEMENTAL FRONTIER</p>
          <p className="prologue">Descend through forgotten roots.<br />Carry the last quiet flame.</p>
          <button className="gold-button" onClick={startGame}>BEGIN THE DESCENT</button>
          <button className="text-button" onClick={() => setGuideOpen(true)}>HOW TO PLAY</button>
          <p className="build-mark">SIDE-SCROLLING PROTOTYPE · ACT I</p>
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
            {zone === "grove" && hud.boss < 950 && hud.boss > 0 && (
              <div className="boss-panel">
                <span>ROOT GUARDIAN</span>
                <strong>FOREST BRUTE</strong>
                <div className="bar boss"><i style={{ width: `${(hud.boss / 950) * 100}%` }} /><b>{Math.ceil(hud.boss)} / 950</b></div>
              </div>
            )}
            <nav className="hud-nav">
              <button onClick={() => setGuideOpen(true)}><span>?</span>Guide</button>
              <button onClick={() => { mapRef.current = true; setMapOpen(true); }}><span>⌖</span>Map</button>
            </nav>
          </header>
          <aside className="area-card">
            <span>{ZONES[zone].name}</span>
            <strong>{hud.room}</strong>
            <i>{hud.sigils}/2 GUARDIAN SIGILS</i>
          </aside>
          <aside className="grove-objective">
            <span>THE SLEEPING DOOR</span>
            <strong>{hud.sigils < 2 ? "Find the Sun and Tide Sigils" : "Enter the Guardian's Hall"}</strong>
            <div><i className={hud.sigils >= 1 ? "done" : ""}>◇</i><i className={hud.sigils >= 2 ? "done" : ""}>◇</i></div>
            <small>{hud.secrets}/2 secret walls · {hud.rescued ? "Vey rescued" : "a voice remains trapped"}</small>
          </aside>
          <div className="loot-count">◆ <b>{hud.shards}</b> RIFT SHARDS</div>
          <div className="ability-dock">
            {[
              ["1", "LANCE", "✦"],
              ["2", "CYCLONE", "◌"],
              ["3", "SPEARFALL", "↯"],
              ["4", "PHANTOM", "➤"],
            ].map(([key, label, icon], index) => (
              <button key={key} className={`ability a${index}`} onClick={() => triggerAbility(index)}>
                <span>{icon}</span><b>{key}</b><small>{label}</small>
                {hud.cooldowns[index] > 0 && <em>{hud.cooldowns[index].toFixed(1)}</em>}
              </button>
            ))}
          </div>
          <div className="side-touch-controls">
            <button onPointerDown={() => holdKey("a", true)} onPointerUp={() => holdKey("a", false)}>◀</button>
            <button onPointerDown={() => holdKey("d", true)} onPointerUp={() => holdKey("d", false)}>▶</button>
            <button onPointerDown={() => { gameRef.current.player.jumpBuffer = 0.13; }}>↑</button>
            <button onPointerDown={() => triggerAbility(0)}>✦</button>
          </div>
          {nearNpc && <div className="side-npc-prompt"><kbd>E</kbd><span>{nearNpc}<strong>{nearNpc === "Old Root Bench" ? "REST AND RESTORE" : nearNpc === "Caged Vey" ? "FREE THE PRISONER" : nearNpc === "Root Gate" ? "ENTER THE PASSAGE" : "SPEAK"}</strong></span></div>}
          {toast && <div className="zone-toast"><i>◇</i>{toast}</div>}
        </>
      )}

      {mapOpen && (
        <section className="overlay map-overlay">
          <button className="close" onClick={() => { mapRef.current = false; setMapOpen(false); }}>×</button>
          <div className="map-copy"><span>LOCAL MAP</span><strong>THE ROOTBOUND CROSSROADS</strong><p>A hand-marked chart of the first region. Dotted rooms are rumored passages; gold marks completed discoveries.</p></div>
          <div className="grove-local-map" role="img" aria-label="Interconnected map of the Rootbound Crossroads">
            <div className="map-line main" />
            <div className="map-line upper" />
            <div className="map-line lower" />
            <article className={`room r1 ${hud.room === "PILGRIM'S MOUTH" ? "current" : ""}`}><b>1</b><span>Pilgrim&apos;s Mouth</span></article>
            <article className={`room r2 ${hud.room === "ROOTBOUND CROSSROADS" ? "current" : ""}`}><b>2</b><span>Crossroads</span></article>
            <article className={`room r3 ${hud.room === "BELLROOT CHAPEL" ? "current" : ""} ${hud.sigils >= 1 ? "found" : ""}`}><b>◇</b><span>Bellroot Chapel</span></article>
            <article className={`room r4 ${hud.sigils >= 2 ? "found" : ""}`}><b>◇</b><span>Murmuring Cistern</span></article>
            <article className={`room r5 secret ${hud.secrets ? "found" : ""} ${hud.room === "THE HIDDEN GALLERY" ? "current" : ""}`}><b>?</b><span>Hidden Gallery</span></article>
            <article className={`room r6 ${hud.room === "OLD ROOT STATION" ? "current" : ""}`}><b>♨</b><span>Old Root Station</span></article>
            <article className={`room r7 ${hud.room === "GUARDIAN'S HALL" ? "current" : ""}`}><b>♜</b><span>Guardian&apos;s Hall</span></article>
            <div className="map-legend"><span><i className="you" />Current chamber</span><span><i className="secret" />Unconfirmed route</span><span><i className="found" />Discovery</span></div>
          </div>
        </section>
      )}

      {guideOpen && (
        <section className="overlay guide-overlay">
          <button className="close" onClick={() => setGuideOpen(false)}>×</button>
          <p className="eyebrow">Silent Warrior movement</p>
          <h2>LEAP. CLING.<br />STRIKE THROUGH.</h2>
          <div className="guide-grid">
            <article><b>A / D</b><span>Move left and right</span></article>
            <article><b>SPACE / W</b><span>Jump; release early for a short jump</span></article>
            <article><b>WALL JUMP</b><span>Press jump while touching a wall</span></article>
            <article><b>1 / J</b><span>Horizontal lance strike</span></article>
            <article><b>2–3</b><span>Cyclone and radiant Spearfall</span></article>
            <article><b>4 / SHIFT</b><span>Invulnerable Phantom Step</span></article>
          </div>
          <button className="gold-button" onClick={() => setGuideOpen(false)}>READY</button>
        </section>
      )}

      {phase === "dead" && (
        <section className="end-screen dead">
          <div className="end-sigil">◇</div>
          <p>THE ABYSS REMEMBERS</p>
          <h2>YOU HAVE FALLEN</h2>
          <span>Rise again. Read the platforms. Find the rhythm.</span>
          <button className="gold-button" onClick={startGame}>RETURN TO THE PATH</button>
        </section>
      )}
    </main>
  );
}
