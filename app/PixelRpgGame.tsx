"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "title" | "playing" | "dead";
type Area = "village" | "shop" | "home";
type Direction = "down" | "left" | "right" | "up";
type Atlas = "tiles" | "expansion" | "forest" | "ocean" | "city" | "city2" | "fortified" | "goblinRegion" | "goblinUnits";
type VendorId = "weapons" | "potions" | "fish" | "food" | "goblin";
type WorldObject = {
  id: string;
  cell: number;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: boolean;
  atlas?: Atlas;
  collision?: { w: number; h: number; offsetY?: number };
  action?: "shop" | "home" | "chest" | "shrine" | "boat" | "cook" | "vendor" | "castle" | "cage" | "trap" | "bossLair" | "goblinShrine";
  vendor?: VendorId;
};
type Actor = {
  id: string;
  cell: number;
  name: string;
  x: number;
  y: number;
  line: string;
  atlas?: Atlas | "sprites";
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
  atlas?: Atlas | "sprites";
  dropsMeat?: boolean;
  passive?: boolean;
};
type Ingredient = "herb" | "mushroom" | "berry" | "ore" | "fish" | "meat" | "scrap" | "muckroot";
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
  citizens?: Citizen[];
  goblinPrisonerFreed: boolean;
  disarmedTraps: string[];
  goblinReputation: number;
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
  { id: "gribble", atlas: "goblinUnits", cell: 5, name: "Gribble the Almost-Honest", x: 69 * TILE, y: 51 * TILE, line: "Shiny things! Mostly found. Some purchased. None currently being searched for by guards." },
  { id: "chef-nib", atlas: "goblinUnits", cell: 6, name: "Chef Nib", x: 75 * TILE, y: 55 * TILE, line: "Today soup is mushroom, boot and mystery. Boot costs extra because it has texture." },
  { id: "wizzle", atlas: "goblinUnits", cell: 13, name: "Wizzle the Witch Doctor", x: 82 * TILE, y: 47 * TILE, line: "Spirits say brave warrior arrive. Spirits also say Wizzle left kettle on. Both prophecies terrible." },
  { id: "bork", atlas: "goblinUnits", cell: 0, name: "Bork, Trap Inspector", x: 62 * TILE, y: 57 * TILE, line: "Every trap passed inspection. I inspected them by standing very far away." },
  { id: "peeb", atlas: "goblinUnits", cell: 14, name: "Peeb the Prisoner", x: 92 * TILE, y: 56 * TILE, line: "I was arrested for asking why the War Chief needs seventeen chairs. Please open the cage before he buys another." },
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
  ...[
    [3, 41], [7, 44], [11, 57], [15, 60], [20, 42], [24, 46], [28, 53], [33, 41],
    [37, 45], [42, 49], [4, 59], [18, 57], [31, 60], [40, 57], [44, 42],
  ].map(([tx, ty], i) => ({
    id: `forest-oak-${i}`, atlas: "forest" as const, cell: i % 2, x: tx * TILE, y: ty * TILE, w: 155, h: 175, solid: true,
  })),
  ...[[7, 57], [20, 49], [26, 59], [39, 45], [13, 43], [35, 55]].map(([tx, ty], i) => ({
    id: `forest-logs-${i}`, atlas: "forest" as const, cell: 15, x: tx * TILE, y: ty * TILE, w: 98, h: 72, solid: true,
  })),
  ...[
    [5, 48, 2], [9, 52, 3], [14, 47, 2], [19, 53, 3], [23, 58, 2], [27, 43, 3],
    [31, 50, 2], [36, 47, 3], [41, 53, 2], [44, 59, 3], [11, 61, 2], [34, 60, 3],
  ].map(([tx, ty, cell], i) => ({
    id: `forest-undergrowth-${i}`, atlas: "forest" as const, cell, x: tx * TILE, y: ty * TILE, w: 90, h: 82,
  })),
];

const CITY_OBJECTS: WorldObject[] = [
  { id: "royal-castle", atlas: "fortified", cell: 8, x: 84 * TILE, y: 11 * TILE, w: 390, h: 375, solid: true, collision: { w: 255, h: 70 }, action: "castle" },
  { id: "royal-barracks", atlas: "fortified", cell: 9, x: 69 * TILE, y: 11 * TILE, w: 240, h: 230, solid: true, collision: { w: 176, h: 48 } },
  { id: "city-bank", atlas: "city2", cell: 3, x: 99 * TILE, y: 11 * TILE, w: 230, h: 220, solid: true },
  { id: "city-inn", atlas: "city", cell: 2, x: 69 * TILE, y: 21 * TILE, w: 220, h: 205, solid: true },
  { id: "city-library", atlas: "city", cell: 6, x: 99 * TILE, y: 21 * TILE, w: 225, h: 210, solid: true },
  { id: "city-forge", atlas: "city", cell: 5, x: 68 * TILE, y: 31 * TILE, w: 205, h: 195, solid: true },
  { id: "city-temple", atlas: "city", cell: 11, x: 99 * TILE, y: 31 * TILE, w: 230, h: 225, solid: true, action: "shrine" },
  { id: "city-fountain", atlas: "fortified", cell: 13, x: 84 * TILE, y: 18 * TILE, w: 170, h: 150, solid: true, collision: { w: 122, h: 54 } },
  ...[
    [74, 14, 8], [78, 14, 9], [90, 14, 10], [94, 14, 11],
    [73, 31, 9], [77, 34, 8], [91, 34, 10], [95, 31, 8],
    [69, 36, 10], [74, 37, 11], [94, 37, 9], [99, 36, 8],
  ].map(([tx, ty, cell], i) => ({
    id: `city-home-${i}`, atlas: i % 3 === 0 ? "city2" as const : "fortified" as const, cell: i % 3 === 0 ? cell : 10, x: tx * TILE, y: ty * TILE, w: cell === 11 ? 205 : 180, h: cell === 11 ? 185 : 170, solid: true, collision: { w: 125, h: 38 },
  })),
  { id: "weapon-vendor", atlas: "fortified", cell: 11, x: 74 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "weapons" },
  { id: "potion-vendor", atlas: "fortified", cell: 11, x: 78 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "potions" },
  { id: "fish-vendor", atlas: "fortified", cell: 11, x: 90 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "fish" },
  { id: "food-vendor", atlas: "fortified", cell: 11, x: 94 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "food" },
  ...[[69, 25, 12], [70, 28, 13], [98, 25, 14], [98, 28, 15]].map(([tx, ty, cell], i) => ({
    id: `market-stall-${i}`, atlas: i % 2 ? "city2" as const : "fortified" as const, cell: i % 2 ? cell : 11, x: tx * TILE, y: ty * TILE, w: 138, h: 120, solid: true, collision: { w: 108, h: 28 },
  })),
  { id: "city-gate", atlas: "fortified", cell: 6, x: 84 * TILE, y: 40 * TILE, w: 245, h: 205 },
  ...[66, 70, 74, 78, 82, 86, 90, 94, 98, 102].map((tx, i) => ({
    id: `city-wall-n-${i}`, atlas: "fortified" as const, cell: 0, x: tx * TILE, y: 5 * TILE, w: 220, h: 105, solid: true, collision: { w: 210, h: 28 },
  })),
  ...[66, 70, 74, 78, 90, 94, 98, 102].map((tx, i) => ({
    id: `city-wall-s-${i}`, atlas: "fortified" as const, cell: 0, x: tx * TILE, y: 40 * TILE, w: 220, h: 105, solid: true, collision: { w: 210, h: 28 },
  })),
  ...[8, 12, 16, 20, 24, 28, 32, 36].flatMap((ty, i) => ([
    { id: `city-wall-w-${i}`, atlas: "fortified" as const, cell: 1, x: 64 * TILE, y: ty * TILE, w: 96, h: 195, solid: true, collision: { w: 30, h: 184 } },
    { id: `city-wall-e-${i}`, atlas: "fortified" as const, cell: 1, x: 104 * TILE, y: ty * TILE, w: 96, h: 195, solid: true, collision: { w: 30, h: 184 } },
  ])),
  ...[[64, 5], [104, 5], [64, 40], [104, 40]].map(([tx, ty], i) => ({
    id: `city-tower-${i}`, atlas: "fortified" as const, cell: i % 2 ? 5 : 4, x: tx * TILE, y: ty * TILE, w: 145, h: 175, solid: true, collision: { w: 92, h: 46 },
  })),
  ...[[72, 18], [76, 18], [92, 18], [96, 18], [72, 28], [78, 28], [90, 28], [96, 28], [80, 34], [88, 34]].map(([tx, ty], i) => ({
    id: `city-lamp-${i}`, atlas: "fortified" as const, cell: 12, x: tx * TILE, y: ty * TILE, w: 58, h: 92, solid: true, collision: { w: 22, h: 20 },
  })),
  { id: "city-board", atlas: "city", cell: 13, x: 84 * TILE, y: 29 * TILE, w: 108, h: 100, solid: true },
  ...[[80, 18], [88, 18], [81, 30], [87, 30], [66, 24], [102, 24]].map(([tx, ty], i) => ({
    id: `city-flowers-${i}`, atlas: "city" as const, cell: 14, x: tx * TILE, y: ty * TILE, w: 96, h: 72,
  })),
  ...[[76, 20], [92, 20], [80, 31], [88, 31]].map(([tx, ty], i) => ({
    id: `city-bench-${i}`, atlas: "city" as const, cell: 15, x: tx * TILE, y: ty * TILE, w: 105, h: 75, solid: true,
  })),
];

const GOBLIN_OBJECTS: WorldObject[] = [
  { id: "goblin-entry-gate", atlas: "goblinRegion", cell: 10, x: 84 * TILE, y: 43 * TILE, w: 245, h: 210 },
  { id: "snagtooth-war-camp", atlas: "goblinRegion", cell: 1, x: 61 * TILE, y: 48 * TILE, w: 250, h: 225, solid: true, collision: { w: 174, h: 48 } },
  { id: "shaman-tower", atlas: "goblinRegion", cell: 2, x: 79 * TILE, y: 47 * TILE, w: 225, h: 270, solid: true, collision: { w: 130, h: 52 }, action: "goblinShrine" },
  { id: "snagtooth-keep", atlas: "goblinRegion", cell: 3, x: 89 * TILE, y: 48 * TILE, w: 275, h: 255, solid: true, collision: { w: 190, h: 54 } },
  { id: "war-chief-lair", atlas: "goblinRegion", cell: 0, x: 101 * TILE, y: 50 * TILE, w: 335, h: 305, solid: true, collision: { w: 248, h: 62 }, action: "bossLair" },
  { id: "goblin-barracks", atlas: "goblinRegion", cell: 5, x: 64 * TILE, y: 58 * TILE, w: 225, h: 195, solid: true, collision: { w: 160, h: 42 } },
  { id: "goblin-weapons-hall", atlas: "goblinRegion", cell: 6, x: 79 * TILE, y: 59 * TILE, w: 235, h: 205, solid: true, collision: { w: 170, h: 46 } },
  { id: "goblin-forge", atlas: "goblinRegion", cell: 7, x: 102 * TILE, y: 59 * TILE, w: 225, h: 200, solid: true, collision: { w: 165, h: 44 } },
  { id: "goblin-market", atlas: "goblinRegion", cell: 14, x: 69 * TILE, y: 52 * TILE, w: 220, h: 180, solid: true, collision: { w: 150, h: 36 }, action: "vendor", vendor: "goblin" },
  { id: "goblin-cage", atlas: "goblinRegion", cell: 13, x: 92 * TILE, y: 57 * TILE, w: 150, h: 155, solid: true, collision: { w: 110, h: 38 }, action: "cage" },
  { id: "goblin-bonfire-a", atlas: "goblinRegion", cell: 12, x: 72 * TILE, y: 47 * TILE, w: 125, h: 115, solid: true, collision: { w: 78, h: 28 }, action: "goblinShrine" },
  { id: "goblin-bonfire-b", atlas: "goblinRegion", cell: 12, x: 86 * TILE, y: 55 * TILE, w: 115, h: 105, solid: true, collision: { w: 72, h: 26 }, action: "goblinShrine" },
  { id: "goblin-swamp-bridge", atlas: "goblinRegion", cell: 15, x: 72 * TILE, y: 61 * TILE, w: 235, h: 115 },
  ...[[67, 46], [74, 44], [86, 45], [95, 45], [60, 54], [74, 57], [97, 55]].map(([tx, ty], i) => ({
    id: `goblin-hut-${i}`, atlas: "goblinRegion" as const, cell: 4, x: tx * TILE, y: ty * TILE, w: 158, h: 145, solid: true, collision: { w: 108, h: 31 },
  })),
  ...[[58, 44], [106, 44], [58, 53], [106, 53], [58, 61], [106, 61]].map(([tx, ty], i) => ({
    id: `goblin-watch-${i}`, atlas: "goblinRegion" as const, cell: i % 2 ? 9 : 8, x: tx * TILE, y: ty * TILE, w: 118, h: 185, solid: true, collision: { w: 72, h: 34 },
  })),
  ...[[66, 50], [77, 53], [88, 51], [95, 60], [82, 57]].map(([tx, ty], i) => ({
    id: `goblin-trap-${i}`, atlas: "goblinRegion" as const, cell: 11, x: tx * TILE, y: ty * TILE, w: 92, h: 65, action: "trap" as const,
  })),
];

function makeResources(): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  [[5, 46], [8, 52], [12, 58], [16, 44], [20, 55], [25, 49], [30, 58], [35, 46], [40, 54], [44, 43], [42, 38], [67, 39]].forEach(([x, y], i) => nodes.push({ id: `herb-${i}`, atlas: "forest", cell: 3, x: x * TILE, y: y * TILE, kind: "herb", collected: false }));
  [[6, 54], [11, 48], [17, 45], [23, 52], [29, 58], [34, 43], [39, 57], [44, 34]].forEach(([x, y], i) => nodes.push({ id: `mushroom-${i}`, cell: 1, x: x * TILE, y: y * TILE, kind: "mushroom", collected: false }));
  [[25, 36], [33, 40], [7, 50], [12, 52], [18, 59], [22, 57], [28, 46], [36, 52], [42, 60], [72, 34], [92, 29]].forEach(([x, y], i) => nodes.push({ id: `berry-${i}`, atlas: "forest", cell: 2, x: x * TILE, y: y * TILE, kind: "berry", collected: false }));
  [[53, 37], [54, 51], [68, 66], [76, 70], [84, 66], [92, 72], [102, 67]].forEach(([x, y], i) => nodes.push({ id: `fish-${i}`, atlas: "ocean", cell: 12, x: x * TILE, y: y * TILE, kind: "fish", collected: false }));
  [[39, 7], [61, 15], [101, 34]].forEach(([x, y], i) => nodes.push({ id: `ore-${i}`, cell: 3, x: x * TILE, y: y * TILE, kind: "ore", collected: false }));
  [[60, 51], [67, 56], [73, 49], [81, 55], [88, 58], [98, 53], [104, 56]].forEach(([x, y], i) => nodes.push({ id: `scrap-${i}`, atlas: "goblinRegion", cell: 12, x: x * TILE, y: y * TILE, kind: "scrap", collected: false }));
  [[62, 45], [70, 59], [76, 51], [84, 50], [91, 53], [101, 45]].forEach(([x, y], i) => nodes.push({ id: `muckroot-${i}`, atlas: "forest", cell: 3, x: x * TILE, y: y * TILE, kind: "muckroot", collected: false }));
  return nodes;
}

const WORLD_OBJECTS = [...OBJECTS, ...EXPANSION_OBJECTS, ...FOREST_OBJECTS, ...CITY_OBJECTS, ...GOBLIN_OBJECTS];

const CITIZEN_ROUTES = [
  [84, 14], [84, 19], [84, 24], [84, 29], [84, 35],
  [72, 23], [76, 23], [92, 23], [97, 23],
  [72, 28], [78, 28], [90, 28], [97, 28],
  [70, 17], [77, 17], [91, 17], [98, 17],
] as const;

function makeCitizens(): Citizen[] {
  return Array.from({ length: 24 }, (_, id) => {
    const start = CITIZEN_ROUTES[id % CITIZEN_ROUTES.length];
    const target = CITIZEN_ROUTES[(id * 5 + 3) % CITIZEN_ROUTES.length];
    return {
      id,
      cell: 4 + (id % 4),
      x: start[0] * TILE + (id % 3 - 1) * 12,
      y: start[1] * TILE + (id % 2 ? 10 : -10),
      homeX: start[0] * TILE,
      homeY: start[1] * TILE,
      targetX: target[0] * TILE,
      targetY: target[1] * TILE,
      speed: 35 + (id % 4) * 6,
      pause: (id % 5) * .3,
    };
  });
}

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
    { id: 125, atlas: "forest", cell: 4, x: 7 * TILE, y: 45 * TILE, homeX: 7 * TILE, homeY: 45 * TILE, hp: 95, maxHp: 95, speed: 125, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 126, atlas: "forest", cell: 4, x: 39 * TILE, y: 57 * TILE, homeX: 39 * TILE, homeY: 57 * TILE, hp: 95, maxHp: 95, speed: 125, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 127, atlas: "forest", cell: 5, x: 34 * TILE, y: 51 * TILE, homeX: 34 * TILE, homeY: 51 * TILE, hp: 145, maxHp: 145, speed: 92, cooldown: 0, flash: 0, dropsMeat: true },
    { id: 128, atlas: "forest", cell: 6, x: 11 * TILE, y: 58 * TILE, homeX: 11 * TILE, homeY: 58 * TILE, hp: 35, maxHp: 35, speed: 155, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 129, atlas: "forest", cell: 6, x: 24 * TILE, y: 50 * TILE, homeX: 24 * TILE, homeY: 50 * TILE, hp: 35, maxHp: 35, speed: 155, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 130, atlas: "forest", cell: 6, x: 41 * TILE, y: 47 * TILE, homeX: 41 * TILE, homeY: 47 * TILE, hp: 35, maxHp: 35, speed: 155, cooldown: 0, flash: 0, dropsMeat: true, passive: true },
    { id: 131, atlas: "forest", cell: 7, x: 6 * TILE, y: 51 * TILE, homeX: 6 * TILE, homeY: 51 * TILE, hp: 28, maxHp: 28, speed: 145, cooldown: 0, flash: 0, passive: true },
    { id: 132, atlas: "forest", cell: 7, x: 31 * TILE, y: 45 * TILE, homeX: 31 * TILE, homeY: 45 * TILE, hp: 28, maxHp: 28, speed: 145, cooldown: 0, flash: 0, passive: true },
    { id: 133, atlas: "forest", cell: 7, x: 43 * TILE, y: 55 * TILE, homeX: 43 * TILE, homeY: 55 * TILE, hp: 28, maxHp: 28, speed: 145, cooldown: 0, flash: 0, passive: true },
  );
  [
    [0, 63, 45, 90, 82], [1, 70, 46, 140, 70], [2, 74, 52, 105, 66], [3, 81, 51, 150, 62],
    [0, 86, 46, 90, 88], [1, 92, 52, 140, 72], [2, 96, 56, 105, 68], [3, 103, 54, 150, 62],
    [7, 61, 55, 210, 98], [8, 69, 60, 320, 48], [9, 84, 59, 225, 72], [10, 88, 54, 120, 100],
    [11, 98, 46, 190, 94], [15, 78, 45, 95, 112], [0, 73, 58, 90, 88], [2, 93, 45, 105, 68],
  ].forEach(([cell, tx, ty, hp, speed], index) => {
    enemies.push({
      id: 200 + index,
      atlas: "goblinUnits",
      cell,
      x: tx * TILE,
      y: ty * TILE,
      homeX: tx * TILE,
      homeY: ty * TILE,
      hp,
      maxHp: hp,
      speed,
      cooldown: 0,
      flash: 0,
      dropsMeat: cell === 8 || cell === 9 || cell === 11,
    });
  });
  enemies.push({
    id: 299, atlas: "goblinUnits", cell: 12, x: 100 * TILE, y: 52 * TILE, homeX: 100 * TILE, homeY: 52 * TILE,
    hp: 1100, maxHp: 1100, speed: 48, boss: true, cooldown: 0, flash: 0,
  });
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
    inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0, scrap: 0, muckroot: 0 },
    cooked: 0,
    fishCaught: [],
    supplies: { potions: 0, bait: 0, spearLevel: 0, armorLevel: 0 },
    resources: makeResources(),
    citizens: makeCitizens(),
    goblinPrisonerFreed: false,
    disarmedTraps: [],
    goblinReputation: 0,
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
  const city = tx >= 63 && tx <= 105 && ty >= 4 && ty <= 40;
  if (city) {
    const garden = ((tx >= 79 && tx <= 81) || (tx >= 87 && tx <= 89)) && ty >= 16 && ty <= 19;
    return garden ? 0 : 1;
  }
  const goblinCamp = tx >= 57 && tx <= 107 && ty >= 41 && ty < 63;
  if (goblinCamp) {
    const mainRoad = tx >= 82 && tx <= 86;
    const marketRoad = ty >= 50 && ty <= 53;
    const windingTrail = (tx >= 61 && tx <= 64 && ty >= 44 && ty <= 59) || (tx >= 96 && tx <= 101 && ty >= 45 && ty <= 59);
    if (mainRoad || marketRoad || windingTrail) return 1;
    return (tx * 7 + ty * 11) % 9 < 2 ? 0 : 2;
  }
  if ((ty >= 20 && ty <= 22) || (tx >= 16 && tx <= 18) || (tx >= 78 && tx <= 80) || (ty >= 47 && ty <= 49 && tx < 80)) return 1;
  if (ty >= 60 && ty < 63) return 1;
  if (ty < 12 && tx > 46) return 2;
  if (ty > 38 && tx < 46) return 2;
  return 0;
}

function rectHit(cx: number, cy: number, radius: number, object: WorldObject) {
  const collision = object.collision ?? {
    w: Math.max(24, object.w * .66),
    h: Math.max(22, Math.min(48, object.h * .24)),
    offsetY: 0,
  };
  const bottom = object.y + (collision.offsetY ?? 0);
  const left = object.x - collision.w / 2;
  const top = bottom - collision.h;
  return cx + radius > left && cx - radius < left + collision.w && cy + radius > top && cy - radius < bottom;
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

const SAVE_KEY = "abyss-walker-beta-save-v2";

type SavedGame = {
  version: 2;
  player: Pick<Game["player"], "x" | "y" | "hp" | "maxHp" | "energy" | "gold" | "shards">;
  inventory: Game["inventory"];
  supplies: Game["supplies"];
  openedChest: boolean;
  shrineActive: boolean;
  boat: boolean;
  cooked: number;
  fishCaught: string[];
  questStage: number;
  kills: number;
  goblinPrisonerFreed: boolean;
  disarmedTraps: string[];
  goblinReputation: number;
  collectedResources: string[];
  enemies: Array<{ id: number; hp: number; dead: boolean }>;
};

function persistGame(game: Game) {
  if (typeof window === "undefined" || game.area !== "village") return;
  const data: SavedGame = {
    version: 2,
    player: {
      x: game.player.x,
      y: game.player.y,
      hp: Math.max(1, game.player.hp),
      maxHp: game.player.maxHp,
      energy: game.player.energy,
      gold: game.player.gold,
      shards: game.player.shards,
    },
    inventory: { ...game.inventory },
    supplies: { ...game.supplies },
    openedChest: game.openedChest,
    shrineActive: game.shrineActive,
    boat: game.boat,
    cooked: game.cooked,
    fishCaught: [...game.fishCaught],
    questStage: game.questStage,
    kills: game.kills,
    goblinPrisonerFreed: game.goblinPrisonerFreed,
    disarmedTraps: [...game.disarmedTraps],
    goblinReputation: game.goblinReputation,
    collectedResources: game.resources.filter((resource) => resource.collected).map((resource) => resource.id),
    enemies: game.enemies.map((enemy) => ({ id: enemy.id, hp: enemy.hp, dead: Boolean(enemy.dead) })),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function restoreGame() {
  const game = freshGame();
  if (typeof window === "undefined") return game;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return game;
    const saved = JSON.parse(raw) as Partial<SavedGame>;
    if (saved.version !== 2 || !saved.player) return game;
    Object.assign(game.player, saved.player);
    if (saved.inventory) game.inventory = { ...game.inventory, ...saved.inventory };
    if (saved.supplies) game.supplies = { ...game.supplies, ...saved.supplies };
    game.openedChest = Boolean(saved.openedChest);
    game.shrineActive = Boolean(saved.shrineActive);
    game.boat = Boolean(saved.boat);
    game.cooked = Math.max(0, saved.cooked ?? 0);
    game.fishCaught = Array.isArray(saved.fishCaught) ? saved.fishCaught : [];
    game.questStage = Math.max(0, saved.questStage ?? 0);
    game.kills = Math.max(0, saved.kills ?? 0);
    game.goblinPrisonerFreed = Boolean(saved.goblinPrisonerFreed);
    game.disarmedTraps = Array.isArray(saved.disarmedTraps) ? saved.disarmedTraps : [];
    game.goblinReputation = Math.max(0, saved.goblinReputation ?? 0);
    const collected = new Set(saved.collectedResources ?? []);
    game.resources.forEach((resource) => { resource.collected = collected.has(resource.id); });
    const enemyState = new Map((saved.enemies ?? []).map((enemy) => [enemy.id, enemy]));
    game.enemies.forEach((enemy) => {
      const state = enemyState.get(enemy.id);
      if (!state) return;
      enemy.hp = state.hp;
      enemy.dead = state.dead;
    });
    if (blocked(game, game.player.x, game.player.y)) {
      game.player.x = 84 * TILE;
      game.player.y = 37 * TILE;
      game.boat = false;
    }
    game.camera.x = Math.max(0, Math.min(WORLD_W - W, game.player.x - W / 2));
    game.camera.y = Math.max(0, Math.min(WORLD_H - H, game.player.y - H / 2));
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
  return game;
}

function drawCell(c: CanvasRenderingContext2D, image: HTMLImageElement, cell: number, x: number, y: number, w: number, h: number) {
  const sw = image.naturalWidth / 4;
  const sh = image.naturalHeight / 4;
  c.drawImage(image, (cell % 4) * sw, Math.floor(cell / 4) * sh, sw, sh, x, y, w, h);
}

const INGREDIENT_META: Record<Ingredient, { icon: string; label: string; color: string }> = {
  herb: { icon: "☘", label: "Moonleaf", color: "#7fe17e" },
  mushroom: { icon: "♧", label: "Cavecap", color: "#d7a4ed" },
  berry: { icon: "●", label: "Sunberry", color: "#e56475" },
  ore: { icon: "▰", label: "Crystal Ore", color: "#8bd8ff" },
  fish: { icon: "♒", label: "Fishing Spot", color: "#5acfff" },
  meat: { icon: "♨", label: "Game Meat", color: "#e59c66" },
  scrap: { icon: "⚙", label: "Goblin Scrap", color: "#e3b055" },
  muckroot: { icon: "♣", label: "Muckroot", color: "#9bbf51" },
};

function drawResourceMarker(
  c: CanvasRenderingContext2D,
  resource: ResourceNode,
  camera: { x: number; y: number },
  time: number,
  playerX: number,
  playerY: number,
) {
  const x = resource.x - camera.x;
  const y = resource.y - camera.y;
  const meta = INGREDIENT_META[resource.kind];
  const pulse = 1 + Math.sin(time * 4 + resource.x * .01) * .12;
  c.save();
  c.translate(x, y - 24);
  c.strokeStyle = meta.color;
  c.fillStyle = `${meta.color}33`;
  c.shadowColor = meta.color;
  c.shadowBlur = 12;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, 17, 25 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(0, -35);
  c.lineTo(7, -27);
  c.lineTo(0, -19);
  c.lineTo(-7, -27);
  c.closePath();
  c.fillStyle = meta.color;
  c.fill();
  c.shadowBlur = 0;
  if (Math.hypot(resource.x - playerX, resource.y - playerY) < 150) {
    c.font = "900 10px 'Courier New', monospace";
    const width = c.measureText(meta.label.toUpperCase()).width + 18;
    c.fillStyle = "rgba(15,10,6,.9)";
    c.strokeStyle = "#c79b4b";
    c.fillRect(-width / 2, -58, width, 18);
    c.strokeRect(-width / 2, -58, width, 18);
    c.fillStyle = "#fff0bd";
    c.textAlign = "center";
    c.fillText(meta.label.toUpperCase(), 0, -45);
  }
  c.restore();
}

function drawMiniMap(canvas: HTMLCanvasElement | null, game: Game) {
  if (!canvas) return;
  const width = 240;
  const height = 154;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const c = canvas.getContext("2d");
  if (!c) return;
  const sx = width / WORLD_W;
  const sy = height / WORLD_H;
  c.clearRect(0, 0, width, height);
  c.fillStyle = "#426b31";
  c.fillRect(0, 0, width, height);
  c.fillStyle = "#174f76";
  c.fillRect(52 * TILE * sx, 0, 4 * TILE * sx, height);
  c.fillRect(0, 63 * TILE * sy, width, 17 * TILE * sy);
  c.fillStyle = "#244b27";
  c.fillRect(0, 38 * TILE * sy, 46 * TILE * sx, 25 * TILE * sy);
  c.fillStyle = "#87765b";
  c.fillRect(63 * TILE * sx, 4 * TILE * sy, 42 * TILE * sx, 36 * TILE * sy);
  c.strokeStyle = "#e4c477";
  c.lineWidth = 1.5;
  c.strokeRect(63 * TILE * sx, 4 * TILE * sy, 42 * TILE * sx, 36 * TILE * sy);
  c.fillStyle = "#57442b";
  c.fillRect(57 * TILE * sx, 41 * TILE * sy, 50 * TILE * sx, 22 * TILE * sy);
  c.strokeStyle = "#e26d37";
  c.strokeRect(57 * TILE * sx, 41 * TILE * sy, 50 * TILE * sx, 22 * TILE * sy);
  c.strokeStyle = "#cbb782";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(17 * TILE * sx, 0);
  c.lineTo(17 * TILE * sx, 49 * TILE * sy);
  c.lineTo(84 * TILE * sx, 49 * TILE * sy);
  c.moveTo(56 * TILE * sx, 21 * TILE * sy);
  c.lineTo(105 * TILE * sx, 21 * TILE * sy);
  c.stroke();
  for (const resource of game.resources) {
    if (resource.collected) continue;
    c.fillStyle = INGREDIENT_META[resource.kind].color;
    c.fillRect(resource.x * sx - 1, resource.y * sy - 1, 3, 3);
  }
  c.fillStyle = "#ffe373";
  c.beginPath();
  c.arc(game.player.x * sx, game.player.y * sy, 4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#31170c";
  c.stroke();
}

export default function PixelRpgGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);
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
  const [hasSave, setHasSave] = useState(false);
  const [hud, setHud] = useState({ hp: 320, energy: 100, gold: 65, shards: 0, kills: 0, quest: 0, boss: 760, area: "TRANQUIL VILLAGE", boat: false, cooked: 0, fishCaught: [] as string[], position: { x: 18 * TILE, y: 23 * TILE }, supplies: { potions: 0, bait: 0, spearLevel: 0, armorLevel: 0 }, inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0, scrap: 0, muckroot: 0 } });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const startGame = useCallback((newJourney = false) => {
    gameRef.current = newJourney ? freshGame() : restoreGame();
    setDialog(null);
    setMapOpen(false);
    setCookingOpen(false);
    setFishBookOpen(false);
    setVendorOpen(null);
    mapRef.current = false;
    setToast(newJourney || !hasSave ? "TRANQUIL VILLAGE · THE ELEMENTAL FRONTIER" : "PROGRESS RESTORED · THE FLAME REMEMBERS");
    setPhase("playing");
  }, [hasSave, setPhase]);

  useEffect(() => {
    try {
      setHasSave(Boolean(localStorage.getItem(SAVE_KEY)));
    } catch {}
  }, []);

  useEffect(() => {
    const save = () => {
      if (phaseRef.current !== "playing") return;
      try {
        persistGame(gameRef.current);
        setHasSave(true);
      } catch {}
    };
    const timer = window.setInterval(save, 2500);
    window.addEventListener("pagehide", save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  const resetSave = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
    setHasSave(false);
    startGame(true);
  }, [startGame]);

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
    const fortified = new Image();
    const goblinRegion = new Image();
    const goblinUnits = new Image();
    const water = new Image();
    tiles.src = "/art/sprites/pixel-world-tileset.png";
    sprites.src = "/art/sprites/pixel-rpg-sprites.png";
    expansion.src = "/art/sprites/pixel-world-expansion.png";
    forest.src = "/art/sprites/forest-expansion.png";
    ocean.src = "/art/sprites/ocean-expansion.png";
    city.src = "/art/sprites/city-expansion.png";
    city2.src = "/art/sprites/city-infrastructure.png";
    fortified.src = "/art/sprites/fortified-city-atlas.png";
    goblinRegion.src = "/art/sprites/goblin-region-atlas.png";
    goblinUnits.src = "/art/sprites/goblin-units-atlas.png";
    water.src = "/art/sprites/pure-water-tiles.png";
    let raf = 0;
    const imageFor = (atlas?: Atlas | "sprites") => atlas === "forest" ? forest : atlas === "ocean" ? ocean : atlas === "city" ? city : atlas === "city2" ? city2 : atlas === "fortified" ? fortified : atlas === "goblinRegion" ? goblinRegion : atlas === "goblinUnits" ? goblinUnits : atlas === "expansion" ? expansion : atlas === "sprites" ? sprites : tiles;

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
            if (enemy.id === 299) {
              game.goblinReputation += 3;
              game.inventory.scrap += 5;
              setToast("WAR CHIEF BONK DEFEATED · 5 SCRAP · GOBLINS ARGUE OVER WHO IS CHIEF NOW");
            } else if (enemy.boss) {
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
      const npc = NPCS.find((item) => !(item.id === "peeb" && game.goblinPrisonerFreed) && Math.hypot(item.x - p.x, item.y - p.y) < 72);
      if (npc) {
        if (npc.id === "peeb" && !game.goblinPrisonerFreed) {
          game.goblinPrisonerFreed = true;
          game.goblinReputation++;
          p.gold += 40;
          setDialog({ name: "Peeb the Newly Free", line: "Freedom! Take these coins. I was saving them for chair number eighteen, but history has changed." });
          return;
        }
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
      } else if (action.action === "cage") {
        if (game.goblinPrisonerFreed) {
          setToast("PEEB IS FREE · THE CAGE NOW HOLDS ONE VERY CONFUSED SPOON");
        } else {
          game.goblinPrisonerFreed = true;
          game.goblinReputation++;
          p.gold += 40;
          setDialog({ name: "Peeb the Newly Free", line: "Freedom! Take these coins. I was saving them for chair number eighteen, but history has changed." });
        }
      } else if (action.action === "goblinShrine") {
        p.hp = Math.min(p.maxHp, p.hp + 90);
        p.energy = 100;
        setToast("QUESTIONABLE GOBLIN MAGIC · MOSTLY RESTORED");
      } else if (action.action === "bossLair") {
        const warChief = game.enemies.find((enemy) => enemy.id === 299);
        setDialog(warChief?.dead
          ? { name: "Empty Chief's Throne", line: "The throne is unattended. Three goblins nearby are already campaigning on a platform of more snacks and fewer wolves." }
          : { name: "Warning Sign (badly spelled)", line: "BIG CHIEF INSIDE. NO HEROES. DELIVERY GOBLINS USE OTHER DOOR." });
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

        for (const trap of GOBLIN_OBJECTS.filter((item) => item.action === "trap")) {
          if (game.disarmedTraps.includes(trap.id) || Math.hypot(trap.x - p.x, trap.y - p.y) >= 33) continue;
          game.disarmedTraps.push(trap.id);
          if (p.invuln <= 0) {
            p.hp -= Math.max(8, 28 - game.supplies.armorLevel * 4);
            p.invuln = .8;
          }
          setToast("SNAP! · SIGN READS: DEFINITELY NOT A TRAP");
        }

        if (game.area === "village") {
          const citizens = game.citizens ?? (game.citizens = makeCitizens());
          for (const citizen of citizens) {
            citizen.pause = Math.max(0, citizen.pause - dt);
            if (citizen.pause > 0) continue;
            const distance = Math.hypot(citizen.targetX - citizen.x, citizen.targetY - citizen.y);
            if (distance < 12) {
              const next = CITIZEN_ROUTES[(citizen.id * 7 + Math.floor(game.time / 3)) % CITIZEN_ROUTES.length];
              citizen.targetX = next[0] * TILE + ((citizen.id % 3) - 1) * 14;
              citizen.targetY = next[1] * TILE + (citizen.id % 2 ? 9 : -9);
              citizen.pause = .5 + (citizen.id % 4) * .22;
            } else {
              const vx = ((citizen.targetX - citizen.x) / Math.max(1, distance)) * citizen.speed * dt;
              const vy = ((citizen.targetY - citizen.y) / Math.max(1, distance)) * citizen.speed * dt;
              const nextX = citizen.x + vx;
              const nextY = citizen.y + vy;
              if (!blocked(game, nextX, citizen.y)) citizen.x = nextX;
              else citizen.pause = .35;
              if (!blocked(game, citizen.x, nextY)) citizen.y = nextY;
              else citizen.pause = .35;
            }
          }
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
        const goblinRegionActive = p.x >= 57 * TILE && p.x <= 107 * TILE && p.y >= 41 * TILE && p.y < 63 * TILE;
        const boss = game.enemies.find((item) => item.id === (goblinRegionActive ? 299 : 99))!;
        setHud({
          hp: Math.max(0, p.hp), energy: p.energy, gold: p.gold, shards: p.shards,
          kills: game.kills, quest: game.questStage, boss: Math.max(0, boss.hp),
          boat: game.boat, cooked: game.cooked, fishCaught: [...game.fishCaught], supplies: { ...game.supplies }, inventory: { ...game.inventory },
          position: { x: p.x, y: p.y },
          area: game.area === "shop" ? "LANTERN & LEAF"
            : game.area === "home" ? "YOUR HOME"
              : p.y >= 63 * TILE ? "AZURE SEA"
                : goblinRegionActive
                  ? p.x >= 96 * TILE ? "WAR CHIEF'S COMPOUND" : p.y >= 54 * TILE ? "RATTLEBONE YARD" : p.x < 76 * TILE ? "SNAGTOOTH MARKET" : "GOBLIN SHAMAN QUARTER"
                  : p.y >= 56 * TILE ? "AZURE COAST"
                    : p.x < 46 * TILE && p.y > 38 * TILE ? "WHISPERING FOREST"
                    : p.x >= 63 * TILE && p.x <= 105 * TILE && p.y >= 4 * TILE && p.y <= 40 * TILE
                      ? p.y < 11 * TILE ? "SUNSPIRE CASTLE" : p.y >= 20 * TILE && p.y <= 26 * TILE ? "DAWNMARKET BAZAAR" : "DAWNMARKET CITY"
                      : p.y < 14 * TILE && p.x > 45 * TILE ? "GUARDIAN GROVE"
                        : "TRANQUIL VILLAGE",
        });
        if (p.hp <= 0) setPhase("dead");
      }

      c.clearRect(0, 0, W, H);
      c.fillStyle = "#142617";
      c.fillRect(0, 0, W, H);
      if (tiles.complete && tiles.naturalWidth && sprites.complete && sprites.naturalWidth && expansion.complete && expansion.naturalWidth && forest.complete && ocean.complete && city.complete && city2.complete && fortified.complete && fortified.naturalWidth && goblinRegion.complete && goblinRegion.naturalWidth && goblinUnits.complete && goblinUnits.naturalWidth && water.complete) {
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
            if (item.action === "cage" && game.goblinPrisonerFreed) continue;
            renderables.push({ y: item.y, draw: () => {
              c.save();
              if (item.action === "trap" && game.disarmedTraps.includes(item.id)) c.globalAlpha = .35;
              drawCell(c, imageFor(item.atlas), item.cell, item.x - item.w / 2 - cam.x, item.y - item.h - cam.y, item.w, item.h);
              c.restore();
            } });
          }
          for (const resource of game.resources) {
            if (resource.collected) continue;
            const size = resource.kind === "fish" ? 74 : resource.kind === "berry" ? 70 : 56;
            renderables.push({ y: resource.y, draw: () => {
              drawResourceMarker(c, resource, cam, game.time, game.player.x, game.player.y);
              drawCell(c, imageFor(resource.atlas ?? "expansion"), resource.cell, resource.x - size / 2 - cam.x, resource.y - size - cam.y, size, size);
            } });
          }
          for (const npc of NPCS) {
            if (npc.id === "peeb" && game.goblinPrisonerFreed) continue;
            const npcSize = npc.atlas === "goblinUnits" ? 74 : 68;
            renderables.push({ y: npc.y, draw: () => drawCell(c, imageFor(npc.atlas ?? "sprites"), npc.cell, npc.x - npcSize / 2 - cam.x, npc.y - npcSize - cam.y, npcSize, npcSize) });
          }
          for (const citizen of game.citizens ?? []) renderables.push({ y: citizen.y, draw: () => {
            const walking = Math.hypot(citizen.targetX - citizen.x, citizen.targetY - citizen.y) > 12 && citizen.pause <= 0;
            const bob = walking ? Math.sin(game.time * 9 + citizen.id) * 2 : 0;
            drawCell(c, sprites, citizen.cell, citizen.x - 27 - cam.x, citizen.y - 57 - cam.y + bob, 54, 54);
          } });
          for (const enemy of game.enemies) {
            if (enemy.dead) continue;
            const size = enemy.boss ? 132 : enemy.atlas === "goblinUnits" ? (enemy.cell >= 8 && enemy.cell <= 11 ? 92 : 70) : enemy.atlas === "forest" && enemy.cell <= 5 ? 78 : 60;
            renderables.push({ y: enemy.y, draw: () => {
              c.save();
              if (enemy.flash > 0) c.globalAlpha = .45;
              drawCell(c, imageFor(enemy.atlas ?? "sprites"), enemy.cell, enemy.x - size / 2 - cam.x, enemy.y - size - cam.y, size, size);
              c.restore();
              if (!enemy.passive || enemy.hp < enemy.maxHp) {
                c.fillStyle = "#31120e";
                c.fillRect(enemy.x - 28 - cam.x, enemy.y - size - 9 - cam.y, 56, 5);
                c.fillStyle = enemy.boss ? "#d89a3b" : "#83c447";
                c.fillRect(enemy.x - 28 - cam.x, enemy.y - size - 9 - cam.y, 56 * Math.max(0, enemy.hp / enemy.maxHp), 5);
              }
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
        drawMiniMap(miniMapRef.current, game);
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
      <aside className={`pixel-minimap ${phase === "title" ? "hidden" : ""}`}>
        <header><span>LIVE MAP</span><b>{hud.area}</b></header>
        <canvas ref={miniMapRef} aria-label="Live minimap with player and collectible locations" />
        <footer><i className="you">◆ YOU</i><i className="loot">◆ RESOURCES</i></footer>
      </aside>
      {phase === "title" && (
        <section className="pixel-title">
          <small>AN ORIGINAL PIXEL ACTION RPG</small>
          <h1>ABYSS <span>WALKER</span></h1>
          <p>The last quiet flame returns to Tranquil Village.</p>
          <button onClick={() => startGame(false)}>{hasSave ? "CONTINUE ADVENTURE" : "BEGIN ADVENTURE"}</button>
          {hasSave && <button className="pixel-new-journey" onClick={resetSave}>NEW JOURNEY · ERASE SAVE</button>}
          <em>WASD / ARROWS · MOVE &nbsp; J / SPACE · ATTACK &nbsp; E · INTERACT</em>
        </section>
      )}
      {phase !== "title" && (
        <>
          <header className="pixel-hud">
            <div className="pixel-portrait">◇</div>
            <div><strong>OMAR</strong><small>LV. 1</small>
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
          <aside className="pixel-inventory" aria-label="Collected materials">
            <small>FIELD PACK</small>
            {(Object.keys(INGREDIENT_META) as Ingredient[]).map((kind) => (
              <span key={kind} className={`collectible ${kind}`} title={INGREDIENT_META[kind].label}>
                <i>{INGREDIENT_META[kind].icon}</i><b>{hud.inventory[kind]}</b><em>{INGREDIENT_META[kind].label}</em>
              </span>
            ))}
            <span className="collectible potion"><i>♥</i><b>{hud.supplies.potions}</b><em>Potions</em></span>
            <span className="collectible bait"><i>⌁</i><b>{hud.supplies.bait}</b><em>Bait</em></span>
            <span className="collectible weapon"><i>⚔</i><b>+{hud.supplies.spearLevel}</b><em>Spear</em></span>
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
            : vendorOpen === "fish" ? "TIDECATCHER'S STALL"
              : vendorOpen === "goblin" ? "GRIBBLE'S TOTALLY LEGAL GOODS" : "SUNBAKED PROVISIONS";
        const wares: { kind: "potion" | "bait" | "spear" | "armor" | "meal"; name: string; copy: string; cost: number }[] =
          vendorOpen === "goblin"
            ? [
              { kind: "potion", name: "BOTTLED GREEN STUFF", copy: "Gribble promises it is a potion", cost: 20 },
              { kind: "bait", name: "PRE-LOVED WORMS ×3", copy: "The worms have stories", cost: 12 },
              { kind: "meal", name: "CHEF NIB'S MYSTERY SOUP", copy: "Restores health, energy and doubt", cost: 18 },
            ]
            : vendorOpen === "weapons"
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
            <small>{vendorOpen === "goblin" ? "SNAGTOOTH TRADING PIT" : "DAWNMARKET MERCHANT"}</small><h2>{vendorName}</h2>
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
            <i className="goblin">SNAGTOOTH ENCAMPMENT<br />MARKET · PRISON · WAR CHIEF</i>
            <i className="coast">AZURE COAST<br />FISHING DOCK</i>
            <i className="ocean">AZURE SEA<br />BOAT ROUTE</i><i className="cache">HIDDEN CACHE</i>
            <b style={{ left: `${Math.max(2, Math.min(96, hud.position.x / WORLD_W * 100))}%`, top: `${Math.max(3, Math.min(92, hud.position.y / WORLD_H * 100))}%` }}>◆ YOU</b>
          </div>
          <p>A single connected world: village life, your homestead, wild forest, market city, river crossings, coast and open-water routes.</p>
        </section>
      )}
      {phase === "dead" && <section className="pixel-dead"><h2>THE FLAME FADES</h2><button onClick={() => startGame(false)}>RETURN TO LAST SAVE</button></section>}
    </main>
  );
}
