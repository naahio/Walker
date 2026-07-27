"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "title" | "playing" | "dead";
type Area = "village" | "shop" | "home";
type Direction = "down" | "left" | "right" | "up";
type WorldObject = {
  id: string;
  cell: number;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: boolean;
  atlas?: "tiles" | "expansion";
  action?: "shop" | "home" | "chest" | "shrine" | "boat" | "cook";
};
type Actor = {
  id: string;
  cell: number;
  name: string;
  x: number;
  y: number;
  line: string;
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
  atlas?: "sprites" | "expansion";
  dropsMeat?: boolean;
};
type Ingredient = "herb" | "mushroom" | "berry" | "ore" | "fish" | "meat";
type ResourceNode = { id: string; cell: number; x: number; y: number; kind: Ingredient; collected: boolean };
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
  resources: ResourceNode[];
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

const NPCS: Actor[] = [
  { id: "elder", cell: 4, name: "Elder Ash", x: 18 * TILE, y: 18 * TILE, line: "Your old homestead is yours again. Gather herbs and mushrooms in the Whispering Forest, then light its hearth and cook a Root Stew." },
  { id: "merchant", cell: 5, name: "Luma", x: 26 * TILE, y: 24 * TILE, line: "My cottage is open. The blue shrine beside the river will restore your flame." },
  { id: "mapper", cell: 6, name: "Vey", x: 10 * TILE, y: 25 * TILE, line: "Roads are safe, but old paths hide chests. Press M whenever the forest turns you around." },
  { id: "guard", cell: 7, name: "Warden Ilyr", x: 45 * TILE, y: 20 * TILE, line: "The bridge leads north to the Guardian Grove. Keep your spear ready." },
  { id: "fisher", cell: 6, name: "Maro the Fisher", x: 53 * TILE, y: 45 * TILE, line: "Fish where the water circles. A boat will carry you beyond the river mouth to the Azure Coast." },
  { id: "mayor", cell: 7, name: "Mayor Sol", x: 80 * TILE, y: 17 * TILE, line: "Dawnmarket welcomes hunters, cooks and travellers. Bring produce from every region." },
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
  { id: "river-dock", atlas: "expansion", cell: 5, x: 53 * TILE, y: 44 * TILE, w: 125, h: 135, action: "boat" },
  { id: "coast-dock", atlas: "expansion", cell: 5, x: 78 * TILE, y: 62 * TILE, w: 125, h: 135, action: "boat" },
  { id: "dawn-market-a", atlas: "expansion", cell: 15, x: 76 * TILE, y: 20 * TILE, w: 145, h: 130, solid: true },
  { id: "dawn-market-b", atlas: "expansion", cell: 15, x: 84 * TILE, y: 20 * TILE, w: 145, h: 130, solid: true },
  { id: "city-home-a", cell: 10, x: 74 * TILE, y: 12 * TILE, w: 190, h: 185, solid: true },
  { id: "city-home-b", cell: 10, x: 84 * TILE, y: 12 * TILE, w: 190, h: 185, solid: true },
  ...[[68, 8], [71, 27], [88, 8], [91, 25], [99, 17], [66, 34], [20, 50], [11, 53], [30, 55]].map(([tx, ty], i) => ({
    id: `world-tree-${i}`, cell: 8, x: tx * TILE, y: ty * TILE, w: 112, h: 135, solid: true,
  })),
];

function makeResources(): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  [[8, 47], [13, 56], [18, 63], [30, 48], [42, 38], [67, 39]].forEach(([x, y], i) => nodes.push({ id: `herb-${i}`, cell: 0, x: x * TILE, y: y * TILE, kind: "herb", collected: false }));
  [[6, 54], [17, 45], [29, 58], [44, 34]].forEach(([x, y], i) => nodes.push({ id: `mushroom-${i}`, cell: 1, x: x * TILE, y: y * TILE, kind: "mushroom", collected: false }));
  [[25, 36], [33, 40], [72, 34], [92, 29]].forEach(([x, y], i) => nodes.push({ id: `berry-${i}`, cell: 2, x: x * TILE, y: y * TILE, kind: "berry", collected: false }));
  [[53, 37], [54, 51], [68, 64], [84, 66], [97, 61]].forEach(([x, y], i) => nodes.push({ id: `fish-${i}`, cell: 4, x: x * TILE, y: y * TILE, kind: "fish", collected: false }));
  [[39, 7], [61, 15], [101, 34]].forEach(([x, y], i) => nodes.push({ id: `ore-${i}`, cell: 3, x: x * TILE, y: y * TILE, kind: "ore", collected: false }));
  return nodes;
}

const WORLD_OBJECTS = [...OBJECTS, ...EXPANSION_OBJECTS];

function makeEnemies(): Enemy[] {
  const data = [
    [8, 15, 28, 70, 64], [8, 21, 32, 70, 64], [9, 43, 29, 120, 78],
    [10, 47, 13, 95, 58], [11, 54, 16, 120, 56], [8, 36, 37, 70, 66],
  ];
  const enemies = data.map(([cell, tx, ty, hp, speed], id) => ({
    id, cell, x: tx * TILE, y: ty * TILE, homeX: tx * TILE, homeY: ty * TILE,
    hp, maxHp: hp, speed, cooldown: 0, flash: 0,
  }));
  enemies.push({
    id: 99, cell: 12, x: 55 * TILE, y: 7 * TILE, homeX: 55 * TILE, homeY: 7 * TILE,
    hp: 760, maxHp: 760, speed: 42, boss: true, cooldown: 0, flash: 0,
  });
  enemies.push(
    { id: 120, atlas: "expansion", cell: 8, x: 13 * TILE, y: 49 * TILE, homeX: 13 * TILE, homeY: 49 * TILE, hp: 95, maxHp: 95, speed: 105, cooldown: 0, flash: 0, dropsMeat: true },
    { id: 121, atlas: "expansion", cell: 9, x: 21 * TILE, y: 56 * TILE, homeX: 21 * TILE, homeY: 56 * TILE, hp: 145, maxHp: 145, speed: 82, cooldown: 0, flash: 0, dropsMeat: true },
    { id: 122, atlas: "expansion", cell: 8, x: 32 * TILE, y: 48 * TILE, homeX: 32 * TILE, homeY: 48 * TILE, hp: 95, maxHp: 95, speed: 105, cooldown: 0, flash: 0, dropsMeat: true },
  );
  return enemies;
}

function freshGame(): Game {
  return {
    area: "village",
    player: { x: 18 * TILE, y: 23 * TILE, vx: 0, vy: 0, direction: "down", hp: 320, maxHp: 320, energy: 100, gold: 0, shards: 0, invuln: 0 },
    keys: new Set(),
    camera: { x: 0, y: 500 },
    enemies: makeEnemies(),
    openedChest: false,
    shrineActive: false,
    boat: false,
    inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0 },
    cooked: 0,
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
  if ((ty >= 20 && ty <= 22) || (tx >= 16 && tx <= 18) || (tx >= 78 && tx <= 80) || (ty >= 47 && ty <= 49 && tx < 80)) return 1;
  if ((tx > 68 && tx < 92 && ty > 10 && ty < 29) || (ty >= 60 && ty < 63)) return 1;
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
  const [toast, setToast] = useState("");
  const [hud, setHud] = useState({ hp: 320, energy: 100, gold: 0, shards: 0, kills: 0, quest: 0, boss: 760, area: "TRANQUIL VILLAGE", boat: false, cooked: 0, inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0 } });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const startGame = useCallback(() => {
    gameRef.current = freshGame();
    setDialog(null);
    setMapOpen(false);
    setCookingOpen(false);
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
    tiles.src = "/art/sprites/pixel-world-tileset.png";
    sprites.src = "/art/sprites/pixel-rpg-sprites.png";
    expansion.src = "/art/sprites/pixel-world-expansion.png";
    let raf = 0;

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
          enemy.hp -= enemy.boss ? 34 : 52;
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
        setToast(`${resource.kind.toUpperCase()} GATHERED · ${game.inventory[resource.kind]} IN YOUR PACK`);
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
      if (phaseRef.current === "playing" && !mapRef.current && !dialog && !cookingOpen) {
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
              const ex = (p.x - enemy.x) / Math.max(1, distance);
              const ey = (p.y - enemy.y) / Math.max(1, distance);
              const tx = enemy.x + ex * enemy.speed * dt;
              const ty = enemy.y + ey * enemy.speed * dt;
              if (!blocked(game, tx, enemy.y)) enemy.x = tx;
              if (!blocked(game, enemy.x, ty)) enemy.y = ty;
            } else {
              enemy.x = enemy.homeX + Math.sin(game.time * .7 + enemy.id) * 30;
            }
            if (distance < (enemy.boss ? 66 : 40) && enemy.cooldown <= 0 && p.invuln <= 0) {
              p.hp -= enemy.boss ? 34 : 14;
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
          boat: game.boat, cooked: game.cooked, inventory: { ...game.inventory },
          area: game.area === "shop" ? "LANTERN & LEAF"
            : game.area === "home" ? "YOUR HOME"
              : p.y >= 63 * TILE ? "AZURE SEA"
                : p.y >= 56 * TILE ? "AZURE COAST"
                  : p.x < 46 * TILE && p.y > 38 * TILE ? "WHISPERING FOREST"
                    : p.x > 68 * TILE && p.y < 30 * TILE ? "DAWNMARKET CITY"
                      : p.y < 14 * TILE && p.x > 45 * TILE ? "GUARDIAN GROVE"
                        : "TRANQUIL VILLAGE",
        });
        if (p.hp <= 0) setPhase("dead");
      }

      c.clearRect(0, 0, W, H);
      c.fillStyle = "#142617";
      c.fillRect(0, 0, W, H);
      if (tiles.complete && tiles.naturalWidth && sprites.complete && sprites.naturalWidth && expansion.complete && expansion.naturalWidth) {
        const game = gameRef.current;
        const cam = game.camera;
        if (game.area === "shop" || game.area === "home") {
          for (let ty = 0; ty < 14; ty++) for (let tx = 0; tx < 20; tx++) {
            drawCell(c, tiles, tx < 2 || tx > 17 || ty < 2 ? 4 : 5, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
          }
          const interiorItems = [...(game.area === "home" ? HOME_OBJECTS : SHOP_OBJECTS)].sort((a, b) => a.y - b.y);
          for (const item of interiorItems) drawCell(c, item.atlas === "expansion" ? expansion : tiles, item.cell, item.x - item.w / 2 - cam.x, item.y - item.h - cam.y, item.w, item.h);
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
            drawCell(c, tiles, ground, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
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
            renderables.push({ y: item.y, draw: () => drawCell(c, item.atlas === "expansion" ? expansion : tiles, item.cell, item.x - item.w / 2 - cam.x, item.y - item.h - cam.y, item.w, item.h) });
          }
          for (const resource of game.resources) {
            if (resource.collected) continue;
            const size = resource.kind === "fish" ? 74 : resource.kind === "berry" ? 70 : 56;
            renderables.push({ y: resource.y, draw: () => drawCell(c, expansion, resource.cell, resource.x - size / 2 - cam.x, resource.y - size - cam.y, size, size) });
          }
          for (const npc of NPCS) renderables.push({ y: npc.y, draw: () => drawCell(c, sprites, npc.cell, npc.x - 34 - cam.x, npc.y - 68 - cam.y, 68, 68) });
          for (const enemy of game.enemies) {
            if (enemy.dead) continue;
            const size = enemy.boss ? 132 : 66;
            renderables.push({ y: enemy.y, draw: () => {
              c.save();
              if (enemy.flash > 0) c.globalAlpha = .45;
              drawCell(c, enemy.atlas === "expansion" ? expansion : sprites, enemy.cell, enemy.x - size / 2 - cam.x, enemy.y - size - cam.y, size, size);
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
          const boatCell = p.direction === "up" || p.direction === "down" ? 7 : 6;
          drawCell(c, expansion, boatCell, p.x - 52 - cam.x, p.y - 68 - cam.y, 104, 78);
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
  }, [cookingOpen, dialog, setPhase]);

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
          <div className="pixel-wallet"><span>● {hud.gold}</span><span>◆ {hud.shards}</span><button onClick={() => { mapRef.current = true; setMapOpen(true); }}>MAP</button></div>
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
            {hud.boat && <b>⛵ SAILING</b>}
          </aside>
          <div className="pixel-hotbar"><button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }))}><b>J</b><span>✦</span><small>SPEAR</small></button><button><b>1</b><span>✚</span><small>HEAL</small></button><button><b>M</b><span>⌖</span><small>MAP</small></button><button><b>E</b><span>!</span><small>USE</small></button></div>
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
