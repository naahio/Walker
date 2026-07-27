"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "title" | "playing" | "dead";
type Area = "village" | "shop" | "home";
type Direction = "down" | "left" | "right" | "up";
type Atlas = "tiles" | "expansion" | "forest" | "ocean" | "city" | "city2";
type VendorId = "weapons" | "potions" | "fish" | "food";
type WorldObject = {
  id: string;
  cell: number;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: boolean;
  atlas?: Atlas;
  action?: "shop" | "home" | "chest" | "shrine" | "boat" | "cook" | "vendor" | "castle";
  vendor?: VendorId;
};
type Actor = {
  id: string;
  cell: number;
  name: string;
  x: number;
  y: number;
  line: string;
};
type Citizen = {
  id: number;
  cell: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  speed: number;
  pause: number;
};
type Enemy = {
  id: number;
  cell: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  speed: number;
  boss?: boolean;
  dead?: boolean;
  cooldown: number;
  flash: number;
  atlas?: "sprites" | "expansion" | "forest";
  dropsMeat?: boolean;
  passive?: boolean;
};
type Ingredient = "herb" | "mushroom" | "berry" | "ore" | "fish" | "meat";
type ResourceNode = { id: string; cell: number; x: number; y: number; kind: Ingredient; collected: boolean; atlas?: Atlas };
type Game = {
  area: Area;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    direction: Direction;
    hp: number;
    maxHp: number;
    energy: number;
    gold: number;
    shards: number;
    invuln: number;
  };
  keys: Set<string>;
  camera: { x: number; y: number };
  enemies: Enemy[];
  openedChest: boolean;
  shrineActive: boolean;
  boat: boolean;
  inventory: Record<Ingredient, number>;
  cooked: number;
  fishCaught: string[];
  supplies: { potions: number; bait: number; spearLevel: number; armorLevel: number };
  resources: ResourceNode[];
  citizens: Citizen[];
  questStage: number;
  kills: number;
  attackTime: number;
  attackCooldown: number;
  time: number;
  last: number;
};

const W = 1280;
const H = 720;
const TILE = 48;
const MAP_W = 112;
const MAP_H = 80;
const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;
const FISH_TYPES = ["Silver Minnow", "Bluegill", "Crimson Carp", "Golden Koi", "Catfish", "Rainbow Trout", "Void Eel", "Ancient Sturgeon"];

const NPCS: Actor[] = [
  { id: "elder", cell: 4, name: "Elder Ash", x: 18 * TILE, y: 18 * TILE, line: "Your old homestead is yours again. Gather herbs and mushrooms in the Whispering Forest, then light its hearth and cook a Root Stew." },
  { id: "merchant", cell: 5, name: "Luma", x: 26 * TILE, y: 24 * TILE, line: "My cottage is open. The blue shrine beside the river will restore your flame." },
  { id: "mapper", cell: 6, name: "Vey", x: 10 * TILE, y: 25 * TILE, line: "Roads are safe, but old paths hide chests. Press M whenever the forest turns you around." },
  { id: "guard", cell: 7, name: "Warden Ilyr", x: 45 * TILE, y: 20 * TILE, line: "The bridge leads north to the Guardian Grove. Keep your spear ready." },
  { id: "fisher", cell: 6, name: "Maro the Fisher", x: 53 * TILE, y: 45 * TILE, line: "Fish where the water circles. A boat will carry you beyond the river mouth to the Azure Coast." },
  { id: "mayor", cell: 7, name: "Mayor Sol", x: 77 * TILE, y: 17 * TILE, line: "Dawnmarket welcomes hunters, cooks and travellers. Bring produce from every region." },
  { id: "hunter", cell: 4, name: "Rook the Hunter", x: 10 * TILE, y: 48 * TILE, line: "Deer flee, boars charge, and rabbits hide among the herbs. The old shrine marks a secret path into the crystal grove." },
  { id: "smith", cell: 5, name: "Brann of the Forge", x: 72 * TILE, y: 24 * TILE, line: "Dawnmarket steel needs forest wood and crystal ore. Bring both and the city will remember your name." },
  { id: "baker", cell: 6, name: "Mira the Baker", x: 83 * TILE, y: 24 * TILE, line: "The ovens never cool. Berries, fish and game all become provisions for travellers." },
  { id: "librarian", cell: 7, name: "Archivist Oren", x: 82 * TILE, y: 15 * TILE, line: "Every road, river and forgotten grove is recorded here—except the ones that move at night." },
  { id: "gate-captain", cell: 7, name: "Captain Aster", x: 82 * TILE, y: 35 * TILE, line: "The south gate never closes to honest travellers. The market avenue leads straight to Sunspire Castle." },
  { id: "clothier", cell: 4, name: "Tessa the Clothier", x: 88 * TILE, y: 26 * TILE, line: "Blue for the crown, red for the bakers, green for the herbalists. Dawnmarket wears its trades proudly." },
  { id: "apothecary", cell: 6, name: "Sister Vale", x: 77 * TILE, y: 26 * TILE, line: "Bring me forest herbs and cave mushrooms. Remedies begin in muddy boots, not crystal bottles." },
  { id: "fishmonger", cell: 5, name: "Old Neris", x: 86 * TILE, y: 22 * TILE, line: "The morning catch came through Mirror River. Rare fish buy more than a room at the inn." },
  { id: "courier", cell: 4, name: "Pip the Courier", x: 91 * TILE, y: 18 * TILE, line: "Castle, library, bazaar, south gate—my feet know every stone in this city." },
  { id: "stablemaster", cell: 5, name: "Stablemaster Rowan", x: 68 * TILE, y: 33 * TILE, line: "The western yard serves hunters and caravans. Even a silent warrior needs somewhere to rest." },
  { id: "gardener", cell: 6, name: "Moss the Gardener", x: 98 * TILE, y: 27 * TILE, line: "The fountain gardens bloom because travellers bring seeds from distant regions." },
  { id: "castle-scholar", cell: 7, name: "Scholar Elian", x: 86 * TILE, y: 13 * TILE, line: "Sunspire was raised around an older flame. Its roots reach farther than the city walls." },
  { id: "camp-scout", cell: 5, name: "Nia the Scout", x: 16 * TILE, y: 52 * TILE, line: "Tracks overlap near the deep grove: deer, boar, rabbits, and something heavy enough to split stone." },
  { id: "herbalist", cell: 6, name: "Fen", x: 28 * TILE, y: 55 * TILE, line: "Blue flowers mark clean soil. Berry bushes attract wildlife, but the brightest mushrooms often hide near ruins." },
];

const OBJECTS: WorldObject[] = [
  { id: "house-a", cell: 10, x: 7 * TILE, y: 11 * TILE, w: 190, h: 185, solid: true },
  { id: "house-shop", cell: 10, x: 25 * TILE, y: 11 * TILE, w: 190, h: 185, solid: true, action: "shop" },
  { id: "house-c", cell: 10, x: 49 * TILE, y: 25 * TILE, w: 190, h: 185, solid: true },
  { id: "shrine", cell: 11, x: 34 * TILE, y: 23 * TILE, w: 120, h: 135, solid: true, action: "shrine" },
  { id: "chest", cell: 14, x: 8 * TILE, y: 35 * TILE, w: 82, h: 72, solid: true, action: "chest" },
  { id: "ruin-a", cell: 15, x: 53 * TILE, y: 8 * TILE, w: 88, h: 120, solid: true },
  { id: "ruin-b", cell: 15, x: 58 * TILE, y: 12 * TILE, w: 88, h: 120, solid: true },
  ...[
    [4, 5], [8, 6], [13, 4], [19, 5], [30, 5], [34, 8], [45, 5], [57, 5],
    [4, 29], [12, 32], [20, 35], [30, 34], [45, 34], [57, 30], [61, 20],
  ].map(([tx, ty], i) => ({ id: `tree-${i}`, cell: 8, x: tx * TILE, y: ty * TILE, w: 112, h: 135, solid: true })),
  ...[[15, 8], [22, 7], [43, 11], [55, 18], [37, 35], [24, 39]].map(([tx, ty], i) => ({
    id: `rock-${i}`, cell: 9, x: tx * TILE, y: ty * TILE, w: 92, h: 80, solid: true,
  })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `fence-n-${i}`, cell: 12, x: (48 + i) * TILE, y: 4 * TILE, w: 72, h: 54, solid: true })),
];

const SHOP_OBJECTS: WorldObject[] = [
  { id: "counter", cell: 12, x: 9 * TILE, y: 6 * TILE, w: 270, h: 64, solid: true },
  { id: "shop-chest", cell: 14, x: 5 * TILE, y: 5 * TILE, w: 82, h: 72, solid: true },
  { id: "shop-pillar-a", cell: 15, x: 3 * TILE, y: 4 * TILE, w: 72, h: 110, solid: true },
  { id: "shop-pillar-b", cell: 15, x: 16 * TILE, y: 4 * TILE, w: 72, h: 110, solid: true },
];
const HOME_OBJECTS: WorldObject[] = [
  { id: "hearth", atlas: "expansion", cell: 13, x: 10 * TILE, y: 6 * TILE, w: 150, h: 135, solid: true, action: "cook" },
  { id: "home-storage", cell: 14, x: 5 * TILE, y: 6 * TILE, w: 82, h: 72, solid: true },
  { id: "home-table", cell: 12, x: 14 * TILE, y: 7 * TILE, w: 165, h: 58, solid: true },
];

const EXPANSION_OBJECTS: WorldObject[] = [
  { id: "player-home", atlas: "expansion", cell: 12, x: 32 * TILE, y: 30 * TILE, w: 180, h: 178, solid: true, action: "home" },
  { id: "home-garden", atlas: "expansion", cell: 14, x: 36 * TILE, y: 31 * TILE, w: 148, h: 125, solid: true },
  { id: "river-dock", atlas: "ocean", cell: 8, x: 53 * TILE, y: 44 * TILE, w: 135, h: 140, action: "boat" },
  { id: "coast-dock", atlas: "ocean", cell: 8, x: 78 * TILE, y: 62 * TILE, w: 135, h: 140, action: "boat" },
  ...[[99, 17], [66, 34], [20, 50], [11, 53], [30, 55]].map(([tx, ty], i) => ({
    id: `world-tree-${i}`, cell: 8, x: tx * TILE, y: ty * TILE, w: 112, h: 135, solid: true,
  })),
];

const FOREST_OBJECTS: WorldObject[] = [
  { id: "hunter-tent", atlas: "forest", cell: 8, x: 8 * TILE, y: 46 * TILE, w: 170, h: 145, solid: true },
  { id: "hunter-fire", atlas: "forest", cell: 9, x: 12 * TILE, y: 47 * TILE, w: 92, h: 82, solid: true },
  { id: "hunter-tower", atlas: "forest", cell: 10, x: 16 * TILE, y: 45 * TILE, w: 145, h: 205, solid: true },
  { id: "trophy-rack", atlas: "forest", cell: 11, x: 6 * TILE, y: 50 * TILE, w: 150, h: 122, solid: true },
  { id: "old-forest-shrine", atlas: "forest", cell: 12, x: 29 * TILE, y: 48 * TILE, w: 145, h: 165, solid: true, action: "shrine" },
  { id: "crystal-cave", atlas: "forest", cell: 13, x: 38 * TILE, y: 54 * TILE, w: 190, h: 170, solid: true },
  { id: "forest-loot", atlas: "forest", cell: 14, x: 34 * TILE, y: 57 * TILE, w: 88, h: 78, solid: true, action: "chest" },
  ...[[4, 42], [9, 55], [15, 59], [22, 44], [28, 52], [35, 42], [42, 48]].map(([tx, ty], i) => ({
    id: `forest-oak-${i}`, atlas: "forest" as const, cell: i % 2, x: tx * TILE, y: ty * TILE, w: 155, h: 175, solid: true,
  })),
  ...[[7, 57], [20, 49], [26, 59], [39, 45]].map(([tx, ty], i) => ({
    id: `forest-logs-${i}`, atlas: "forest" as const, cell: 15, x: tx * TILE, y: ty * TILE, w: 98, h: 72, solid: true,
  })),
];

const CITY_OBJECTS: WorldObject[] = [
  { id: "royal-castle", atlas: "city2", cell: 0, x: 82 * TILE, y: 8 * TILE, w: 340, h: 330, solid: true, action: "castle" },
  { id: "royal-barracks", atlas: "city2", cell: 1, x: 69 * TILE, y: 11 * TILE, w: 220, h: 215, solid: true },
  { id: "city-bank", atlas: "city2", cell: 3, x: 96 * TILE, y: 12 * TILE, w: 210, h: 205, solid: true },
  { id: "city-inn", atlas: "city", cell: 2, x: 69 * TILE, y: 20 * TILE, w: 205, h: 195, solid: true },
  { id: "city-library", atlas: "city", cell: 7, x: 94 * TILE, y: 20 * TILE, w: 205, h: 195, solid: true },
  { id: "city-forge", atlas: "city", cell: 5, x: 68 * TILE, y: 29 * TILE, w: 185, h: 178, solid: true },
  { id: "city-temple", atlas: "city", cell: 11, x: 96 * TILE, y: 30 * TILE, w: 215, h: 210, solid: true, action: "shrine" },
  { id: "city-fountain", atlas: "city", cell: 9, x: 82 * TILE, y: 18 * TILE, w: 150, h: 130, solid: true },
  ...[[73, 13, 8], [77, 13, 9], [88, 13, 10], [92, 13, 11], [73, 28, 9], [77, 28, 8], [87, 29, 10], [91, 29, 8]].map(([tx, ty, cell], i) => ({
    id: `city-home-${i}`, atlas: "city2" as const, cell, x: tx * TILE, y: ty * TILE, w: cell === 11 ? 205 : 175, h: cell === 11 ? 185 : 165, solid: true,
  })),
  { id: "weapon-vendor", atlas: "city2", cell: 12, x: 75 * TILE, y: 23 * TILE, w: 145, h: 125, solid: true, action: "vendor", vendor: "weapons" },
  { id: "potion-vendor", atlas: "city2", cell: 13, x: 79 * TILE, y: 23 * TILE, w: 145, h: 125, solid: true, action: "vendor", vendor: "potions" },
  { id: "fish-vendor", atlas: "city2", cell: 14, x: 85 * TILE, y: 23 * TILE, w: 145, h: 125, solid: true, action: "vendor", vendor: "fish" },
  { id: "food-vendor", atlas: "city2", cell: 15, x: 89 * TILE, y: 23 * TILE, w: 145, h: 125, solid: true, action: "vendor", vendor: "food" },
  { id: "city-gate", atlas: "city2", cell: 7, x: 82 * TILE, y: 37 * TILE, w: 230, h: 190 },
  ...[[66, 5], [72, 5], [78, 5], [86, 5], [92, 5], [98, 5], [66, 37], [72, 37], [76, 37], [88, 37], [92, 37], [98, 37]].map(([tx, ty], i) => ({
    id: `city-wall-h-${i}`, atlas: "city2" as const, cell: 4, x: tx * TILE, y: ty * TILE, w: 245, h: 112, solid: true,
  })),
  ...[[64, 9], [64, 15], [64, 21], [64, 27], [64, 33], [102, 9], [102, 15], [102, 21], [102, 27], [102, 33]].map(([tx, ty], i) => ({
    id: `city-wall-v-${i}`, atlas: "city2" as const, cell: 5, x: tx * TILE, y: ty * TILE, w: 95, h: 205, solid: true,
  })),
  ...[[64, 5], [102, 5], [64, 37], [102, 37]].map(([tx, ty], i) => ({
    id: `city-tower-${i}`, atlas: "city2" as const, cell: 6, x: tx * TILE, y: ty * TILE, w: 145, h: 175, solid: true,
  })),
  ...[[72, 18], [76, 18], [88, 18], [92, 18], [72, 33], [76, 33], [88, 33], [92, 33]].map(([tx, ty], i) => ({
    id: `city-lamp-${i}`, atlas: "city" as const, cell: 12, x: tx * TILE, y: ty * TILE, w: 58, h: 92, solid: true,
  })),
  { id: "city-board", atlas: "city", cell: 13, x: 82 * TILE, y: 28 * TILE, w: 108, h: 100, solid: true },
  { id: "city-flowers-a", atlas: "city", cell: 14, x: 79 * TILE, y: 18 * TILE, w: 98, h: 72, solid: true },
  { id: "city-flowers-b", atlas: "city", cell: 14, x: 85 * TILE, y: 18 * TILE, w: 98, h: 72, solid: true },
];

function makeResources(): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  [[8, 47], [13, 56], [18, 60], [30, 48], [42, 38], [67, 39]].forEach(([x, y], i) => nodes.push({ id: `herb-${i}`, atlas: "forest", cell: 3, x: x * TILE, y: y * TILE, kind: "herb", collected: false }));
  [[6, 54], [17, 45], [29, 58], [44, 34]].forEach(([x, y], i) => nodes.push({ id: `mushroom-${i}`, cell: 1, x: x * TILE, y: y * TILE, kind: "mushroom", collected: false }));
  [[25, 36], [33, 40], [12, 52], [22, 57], [72, 34], [92, 29]].forEach(([x, y], i) => nodes.push({ id: `berry-${i}`, atlas: "forest", cell: 2, x: x * TILE, y: y * TILE, kind: "berry", collected: false }));
  [[53, 37], [54, 51], [68, 66], [76, 70], [84, 66], [92, 72], [102, 67]].forEach(([x, y], i) => nodes.push({ id: `fish-${i}`, atlas: "ocean", cell: 12, x: x * TILE, y: y * TILE, kind: "fish", collected: false }));
  [[39, 7], [61, 15], [101, 34]].forEach(([x, y], i) => nodes.push({ id: `ore-${i}`, cell: 3, x: x * TILE, y: y * TILE, kind: "ore", collected: false }));
  return nodes;
}

const WORLD_OBJECTS = [...OBJECTS, ...EXPANSION_OBJECTS, ...FOREST_OBJECTS, ...CITY_OBJECTS];

function makeEnemies(): Enemy[] {
  const data = [
    [8, 15, 28, 70, 64], [8, 21, 32, 70, 64], [9, 43, 29, 120, 78],
    [10, 47, 13, 95, 58], [11, 54, 16, 120, 56], [8, 36, 37, 70, 66],
  ];
  const enemies: Enemy[] = data.map(([cell, tx, ty, hp, speed], id) => ({
    id, cell, x: tx * TILE, y: ty * TILE, homeX: tx * TILE, homeY: ty * TILE,
    hp, maxHp: hp, speed, cooldown: 0, flash: 0,
  }));
  enemies.push({
    id: 99, cell: 12, x: 55 * TILE, y: 7 * TILE, homeX: 55 * TILE, homeY: 7 * TILE,
    hp: 760, maxHp: 760, speed: 42, boss: true, cooldown: 0, flash: 0,
  });
  enemies.push(
    { id: 120, atlas: "forest", cell: 4, x: 13 * TILE, y: 52 * TILE, homeX: 13 * TILE, homeY: 52 * TILE, hp: 95, maxHp: 95, speed: 125, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 121, atlas: "forest", cell: 5, x: 21 * TILE, y: 56 * TILE, homeX: 21 * TILE, homeY: 56 * TILE, hp: 145, maxHp: 145, speed: 92, cooldown: 0, flash: 0, dropsMeat: true },
    { id: 122, atlas: "forest", cell: 4, x: 32 * TILE, y: 48 * TILE, homeX: 32 * TILE, homeY: 48 * TILE, hp: 95, maxHp: 95, speed: 125, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 123, atlas: "forest", cell: 6, x: 18 * TILE, y: 47 * TILE, homeX: 18 * TILE, homeY: 47 * TILE, hp: 35, maxHp: 35, speed: 155, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 124, atlas: "forest", cell: 7, x: 27 * TILE, y: 44 * TILE, homeX: 27 * TILE, homeY: 44 * TILE, hp: 28, maxHp: 28, speed: 145, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
  );
  return enemies;
}

function freshGame(): Game {
  return {
    area: "village",
    player: { x: 18 * TILE, y: 23 * TILE, vx: 0, vy: 0, direction: "down", hp: 320, maxHp: 320, energy: 100, gold: 65, shards: 0, invuln: 0 },
    keys: new Set(),
    camera: { x: 0, y: 500 },
    enemies: makeEnemies(),
    openedChest: false,
    shrineActive: false,
    boat: false,
    inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0 },
    cooked: 0,
    fishCaught: [],
    supplies: { potions: 0, bait: 0, spearLevel: 0, armorLevel: 0 },
    resources: makeResources(),
    questStage: 0,
    kills: 0,
    attackTime: 0,
    attackCooldown: 0,
    time: 0,
    last: performance.now(),
  };
}

function groundAt(tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 3;
  const ocean = ty >= 63;
  if (ocean) return 3;
  const river = tx >= 52 && tx <= 55;
  const bridge = river && ((ty >= 20 && ty <= 22) || (ty >= 47 && ty <= 49));
  if (river && !bridge) return 3;
  if (bridge) return 1;
  const city = tx >= 64 && tx <= 102 && ty >= 5 && ty <= 37;
  if (city) {
    const avenue = tx >= 80 && tx <= 84;
    const marketStreet = ty >= 20 && ty <= 24;
    const southStreet = ty >= 32 && ty <= 36;
    const residentialLanes = (tx >= 70 && tx <= 73) || (tx >= 92 && tx <= 95);
    return avenue || marketStreet || southStreet || residentialLanes ? 1 : 0;
  }
  if ((ty >= 20 && ty <= 22) || (tx >= 16 && tx <= 18) || (tx >= 78 && tx <= 80) || (ty >= 47 && ty <= 49 && tx < 80)) return 1;
  if (ty >= 60 && ty < 63) return 1;
  if (ty < 12 && tx > 46) return 2;
  if (ty > 38 && tx < 46) return 2;
  return 0;
}

function rectHit(cx: number, cy: number, radius: number, object: WorldObject) {
  const left = object.x - object.w / 2 + 8;
  const top = object.y - object.h + 12;
  return cx + radius > left && cx - radius < left + object.w - 16 && cy + radius > top && cy - radius < object.y;
}

function blocked(game: Game, x: number, y: number) {
  if (game.area === "shop" || game.area === "home") {
    const interiorObjects = game.area === "home" ? HOME_OBJECTS : SHOP_OBJECTS;
    return x < 2 * TILE || x > 18 * TILE || y < 3 * TILE || y > 12 * TILE || interiorObjects.some((item) => item.solid && rectHit(x, y, 15, item));
  }
  const checks = [[x - 14, y], [x + 14, y], [x, y - 12], [x, y + 14]];
  if (!game.boat && checks.some(([px, py]) => groundAt(Math.floor(px / TILE), Math.floor(py / TILE)) === 3)) return true;
  return WORLD_OBJECTS.some((item) => item.solid && rectHit(x, y, 15, item));
}

function drawCell(c: CanvasRenderingContext2D, image: HTMLImageElement, cell: number, x: number, y: number, w: number, h: number) {
  const sw = image.naturalWidth / 4;
  const sh = image.naturalHeight / 4;
  c.drawImage(image, (cell % 4) * sw, Math.floor(cell / 4) * sh, sw, sh, x, y, w, h);
}

export default function PixelRpgGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(freshGame());
  const phaseRef = useRef<Phase>("title");
  const mapRef = useRef(false);
  const [phase, setPhaseState] = useState<Phase>("title");
  const [dialog, setDialog] = useState<{ name: string; line: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [cookingOpen, setCookingOpen] = useState(false);
  const [fishBookOpen, setFishBookOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState<VendorId | null>(null);
  const [toast, setToast] = useState("");
  const [hud, setHud] = useState({ hp: 320, energy: 100, gold: 65, shards: 0, kills: 0, quest: 0, boss: 760, area: "TRANQUIL VILLAGE", boat: false, cooked: 0, fishCaught: [] as string[], supplies: { potions: 0, bait: 0, spearLevel: 0, armorLevel: 0 }, inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0 } });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const startGame = useCallback(() => {
    gameRef.current = freshGame();
    setDialog(null);
    setMapOpen(false);
    setCookingOpen(false);
    setFishBookOpen(false);
    setVendorOpen(null);
    mapRef.current = false;
    setToast("TRANQUIL VILLAGE · THE ELEMENTAL FRONTIER");
    setPhase("playing");
  }, [setPhase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const cookMeal = useCallback((recipe: "stew" | "chowder" | "plate") => {
    const game = gameRef.current;
    const needs: Partial<Record<Ingredient, number>> = recipe === "stew"
      ? { herb: 2, mushroom: 1 }
      : recipe === "chowder"
        ? { fish: 2, herb: 1 }
        : { meat: 2, berry: 1 };
    if (Object.entries(needs).some(([kind, amount]) => game.inventory[kind as Ingredient] < (amount ?? 0))) {
      setToast("YOU STILL NEED MORE INGREDIENTS");
      return;
    }
    Object.entries(needs).forEach(([kind, amount]) => {
      game.inventory[kind as Ingredient] -= amount ?? 0;
    });
    game.cooked++;
    game.player.hp = game.player.maxHp;
    game.player.energy = 100;
    setCookingOpen(false);
    setToast(`${recipe === "stew" ? "ROOT STEW" : recipe === "chowder" ? "RIVER CHOWDER" : "HUNTER'S PLATE"} COOKED · FLAME RESTORED`);
  }, []);

  const buyItem = useCallback((kind: "potion" | "bait" | "spear" | "armor" | "meal") => {
    const game = gameRef.current;
    const cost = kind === "potion" ? 20 : kind === "bait" ? 12 : kind === "meal" ? 18 : kind === "spear" ? 60 + game.supplies.spearLevel * 45 : 75 + game.supplies.armorLevel * 50;
    if (game.player.gold < cost) {
      setToast(`NEED ${cost - game.player.gold} MORE GOLD`);
      return;
    }
    game.player.gold -= cost;
    if (kind === "potion") game.supplies.potions++;
    if (kind === "bait") game.supplies.bait += 3;
    if (kind === "meal") {
      game.player.hp = game.player.maxHp;
      game.player.energy = 100;
    }
    if (kind === "spear") game.supplies.spearLevel++;
    if (kind === "armor") {
      game.supplies.armorLevel++;
      game.player.maxHp += 30;
      game.player.hp = game.player.maxHp;
    }
    setToast(`${kind.toUpperCase()} PURCHASED · ${cost} GOLD`);
  }, []);

  const usePotion = useCallback(() => {
    const game = gameRef.current;
    if (game.supplies.potions <= 0) {
      setToast("NO POTIONS · VISIT DAWNMARKET");
      return;
    }
    game.supplies.potions--;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + 150);
    setToast("HEALING POTION USED");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.imageSmoothingEnabled = false;
    const tiles = new Image();
    const sprites = new Image();
    const expansion = new Image();
    const forest = new Image();
    const ocean = new Image();
    const city = new Image();
    const city2 = new Image();
    const water = new Image();
    tiles.src = "/art/sprites/pixel-world-tileset.png";
    sprites.src = "/art/sprites/pixel-rpg-sprites.png";
    expansion.src = "/art/sprites/pixel-world-expansion.png";
    forest.src = "/art/sprites/forest-expansion.png";
    ocean.src = "/art/sprites/ocean-expansion.png";
    city.src = "/art/sprites/city-expansion.png";
    city2.src = "/art/sprites/city-infrastructure.png";
    water.src = "/art/sprites/pure-water-tiles.png";
    let raf = 0;
    const imageFor = (atlas?: Atlas | "sprites") => atlas === "forest" ? forest : atlas === "ocean" ? ocean : atlas === "city" ? city : atlas === "city2" ? city2 : atlas === "expansion" ? expansion : atlas === "sprites" ? sprites : tiles;

    const attack = () => {
      const game = gameRef.current;
      if (game.attackCooldown > 0 || phaseRef.current !== "playing" || mapRef.current || dialog || cookingOpen) return;
      game.attackTime = .22;
      game.attackCooldown = .38;
      const p = game.player;
      const facing = p.direction === "left" ? [-1, 0] : p.direction === "right" ? [1, 0] : p.direction === "up" ? [0, -1] : [0, 1];
      const ax = p.x + facing[0] * 45;
      const ay = p.y + facing[1] * 45;
      for (const enemy of game.enemies) {
        if (enemy.dead || game.area !== "village") continue;
        if (Math.hypot(enemy.x - ax, enemy.y - ay) < (enemy.boss ? 82 : 58)) {
          enemy.hp -= (enemy.boss ? 34 : 52) + game.supplies.spearLevel * 18;
          enemy.flash = .14;
          enemy.x += facing[0] * 22;
          enemy.y += facing[1] * 22;
          if (enemy.hp <= 0) {
            enemy.dead = true;
            game.kills++;
            if (enemy.dropsMeat) game.inventory.meat++;
            game.player.gold += enemy.boss ? 100 : 12;
            game.player.shards += enemy.boss ? 5 : 1;
            if (enemy.boss) {
              game.questStage = 3;
              setToast("ROOT GUARDIAN DEFEATED · THE NORTHERN WAY IS CLEAR");
            } else if (game.kills === 3) {
              game.questStage = 2;
              setToast("THE CORRUPTION WEAKENS · FACE THE ROOT GUARDIAN");
            }
          }
        }
      }
    };

    const interact = () => {
      const game = gameRef.current;
      const p = game.player;
      if (game.area === "home") {
        if (p.y > 10.5 * TILE) {
          game.area = "village";
          p.x = 32 * TILE;
          p.y = 32 * TILE;
          setToast("YOUR HOMESTEAD");
        } else {
          setCookingOpen(true);
        }
        return;
      }
      if (game.area === "shop") {
        if (p.y > 10.5 * TILE) {
          game.area = "village";
          p.x = 26 * TILE;
          p.y = 15 * TILE;
          setToast("TRANQUIL VILLAGE");
        } else {
          setDialog({ name: "Luma", line: "Welcome to the Lantern & Leaf. I can restore your energy for this prototype—take what you need." });
          p.energy = 100;
        }
        return;
      }
      const resource = game.resources.find((item) => !item.collected && Math.hypot(item.x - p.x, item.y - p.y) < 76);
      if (resource) {
        resource.collected = true;
        game.inventory[resource.kind]++;
        if (resource.kind === "fish") {
          const catchIndex = Math.abs(resource.id.split("").reduce((total, letter) => total + letter.charCodeAt(0), 0)) % FISH_TYPES.length;
          const caught = FISH_TYPES[catchIndex];
          game.fishCaught.push(caught);
          game.player.gold += catchIndex >= 6 ? 30 : catchIndex >= 3 ? 12 : 5;
          setToast(`${caught.toUpperCase()} CAUGHT · ${catchIndex >= 6 ? "RARE CATCH" : "ADDED TO FISH INDEX"}`);
        } else {
          setToast(`${resource.kind.toUpperCase()} GATHERED · ${game.inventory[resource.kind]} IN YOUR PACK`);
        }
        return;
      }
      const npc = NPCS.find((item) => Math.hypot(item.x - p.x, item.y - p.y) < 72);
      if (npc) {
        setDialog({ name: npc.name, line: npc.line });
        if (npc.id === "elder" && game.questStage === 0) game.questStage = 1;
        return;
      }
      const action = WORLD_OBJECTS.find((item) => item.action && Math.hypot(item.x - p.x, item.y - p.y) < 120);
      if (!action) return;
      if (action.action === "shop") {
        game.area = "shop";
        p.x = 10 * TILE;
        p.y = 11 * TILE;
        game.camera.x = 0;
        game.camera.y = 0;
        setToast("LANTERN & LEAF");
      } else if (action.action === "home") {
        game.area = "home";
        p.x = 10 * TILE;
        p.y = 11 * TILE;
        game.camera.x = 0;
        game.camera.y = 0;
        setToast("YOUR HOME · HEARTH & HARVEST");
      } else if (action.action === "boat") {
        game.boat = !game.boat;
        if (game.boat) {
          p.x = action.x + (action.id === "river-dock" ? TILE : 0);
          p.y = action.y;
          setToast("BOAT LAUNCHED · WATER ROUTES ARE OPEN");
        } else {
          setToast("BOAT MOORED");
        }
      } else if (action.action === "shrine") {
        game.shrineActive = true;
        p.hp = p.maxHp;
        p.energy = 100;
        setToast("WAYPOINT AWAKENED · FLAME RESTORED");
      } else if (action.action === "chest" && !game.openedChest) {
        game.openedChest = true;
        p.gold += 75;
        p.shards += 2;
        setToast("HIDDEN CACHE · 75 GOLD · 2 RIFT SHARDS");
      } else if (action.action === "vendor" && action.vendor) {
        setVendorOpen(action.vendor);
      } else if (action.action === "castle") {
        setDialog({ name: "Royal Guard Cael", line: "The Sunspire Castle is the heart of Dawnmarket. The throne hall remains sealed until the Root Guardian no longer threatens the northern roads." });
      }
    };

    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e", "m"].includes(key)) event.preventDefault();
      gameRef.current.keys.add(key);
      if ((key === " " || key === "j") && !event.repeat) attack();
      if (key === "e" && !event.repeat) interact();
      if (key === "m" && !event.repeat) {
        mapRef.current = !mapRef.current;
        setMapOpen(mapRef.current);
      }
      if (key === "escape") {
        setDialog(null);
        setCookingOpen(false);
        setFishBookOpen(false);
        setVendorOpen(null);
        mapRef.current = false;
        setMapOpen(false);
      }
    };
    const keyUp = (event: KeyboardEvent) => gameRef.current.keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);

    const loop = (now: number) => {
      const game = gameRef.current;
      const dt = Math.min(.033, (now - game.last) / 1000 || 0);
      game.last = now;
      if (phaseRef.current === "playing" && !mapRef.current && !dialog && !cookingOpen && !fishBookOpen && !vendorOpen) {
        game.time += dt;
        game.attackTime = Math.max(0, game.attackTime - dt);
        game.attackCooldown = Math.max(0, game.attackCooldown - dt);
        const p = game.player;
        p.invuln = Math.max(0, p.invuln - dt);
        const left = game.keys.has("a") || game.keys.has("arrowleft");
        const right = game.keys.has("d") || game.keys.has("arrowright");
        const up = game.keys.has("w") || game.keys.has("arrowup");
        const down = game.keys.has("s") || game.keys.has("arrowdown");
        let dx = (right ? 1 : 0) - (left ? 1 : 0);
        let dy = (down ? 1 : 0) - (up ? 1 : 0);
        if (dx || dy) {
          const length = Math.hypot(dx, dy);
          dx /= length;
          dy /= length;
          if (Math.abs(dx) > Math.abs(dy)) p.direction = dx < 0 ? "left" : "right";
          else p.direction = dy < 0 ? "up" : "down";
        }
        const speed = 220;
        const nx = p.x + dx * speed * dt;
        const ny = p.y + dy * speed * dt;
        if (!blocked(game, nx, p.y)) p.x = nx;
        if (!blocked(game, p.x, ny)) p.y = ny;

        if (game.area === "village") {
          for (const enemy of game.enemies) {
            if (enemy.dead) continue;
            enemy.cooldown = Math.max(0, enemy.cooldown - dt);
            enemy.flash = Math.max(0, enemy.flash - dt);
            const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            if (distance < (enemy.boss ? 360 : 250)) {
              const direction = enemy.passive ? -1 : 1;
              const ex = ((p.x - enemy.x) / Math.max(1, distance)) * direction;
              const ey = ((p.y - enemy.y) / Math.max(1, distance)) * direction;
              const tx = enemy.x + ex * enemy.speed * dt;
              const ty = enemy.y + ey * enemy.speed * dt;
              if (!blocked(game, tx, enemy.y)) enemy.x = tx;
              if (!blocked(game, enemy.x, ty)) enemy.y = ty;
            } else {
              enemy.x = enemy.homeX + Math.sin(game.time * .7 + enemy.id) * 30;
            }
            if (!enemy.passive && distance < (enemy.boss ? 66 : 40) && enemy.cooldown <= 0 && p.invuln <= 0) {
              p.hp -= Math.max(5, (enemy.boss ? 34 : 14) - game.supplies.armorLevel * 4);
              p.invuln = .75;
              enemy.cooldown = 1;
            }
          }
        }
        const interior = game.area === "shop" || game.area === "home";
        const areaW = interior ? 20 * TILE : WORLD_W;
        const areaH = interior ? 14 * TILE : WORLD_H;
        game.camera.x += (Math.max(0, Math.min(areaW - W, p.x - W / 2)) - game.camera.x) * Math.min(1, dt * 7);
        game.camera.y += (Math.max(0, Math.min(areaH - H, p.y - H / 2)) - game.camera.y) * Math.min(1, dt * 7);
        const boss = game.enemies.find((item) => item.boss)!;
        setHud({
          hp: Math.max(0, p.hp), energy: p.energy, gold: p.gold, shards: p.shards,
          kills: game.kills, quest: game.questStage, boss: Math.max(0, boss.hp),
          boat: game.boat, cooked: game.cooked, fishCaught: [...game.fishCaught], supplies: { ...game.supplies }, inventory: { ...game.inventory },
          area: game.area === "shop" ? "LANTERN & LEAF"
            : game.area === "home" ? "YOUR HOME"
              : p.y >= 63 * TILE ? "AZURE SEA"
                : p.y >= 56 * TILE ? "AZURE COAST"
                  : p.x < 46 * TILE && p.y > 38 * TILE ? "WHISPERING FOREST"
                    : p.x >= 64 * TILE && p.x <= 103 * TILE && p.y >= 4 * TILE && p.y <= 38 * TILE
                      ? p.y < 11 * TILE ? "SUNSPIRE CASTLE" : p.y >= 20 * TILE && p.y <= 26 * TILE ? "DAWNMARKET BAZAAR" : "DAWNMARKET CITY"
                      : p.y < 14 * TILE && p.x > 45 * TILE ? "GUARDIAN GROVE"
                        : "TRANQUIL VILLAGE",
        });
        if (p.hp <= 0) setPhase("dead");
      }

      c.clearRect(0, 0, W, H);
      c.fillStyle = "#142617";
      c.fillRect(0, 0, W, H);
      if (tiles.complete && tiles.naturalWidth && sprites.complete && sprites.naturalWidth && expansion.complete && expansion.naturalWidth && forest.complete && ocean.complete && city.complete && city2.complete && water.complete) {
        const game = gameRef.current;
        const cam = game.camera;
        if (game.area === "shop" || game.area === "home") {
          for (let ty = 0; ty < 14; ty++) for (let tx = 0; tx < 20; tx++) {
            drawCell(c, tiles, tx < 2 || tx > 17 || ty < 2 ? 4 : 5, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
          }
          const interiorItems = [...(game.area === "home" ? HOME_OBJECTS : SHOP_OBJECTS)].sort((a, b) => a.y - b.y);
          for (const item of interiorItems) drawCell(c, imageFor(item.atlas), item.cell, item.x - item.w / 2 - cam.x, item.y - item.h - cam.y, item.w, item.h);
          if (game.area === "shop") drawCell(c, sprites, 5, 10 * TILE - 34 - cam.x, 7 * TILE - 64 - cam.y, 68, 68);
          if (game.area === "home") {
            c.fillStyle = "#d7a84d";
            c.font = "18px Georgia";
            c.fillText("YOUR HEARTH", 8.8 * TILE - cam.x, 3.3 * TILE - cam.y);
          }
          c.fillStyle = "#6f4c2e";
          c.fillRect(8 * TILE - cam.x, 12 * TILE - cam.y, 4 * TILE, 12);
        } else {
          const minX = Math.max(0, Math.floor(cam.x / TILE) - 1);
          const maxX = Math.min(MAP_W, Math.ceil((cam.x + W) / TILE) + 1);
          const minY = Math.max(0, Math.floor(cam.y / TILE) - 1);
          const maxY = Math.min(MAP_H, Math.ceil((cam.y + H) / TILE) + 1);
          for (let ty = minY; ty < maxY; ty++) for (let tx = minX; tx < maxX; tx++) {
            const ground = groundAt(tx, ty);
            drawCell(c, ground === 3 ? water : tiles, ground === 3 ? 0 : ground, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
          }
          const bridgeY = 21 * TILE;
          drawCell(c, tiles, 7, 39 * TILE - 74 - cam.x, bridgeY - 74 - cam.y, 148, 148);
          for (let i = 0; i < 30; i++) {
            const fx = ((i * 317) % WORLD_W) - cam.x;
            const fy = ((i * 191) % WORLD_H) - cam.y;
            if (fx > -40 && fx < W + 40 && fy > -40 && fy < H + 40) drawCell(c, tiles, 13, fx, fy, 42, 42);
          }
          const renderables: { y: number; draw: () => void }[] = [];
          for (const item of WORLD_OBJECTS) {
            if (item.action === "chest" && game.openedChest) continue;
            renderables.push({ y: item.y, draw: () => drawCell(c, imageFor(item.atlas), item.cell, item.x - item.w / 2 - cam.x, item.y - item.h - cam.y, item.w, item.h) });
          }
          for (const resource of game.resources) {
            if (resource.collected) continue;
            const size = resource.kind === "fish" ? 74 : resource.kind === "berry" ? 70 : 56;
            renderables.push({ y: resource.y, draw: () => drawCell(c, imageFor(resource.atlas ?? "expansion"), resource.cell, resource.x - size / 2 - cam.x, resource.y - size - cam.y, size, size) });
          }
          for (const npc of NPCS) renderables.push({ y: npc.y, draw: () => drawCell(c, sprites, npc.cell, npc.x - 34 - cam.x, npc.y - 68 - cam.y, 68, 68) });
          for (const enemy of game.enemies) {
            if (enemy.dead) continue;
            const size = enemy.boss ? 132 : 66;
            renderables.push({ y: enemy.y, draw: () => {
              c.save();
              if (enemy.flash > 0) c.globalAlpha = .45;
              drawCell(c, imageFor(enemy.atlas ?? "sprites"), enemy.cell, enemy.x - size / 2 - cam.x, enemy.y - size - cam.y, size, size);
              c.restore();
              c.fillStyle = "#31120e";
              c.fillRect(enemy.x - 28 - cam.x, enemy.y - size - 9 - cam.y, 56, 5);
              c.fillStyle = enemy.boss ? "#d89a3b" : "#83c447";
              c.fillRect(enemy.x - 28 - cam.x, enemy.y - size - 9 - cam.y, 56 * Math.max(0, enemy.hp / enemy.maxHp), 5);
            }});
          }
          renderables.sort((a, b) => a.y - b.y);
          for (const item of renderables) item.draw();
        }
        const p = game.player;
        const playerCell = p.direction === "down" ? 0 : p.direction === "left" ? 2 : p.direction === "right" ? 1 : 3;
        c.save();
        c.globalAlpha = p.invuln > 0 && Math.floor(game.time * 16) % 2 ? .45 : 1;
        if (game.boat && game.area === "village") {
          drawCell(c, ocean, 9, p.x - 58 - cam.x, p.y - 76 - cam.y, 116, 88);
          drawCell(c, sprites, playerCell, p.x - 28 - cam.x, p.y - 74 - cam.y, 56, 56);
        } else {
          drawCell(c, sprites, playerCell, p.x - 38 - cam.x, p.y - 76 - cam.y, 76, 76);
        }
        c.restore();
        if (game.attackTime > 0) {
          const angle = p.direction === "left" ? Math.PI : p.direction === "up" ? -Math.PI / 2 : p.direction === "down" ? Math.PI / 2 : 0;
          c.save();
          c.translate(p.x - cam.x, p.y - 34 - cam.y);
          c.rotate(angle);
          drawCell(c, sprites, 13, 8, -45, 90, 90);
          c.restore();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [cookingOpen, dialog, fishBookOpen, vendorOpen, setPhase]);

  const press = (key: string, active: boolean) => {
    if (active) gameRef.current.keys.add(key);
    else gameRef.current.keys.delete(key);
  };

  return (
    <main className="pixel-game-shell">
      <canvas ref={canvasRef} className="pixel-game-canvas" aria-label="Top-down pixel art action RPG" />
      {phase === "title" && (
        <section className="pixel-title">
          <small>AN ORIGINAL PIXEL ACTION RPG</small>
          <h1>ABYSS <span>WALKER</span></h1>
          <p>The last quiet flame returns to Tranquil Village.</p>
          <button onClick={startGame}>BEGIN ADVENTURE</button>
          <em>WASD / ARROWS · MOVE &nbsp; J / SPACE · ATTACK &nbsp; E · INTERACT</em>
        </section>
      )}
      {phase !== "title" && (
        <>
          <header className="pixel-hud">
            <div className="pixel-portrait">◇</div>
            <div><strong>SILENT WARRIOR</strong><small>LV. 1</small>
              <span className="pixel-bar hp"><i style={{ width: `${hud.hp / 3.2}%` }} />{Math.ceil(hud.hp)} / 320</span>
              <span className="pixel-bar mp"><i style={{ width: `${hud.energy}%` }} />{Math.ceil(hud.energy)} / 100</span>
            </div>
          </header>
          <div className="pixel-area"><small>ADVENTURE MODE</small><strong>{hud.area}</strong></div>
          <div className="pixel-wallet"><span>● {hud.gold}</span><span>◆ {hud.shards}</span><button onClick={() => { mapRef.current = true; setMapOpen(true); }}>MAP</button><button onClick={() => setFishBookOpen(true)}>FISH</button></div>
          <aside className="pixel-quest">
            <small>MAIN QUEST</small>
            <strong>{hud.quest === 0 ? "Speak with Elder Ash"
              : hud.cooked === 0 ? "Gather herbs and mushrooms, then cook Root Stew at home"
                : hud.quest === 1 ? `Hunt corrupted beasts (${Math.min(3, hud.kills)}/3)`
                  : hud.quest === 2 ? "Defeat the Root Guardian"
                    : "The northern road is safe"}</strong>
          </aside>
          <aside className="pixel-inventory">
            <span>☘ {hud.inventory.herb}</span><span>♧ {hud.inventory.mushroom}</span><span>● {hud.inventory.berry}</span>
            <span>♒ {hud.inventory.fish}</span><span>♨ {hud.inventory.meat}</span><span>▰ {hud.inventory.ore}</span>
            <span>♥ {hud.supplies.potions}</span><span>⌁ {hud.supplies.bait}</span><span>⚔ +{hud.supplies.spearLevel}</span>
            {hud.boat && <b>⛵ SAILING</b>}
          </aside>
          <div className="pixel-hotbar"><button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }))}><b>J</b><span>✦</span><small>SPEAR +{hud.supplies.spearLevel}</small></button><button onClick={usePotion}><b>1</b><span>✚</span><small>POTION {hud.supplies.potions}</small></button><button><b>M</b><span>⌖</span><small>MAP</small></button><button><b>E</b><span>!</span><small>USE</small></button></div>
          <div className="pixel-touch">
            <button onPointerDown={() => press("a", true)} onPointerUp={() => press("a", false)}>◀</button>
            <button onPointerDown={() => press("w", true)} onPointerUp={() => press("w", false)}>▲</button>
            <button onPointerDown={() => press("s", true)} onPointerUp={() => press("s", false)}>▼</button>
            <button onPointerDown={() => press("d", true)} onPointerUp={() => press("d", false)}>▶</button>
          </div>
          {toast && <div className="pixel-toast">{toast}</div>}
        </>
      )}
      {dialog && (
        <section className="pixel-dialog">
          <div><strong>{dialog.name}</strong><p>{dialog.line}</p><button onClick={() => setDialog(null)}>CONTINUE</button></div>
        </section>
      )}
      {cookingOpen && (
        <section className="pixel-cooking">
          <div className="pixel-cooking-book">
            <button className="pixel-cooking-close" onClick={() => setCookingOpen(false)}>×</button>
            <small>YOUR HOME · HEARTH & HARVEST</small>
            <h2>THE SILENT COOKBOOK</h2>
            <p>Meals restore your flame. Ingredients come from the forest, river and hunting grounds.</p>
            <div className="pixel-recipe-grid">
              <article><span>♨</span><h3>ROOT STEW</h3><p>2 herbs · 1 mushroom</p><button onClick={() => cookMeal("stew")}>COOK</button></article>
              <article><span>♒</span><h3>RIVER CHOWDER</h3><p>2 fish · 1 herb</p><button onClick={() => cookMeal("chowder")}>COOK</button></article>
              <article><span>♨</span><h3>HUNTER&apos;S PLATE</h3><p>2 meat · 1 berry</p><button onClick={() => cookMeal("plate")}>COOK</button></article>
            </div>
            <footer>PACK · ☘ {hud.inventory.herb} · ♧ {hud.inventory.mushroom} · ● {hud.inventory.berry} · ♒ {hud.inventory.fish} · ♨ {hud.inventory.meat}</footer>
          </div>
        </section>
      )}
      {fishBookOpen && (
        <section className="pixel-fish-book">
          <div>
            <button className="pixel-cooking-close" onClick={() => setFishBookOpen(false)}>×</button>
            <small>MARO&apos;S FIELD GUIDE</small>
            <h2>FISH OF THE FRONTIER</h2>
            <p>Cast at ripples in rivers and the Azure Sea. Rarer catches earn more gold.</p>
            <div className="pixel-fish-grid">
              {FISH_TYPES.map((fish, index) => {
                const count = hud.fishCaught.filter((caught) => caught === fish).length;
                return <article className={count ? "caught" : ""} key={fish}>
                  <span style={{ backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` }} />
                  <strong>{count ? fish : "UNKNOWN"}</strong><small>{count ? `CAUGHT × ${count}` : "NOT DISCOVERED"}</small>
                </article>;
              })}
            </div>
          </div>
        </section>
      )}
      {vendorOpen && (() => {
        const vendorName = vendorOpen === "weapons" ? "IRON & EMBER"
          : vendorOpen === "potions" ? "THE VIOLET VIAL"
            : vendorOpen === "fish" ? "TIDECATCHER'S STALL" : "SUNBAKED PROVISIONS";
        const wares: { kind: "potion" | "bait" | "spear" | "armor" | "meal"; name: string; copy: string; cost: number }[] =
          vendorOpen === "weapons"
            ? [
              { kind: "spear", name: `TEMPERED SPEAR +${hud.supplies.spearLevel + 1}`, copy: "+18 attack damage", cost: 60 + hud.supplies.spearLevel * 45 },
              { kind: "armor", name: `CITY ARMOR +${hud.supplies.armorLevel + 1}`, copy: "+30 maximum health · damage resistance", cost: 75 + hud.supplies.armorLevel * 50 },
            ]
            : vendorOpen === "potions"
              ? [
                { kind: "potion", name: "HEALING POTION", copy: "Restores 150 health", cost: 20 },
                { kind: "meal", name: "ARCANE TONIC", copy: "Restores health and energy", cost: 18 },
              ]
              : vendorOpen === "fish"
                ? [
                  { kind: "bait", name: "FISHING BAIT ×3", copy: "Prepared river worms", cost: 12 },
                  { kind: "meal", name: "SMOKED BLUEGILL", copy: "Restores health and energy", cost: 18 },
                ]
                : [
                  { kind: "meal", name: "DAWNMARKET FEAST", copy: "Restores health and energy", cost: 18 },
                  { kind: "potion", name: "TRAVELLER'S DRAUGHT", copy: "Restores 150 health", cost: 20 },
                ];
        return <section className="pixel-vendor">
          <div>
            <button className="pixel-cooking-close" onClick={() => setVendorOpen(null)}>×</button>
            <small>DAWNMARKET MERCHANT</small><h2>{vendorName}</h2>
            <p>Your purse: <b>● {hud.gold} gold</b></p>
            <div className="pixel-vendor-wares">
              {wares.map((ware) => <article key={ware.name}>
                <span>{ware.kind === "spear" ? "⚔" : ware.kind === "armor" ? "♜" : ware.kind === "potion" ? "⚗" : ware.kind === "bait" ? "⌁" : "♨"}</span>
                <h3>{ware.name}</h3><p>{ware.copy}</p>
                <button onClick={() => buyItem(ware.kind)}>BUY · {ware.cost} GOLD</button>
              </article>)}
            </div>
          </div>
        </section>;
      })()}
      {mapOpen && (
        <section className="pixel-map">
          <button onClick={() => { mapRef.current = false; setMapOpen(false); }}>×</button>
          <h2>THE ELEMENTAL FRONTIER</h2>
          <div className="pixel-map-grid">
            <i className="village">TRANQUIL VILLAGE</i><i className="home">⌂ YOUR HOME</i>
            <i className="river">MIRROR RIVER</i><i className="grove">GUARDIAN GROVE</i>
            <i className="forest">WHISPERING FOREST<br />HUNTING · GATHERING</i>
            <i className="city">DAWNMARKET CITY<br />SHOPS · NPCS</i>
            <i className="coast">AZURE COAST<br />FISHING DOCK</i>
            <i className="ocean">AZURE SEA<br />BOAT ROUTE</i><i className="cache">HIDDEN CACHE</i><b>◆ YOU</b>
          </div>
          <p>A single connected world: village life, your homestead, wild forest, market city, river crossings, coast and open-water routes.</p>
        </section>
      )}
      {phase === "dead" && <section className="pixel-dead"><h2>THE FLAME FADES</h2><button onClick={startGame}>TRY AGAIN</button></section>}
    </main>
  );
}
