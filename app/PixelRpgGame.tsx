"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "title" | "select" | "playing" | "dead";
type Area = "village" | "shop" | "home";
type Direction = "down" | "left" | "right" | "up";
type HeroId = "warrior" | "archer";
type Atlas = "tiles" | "expansion" | "forest" | "ocean" | "city" | "city2" | "fortified" | "goblinRegion" | "goblinUnits" | "desertRegion" | "desertUnits" | "farmRegion" | "farmCrops" | "npcs";
type VendorId = "weapons" | "potions" | "fish" | "food" | "goblin";
type CropKind = "carrot" | "potato" | "tomato" | "onion" | "cabbage" | "strawberry" | "pumpkin" | "corn";
type FarmStyle = "homestead" | "orchard" | "market";
type FarmPlot = { id: string; x: number; y: number; unlockedAt: number; crop: CropKind | null; plantedAt: number; watered: boolean };
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
  rotation?: number;
  action?: "shop" | "home" | "chest" | "shrine" | "boat" | "cook" | "vendor" | "castle" | "cage" | "trap" | "bossLair" | "goblinShrine" | "desertObelisk" | "desertPlate" | "desertTomb" | "farmhouse" | "farmBarn" | "farmStand" | "farmWell" | "adventureGate";
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
  specialCooldown?: number;
  specialTime?: number;
  specialKind?: "rootSlam" | "chiefCharge" | "sunVortex";
  specialX?: number;
  specialY?: number;
  specialTriggered?: boolean;
};
type Ingredient = "herb" | "mushroom" | "berry" | "ore" | "fish" | "meat" | "scrap" | "muckroot";
type ResourceNode = { id: string; cell: number; x: number; y: number; kind: Ingredient; collected: boolean; atlas?: Atlas };
type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  pierce: number;
  kind: "arrow" | "piercing" | "volley";
  hit: number[];
};
type Game = {
  area: Area;
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hero: HeroId;
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
  desertQuestStage: number;
  desertObelisks: string[];
  desertPlates: string[];
  desertBossUnlocked: boolean;
  farmUnlocked: boolean;
  farmLevel: number;
  farmStyle: FarmStyle;
  farmPlots: FarmPlot[];
  seeds: Record<CropKind, number>;
  produce: Record<CropKind, number>;
  harvestedTotal: number;
  farmRevenue: number;
  questStage: number;
  kills: number;
  attackTime: number;
  attackCooldown: number;
  abilityCooldowns: [number, number, number];
  abilityTime: number;
  abilitySlot: number;
  dashTime: number;
  projectiles: Projectile[];
  nextProjectileId: number;
  time: number;
  last: number;
};

const W = 1280;
const H = 720;
const TILE = 48;
const MAP_W = 180;
const MAP_H = 80;
const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;
const FISH_TYPES = ["Silver Minnow", "Bluegill", "Crimson Carp", "Golden Koi", "Catfish", "Rainbow Trout", "Void Eel", "Ancient Sturgeon"];
const CROP_META: Record<CropKind, { label: string; icon: string; growMs: number; price: number; row: number; unlockAt: number }> = {
  carrot: { label: "جزر", icon: "🥕", growMs: 45_000, price: 8, row: 0, unlockAt: 1 },
  potato: { label: "بطاطس", icon: "🥔", growMs: 60_000, price: 12, row: 1, unlockAt: 1 },
  tomato: { label: "طماطم", icon: "🍅", growMs: 75_000, price: 16, row: 2, unlockAt: 2 },
  onion: { label: "بصل", icon: "🧅", growMs: 70_000, price: 15, row: 1, unlockAt: 2 },
  cabbage: { label: "ملفوف", icon: "🥬", growMs: 90_000, price: 20, row: 0, unlockAt: 3 },
  strawberry: { label: "فراولة", icon: "🍓", growMs: 85_000, price: 22, row: 2, unlockAt: 3 },
  pumpkin: { label: "يقطين", icon: "🎃", growMs: 100_000, price: 24, row: 3, unlockAt: 4 },
  corn: { label: "ذرة", icon: "🌽", growMs: 110_000, price: 28, row: 3, unlockAt: 4 },
};

function makeFarmPlots(): FarmPlot[] {
  const plots: FarmPlot[] = [
    // The four starter beds now live beside the player's house. Each quest
    // expansion visibly clears another neighbouring field.
    [36, 30, 1], [38, 30, 1], [36, 32, 1], [38, 32, 1],
    [41, 30, 2], [43, 30, 2], [45, 30, 2], [41, 32, 2], [43, 32, 2], [45, 32, 2],
    [36, 36, 3], [38, 36, 3], [40, 36, 3], [36, 38, 3], [38, 38, 3], [40, 38, 3],
    [43, 36, 4], [45, 36, 4], [47, 36, 4], [49, 36, 4], [43, 38, 4], [45, 38, 4], [47, 38, 4], [49, 38, 4],
  ].map(([x, y, unlockedAt], index) => ({
    id: `farm-plot-${index}`,
    x: x * TILE,
    y: y * TILE,
    unlockedAt,
    crop: null,
    plantedAt: 0,
    watered: false,
  }));
  const villageFields = [
    [72, 48, 8, 7], [81, 48, 10, 7], [92, 48, 10, 7], [81, 56, 14, 7],
  ] as const;
  const villageCrops: CropKind[] = ["carrot", "potato", "tomato", "pumpkin"];
  for (const [startX, startY, width, height] of villageFields) {
    for (let y = startY; y < startY + height; y++) for (let x = startX; x < startX + width; x++) {
      const planted = (x + y) % 2 === 0;
      const crop = planted ? villageCrops[Math.abs(x * 3 + y) % villageCrops.length] : null;
      plots.push({
        id: `village-plot-${x}-${y}`,
        x: x * TILE,
        y: y * TILE,
        unlockedAt: 1,
        crop,
        plantedAt: crop ? Date.now() - CROP_META[crop].growMs : 0,
        watered: Boolean(crop),
      });
    }
  }
  return plots;
}

function cropStage(plot: FarmPlot, now = Date.now()) {
  if (!plot.crop) return -1;
  if (!plot.watered) return 0;
  const progress = Math.min(1, Math.max(0, (now - plot.plantedAt) / CROP_META[plot.crop].growMs));
  return progress >= 1 ? 3 : Math.floor(progress * 3);
}

const NPCS: Actor[] = [
  { id: "elder", atlas: "npcs", cell: 96, name: "الشيخ آش", x: 18 * TILE, y: 18 * TILE, line: "عادت المزرعة القديمة إليك. اجمع الأعشاب والفطر من الغابة الهامسة، ثم أشعل الموقد واطبخ حساء الجذور." },
  { id: "merchant", atlas: "npcs", cell: 35, name: "لوما", x: 26 * TILE, y: 24 * TILE, line: "متجري مفتوح لك. الضريح الأزرق قرب النهر يعيد لك الصحة والطاقة." },
  { id: "mapper", atlas: "npcs", cell: 138, name: "فاي رسّام الخرائط", x: 10 * TILE, y: 25 * TILE, line: "الطرق الرئيسية آمنة، لكن الممرات القديمة تخفي صناديق. اضغط M عندما تضل طريقك." },
  { id: "guard", atlas: "npcs", cell: 14, name: "الحارس إلير", x: 45 * TILE, y: 20 * TILE, line: "الجسر يقود شمالاً إلى بستان الحارس. أبقِ رمحك جاهزاً." },
  { id: "fisher", atlas: "npcs", cell: 78, name: "مارو الصياد", x: 53 * TILE, y: 45 * TILE, line: "اصطد عند دوائر الماء. سيحملك القارب إلى ما وراء مصب النهر والساحل الأزرق." },
  { id: "mayor", atlas: "npcs", cell: 3, name: "العمدة سول", x: 77 * TILE, y: 17 * TILE, line: "سوق الفجر يرحب بالصيادين والطهاة والمسافرين. أحضر منتجات من كل منطقة." },
  { id: "hunter", atlas: "npcs", cell: 192, name: "روك الصياد", x: 10 * TILE, y: 48 * TILE, line: "تهرب الغزلان، تهاجم الخنازير، وتختبئ الأرانب بين الأعشاب. الضريح القديم يحدد ممراً سرياً." },
  { id: "smith", atlas: "npcs", cell: 74, name: "بران الحداد", x: 72 * TILE, y: 24 * TILE, line: "فولاذ سوق الفجر يحتاج خشب الغابة وخام البلور. أحضرهما وسيتذكرك أهل المدينة." },
  { id: "baker", atlas: "npcs", cell: 45, name: "ميرا الخبازة", x: 83 * TILE, y: 24 * TILE, line: "أفراننا لا تبرد أبداً. التوت والسمك والطرائد كلها تتحول إلى مؤن للمسافرين." },
  { id: "librarian", atlas: "npcs", cell: 111, name: "أمين الأرشيف أورين", x: 82 * TILE, y: 15 * TILE, line: "كل طريق ونهر وبستان منسي مسجل هنا... باستثناء الطرق التي تتحرك ليلاً." },
  { id: "gate-captain", atlas: "npcs", cell: 12, name: "القائد أستر", x: 82 * TILE, y: 35 * TILE, line: "البوابة الجنوبية لا تغلق أمام المسافرين الشرفاء. شارع السوق يقود مباشرة إلى القلعة." },
  { id: "clothier", atlas: "npcs", cell: 39, name: "تيسا الخياطة", x: 88 * TILE, y: 26 * TILE, line: "الأزرق للتاج، والأحمر للخبازين، والأخضر للعشابين. لكل حرفة لونها في سوق الفجر." },
  { id: "apothecary", atlas: "npcs", cell: 163, name: "الأخت فال", x: 77 * TILE, y: 26 * TILE, line: "أحضر أعشاب الغابة وفطر الكهوف. العلاج يبدأ بحذاء موحل، لا بزجاجة لامعة." },
  { id: "fishmonger", atlas: "npcs", cell: 102, name: "نيريس بائع السمك", x: 86 * TILE, y: 22 * TILE, line: "صيد الصباح جاء عبر نهر المرآة. السمك النادر يساوي أكثر من ليلة في النزل." },
  { id: "courier", atlas: "npcs", cell: 134, name: "بيب ساعي البريد", x: 91 * TILE, y: 18 * TILE, line: "القلعة والمكتبة والبازار والبوابة الجنوبية... قدماي تعرفان كل حجر هنا." },
  { id: "stablemaster", atlas: "npcs", cell: 235, name: "روان سيد الإسطبل", x: 68 * TILE, y: 33 * TILE, line: "الساحة الغربية تخدم الصيادين والقوافل. حتى عمر يحتاج مكاناً للراحة." },
  { id: "gardener", atlas: "npcs", cell: 68, name: "موس البستاني", x: 98 * TILE, y: 27 * TILE, line: "حدائق النافورة تزهر لأن المسافرين يجلبون بذوراً من مناطق بعيدة." },
  { id: "castle-scholar", atlas: "npcs", cell: 98, name: "الباحث إليان", x: 86 * TILE, y: 13 * TILE, line: "بُنيت القلعة حول شعلة أقدم منها. جذورها تمتد إلى ما وراء أسوار المدينة." },
  { id: "camp-scout", atlas: "npcs", cell: 200, name: "نيا الكشافة", x: 16 * TILE, y: 52 * TILE, line: "تتقاطع آثار الغزلان والخنازير والأرانب قرب البستان العميق، ومعها أثر شيء يحطم الحجر." },
  { id: "herbalist", atlas: "npcs", cell: 164, name: "فين العشّابة", x: 28 * TILE, y: 55 * TILE, line: "الزهور الزرقاء تدل على تربة نظيفة. أما ألمع أنواع الفطر فتختبئ قرب الأطلال." },
  { id: "city-watch-west", atlas: "npcs", cell: 15, name: "الرقيب فال", x: 66 * TILE, y: 22 * TILE, line: "دورية السور الغربي بخير. الأبراج تغطي الزوايا، ولا توجد نقاط عمياء." },
  { id: "city-watch-east", atlas: "npcs", cell: 13, name: "الرقيب كورين", x: 103 * TILE, y: 22 * TILE, line: "السور الشرقي هادئ. نفحص التجار القادمين من الصحراء عند البوابة الجنوبية." },
  { id: "guildmaster", atlas: "npcs", cell: 8, name: "إيدا قائدة النقابة", x: 73 * TILE, y: 16 * TILE, line: "تنشر نقابة المغامرين مكافآت للوحوش والمرافقة واستكشاف الأطلال والقوافل المفقودة." },
  { id: "stable-boy", atlas: "npcs", cell: 236, name: "تارين مساعد الإسطبل", x: 68 * TILE, y: 36 * TILE, line: "الخيول تحتاج حبوباً وماءً نظيفاً ويداً هادئة. تزدحم الساحة قبل الشروق." },
  { id: "street-musician", atlas: "npcs", cell: 132, name: "ليان العازفة", x: 84 * TILE, y: 27 * TILE, line: "لكل حي أغنيته. ارمِ قطعة ذهبية وقد أعزف لك لحن القلعة القديم." },
  { id: "market-cook", atlas: "npcs", cell: 42, name: "الطاهي برام", x: 96 * TILE, y: 27 * TILE, line: "حساء ساخن وسمك مشوي وفطائر التوت! أحضر المكونات وسنحولها إلى وجبة حقيقية." },
  { id: "city-farmer", atlas: "npcs", cell: 33, name: "المزارعة نيلا", x: 69 * TILE, y: 46 * TILE, line: "تبدأ مزرعتك بأربعة أحواض فقط. تعلّم الزراعة مني، وأنهِ مهام الحقول لتوسيع أرضك كما تريد." },
  { id: "frontier-warden", atlas: "npcs", cell: 142, name: "الحارسة براير", x: 114 * TILE, y: 52 * TILE, line: "بعد هذا الحاجز تبدأ غابة برايرواتش. يتوقف المزارعون هنا، ولا يعبر ممر الفوانيس إلا المغامرون." },
  { id: "mason", atlas: "npcs", cell: 108, name: "أوريك كبير البنّائين", x: 101 * TILE, y: 36 * TILE, line: "قوة السور من قوة زواياه. الأبراج تثبت الجوانب، والحجارة السفلى تحمل الوزن كله." },
  { id: "courtyard-child", atlas: "npcs", cell: 129, name: "ميلو", x: 88 * TILE, y: 20 * TILE, line: "أتسابق مع سعاة البريد من النافورة إلى البوابة. بيب يقول إنه يتركني أفوز!" },
  { id: "city-healer", atlas: "npcs", cell: 100, name: "المعالجة أمارا", x: 97 * TILE, y: 33 * TILE, line: "يعالج المعبد المسافرين مجاناً، لكن الأدوية النادرة تحتاج أعشاباً من أماكن خطرة." },
  { id: "gribble", atlas: "goblinUnits", cell: 5, name: "غريبل شبه الصادق", x: 129 * TILE, y: 51 * TILE, line: "أشياء لامعة! معظمها وجدتها، وبعضها اشتريته، ولا يبحث الحراس عن أي منها حالياً." },
  { id: "chef-nib", atlas: "goblinUnits", cell: 6, name: "الطاهي نيب", x: 135 * TILE, y: 55 * TILE, line: "حساء اليوم بالفطر والحذاء والمفاجأة. الحذاء أغلى لأنه مقرمش." },
  { id: "wizzle", atlas: "goblinUnits", cell: 13, name: "ويزل طبيب الأرواح", x: 142 * TILE, y: 47 * TILE, line: "الأرواح تقول إن بطلاً وصل. وتقول أيضاً إنني تركت القدر فوق النار. نبوءتان سيئتان." },
  { id: "bork", atlas: "goblinUnits", cell: 0, name: "بورك مفتش الفخاخ", x: 122 * TILE, y: 57 * TILE, line: "كل الفخاخ اجتازت الفحص. فحصتها من مسافة آمنة جداً." },
  { id: "peeb", atlas: "goblinUnits", cell: 14, name: "بيب السجين", x: 152 * TILE, y: 56 * TILE, line: "سجنوني لأنني سألت لماذا يحتاج الزعيم إلى سبعة عشر كرسياً. افتح القفص قبل أن يشتري الثامن عشر." },
  { id: "zahir", atlas: "desertUnits", cell: 2, name: "الأمير زاهر", x: 158 * TILE, y: 16 * TILE, line: "أيقظ مسلات الشمس الثلاث، واضغط الأختام المرآتية، واهزم حراس الكثبان، ثم ادخل القبر الملكي." },
  { id: "safi", atlas: "desertUnits", cell: 10, name: "صافي راعية القافلة", x: 146 * TILE, y: 28 * TILE, line: "تعبر القوافل الكثبان عند الفجر. الماء والظل والرمح الحاد أثمن من الذهب." },
  { id: "nadia", atlas: "desertUnits", cell: 3, name: "نادية كاهنة الشمس", x: 169 * TILE, y: 30 * TILE, line: "تستجيب المسلات أولاً، ثم أختام الضغط. بعد ذلك فقط سيسمع القبر خطواتك." },
  { id: "rami", atlas: "desertUnits", cell: 1, name: "رامي حارس الواحة", x: 155 * TILE, y: 35 * TILE, line: "تحمي الأحجار القديمة الواحة، لكن ثلاثة حراس يجوبون الكثبان: العملاق والملك المحنط وملكة العقارب." },
];

// Exact role locations in the clear city/farm character sheet. Goblin and desert
// actors continue to use their own regional sheets.
const CLEAR_NPC_ROLE: Record<string, number> = {
  elder: 58, merchant: 25, mapper: 20, guard: 3, fisher: 65, mayor: 18,
  hunter: 66, smith: 7, baker: 28, librarian: 20, "gate-captain": 4,
  clothier: 34, apothecary: 10, fishmonger: 33, courier: 22, stablemaster: 30,
  gardener: 59, "castle-scholar": 14, "camp-scout": 66, herbalist: 59,
  "city-watch-west": 47, "city-watch-east": 48, guildmaster: 6, "stable-boy": 50,
  "street-musician": 15, "market-cook": 29, "city-farmer": 54,
  "frontier-warden": 49, mason: 31, "courtyard-child": 36, "city-healer": 11,
};

const CITY_CROWD_CELLS = [
  96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107,
  128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139,
  160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171,
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
  { id: "player-home", atlas: "expansion", cell: 12, x: 32 * TILE, y: 30 * TILE, w: 215, h: 212, solid: true, action: "home" },
  { id: "home-well", atlas: "farmRegion", cell: 8, x: 28 * TILE, y: 31 * TILE, w: 118, h: 118, solid: true, collision: { w: 70, h: 28 }, action: "farmWell" },
  { id: "home-produce-stand", atlas: "farmRegion", cell: 9, x: 32 * TILE, y: 35 * TILE, w: 155, h: 125, solid: true, collision: { w: 105, h: 27 }, action: "farmStand" },
  { id: "home-field-gate", atlas: "farmRegion", cell: 11, x: 35 * TILE, y: 34 * TILE, w: 150, h: 112 },
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
  // Civic landmarks and service buildings.
  { id: "royal-castle", atlas: "fortified", cell: 8, x: 84 * TILE, y: 12 * TILE, w: 390, h: 375, solid: true, collision: { w: 255, h: 70 }, action: "castle" },
  { id: "royal-barracks", atlas: "fortified", cell: 9, x: 69 * TILE, y: 13 * TILE, w: 240, h: 230, solid: true, collision: { w: 176, h: 48 } },
  { id: "city-bank", atlas: "city2", cell: 3, x: 99 * TILE, y: 13 * TILE, w: 230, h: 220, solid: true },
  { id: "city-inn", atlas: "city", cell: 2, x: 69 * TILE, y: 22 * TILE, w: 220, h: 205, solid: true, action: "vendor", vendor: "food" },
  { id: "city-library", atlas: "city", cell: 6, x: 99 * TILE, y: 22 * TILE, w: 225, h: 210, solid: true },
  { id: "city-forge", atlas: "city", cell: 5, x: 68 * TILE, y: 32 * TILE, w: 205, h: 195, solid: true, action: "vendor", vendor: "weapons" },
  { id: "city-temple", atlas: "city", cell: 11, x: 99 * TILE, y: 32 * TILE, w: 230, h: 225, solid: true, action: "shrine" },
  { id: "city-fountain", atlas: "fortified", cell: 13, x: 84 * TILE, y: 19 * TILE, w: 170, h: 150, solid: true, collision: { w: 122, h: 54 }, action: "shrine" },
  { id: "adventurers-guild", atlas: "fortified", cell: 10, x: 75 * TILE, y: 18 * TILE, w: 205, h: 188, solid: true, collision: { w: 142, h: 42 } },
  { id: "city-healers-hall", atlas: "city2", cell: 11, x: 96 * TILE, y: 35 * TILE, w: 205, h: 190, solid: true, collision: { w: 138, h: 40 }, action: "shrine" },
  { id: "city-stables", atlas: "city2", cell: 8, x: 68 * TILE, y: 38 * TILE, w: 220, h: 185, solid: true, collision: { w: 155, h: 40 } },
  { id: "city-granary", atlas: "city2", cell: 9, x: 76 * TILE, y: 38 * TILE, w: 195, h: 178, solid: true, collision: { w: 136, h: 38 } },

  // Residential districts: compact blocks with visible streets between them.
  ...[
    [73, 14, 8], [78, 14, 9], [90, 14, 10], [95, 14, 11],
    [72, 31, 9], [77, 34, 8], [91, 34, 10], [96, 31, 8],
    [72, 38, 10], [80, 37, 11], [89, 38, 9], [101, 37, 8],
    [74, 21, 10], [94, 21, 9], [74, 29, 8], [94, 29, 11],
  ].map(([tx, ty, cell], i) => ({
    id: `city-home-${i}`,
    atlas: i % 3 === 0 ? "city2" as const : "fortified" as const,
    cell: i % 3 === 0 ? cell : 10,
    x: tx * TILE,
    y: ty * TILE,
    w: cell === 11 ? 205 : 180,
    h: cell === 11 ? 185 : 170,
    solid: true,
    collision: { w: 125, h: 38 },
  })),

  // Market square and useful interactions.
  { id: "weapon-vendor", atlas: "fortified", cell: 11, x: 78 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "weapons" },
  { id: "potion-vendor", atlas: "fortified", cell: 11, x: 81 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "potions" },
  { id: "fish-vendor", atlas: "fortified", cell: 11, x: 88 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "fish" },
  { id: "food-vendor", atlas: "fortified", cell: 11, x: 91 * TILE, y: 25 * TILE, w: 150, h: 132, solid: true, collision: { w: 118, h: 30 }, action: "vendor", vendor: "food" },
  ...[[76, 27, 12], [80, 28, 13], [92, 27, 14], [96, 28, 15], [84, 31, 12], [88, 31, 13]].map(([tx, ty, cell], i) => ({
    id: `market-stall-${i}`, atlas: i % 2 ? "city2" as const : "fortified" as const, cell: i % 2 ? cell : 11,
    x: tx * TILE, y: ty * TILE, w: 138, h: 120, solid: true, collision: { w: 108, h: 28 },
  })),

  // A centered southern gate, leaving an actual walkable entrance.
  { id: "city-gate", atlas: "fortified", cell: 6, x: 85 * TILE, y: 42 * TILE, w: 245, h: 205, collision: { w: 55, h: 28 } },

  // Continuous north and south walls. They overlap slightly to hide sprite seams.
  ...Array.from({ length: 15 }, (_, i) => 65 + i * 2.9).map((tx, i) => ({
    id: `city-wall-n-${i}`, atlas: "fortified" as const, cell: 0, x: tx * TILE, y: 6 * TILE,
    w: 170, h: 98, solid: true, collision: { w: 158, h: 25 },
  })),
  ...[65, 68, 71, 74, 77, 80, 90, 93, 96, 99, 102, 105].map((tx, i) => ({
    id: `city-wall-s-${i}`, atlas: "fortified" as const, cell: 0, x: tx * TILE, y: 42 * TILE,
    w: 180, h: 98, solid: true, collision: { w: 168, h: 25 },
  })),

  // Dedicated vertical-wall artwork: no rotated horizontal sprites.
  ...Array.from({ length: 15 }, (_, i) => 8 + i * 2.2).flatMap((ty, i) => ([
    { id: `city-wall-w-${i}`, atlas: "fortified" as const, cell: 1, x: 64 * TILE, y: ty * TILE, w: 96, h: 150, solid: true, collision: { w: 30, h: 138 } },
    { id: `city-wall-e-${i}`, atlas: "fortified" as const, cell: 1, x: 106 * TILE, y: ty * TILE, w: 96, h: 150, solid: true, collision: { w: 30, h: 138 } },
  ])),

  // Corner towers are drawn last and overlap both wall directions, hiding joins.
  ...[[64, 6], [106, 6], [64, 42], [106, 42]].map(([tx, ty], i) => ({
    id: `city-corner-tower-${i}`, atlas: "fortified" as const, cell: i % 2 ? 5 : 4,
    x: tx * TILE, y: ty * TILE, w: 158, h: 195, solid: true, collision: { w: 98, h: 50 },
  })),
  { id: "city-gate-tower-west", atlas: "fortified", cell: 4, x: 81 * TILE, y: 42 * TILE, w: 145, h: 180, solid: true, collision: { w: 88, h: 46 } },
  { id: "city-gate-tower-east", atlas: "fortified", cell: 5, x: 89 * TILE, y: 42 * TILE, w: 145, h: 180, solid: true, collision: { w: 88, h: 46 } },

  // Street furniture and activity props.
  ...[[70, 18], [76, 18], [92, 18], [100, 18], [72, 28], [78, 30], [91, 30], [98, 28], [80, 35], [88, 35], [84, 23], [84, 35]].map(([tx, ty], i) => ({
    id: `city-lamp-${i}`, atlas: "fortified" as const, cell: 12, x: tx * TILE, y: ty * TILE,
    w: 58, h: 92, solid: true, collision: { w: 22, h: 20 },
  })),
  { id: "city-board", atlas: "city", cell: 13, x: 85 * TILE, y: 29 * TILE, w: 108, h: 100, solid: true },
  ...[[80, 18], [88, 18], [81, 32], [89, 32], [67, 24], [103, 24], [77, 36], [93, 36]].map(([tx, ty], i) => ({
    id: `city-flowers-${i}`, atlas: "city" as const, cell: 14, x: tx * TILE, y: ty * TILE, w: 96, h: 72,
  })),
  ...[[76, 20], [92, 20], [80, 33], [90, 33], [83, 21], [87, 21]].map(([tx, ty], i) => ({
    id: `city-bench-${i}`, atlas: "city" as const, cell: 15, x: tx * TILE, y: ty * TILE, w: 105, h: 75, solid: true,
  })),
  ...[[68, 16], [102, 16], [68, 27], [102, 27], [73, 40], [98, 40]].map(([tx, ty], i) => ({
    id: `city-cart-${i}`, atlas: "city2" as const, cell: 12 + (i % 4), x: tx * TILE, y: ty * TILE,
    w: 120, h: 88, solid: true, collision: { w: 82, h: 24 },
  })),
];

const GOBLIN_OBJECTS: WorldObject[] = [
  { id: "goblin-entry-gate", atlas: "goblinRegion", cell: 10, x: 144 * TILE, y: 43 * TILE, w: 245, h: 210 },
  { id: "snagtooth-war-camp", atlas: "goblinRegion", cell: 1, x: 121 * TILE, y: 48 * TILE, w: 250, h: 225, solid: true, collision: { w: 174, h: 48 } },
  { id: "shaman-tower", atlas: "goblinRegion", cell: 2, x: 139 * TILE, y: 47 * TILE, w: 225, h: 270, solid: true, collision: { w: 130, h: 52 }, action: "goblinShrine" },
  { id: "snagtooth-keep", atlas: "goblinRegion", cell: 3, x: 149 * TILE, y: 48 * TILE, w: 275, h: 255, solid: true, collision: { w: 190, h: 54 } },
  { id: "war-chief-lair", atlas: "goblinRegion", cell: 0, x: 161 * TILE, y: 50 * TILE, w: 335, h: 305, solid: true, collision: { w: 248, h: 62 }, action: "bossLair" },
  { id: "goblin-barracks", atlas: "goblinRegion", cell: 5, x: 124 * TILE, y: 58 * TILE, w: 225, h: 195, solid: true, collision: { w: 160, h: 42 } },
  { id: "goblin-weapons-hall", atlas: "goblinRegion", cell: 6, x: 139 * TILE, y: 59 * TILE, w: 235, h: 205, solid: true, collision: { w: 170, h: 46 } },
  { id: "goblin-forge", atlas: "goblinRegion", cell: 7, x: 162 * TILE, y: 59 * TILE, w: 225, h: 200, solid: true, collision: { w: 165, h: 44 } },
  { id: "goblin-market", atlas: "goblinRegion", cell: 14, x: 129 * TILE, y: 52 * TILE, w: 220, h: 180, solid: true, collision: { w: 150, h: 36 }, action: "vendor", vendor: "goblin" },
  { id: "goblin-cage", atlas: "goblinRegion", cell: 13, x: 152 * TILE, y: 57 * TILE, w: 150, h: 155, solid: true, collision: { w: 110, h: 38 }, action: "cage" },
  { id: "goblin-bonfire-a", atlas: "goblinRegion", cell: 12, x: 132 * TILE, y: 47 * TILE, w: 125, h: 115, solid: true, collision: { w: 78, h: 28 }, action: "goblinShrine" },
  { id: "goblin-bonfire-b", atlas: "goblinRegion", cell: 12, x: 146 * TILE, y: 55 * TILE, w: 115, h: 105, solid: true, collision: { w: 72, h: 26 }, action: "goblinShrine" },
  { id: "goblin-swamp-bridge", atlas: "goblinRegion", cell: 15, x: 132 * TILE, y: 61 * TILE, w: 235, h: 115 },
  ...[[127, 46], [134, 44], [146, 45], [155, 45], [120, 54], [134, 57], [157, 55]].map(([tx, ty], i) => ({
    id: `goblin-hut-${i}`, atlas: "goblinRegion" as const, cell: 4, x: tx * TILE, y: ty * TILE, w: 158, h: 145, solid: true, collision: { w: 108, h: 31 },
  })),
  ...[[118, 44], [166, 44], [118, 53], [166, 53], [118, 61], [166, 61]].map(([tx, ty], i) => ({
    id: `goblin-watch-${i}`, atlas: "goblinRegion" as const, cell: i % 2 ? 9 : 8, x: tx * TILE, y: ty * TILE, w: 118, h: 185, solid: true, collision: { w: 72, h: 34 },
  })),
  ...[[126, 50], [137, 53], [148, 51], [155, 60], [142, 57]].map(([tx, ty], i) => ({
    id: `goblin-trap-${i}`, atlas: "goblinRegion" as const, cell: 11, x: tx * TILE, y: ty * TILE, w: 92, h: 65, action: "trap" as const,
  })),
];

const DESERT_OBJECTS: WorldObject[] = [
  { id: "desert-gate", atlas: "desertRegion", cell: 0, x: 141 * TILE, y: 25 * TILE, w: 300, h: 255, solid: true, collision: { w: 72, h: 170 } },
  { id: "zahar-palace", atlas: "desertRegion", cell: 3, x: 160 * TILE, y: 13 * TILE, w: 390, h: 350, solid: true, collision: { w: 250, h: 64 }, action: "castle" },
  { id: "sun-temple", atlas: "desertRegion", cell: 3, x: 172 * TILE, y: 20 * TILE, w: 285, h: 270, solid: true, collision: { w: 174, h: 48 }, action: "shrine" },
  { id: "desert-inn", atlas: "desertRegion", cell: 5, x: 147 * TILE, y: 20 * TILE, w: 230, h: 190, solid: true, collision: { w: 155, h: 38 }, action: "vendor", vendor: "food" },
  { id: "desert-watch-north", atlas: "desertRegion", cell: 1, x: 146 * TILE, y: 9 * TILE, w: 160, h: 220, solid: true, collision: { w: 82, h: 38 } },
  { id: "desert-watch-south", atlas: "desertRegion", cell: 1, x: 176 * TILE, y: 37 * TILE, w: 160, h: 220, solid: true, collision: { w: 82, h: 38 } },
  ...[[151, 17], [166, 17], [153, 25], [168, 25]].map(([tx, ty], index) => ({
    id: `zahar-house-${index}`, atlas: "desertRegion" as const, cell: 2, x: tx * TILE, y: ty * TILE, w: 185, h: 170, solid: true, collision: { w: 118, h: 34 },
  })),
  { id: "sun-obelisk-west", atlas: "desertRegion", cell: 10, x: 149 * TILE, y: 32 * TILE, w: 118, h: 175, solid: true, collision: { w: 50, h: 34 }, action: "desertObelisk" },
  { id: "sun-obelisk-crown", atlas: "desertRegion", cell: 10, x: 159 * TILE, y: 22 * TILE, w: 118, h: 175, solid: true, collision: { w: 50, h: 34 }, action: "desertObelisk" },
  { id: "sun-obelisk-east", atlas: "desertRegion", cell: 10, x: 171 * TILE, y: 31 * TILE, w: 118, h: 175, solid: true, collision: { w: 50, h: 34 }, action: "desertObelisk" },
  { id: "sun-plate-west", atlas: "desertRegion", cell: 10, x: 151 * TILE, y: 36 * TILE, w: 105, h: 52, action: "desertPlate" },
  { id: "sun-plate-crown", atlas: "desertRegion", cell: 10, x: 161 * TILE, y: 27 * TILE, w: 105, h: 52, action: "desertPlate" },
  { id: "sun-plate-east", atlas: "desertRegion", cell: 10, x: 170 * TILE, y: 35 * TILE, w: 105, h: 52, action: "desertPlate" },
  { id: "tomb-of-burning-crown", atlas: "desertRegion", cell: 11, x: 174 * TILE, y: 10 * TILE, w: 300, h: 255, solid: true, collision: { w: 175, h: 46 }, action: "desertTomb" },
  ...[[145, 13], [154, 35], [166, 9], [176, 27]].map(([tx, ty], index) => ({
    id: `desert-ruin-${index}`, atlas: "desertRegion" as const, cell: 12, x: tx * TILE, y: ty * TILE, w: 165, h: 150, solid: true, collision: { w: 94, h: 30 },
  })),
  ...[[145, 29], [153, 17], [166, 37], [175, 24]].map(([tx, ty], index) => ({
    id: `caravan-camp-${index}`, atlas: "desertRegion" as const, cell: index % 2 ? 5 : 4, x: tx * TILE, y: ty * TILE, w: 185, h: 150, solid: true, collision: { w: 112, h: 28 },
  })),
  ...[[149, 38], [158, 36], [171, 38], [176, 15]].map(([tx, ty], index) => ({
    id: `zahar-oasis-${index}`, atlas: "desertRegion" as const, cell: 8, x: tx * TILE, y: ty * TILE, w: 180, h: 160, solid: true, collision: { w: 68, h: 30 },
  })),
  ...[[143, 8], [163, 31], [176, 18]].map(([tx, ty], index) => ({
    id: `wind-rock-${index}`, atlas: "desertRegion" as const, cell: 13, x: tx * TILE, y: ty * TILE, w: 150, h: 125, solid: true, collision: { w: 92, h: 28 },
  })),
  ...[[144, 34], [152, 38], [164, 8], [168, 34], [175, 29]].map(([tx, ty], index) => ({
    id: `desert-cactus-${index}`, atlas: "desertRegion" as const, cell: 14, x: tx * TILE, y: ty * TILE, w: 96, h: 105,
  })),
  ...[[144, 24], [157, 31], [169, 18], [175, 35]].map(([tx, ty], index) => ({
    id: `desert-sign-${index}`, atlas: "desertRegion" as const, cell: index % 2 ? 15 : 7, x: tx * TILE, y: ty * TILE, w: 88, h: 92,
  })),
];

const SAND_STORMS = [
  { x: 148 * TILE, y: 12 * TILE, phase: 0, radius: 50 },
  { x: 163 * TILE, y: 19 * TILE, phase: 2.1, radius: 58 },
  { x: 174 * TILE, y: 31 * TILE, phase: 4.2, radius: 52 },
] as const;

const FARM_OBJECTS: WorldObject[] = [
  { id: "farmhouse", atlas: "farmRegion", cell: 4, x: 65 * TILE, y: 50 * TILE, w: 250, h: 220, solid: true, collision: { w: 170, h: 43 }, action: "farmhouse" },
  { id: "farm-barn", atlas: "farmRegion", cell: 5, x: 106 * TILE, y: 50 * TILE, w: 240, h: 210, solid: true, collision: { w: 165, h: 42 }, action: "farmBarn" },
  { id: "farm-windmill", atlas: "farmRegion", cell: 6, x: 64 * TILE, y: 60 * TILE, w: 235, h: 260, solid: true, collision: { w: 135, h: 42 } },
  { id: "farm-greenhouse", atlas: "farmRegion", cell: 7, x: 107 * TILE, y: 59 * TILE, w: 250, h: 215, solid: true, collision: { w: 172, h: 42 } },
  { id: "farm-well", atlas: "farmRegion", cell: 8, x: 84 * TILE, y: 46 * TILE, w: 135, h: 135, solid: true, collision: { w: 82, h: 30 }, action: "farmWell" },
  { id: "produce-stand", atlas: "farmRegion", cell: 9, x: 95 * TILE, y: 46 * TILE, w: 180, h: 145, solid: true, collision: { w: 125, h: 30 }, action: "farmStand" },
  { id: "farm-gate", atlas: "farmRegion", cell: 11, x: 70 * TILE, y: 43 * TILE, w: 195, h: 150 },
  ...[[71, 48], [90, 48], [72, 58], [100, 57]].map(([tx, ty], index) => ({
    id: `farm-scarecrow-${index}`, atlas: "farmRegion" as const, cell: 10, x: tx * TILE, y: ty * TILE, w: 100, h: 130, solid: true, collision: { w: 34, h: 24 },
  })),
  ...[[69, 54], [102, 54]].map(([tx, ty], index) => ({
    id: `farm-apple-${index}`, atlas: "farmRegion" as const, cell: 12, x: tx * TILE, y: ty * TILE, w: 145, h: 165, solid: true, collision: { w: 42, h: 30 },
  })),
  ...[[69, 58], [102, 58]].map(([tx, ty], index) => ({
    id: `farm-orange-${index}`, atlas: "farmRegion" as const, cell: 13, x: tx * TILE, y: ty * TILE, w: 145, h: 165, solid: true, collision: { w: 42, h: 30 },
  })),
  ...[[73, 46], [100, 47], [72, 61], [101, 61]].map(([tx, ty], index) => ({
    id: `farm-bees-${index}`, atlas: "farmRegion" as const, cell: 14, x: tx * TILE, y: ty * TILE, w: 110, h: 105,
  })),
  ...[[89, 46], [104, 52], [98, 60]].map(([tx, ty], index) => ({
    id: `farm-crates-${index}`, atlas: "farmRegion" as const, cell: 15, x: tx * TILE, y: ty * TILE, w: 125, h: 95, solid: true, collision: { w: 78, h: 24 },
  })),
];

const FRONTIER_OBJECTS: WorldObject[] = [
  { id: "briarwatch-gate", atlas: "goblinRegion", cell: 10, x: 119 * TILE, y: 54 * TILE, w: 250, h: 215, action: "adventureGate" },
  ...[
    [112, 43], [115, 43], [118, 43], [121, 43],
    [113, 46], [116, 46], [120, 46],
    [112, 48], [121, 48],
    [112, 56], [121, 56],
    [113, 59], [116, 59], [119, 59], [121, 59],
    [112, 62], [115, 62], [118, 62], [121, 62],
  ].map(([tx, ty], index) => ({
    id: `briarwatch-tree-${index}`,
    atlas: "forest" as const,
    cell: index % 2,
    x: tx * TILE,
    y: ty * TILE,
    w: 164,
    h: 190,
    solid: true,
    collision: { w: 82, h: 34 },
  })),
  ...[[114, 49], [118, 48], [114, 57], [118, 57]].map(([tx, ty], index) => ({
    id: `briarwatch-brush-${index}`,
    atlas: "forest" as const,
    cell: index % 2 ? 2 : 3,
    x: tx * TILE,
    y: ty * TILE,
    w: 94,
    h: 82,
  })),
];

function makeResources(): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  [[5, 46], [8, 52], [12, 58], [16, 44], [20, 55], [25, 49], [30, 58], [35, 46], [40, 54], [44, 43], [42, 38], [67, 39]].forEach(([x, y], i) => nodes.push({ id: `herb-${i}`, atlas: "forest", cell: 3, x: x * TILE, y: y * TILE, kind: "herb", collected: false }));
  [[6, 54], [11, 48], [17, 45], [23, 52], [29, 58], [34, 43], [39, 57], [44, 34]].forEach(([x, y], i) => nodes.push({ id: `mushroom-${i}`, cell: 1, x: x * TILE, y: y * TILE, kind: "mushroom", collected: false }));
  [[25, 36], [33, 40], [7, 50], [12, 52], [18, 59], [22, 57], [28, 46], [36, 52], [42, 60], [72, 34], [92, 29]].forEach(([x, y], i) => nodes.push({ id: `berry-${i}`, atlas: "forest", cell: 2, x: x * TILE, y: y * TILE, kind: "berry", collected: false }));
  [[53, 37], [54, 51], [68, 66], [76, 70], [84, 66], [92, 72], [102, 67]].forEach(([x, y], i) => nodes.push({ id: `fish-${i}`, atlas: "ocean", cell: 12, x: x * TILE, y: y * TILE, kind: "fish", collected: false }));
  [[39, 7], [61, 15], [101, 34]].forEach(([x, y], i) => nodes.push({ id: `ore-${i}`, cell: 3, x: x * TILE, y: y * TILE, kind: "ore", collected: false }));
  [[120, 51], [127, 56], [133, 49], [141, 55], [148, 58], [158, 53], [164, 56]].forEach(([x, y], i) => nodes.push({ id: `scrap-${i}`, atlas: "goblinRegion", cell: 12, x: x * TILE, y: y * TILE, kind: "scrap", collected: false }));
  [[122, 45], [130, 59], [136, 51], [144, 50], [151, 53], [161, 45]].forEach(([x, y], i) => nodes.push({ id: `muckroot-${i}`, atlas: "forest", cell: 3, x: x * TILE, y: y * TILE, kind: "muckroot", collected: false }));
  [[146, 14], [152, 24], [160, 33], [170, 22], [174, 35]].forEach(([x, y], i) => nodes.push({ id: `sunroot-${i}`, atlas: "forest", cell: 3, x: x * TILE, y: y * TILE, kind: "herb", collected: false }));
  [[149, 16], [164, 10], [171, 31], [155, 38]].forEach(([x, y], i) => nodes.push({ id: `desert-ore-${i}`, cell: 3, x: x * TILE, y: y * TILE, kind: "ore", collected: false }));
  [[153, 34], [168, 36], [175, 25]].forEach(([x, y], i) => nodes.push({ id: `cactus-fruit-${i}`, atlas: "forest", cell: 2, x: x * TILE, y: y * TILE, kind: "berry", collected: false }));
  return nodes;
}

const WORLD_OBJECTS = [...OBJECTS, ...EXPANSION_OBJECTS, ...FOREST_OBJECTS, ...CITY_OBJECTS, ...GOBLIN_OBJECTS, ...DESERT_OBJECTS, ...FARM_OBJECTS, ...FRONTIER_OBJECTS];

const CITIZEN_ROUTES = [
  // Castle avenue and central plaza.
  [84, 14], [84, 18], [84, 22], [84, 26], [84, 30], [84, 35], [84, 39],
  // West and east commercial streets.
  [68, 17], [72, 17], [76, 17], [92, 17], [97, 17], [102, 17],
  [68, 24], [73, 24], [78, 24], [91, 24], [96, 24], [102, 24],
  [69, 31], [74, 31], [79, 31], [90, 31], [95, 31], [101, 31],
  // Southern gardens, stables and gate square.
  [69, 37], [75, 37], [80, 37], [89, 37], [95, 37], [101, 37],
  [79, 40], [84, 40], [90, 40],
] as const;

function makeCitizens(): Citizen[] {
  return Array.from({ length: 30 }, (_, id) => {
    const start = CITIZEN_ROUTES[id % CITIZEN_ROUTES.length];
    const target = CITIZEN_ROUTES[(id * 5 + 3) % CITIZEN_ROUTES.length];
    return {
      id,
      cell: 4 + (id % 4),
      x: start[0] * TILE + (id % 3 - 1) * 16,
      y: start[1] * TILE + (id % 2 ? 13 : -13),
      homeX: start[0] * TILE,
      homeY: start[1] * TILE,
      targetX: target[0] * TILE,
      targetY: target[1] * TILE,
      speed: 28 + (id % 6) * 7,
      pause: (id % 7) * .24,
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
    [0, 123, 45, 90, 82], [1, 130, 46, 140, 70], [2, 134, 52, 105, 66], [3, 141, 51, 150, 62],
    [0, 146, 46, 90, 88], [1, 152, 52, 140, 72], [2, 156, 56, 105, 68], [3, 163, 54, 150, 62],
    [7, 121, 55, 210, 98], [8, 129, 60, 320, 48], [9, 144, 59, 225, 72], [10, 148, 54, 120, 100],
    [11, 158, 46, 190, 94], [15, 138, 45, 95, 112], [0, 133, 58, 90, 88], [2, 153, 45, 105, 68],
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
    id: 299, atlas: "goblinUnits", cell: 12, x: 160 * TILE, y: 52 * TILE, homeX: 160 * TILE, homeY: 52 * TILE,
    hp: 1100, maxHp: 1100, speed: 48, boss: true, cooldown: 0, flash: 0,
  });
  [
    [5, 143, 15, 80, 122], [6, 151, 26, 145, 84], [0, 166, 18, 165, 72],
    [1, 174, 33, 110, 105], [2, 160, 36, 150, 86], [3, 175, 14, 185, 68],
    [4, 147, 35, 220, 82], [7, 165, 24, 280, 48], [8, 171, 8, 105, 118],
    [9, 154, 9, 170, 78], [10, 176, 27, 210, 70],
  ].forEach(([cell, tx, ty, hp, speed], index) => enemies.push({
    id: 400 + index, atlas: "desertUnits", cell, x: tx * TILE, y: ty * TILE,
    homeX: tx * TILE, homeY: ty * TILE, hp, maxHp: hp, speed, cooldown: 0, flash: 0,
  }));
  [
    [12, 151, 8, 720, 48], [13, 173, 8, 860, 45], [14, 174, 36, 780, 56],
  ].forEach(([cell, tx, ty, hp, speed], index) => enemies.push({
    id: 490 + index, atlas: "desertUnits", cell, x: tx * TILE, y: ty * TILE,
    homeX: tx * TILE, homeY: ty * TILE, hp, maxHp: hp, speed, cooldown: 0, flash: 0,
  }));
  enemies.push({
    id: 499, atlas: "desertUnits", cell: 15, x: 172 * TILE, y: 13 * TILE, homeX: 172 * TILE, homeY: 13 * TILE,
    hp: 1700, maxHp: 1700, speed: 52, boss: true, cooldown: 0, flash: 0,
  });
  return enemies;
}

function freshGame(): Game {
  return {
    area: "village",
    player: { x: 18 * TILE, y: 23 * TILE, vx: 0, vy: 0, hero: "warrior", direction: "right", hp: 320, maxHp: 320, energy: 100, gold: 65, shards: 0, invuln: 0 },
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
    desertQuestStage: 0,
    desertObelisks: [],
    desertPlates: [],
    desertBossUnlocked: false,
    farmUnlocked: false,
    farmLevel: 0,
    farmStyle: "homestead",
    farmPlots: makeFarmPlots(),
    seeds: { carrot: 0, potato: 0, tomato: 0, onion: 0, cabbage: 0, strawberry: 0, pumpkin: 0, corn: 0 },
    produce: { carrot: 0, potato: 0, tomato: 0, onion: 0, cabbage: 0, strawberry: 0, pumpkin: 0, corn: 0 },
    harvestedTotal: 0,
    farmRevenue: 0,
    questStage: 0,
    kills: 0,
    attackTime: 0,
    attackCooldown: 0,
    abilityCooldowns: [0, 0, 0],
    abilityTime: 0,
    abilitySlot: -1,
    dashTime: 0,
    projectiles: [],
    nextProjectileId: 1,
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
  const city = tx >= 63 && tx <= 106 && ty >= 4 && ty <= 41;
  if (city) {
    const garden = ((tx >= 79 && tx <= 81) || (tx >= 87 && tx <= 89)) && ty >= 16 && ty <= 19;
    return garden ? 0 : 1;
  }
  const desert = tx >= 138 && tx < MAP_W && ty >= 3 && ty <= 41;
  if (desert) {
    const avenue = (tx >= 158 && tx <= 162) || (ty >= 23 && ty <= 26) || (tx >= 170 && ty <= 14);
    return avenue ? 1 : 0;
  }
  const farm = tx >= 60 && tx <= 112 && ty >= 42 && ty < 63;
  if (farm) return ((tx >= 69 && tx <= 71) || (ty >= 44 && ty <= 47)) ? 1 : 0;
  const briarwatch = tx >= 113 && tx <= 120 && ty >= 41 && ty < 63;
  if (briarwatch) return ty >= 50 && ty <= 54 ? 1 : 2;
  const goblinCamp = tx >= 121 && tx <= 167 && ty >= 41 && ty < 63;
  if (goblinCamp) {
    const mainRoad = tx >= 142 && tx <= 146;
    const marketRoad = ty >= 50 && ty <= 53;
    const windingTrail = (tx >= 121 && tx <= 124 && ty >= 44 && ty <= 59) || (tx >= 156 && tx <= 161 && ty >= 45 && ty <= 59);
    if (mainRoad || marketRoad || windingTrail) return 1;
    return (tx * 7 + ty * 11) % 9 < 2 ? 0 : 2;
  }
  if ((ty >= 20 && ty <= 22) || (tx >= 16 && tx <= 18) || (tx >= 78 && tx <= 80) || (ty >= 47 && ty <= 49 && tx < 80)) return 1;
  if (ty >= 60 && ty < 63) return 1;
  if (ty < 12 && tx > 46) return 2;
  if (ty > 38 && tx < 46) return 2;
  return 0;
}

function desertTileAt(tx: number, ty: number) {
  const avenue = (tx >= 158 && tx <= 162) || (ty >= 23 && ty <= 26) || (tx >= 170 && ty <= 14);
  const salt = tx >= 172 && ty <= 12;
  return avenue ? 1 : salt ? 3 : 0;
}

function farmFieldLevelAt(tx: number, ty: number) {
  if (tx >= 35 && tx <= 39 && ty >= 29 && ty <= 33) return 1;
  if (tx >= 40 && tx <= 46 && ty >= 29 && ty <= 33) return 2;
  if (tx >= 35 && tx <= 41 && ty >= 35 && ty <= 39) return 3;
  if (tx >= 42 && tx <= 50 && ty >= 35 && ty <= 39) return 4;
  return 0;
}

function farmTileAt(tx: number, ty: number, farmLevel: number) {
  const fieldLevel = farmFieldLevelAt(tx, ty);
  return fieldLevel > 0 && fieldLevel <= farmLevel ? 0 : -1;
}

function villageFarmTileAt(tx: number, ty: number) {
  const irrigationPath = (tx >= 69 && tx <= 71) || (ty >= 44 && ty <= 47);
  if (irrigationPath) return 3;
  if (tx >= 72 && tx <= 79 && ty >= 48 && ty <= 54) return 0;
  if (tx >= 81 && tx <= 90 && ty >= 48 && ty <= 54) return 0;
  if (tx >= 92 && tx <= 101 && ty >= 48 && ty <= 54) return 0;
  if (tx >= 81 && tx <= 94 && ty >= 56 && ty <= 62) return 0;
  return -1;
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

const SAVE_KEY = "abyss-walker-beta-save-v3";

type SavedGame = {
  version: 3;
  player: Pick<Game["player"], "x" | "y" | "hero" | "direction" | "hp" | "maxHp" | "energy" | "gold" | "shards">;
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
  desertQuestStage: number;
  desertObelisks: string[];
  desertPlates: string[];
  desertBossUnlocked: boolean;
  farmUnlocked: boolean;
  farmLevel: number;
  farmStyle: FarmStyle;
  farmPlots: FarmPlot[];
  seeds: Record<CropKind, number>;
  produce: Record<CropKind, number>;
  harvestedTotal: number;
  farmRevenue: number;
  collectedResources: string[];
  enemies: Array<{ id: number; hp: number; dead: boolean }>;
};

function persistGame(game: Game) {
  if (typeof window === "undefined" || game.area !== "village") return;
  const data: SavedGame = {
    version: 3,
    player: {
      x: game.player.x,
      y: game.player.y,
      hero: game.player.hero,
      direction: game.player.direction,
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
    desertQuestStage: game.desertQuestStage,
    desertObelisks: [...game.desertObelisks],
    desertPlates: [...game.desertPlates],
    desertBossUnlocked: game.desertBossUnlocked,
    farmUnlocked: game.farmUnlocked,
    farmLevel: game.farmLevel,
    farmStyle: game.farmStyle,
    farmPlots: game.farmPlots.map((plot) => ({ ...plot })),
    seeds: { ...game.seeds },
    produce: { ...game.produce },
    harvestedTotal: game.harvestedTotal,
    farmRevenue: game.farmRevenue,
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
    if (saved.version !== 3 || !saved.player) return game;
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
    game.desertQuestStage = Math.max(0, saved.desertQuestStage ?? 0);
    game.desertObelisks = Array.isArray(saved.desertObelisks) ? saved.desertObelisks : [];
    game.desertPlates = Array.isArray(saved.desertPlates) ? saved.desertPlates : [];
    game.desertBossUnlocked = Boolean(saved.desertBossUnlocked);
    game.farmUnlocked = Boolean(saved.farmUnlocked);
    game.farmLevel = game.farmUnlocked ? Math.max(1, Math.min(4, saved.farmLevel ?? 1)) : 0;
    game.farmStyle = saved.farmStyle === "orchard" || saved.farmStyle === "market" ? saved.farmStyle : "homestead";
    if (Array.isArray(saved.farmPlots)) {
      const savedPlots = new Map(saved.farmPlots.map((plot) => [plot.id, plot]));
      game.farmPlots = game.farmPlots.map((plot) => {
        const savedPlot = savedPlots.get(plot.id);
        return savedPlot ? { ...plot, ...savedPlot, x: plot.x, y: plot.y, unlockedAt: plot.unlockedAt } : plot;
      });
    }
    if (saved.seeds) game.seeds = { ...game.seeds, ...saved.seeds };
    if (saved.produce) game.produce = { ...game.produce, ...saved.produce };
    game.harvestedTotal = Math.max(0, saved.harvestedTotal ?? 0);
    game.farmRevenue = Math.max(0, saved.farmRevenue ?? 0);
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

function drawGridCell(c: CanvasRenderingContext2D, image: HTMLImageElement | HTMLCanvasElement, cell: number, columns: number, rows: number, x: number, y: number, w: number, h: number) {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const sw = sourceWidth / columns;
  const sh = sourceHeight / rows;
  c.drawImage(image, (cell % columns) * sw, Math.floor(cell / columns) * sh, sw, sh, x, y, w, h);
}

type NpcCrop = { x: number; y: number; w: number; h: number };

function npcCropRow(count: number, y: number, h: number): NpcCrop[] {
  return Array.from({ length: count }, (_, column) => {
    const x = Math.round(column * 1536 / count);
    const right = Math.round((column + 1) * 1536 / count);
    return { x, y, w: right - x, h };
  });
}

const CLEAR_NPC_CROPS = [
  ...npcCropRow(18, 57, 124),
  ...npcCropRow(18, 219, 88),
  ...npcCropRow(18, 365, 112),
  ...npcCropRow(17, 541, 121),
];

function prepareClearNpcAtlas(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const dark = (x: number, y: number) => {
    const offset = (y * canvas.width + x) * 4;
    return Math.max(pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]) < 38;
  };
  for (const crop of CLEAR_NPC_CROPS) {
    const visited = new Uint8Array(crop.w * crop.h);
    const queue: number[] = [];
    const seed = (localX: number, localY: number) => {
      const index = localY * crop.w + localX;
      if (!visited[index] && dark(crop.x + localX, crop.y + localY)) {
        visited[index] = 1;
        queue.push(index);
      }
    };
    for (let x = 0; x < crop.w; x++) { seed(x, 0); seed(x, crop.h - 1); }
    for (let y = 0; y < crop.h; y++) { seed(0, y); seed(crop.w - 1, y); }
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      const localX = current % crop.w;
      const localY = Math.floor(current / crop.w);
      const offset = ((crop.y + localY) * canvas.width + crop.x + localX) * 4;
      pixels.data[offset + 3] = 0;
      if (localX > 0) seed(localX - 1, localY);
      if (localX + 1 < crop.w) seed(localX + 1, localY);
      if (localY > 0) seed(localX, localY - 1);
      if (localY + 1 < crop.h) seed(localX, localY + 1);
    }
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function drawClearNpc(c: CanvasRenderingContext2D, image: HTMLCanvasElement, cell: number, x: number, y: number, w: number, h: number) {
  const crop = CLEAR_NPC_CROPS[cell % CLEAR_NPC_CROPS.length];
  c.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
}

function prepareNpcAtlas(image: HTMLImageElement) {
  const columns = 32;
  const rows = 14;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const left = Math.round(column * canvas.width / columns);
    const right = Math.round((column + 1) * canvas.width / columns);
    const top = Math.round(row * canvas.height / rows);
    const bottom = Math.round((row + 1) * canvas.height / rows);
    const cellWidth = right - left;
    const cellHeight = bottom - top;
    const mask = new Uint8Array(cellWidth * cellHeight);
    const keep = new Uint8Array(cellWidth * cellHeight);
    const visited = new Uint8Array(cellWidth * cellHeight);
    const components: number[][] = [];
    for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
      const source = ((top + y) * canvas.width + left + x) * 4;
      const brightness = Math.max(pixels.data[source], pixels.data[source + 1], pixels.data[source + 2]);
      if (brightness >= 30) mask[y * cellWidth + x] = 1;
    }
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
      const queue = [start];
      const component: number[] = [];
      visited[start] = 1;
      for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        component.push(current);
        const x = current % cellWidth;
        const y = Math.floor(current / cellWidth);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) continue;
          const next = ny * cellWidth + nx;
          if (mask[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
      if (component.length >= 12) components.push(component);
    }
    // The reference image looks like a grid, but several neighbouring figures
    // extend into the same nominal cell. Keeping every bright component caused
    // spare heads, feet and props to be rendered beside an otherwise valid NPC.
    // The body is always the dominant connected component in a pedestrian cell.
    const figure = components.sort((a, b) => b.length - a.length)[0];
    figure?.forEach((index) => { keep[index] = 1; });
    for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
      const source = ((top + y) * canvas.width + left + x) * 4;
      pixels.data[source + 3] = keep[y * cellWidth + x] ? 255 : 0;
    }
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function drawFacingCell(c: CanvasRenderingContext2D, image: HTMLImageElement, cell: number, x: number, y: number, w: number, h: number, flip: boolean) {
  if (!flip) {
    drawCell(c, image, cell, x, y, w, h);
    return;
  }
  c.save();
  c.translate(x + w, 0);
  c.scale(-1, 1);
  drawCell(c, image, cell, 0, y, w, h);
  c.restore();
}

function drawWorldObject(c: CanvasRenderingContext2D, image: HTMLImageElement, item: WorldObject, camera: { x: number; y: number }) {
  if (!item.rotation) {
    drawCell(c, image, item.cell, item.x - item.w / 2 - camera.x, item.y - item.h - camera.y, item.w, item.h);
    return;
  }
  c.save();
  c.translate(item.x - camera.x, item.y - item.h / 2 - camera.y);
  c.rotate(item.rotation);
  drawCell(c, image, item.cell, -item.w / 2, -item.h / 2, item.w, item.h);
  c.restore();
}

const INGREDIENT_META: Record<Ingredient, { icon: string; label: string; color: string }> = {
  herb: { icon: "☘", label: "ورق القمر", color: "#7fe17e" },
  mushroom: { icon: "♧", label: "فطر الكهف", color: "#d7a4ed" },
  berry: { icon: "●", label: "توت الشمس", color: "#e56475" },
  ore: { icon: "▰", label: "خام البلور", color: "#8bd8ff" },
  fish: { icon: "♒", label: "بقعة صيد", color: "#5acfff" },
  meat: { icon: "♨", label: "لحم الطرائد", color: "#e59c66" },
  scrap: { icon: "⚙", label: "خردة الغوبلن", color: "#e3b055" },
  muckroot: { icon: "♣", label: "جذر المستنقع", color: "#9bbf51" },
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
  c.fillRect(117 * TILE * sx, 41 * TILE * sy, 50 * TILE * sx, 22 * TILE * sy);
  c.strokeStyle = "#e26d37";
  c.strokeRect(117 * TILE * sx, 41 * TILE * sy, 50 * TILE * sx, 22 * TILE * sy);
  c.fillStyle = "#c79a4a";
  c.fillRect(138 * TILE * sx, 3 * TILE * sy, 42 * TILE * sx, 38 * TILE * sy);
  c.strokeStyle = "#ffe09a";
  c.strokeRect(138 * TILE * sx, 3 * TILE * sy, 42 * TILE * sx, 38 * TILE * sy);
  c.fillStyle = "#6f8c3e";
  c.fillRect(60 * TILE * sx, 42 * TILE * sy, 52 * TILE * sx, 21 * TILE * sy);
  c.strokeStyle = "#f0c864";
  c.strokeRect(60 * TILE * sx, 42 * TILE * sy, 52 * TILE * sx, 21 * TILE * sy);
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
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<"all" | "materials" | "supplies" | "equipment">("all");
  const [cookingOpen, setCookingOpen] = useState(false);
  const [fishBookOpen, setFishBookOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState<VendorId | null>(null);
  const [farmOpen, setFarmOpen] = useState<"plant" | "stock" | "manage" | null>(null);
  const [activePlotId, setActivePlotId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [hasSave, setHasSave] = useState(false);
  const [hud, setHud] = useState({
    hp: 320, maxHp: 320, energy: 100, maxEnergy: 100, gold: 65, shards: 0, kills: 0, quest: 0, boss: 760, area: "القرية الهادئة", boat: false, cooked: 0,
    hero: "warrior" as HeroId, abilityCooldowns: [0, 0, 0] as [number, number, number],
    fishCaught: [] as string[], position: { x: 18 * TILE, y: 23 * TILE },
    supplies: { potions: 0, bait: 0, spearLevel: 0, armorLevel: 0 },
    inventory: { herb: 0, mushroom: 0, berry: 0, ore: 0, fish: 0, meat: 0, scrap: 0, muckroot: 0 },
    desertQuestStage: 0, desertObelisks: 0, desertPlates: 0, desertBossUnlocked: false,
    farmUnlocked: false, farmLevel: 0, farmStyle: "homestead" as FarmStyle, harvestedTotal: 0, farmRevenue: 0,
    seeds: { carrot: 0, potato: 0, tomato: 0, onion: 0, cabbage: 0, strawberry: 0, pumpkin: 0, corn: 0 } as Record<CropKind, number>,
    produce: { carrot: 0, potato: 0, tomato: 0, onion: 0, cabbage: 0, strawberry: 0, pumpkin: 0, corn: 0 } as Record<CropKind, number>,
  });

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const startGame = useCallback((newJourney = false) => {
    gameRef.current = newJourney ? freshGame() : restoreGame();
    setDialog(null);
    setMapOpen(false);
    setInventoryOpen(false);
    setCookingOpen(false);
    setFishBookOpen(false);
    setVendorOpen(null);
    setFarmOpen(null);
    setActivePlotId(null);
    mapRef.current = false;
    setToast(newJourney || !hasSave ? "TRANQUIL VILLAGE · THE ELEMENTAL FRONTIER" : "PROGRESS RESTORED · THE FLAME REMEMBERS");
    setPhase("playing");
  }, [hasSave, setPhase]);

  const chooseHero = useCallback((hero: HeroId) => {
    const game = freshGame();
    game.player.hero = hero;
    if (hero === "archer") {
      game.player.maxHp = 260;
      game.player.hp = 260;
      game.player.energy = 120;
    }
    gameRef.current = game;
    setToast(hero === "warrior" ? "تم اختيار عمر · الرمح والنور" : "تم اختيار نعيمة · القوس والرياح");
    setPhase("playing");
  }, [setPhase]);

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
    gameRef.current = freshGame();
    setPhase("select");
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

  const plantCrop = useCallback((kind: CropKind) => {
    const game = gameRef.current;
    const plot = game.farmPlots.find((item) => item.id === activePlotId);
    if (!plot || plot.unlockedAt > game.farmLevel || plot.crop) return;
    if (!game.farmUnlocked || CROP_META[kind].unlockAt > game.farmLevel) {
      setToast(`${CROP_META[kind].label.toUpperCase()} UNLOCKS WITH FIELD ${CROP_META[kind].unlockAt}`);
      return;
    }
    if (game.seeds[kind] <= 0) {
      setToast(`NO ${CROP_META[kind].label.toUpperCase()} SEEDS LEFT`);
      return;
    }
    game.seeds[kind]--;
    plot.crop = kind;
    plot.plantedAt = Date.now();
    plot.watered = false;
    setFarmOpen(null);
    setActivePlotId(null);
    setToast(`${CROP_META[kind].label.toUpperCase()} PLANTED · WATER THE BED TO START GROWTH`);
  }, [activePlotId]);

  const sellProduce = useCallback((kind?: CropKind) => {
    const game = gameRef.current;
    const kinds = kind ? [kind] : (Object.keys(CROP_META) as CropKind[]);
    let earned = 0;
    for (const crop of kinds) {
      earned += game.produce[crop] * CROP_META[crop].price;
      game.produce[crop] = 0;
    }
    if (game.farmStyle === "market") earned = Math.ceil(earned * 1.2);
    if (!earned) {
      setToast("THE PRODUCE CRATES ARE EMPTY");
      return;
    }
    game.player.gold += earned;
    game.farmRevenue += earned;
    setFarmOpen(null);
    setToast(`PRODUCE SOLD · ${earned} GOLD ADDED TO YOUR PURSE`);
  }, []);

  const expandFarm = useCallback(() => {
    const game = gameRef.current;
    if (!game.farmUnlocked) {
      setToast("SPEAK WITH FARMER NELLA TO LEARN THE FARMING SKILL");
      return;
    }
    if (game.farmLevel >= 4) {
      setToast("EVERY FARM FIELD IS NOW RESTORED");
      return;
    }
    const next = game.farmLevel + 1;
    const requiredHarvest = next === 2 ? 8 : next === 3 ? 24 : 48;
    const cost = next === 2 ? 150 : next === 3 ? 400 : 750;
    if (game.harvestedTotal < requiredHarvest) {
      setToast(`HARVEST ${requiredHarvest - game.harvestedTotal} MORE CROPS TO PROVE THE SOIL`);
      return;
    }
    if (game.player.gold < cost) {
      setToast(`NEED ${cost - game.player.gold} MORE GOLD TO CLEAR THE FIELD`);
      return;
    }
    game.player.gold -= cost;
    game.farmLevel = next;
    game.seeds.carrot += 3;
    game.seeds.potato += 2;
    if (next === 2) {
      game.seeds.tomato += 3;
      game.seeds.onion += 3;
    } else if (next === 3) {
      game.seeds.cabbage += 3;
      game.seeds.strawberry += 3;
    } else {
      game.seeds.pumpkin += 3;
      game.seeds.corn += 3;
    }
    setFarmOpen(null);
    setToast(`FIELD ${next} RESTORED · NEW BEDS AND CROPS UNLOCKED`);
  }, []);

  const chooseFarmStyle = useCallback((style: FarmStyle) => {
    const game = gameRef.current;
    game.farmStyle = style;
    setToast(style === "homestead" ? "HOMESTEAD FOCUS · EXTRA SEEDS WHILE HARVESTING" : style === "orchard" ? "ORCHARD FOCUS · FRUIT CROPS YIELD EXTRA PRODUCE" : "MARKET GARDEN · PRODUCE SELLS FOR 20% MORE");
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
    const desertRegion = new Image();
    const desertUnits = new Image();
    const farmRegion = new Image();
    const farmCrops = new Image();
    const clearNpcs = new Image();
    const warriorAnim = new Image();
    const archerAnim = new Image();
    const warriorDirectional = new Image();
    const archerDirectional = new Image();
    const water = new Image();
    let clearNpcAtlas = document.createElement("canvas");
    clearNpcs.addEventListener("load", () => { clearNpcAtlas = prepareNpcAtlas(clearNpcs); }, { once: true });
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
    desertRegion.src = "/art/sprites/desert-environment-v2.png";
    desertUnits.src = "/art/sprites/desert-enemies-v2.png";
    farmRegion.src = "/art/sprites/farm-region-atlas.png";
    farmCrops.src = "/art/sprites/farm-crops-atlas.png";
    clearNpcs.src = "/art/sprites/npc-citizens-atlas.png";
    warriorAnim.src = "/art/sprites/warrior-animation-sheet.png";
    archerAnim.src = "/art/sprites/archer-animation-sheet.png";
    warriorDirectional.src = "/art/sprites/warrior-directional-sheet.png";
    archerDirectional.src = "/art/sprites/archer-directional-sheet.png";
    water.src = "/art/sprites/pure-water-tiles.png";
    let raf = 0;
    const imageFor = (atlas?: Atlas | "sprites") => atlas === "forest" ? forest : atlas === "ocean" ? ocean : atlas === "city" ? city : atlas === "city2" ? city2 : atlas === "fortified" ? fortified : atlas === "goblinRegion" ? goblinRegion : atlas === "goblinUnits" ? goblinUnits : atlas === "desertRegion" ? desertRegion : atlas === "desertUnits" ? desertUnits : atlas === "farmRegion" ? farmRegion : atlas === "farmCrops" ? farmCrops : atlas === "expansion" ? expansion : atlas === "sprites" || atlas === "npcs" ? sprites : tiles;

    const facingVector = (direction: Direction): [number, number] =>
      direction === "left" ? [-1, 0] : direction === "right" ? [1, 0] : direction === "up" ? [0, -1] : [0, 1];

    const defeatEnemy = (game: Game, enemy: Enemy) => {
      if (enemy.dead) return;
      const p = game.player;
      enemy.dead = true;
      game.kills++;
      if (enemy.dropsMeat) game.inventory.meat++;
      p.gold += enemy.boss ? 100 : 12;
      p.shards += enemy.boss ? 5 : 1;
      if (enemy.id === 499) {
        game.desertQuestStage = 5;
        p.gold += 500;
        p.shards += 12;
        setToast("SUN DRAGON DEFEATED · THE BURNING CROWN IS YOURS · 500 GOLD");
      } else if (enemy.id >= 490 && enemy.id <= 492) {
        const names = ["SAND COLOSSUS", "ANCIENT MUMMY KING", "SCORPION QUEEN"];
        setToast(`${names[enemy.id - 490]} DEFEATED · A TOMB WARD FALLS`);
      } else if (enemy.id === 299) {
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
    };

    const damageEnemy = (game: Game, enemy: Enemy, damage: number, knockX = 0, knockY = 0) => {
      if (enemy.dead || (enemy.id === 499 && !game.desertBossUnlocked)) return;
      enemy.hp -= damage;
      enemy.flash = .14;
      enemy.x += knockX;
      enemy.y += knockY;
      if (enemy.hp <= 0) defeatEnemy(game, enemy);
    };

    const damageArea = (game: Game, x: number, y: number, radius: number, damage: number, knock = 16) => {
      for (const enemy of game.enemies) {
        const distance = Math.hypot(enemy.x - x, enemy.y - y);
        if (enemy.dead || distance > radius || (enemy.id === 499 && !game.desertBossUnlocked)) continue;
        damageEnemy(game, enemy, damage, (enemy.x - x) / Math.max(1, distance) * knock, (enemy.y - y) / Math.max(1, distance) * knock);
      }
    };

    const spawnArrow = (game: Game, angle: number, kind: Projectile["kind"], damage: number, pierce: number) => {
      const p = game.player;
      const speed = kind === "piercing" ? 760 : 650;
      game.projectiles.push({
        id: game.nextProjectileId++,
        x: p.x + Math.cos(angle) * 38,
        y: p.y - 28 + Math.sin(angle) * 38,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        life: 1.15,
        pierce,
        kind,
        hit: [],
      });
    };

    const attack = () => {
      const game = gameRef.current;
      if (game.attackCooldown > 0 || phaseRef.current !== "playing" || mapRef.current || dialog || cookingOpen || farmOpen) return;
      const p = game.player;
      const [fx, fy] = facingVector(p.direction);
      game.attackTime = p.hero === "archer" ? .32 : .28;
      game.attackCooldown = p.hero === "archer" ? .42 : .36;
      if (p.hero === "archer") {
        spawnArrow(game, Math.atan2(fy, fx), "arrow", 48 + game.supplies.spearLevel * 12, 1);
      } else {
        const ax = p.x + fx * 58;
        const ay = p.y + fy * 58;
        for (const enemy of game.enemies) {
          if (enemy.dead || game.area !== "village" || (enemy.id === 499 && !game.desertBossUnlocked)) continue;
          if (Math.hypot(enemy.x - ax, enemy.y - ay) < (enemy.boss ? 88 : 66)) {
            damageEnemy(game, enemy, (enemy.boss ? 38 : 58) + game.supplies.spearLevel * 18, fx * 24, fy * 24);
          }
        }
      }
    };

    const useAbility = (slot: 0 | 1 | 2) => {
      const game = gameRef.current;
      const p = game.player;
      const costs = [15, 25, 45];
      const cooldowns = p.hero === "warrior" ? [1.4, 4.2, 7.5] : [1.8, 4.8, 8];
      if (phaseRef.current !== "playing" || mapRef.current || dialog || cookingOpen || farmOpen || game.abilityCooldowns[slot] > 0) return;
      if (p.energy < costs[slot]) {
        setToast(`NEED ${costs[slot] - Math.floor(p.energy)} MORE ENERGY`);
        return;
      }
      p.energy -= costs[slot];
      game.abilityCooldowns[slot] = cooldowns[slot];
      game.abilitySlot = slot;
      game.abilityTime = slot === 2 ? .7 : .42;
      const [fx, fy] = facingVector(p.direction);
      const angle = Math.atan2(fy, fx);
      if (p.hero === "warrior") {
        if (slot === 0) {
          game.dashTime = .22;
          p.vx = fx * 760;
          p.vy = fy * 760;
          damageArea(game, p.x + fx * 75, p.y + fy * 75, 105, 105 + game.supplies.spearLevel * 15, 34);
          setToast("PHANTOM STEP · DASH SLASH");
        } else if (slot === 1) {
          damageArea(game, p.x, p.y, 145, 92 + game.supplies.spearLevel * 14, 42);
          setToast("CYCLONE LANCE");
        } else {
          damageArea(game, p.x + fx * 155, p.y + fy * 155, 150, 175 + game.supplies.spearLevel * 18, 54);
          setToast("SPEARFALL · SOLAR IMPACT");
        }
      } else if (slot === 0) {
        spawnArrow(game, angle, "piercing", 120 + game.supplies.spearLevel * 16, 5);
        setToast("PIERCING LIGHT");
      } else if (slot === 1) {
        [-.3, -.15, 0, .15, .3].forEach((offset) => spawnArrow(game, angle + offset, "volley", 58 + game.supplies.spearLevel * 10, 1));
        setToast("FAN VOLLEY · FIVE ARROWS");
      } else {
        damageArea(game, p.x + fx * 190, p.y + fy * 190, 175, 165 + game.supplies.spearLevel * 15, 24);
        setToast("SKYFALL RAIN");
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
        } else if (p.x < 7.5 * TILE) {
          if (game.farmUnlocked) setFarmOpen("stock");
          else setToast("LEARN FARMING FROM NELLA TO OPEN THE PANTRY");
        } else if (p.x > 12.5 * TILE) {
          if (game.farmUnlocked) setFarmOpen("manage");
          else setToast("THE FARM LEDGER IS EMPTY · SPEAK WITH NELLA");
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
          setDialog({ name: "لوما", line: "مرحباً بك في متجر الفانوس والورق. سأعيد لك طاقتك، خذ ما تحتاجه قبل متابعة الرحلة." });
          p.energy = 100;
        }
        return;
      }
      const farmPlot = game.farmPlots.find((plot) => plot.unlockedAt <= game.farmLevel && Math.hypot(plot.x - p.x, plot.y - p.y) < 70);
      if (farmPlot) {
        if (!farmPlot.crop) {
          setActivePlotId(farmPlot.id);
          setFarmOpen("plant");
          return;
        }
        const stage = cropStage(farmPlot);
        if (stage >= 3) {
          const kind = farmPlot.crop;
          const orchardBonus = game.farmStyle === "orchard" && kind === "strawberry" ? 1 : 0;
          game.produce[kind] += 1 + orchardBonus;
          game.harvestedTotal++;
          if (game.farmStyle === "homestead" || game.harvestedTotal % 3 === 0) game.seeds[kind]++;
          farmPlot.crop = null;
          farmPlot.plantedAt = 0;
          farmPlot.watered = false;
          setToast(`${CROP_META[kind].label.toUpperCase()} HARVESTED · STORED IN THE BARN`);
        } else if (!farmPlot.watered) {
          farmPlot.watered = true;
          farmPlot.plantedAt = Date.now();
          setToast(`${CROP_META[farmPlot.crop].label.toUpperCase()} WATERED · GROWTH HAS STARTED`);
        } else {
          const percent = Math.min(99, Math.floor((Date.now() - farmPlot.plantedAt) / CROP_META[farmPlot.crop].growMs * 100));
          setToast(`${CROP_META[farmPlot.crop].label.toUpperCase()} GROWING · ${percent}%`);
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
        if (npc.id === "city-farmer" && !game.farmUnlocked) {
          game.farmUnlocked = true;
          game.farmLevel = 1;
          game.seeds.carrot += 6;
          game.seeds.potato += 4;
          setDialog({ name: "المزارعة نيلا · تعلّمت مهارة الزراعة", line: "ابدأ بهذه الأحواض الأربعة وعشر بذور. ازرع واسقِ واحصد ثمانية محاصيل، ثم أحضر 150 ذهباً لترميم الحقل الثاني. كل حقل جديد يفتح محاصيل وخيارات تخصيص أكثر." });
          setToast("FARMING SKILL UNLOCKED · FOUR STARTER BEDS");
          return;
        }
        if (npc.id === "peeb" && !game.goblinPrisonerFreed) {
          game.goblinPrisonerFreed = true;
          game.goblinReputation++;
          p.gold += 40;
          setDialog({ name: "بيب الحر أخيراً", line: "الحرية! خذ هذه القطع الذهبية. كنت أدخرها للكرسي الثامن عشر، لكن التاريخ تغير." });
          return;
        }
        setDialog({ name: npc.name, line: npc.line });
        if (npc.id === "elder" && game.questStage === 0) game.questStage = 1;
        if (npc.id === "zahir" && game.desertQuestStage === 0) game.desertQuestStage = 1;
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
        setDialog({ name: "الحارس الملكي كايل", line: "قلعة شمس القمم هي قلب سوق الفجر. ستبقى قاعة العرش مغلقة حتى يزول خطر حارس الجذور عن الطريق الشمالي." });
      } else if (action.action === "cage") {
        if (game.goblinPrisonerFreed) {
          setToast("PEEB IS FREE · THE CAGE NOW HOLDS ONE VERY CONFUSED SPOON");
        } else {
          game.goblinPrisonerFreed = true;
          game.goblinReputation++;
          p.gold += 40;
          setDialog({ name: "بيب الحر أخيراً", line: "الحرية! خذ هذه القطع الذهبية. كنت أدخرها للكرسي الثامن عشر، لكن التاريخ تغير." });
        }
      } else if (action.action === "goblinShrine") {
        p.hp = Math.min(p.maxHp, p.hp + 90);
        p.energy = 100;
        setToast("QUESTIONABLE GOBLIN MAGIC · MOSTLY RESTORED");
      } else if (action.action === "bossLair") {
        const warChief = game.enemies.find((enemy) => enemy.id === 299);
        setDialog(warChief?.dead
          ? { name: "عرش الزعيم الفارغ", line: "العرش بلا صاحب. ثلاثة غوبلن قريبون بدأوا حملة انتخابية شعارها: طعام أكثر وذئاب أقل." }
          : { name: "لافتة تحذير مكتوبة بشكل سيئ", line: "زعيم كبير بالداخل. ممنوع الأبطال. غوبلن التوصيل يستخدمون الباب الآخر." });
      } else if (action.action === "desertObelisk") {
        if (!game.desertObelisks.includes(action.id)) {
          game.desertObelisks.push(action.id);
          game.desertQuestStage = Math.max(game.desertQuestStage, game.desertObelisks.length === 3 ? 2 : 1);
          setToast(`SUN OBELISK AWAKENED · ${game.desertObelisks.length}/3`);
        } else setToast("THIS OBELISK ALREADY BURNS WITH AN ANCIENT LIGHT");
      } else if (action.action === "desertPlate") {
        if (game.desertObelisks.length < 3) {
          setToast("THE STONE IS COLD · AWAKEN ALL THREE OBELISKS FIRST");
        } else if (!game.desertPlates.includes(action.id)) {
          game.desertPlates.push(action.id);
          game.desertQuestStage = Math.max(game.desertQuestStage, game.desertPlates.length === 3 ? 3 : 2);
          setToast(`MIRRORED SEAL PRESSED · ${game.desertPlates.length}/3`);
        } else setToast("THIS MIRRORED SEAL IS ALREADY LOCKED IN PLACE");
      } else if (action.action === "desertTomb") {
        const wardensDead = [490, 491, 492].every((id) => game.enemies.find((enemy) => enemy.id === id)?.dead);
        if (game.desertObelisks.length < 3 || game.desertPlates.length < 3) {
          setDialog({ name: "قبر التاج المحترق", line: "الباب الملكي بلا مقبض. يجب أن تتوافق المسلات الثلاث مع أختامها المرآتية قبل أن يستجيب." });
        } else if (!wardensDead) {
          const remaining = [490, 491, 492].filter((id) => !game.enemies.find((enemy) => enemy.id === id)?.dead).length;
          setDialog({ name: "قبر التاج المحترق", line: `ما زال ${remaining} من حراس الكثبان يربطون الختم الملكي. اهزم عملاق الرمل والملك المحنط وملكة العقارب.` });
        } else if (!game.desertBossUnlocked) {
          game.desertBossUnlocked = true;
          game.desertQuestStage = 4;
          setDialog({ name: "صحوة التاج المحترق", line: "يفتح القبر ويهبط تنين الشمس إلى الساحة الملكية. أنهِ لعنة قصر زاهر." });
        } else setToast("THE ROYAL TOMB STANDS OPEN");
      } else if (action.action === "farmhouse") {
        if (!game.farmUnlocked) setDialog({ name: "المزرعة المهجورة", line: "غطت الأعشاب التربة ومخزن الأدوات مغلق. تنتظرك المزارعة نيلا قرب الطريق الغربي لتعلّمك مهارة الزراعة." });
        else setFarmOpen("manage");
      } else if (action.action === "farmBarn" || action.action === "farmStand") {
        if (!game.farmUnlocked) setToast("THE BARN OPENS AFTER YOU LEARN FARMING");
        else setFarmOpen("stock");
      } else if (action.action === "farmWell") {
        if (!game.farmUnlocked) {
          setToast("LEARN FARMING BEFORE OPENING THE IRRIGATION CHANNELS");
          return;
        }
        let watered = 0;
        for (const plot of game.farmPlots) {
          if (plot.unlockedAt <= game.farmLevel && plot.crop && !plot.watered) {
            plot.watered = true;
            plot.plantedAt = Date.now();
            watered++;
          }
        }
        setToast(watered ? `IRRIGATION OPENED · ${watered} CROP BED${watered === 1 ? "" : "S"} WATERED` : "THE IRRIGATION CHANNELS ARE READY");
      } else if (action.action === "adventureGate") {
        setDialog({ name: "بوابة مغامري برايرواتش", line: "ممر الفوانيس هو الطريق الآمن الوحيد عبر غابة الأشواك. يعود المدنيون من هنا، ويواصل المغامرون المسجلون شرقاً نحو أراضي سناغتوث." });
      }
    };

    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e", "i", "m", "q", "r", "f"].includes(key)) event.preventDefault();
      if (inventoryOpen && key !== "i" && key !== "escape") return;
      gameRef.current.keys.add(key);
      if ((key === " " || key === "j") && !event.repeat) attack();
      if (key === "q" && !event.repeat) useAbility(0);
      if (key === "r" && !event.repeat) useAbility(1);
      if (key === "f" && !event.repeat) useAbility(2);
      if (key === "e" && !event.repeat) interact();
      if (key === "m" && !event.repeat) {
        mapRef.current = !mapRef.current;
        setMapOpen(mapRef.current);
      }
      if (key === "i" && !event.repeat) {
        setInventoryOpen((open) => {
          const next = !open;
          if (next) {
            mapRef.current = false;
            setMapOpen(false);
            setDialog(null);
            setCookingOpen(false);
            setFishBookOpen(false);
            setVendorOpen(null);
            setFarmOpen(null);
          }
          return next;
        });
      }
      if (key === "escape") {
        setDialog(null);
        setCookingOpen(false);
        setFishBookOpen(false);
        setVendorOpen(null);
        setFarmOpen(null);
        setActivePlotId(null);
        mapRef.current = false;
        setMapOpen(false);
        setInventoryOpen(false);
      }
    };
    const keyUp = (event: KeyboardEvent) => gameRef.current.keys.delete(event.key.toLowerCase());
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return;
      event.preventDefault();
      attack();
    };
    const preventGameContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("contextmenu", preventGameContextMenu);

    const loop = (now: number) => {
      const game = gameRef.current;
      const dt = Math.min(.033, (now - game.last) / 1000 || 0);
      game.last = now;
      if (phaseRef.current === "playing" && !mapRef.current && !inventoryOpen && !dialog && !cookingOpen && !fishBookOpen && !vendorOpen && !farmOpen) {
        game.time += dt;
        game.attackTime = Math.max(0, game.attackTime - dt);
        game.attackCooldown = Math.max(0, game.attackCooldown - dt);
        game.abilityTime = Math.max(0, game.abilityTime - dt);
        game.dashTime = Math.max(0, game.dashTime - dt);
        game.abilityCooldowns = game.abilityCooldowns.map((cooldown) => Math.max(0, cooldown - dt)) as [number, number, number];
        const p = game.player;
        p.invuln = Math.max(0, p.invuln - dt);
        p.energy = Math.min(p.hero === "archer" ? 120 : 100, p.energy + dt * 7);
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
        const speed = p.hero === "archer" ? 245 : 225;
        if (game.dashTime <= 0) {
          const response = 1 - Math.exp(-(dx || dy ? 15 : 10) * dt);
          p.vx += (dx * speed - p.vx) * response;
          p.vy += (dy * speed - p.vy) * response;
        }
        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        if (!blocked(game, nx, p.y)) p.x = nx;
        else p.vx *= -.12;
        if (!blocked(game, p.x, ny)) p.y = ny;
        else p.vy *= -.12;

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
          for (const projectile of game.projectiles) {
            projectile.life -= dt;
            projectile.x += projectile.vx * dt;
            projectile.y += projectile.vy * dt;
            if (projectile.life <= 0 || projectile.x < 0 || projectile.y < 0 || projectile.x > WORLD_W || projectile.y > WORLD_H) continue;
            for (const enemy of game.enemies) {
              if (enemy.dead || projectile.hit.includes(enemy.id) || (enemy.id === 499 && !game.desertBossUnlocked)) continue;
              const hitRadius = enemy.boss ? 64 : enemy.id >= 490 ? 54 : 34;
              if (Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) > hitRadius) continue;
              projectile.hit.push(enemy.id);
              projectile.pierce--;
              damageEnemy(game, enemy, projectile.damage, projectile.vx * .025, projectile.vy * .025);
              if (projectile.pierce <= 0) {
                projectile.life = 0;
                break;
              }
            }
          }
          game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);
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
          // Keep the market lively without allowing pedestrians to merge into
          // one another or stand on top of named quest and shop characters.
          for (let i = 0; i < citizens.length; i++) {
            const citizen = citizens[i];
            for (let j = i + 1; j < citizens.length; j++) {
              const other = citizens[j];
              const dx = citizen.x - other.x;
              const dy = citizen.y - other.y;
              const distance = Math.hypot(dx, dy);
              if (distance <= 0 || distance >= 52) continue;
              const push = (52 - distance) * .5;
              const nx = dx / distance;
              const ny = dy / distance;
              const citizenX = citizen.x + nx * push;
              const citizenY = citizen.y + ny * push;
              const otherX = other.x - nx * push;
              const otherY = other.y - ny * push;
              if (!blocked(game, citizenX, citizenY)) { citizen.x = citizenX; citizen.y = citizenY; }
              if (!blocked(game, otherX, otherY)) { other.x = otherX; other.y = otherY; }
            }
            for (const npc of NPCS) {
              if (npc.atlas !== "npcs") continue;
              const dx = citizen.x - npc.x;
              const dy = citizen.y - npc.y;
              const distance = Math.hypot(dx, dy);
              if (distance <= 0 || distance >= 60) continue;
              const nextX = citizen.x + dx / distance * (60 - distance);
              const nextY = citizen.y + dy / distance * (60 - distance);
              if (!blocked(game, nextX, nextY)) { citizen.x = nextX; citizen.y = nextY; }
            }
          }
          for (const enemy of game.enemies) {
            if (enemy.dead || (enemy.id === 499 && !game.desertBossUnlocked)) continue;
            enemy.cooldown = Math.max(0, enemy.cooldown - dt);
            enemy.flash = Math.max(0, enemy.flash - dt);
            const distance = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            let bossCasting = false;
            if (enemy.boss) {
              enemy.specialCooldown = Math.max(0, (enemy.specialCooldown ?? (1.2 + enemy.id % 3)) - dt);
              if ((enemy.specialTime ?? 0) > 0) {
                bossCasting = true;
                enemy.specialTime = Math.max(0, (enemy.specialTime ?? 0) - dt);
                if (!enemy.specialTriggered && enemy.specialTime <= .42) {
                  enemy.specialTriggered = true;
                  const targetX = enemy.specialX ?? enemy.x;
                  const targetY = enemy.specialY ?? enemy.y;
                  if (enemy.specialKind === "chiefCharge") {
                    const chargeDistance = Math.hypot(targetX - enemy.x, targetY - enemy.y);
                    const chargeX = enemy.x + (targetX - enemy.x) / Math.max(1, chargeDistance) * Math.min(220, chargeDistance);
                    const chargeY = enemy.y + (targetY - enemy.y) / Math.max(1, chargeDistance) * Math.min(220, chargeDistance);
                    if (!blocked(game, chargeX, chargeY)) { enemy.x = chargeX; enemy.y = chargeY; }
                  }
                  const hitRadius = enemy.specialKind === "rootSlam" ? 150 : enemy.specialKind === "sunVortex" ? 125 : 100;
                  const hitX = enemy.specialKind === "rootSlam" ? enemy.x : targetX;
                  const hitY = enemy.specialKind === "rootSlam" ? enemy.y : targetY;
                  if (Math.hypot(p.x - hitX, p.y - hitY) < hitRadius && p.invuln <= 0) {
                    const baseDamage = enemy.specialKind === "sunVortex" ? 58 : enemy.specialKind === "chiefCharge" ? 48 : 44;
                    p.hp -= Math.max(9, baseDamage - game.supplies.armorLevel * 4);
                    p.invuln = 1;
                  }
                }
                if (enemy.specialTime <= 0) {
                  enemy.specialCooldown = enemy.id === 499 ? 3.2 : enemy.id === 299 ? 3.8 : 4.4;
                  enemy.specialKind = undefined;
                }
              } else if ((enemy.specialCooldown ?? 0) <= 0 && distance < 520) {
                enemy.specialKind = enemy.id === 499 ? "sunVortex" : enemy.id === 299 ? "chiefCharge" : "rootSlam";
                enemy.specialTime = enemy.id === 499 ? 1.25 : 1.05;
                enemy.specialX = enemy.specialKind === "rootSlam" ? enemy.x : p.x;
                enemy.specialY = enemy.specialKind === "rootSlam" ? enemy.y : p.y;
                enemy.specialTriggered = false;
                bossCasting = true;
              }
            }
            if (!bossCasting && distance < (enemy.boss ? 360 : 250)) {
              const direction = enemy.passive ? -1 : 1;
              const ex = ((p.x - enemy.x) / Math.max(1, distance)) * direction;
              const ey = ((p.y - enemy.y) / Math.max(1, distance)) * direction;
              const tx = enemy.x + ex * enemy.speed * dt;
              const ty = enemy.y + ey * enemy.speed * dt;
              if (!blocked(game, tx, enemy.y)) enemy.x = tx;
              if (!blocked(game, enemy.x, ty)) enemy.y = ty;
            } else if (!bossCasting) {
              enemy.x = enemy.homeX + Math.sin(game.time * .7 + enemy.id) * 30;
            }
            if (!bossCasting && !enemy.passive && distance < (enemy.boss ? 66 : 40) && enemy.cooldown <= 0 && p.invuln <= 0) {
              p.hp -= Math.max(5, (enemy.boss ? 34 : 14) - game.supplies.armorLevel * 4);
              p.invuln = .75;
              enemy.cooldown = 1;
            }
          }
          if (p.x >= 138 * TILE && p.y >= 3 * TILE && p.y <= 41 * TILE) {
            for (const storm of SAND_STORMS) {
              const stormX = storm.x + Math.sin(game.time * .42 + storm.phase) * 110;
              const stormY = storm.y + Math.cos(game.time * .31 + storm.phase) * 75;
              if (Math.hypot(p.x - stormX, p.y - stormY) < storm.radius && p.invuln <= 0) {
                p.hp -= Math.max(4, 18 - game.supplies.armorLevel * 3);
                p.invuln = .8;
                const push = Math.atan2(p.y - stormY, p.x - stormX);
                p.x += Math.cos(push) * 42;
                p.y += Math.sin(push) * 42;
              }
            }
          }
        }
        const interior = game.area === "shop" || game.area === "home";
        const areaW = interior ? 20 * TILE : WORLD_W;
        const areaH = interior ? 14 * TILE : WORLD_H;
        game.camera.x += (Math.max(0, Math.min(areaW - W, p.x - W / 2)) - game.camera.x) * Math.min(1, dt * 7);
        game.camera.y += (Math.max(0, Math.min(areaH - H, p.y - H / 2)) - game.camera.y) * Math.min(1, dt * 7);
        const goblinRegionActive = p.x >= 121 * TILE && p.x <= 167 * TILE && p.y >= 41 * TILE && p.y < 63 * TILE;
        const briarwatchActive = p.x >= 113 * TILE && p.x < 121 * TILE && p.y >= 41 * TILE && p.y < 63 * TILE;
        const desertRegionActive = p.x >= 138 * TILE && p.x < MAP_W * TILE && p.y >= 3 * TILE && p.y <= 41 * TILE;
        const farmRegionActive = p.x >= 60 * TILE && p.x <= 112 * TILE && p.y >= 42 * TILE && p.y < 63 * TILE;
        const boss = game.enemies.find((item) => item.id === (desertRegionActive ? 499 : goblinRegionActive ? 299 : 99))!;
        setHud({
          hp: Math.max(0, p.hp), maxHp: p.maxHp, energy: p.energy, maxEnergy: p.hero === "archer" ? 120 : 100, hero: p.hero, abilityCooldowns: [...game.abilityCooldowns] as [number, number, number], gold: p.gold, shards: p.shards,
          kills: game.kills, quest: game.questStage, boss: Math.max(0, boss.hp),
          boat: game.boat, cooked: game.cooked, fishCaught: [...game.fishCaught], supplies: { ...game.supplies }, inventory: { ...game.inventory },
          desertQuestStage: game.desertQuestStage, desertObelisks: game.desertObelisks.length, desertPlates: game.desertPlates.length, desertBossUnlocked: game.desertBossUnlocked,
          farmUnlocked: game.farmUnlocked, farmLevel: game.farmLevel, farmStyle: game.farmStyle, harvestedTotal: game.harvestedTotal, farmRevenue: game.farmRevenue, seeds: { ...game.seeds }, produce: { ...game.produce },
          position: { x: p.x, y: p.y },
          area: game.area === "shop" ? "متجر الفانوس والورق"
            : game.area === "home" ? "منزلك"
              : p.y >= 63 * TILE ? "البحر الأزرق"
                : desertRegionActive
                  ? p.x >= 168 * TILE ? "حي معبد الشمس" : p.y >= 30 * TILE ? "واحة زاهر" : p.x < 152 * TILE ? "بوابة القوافل" : "قصر زاهر"
                  : goblinRegionActive
                    ? p.x >= 156 * TILE ? "حصن زعيم الحرب" : p.y >= 54 * TILE ? "ساحة العظام" : p.x < 136 * TILE ? "سوق سناغتوث" : "حي شامان الغوبلن"
                  : briarwatchActive
                    ? "حدود غابة برايرواتش"
                  : farmRegionActive
                    ? p.x < 73 * TILE ? "المزرعة القديمة" : p.x > 101 * TILE ? "البستان والحظيرة" : "مزرعة مرج الشمس"
                  : p.y >= 56 * TILE ? "الساحل الأزرق"
                    : p.x < 46 * TILE && p.y > 38 * TILE ? "الغابة الهامسة"
                    : p.x >= 63 * TILE && p.x <= 105 * TILE && p.y >= 4 * TILE && p.y <= 40 * TILE
                      ? p.y < 11 * TILE ? "قلعة شمس القمم" : p.y >= 20 * TILE && p.y <= 26 * TILE ? "بازار سوق الفجر" : "مدينة سوق الفجر"
                      : p.y < 14 * TILE && p.x > 45 * TILE ? "بستان الحارس"
                        : "القرية الهادئة",
        });
        if (p.hp <= 0) setPhase("dead");
      }

      c.clearRect(0, 0, W, H);
      c.fillStyle = "#142617";
      c.fillRect(0, 0, W, H);
      if (tiles.complete && tiles.naturalWidth && sprites.complete && sprites.naturalWidth && expansion.complete && expansion.naturalWidth && forest.complete && ocean.complete && city.complete && city2.complete && fortified.complete && fortified.naturalWidth && goblinRegion.complete && goblinRegion.naturalWidth && goblinUnits.complete && goblinUnits.naturalWidth && desertRegion.complete && desertRegion.naturalWidth && desertUnits.complete && desertUnits.naturalWidth && farmRegion.complete && farmRegion.naturalWidth && farmCrops.complete && farmCrops.naturalWidth && clearNpcs.complete && clearNpcs.naturalWidth && clearNpcAtlas.width && warriorAnim.complete && warriorAnim.naturalWidth && archerAnim.complete && archerAnim.naturalWidth && warriorDirectional.complete && warriorDirectional.naturalWidth && archerDirectional.complete && archerDirectional.naturalWidth && water.complete) {
        const game = gameRef.current;
        const cam = game.camera;
        if (game.area === "shop" || game.area === "home") {
          for (let ty = 0; ty < 14; ty++) for (let tx = 0; tx < 20; tx++) {
            drawCell(c, tiles, tx < 2 || tx > 17 || ty < 2 ? 4 : 5, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
          }
          const interiorItems = [...(game.area === "home" ? HOME_OBJECTS : SHOP_OBJECTS)].sort((a, b) => a.y - b.y);
          for (const item of interiorItems) drawWorldObject(c, imageFor(item.atlas), item, cam);
          if (game.area === "shop") drawCell(c, sprites, 5, 10 * TILE - 34 - cam.x, 7 * TILE - 64 - cam.y, 68, 68);
          if (game.area === "home") {
            c.fillStyle = "#d7a84d";
            c.font = "18px Georgia";
            c.fillText("موقد الطبخ", 8.8 * TILE - cam.x, 3.3 * TILE - cam.y);
            c.font = "bold 13px Georgia";
            c.fillStyle = "#f2dda0";
            c.fillText("المخزن والمحاصيل", 3.3 * TILE - cam.x, 8.4 * TILE - cam.y);
            c.fillText("دفتر تطوير المزرعة", 12.4 * TILE - cam.x, 8.9 * TILE - cam.y);
            c.fillStyle = "rgba(12, 8, 4, .72)";
            c.fillRect(6.1 * TILE - cam.x, 10.1 * TILE - cam.y, 7.8 * TILE, 28);
            c.fillStyle = "#fff0bb";
            c.font = "12px Georgia";
            c.fillText("E · اطبخ في الوسط · المخزن يساراً · التطوير يميناً", 6.35 * TILE - cam.x, 10.5 * TILE - cam.y);
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
            const isDesert = tx >= 138 && ty >= 3 && ty <= 41;
            const isFarm = tx >= 60 && tx <= 112 && ty >= 42 && ty < 63;
            if (isDesert) {
              const desertKind = desertTileAt(tx, ty);
              const sandHash = Math.abs((tx * 73856093) ^ (ty * 19349663));
              const sandColors = ["#c58d45", "#c9934b", "#bd823b", "#d09a51"];
              c.fillStyle = desertKind === 3 ? (sandHash % 3 ? "#d8c28c" : "#cdb77d") : desertKind === 1 ? (sandHash % 2 ? "#b98243" : "#c08c4c") : sandColors[sandHash % sandColors.length];
              c.fillRect(tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
              c.save();
              const tileX = tx * TILE - cam.x;
              const tileY = ty * TILE - cam.y;
              if (desertKind === 1) {
                c.strokeStyle = "rgba(96,55,25,.28)";
                c.lineWidth = 1;
                c.strokeRect(tileX + 4, tileY + 5, TILE - 8, TILE - 10);
                c.beginPath();
                c.moveTo(tileX + 4, tileY + TILE * .55);
                c.lineTo(tileX + TILE - 4, tileY + TILE * .45);
                c.stroke();
              } else if (desertKind === 3) {
                c.strokeStyle = "rgba(109,88,49,.28)";
                c.lineWidth = 1.5;
                c.beginPath();
                c.moveTo(tileX + 8, tileY + 6);
                c.lineTo(tileX + 22, tileY + 20);
                c.lineTo(tileX + 15, tileY + 34);
                c.moveTo(tileX + 22, tileY + 20);
                c.lineTo(tileX + 41, tileY + 13);
                c.stroke();
              } else if (sandHash % 4 === 0) {
                c.strokeStyle = "rgba(255,220,151,.34)";
                c.lineWidth = 1.5;
                c.beginPath();
                c.moveTo(tileX + 7, tileY + 18 + (sandHash % 12));
                c.bezierCurveTo(tileX + 18, tileY + 10 + (sandHash % 12), tileX + 34, tileY + 28 + (sandHash % 9), tileX + 53, tileY + 17 + (sandHash % 11));
                c.stroke();
              }
              if (sandHash % 11 === 0) {
                c.fillStyle = "rgba(103,63,32,.38)";
                c.beginPath();
                c.ellipse(tileX + 11 + sandHash % 33, tileY + 14 + sandHash % 24, 2.5, 1.5, 0, 0, Math.PI * 2);
                c.fill();
              }
              c.restore();
            } else if (isFarm) {
              drawCell(c, ground === 3 ? water : tiles, ground === 3 ? 0 : ground, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
              const villageFarmTile = villageFarmTileAt(tx, ty);
              if (villageFarmTile >= 0) {
                if (villageFarmTile === 0) {
                  // Each crop owns one readable square bed with a grass gutter.
                  drawCell(c, farmRegion, 1, tx * TILE - cam.x + 4, ty * TILE - cam.y + 4, TILE - 8, TILE - 8);
                } else {
                  drawCell(c, farmRegion, villageFarmTile, tx * TILE - cam.x - 2, ty * TILE - cam.y - 2, TILE + 5, TILE + 5);
                }
                if (villageFarmTile === 0) {
                  const villagePlot = game.farmPlots.find((plot) => plot.id === `village-plot-${tx}-${ty}`);
                  if (villagePlot?.crop) {
                    const cell = CROP_META[villagePlot.crop].row * 4 + Math.max(0, cropStage(villagePlot));
                    drawCell(c, farmCrops, cell, tx * TILE - cam.x + 6, ty * TILE - cam.y + 2, TILE - 12, TILE - 7);
                  }
                  if (villagePlot && game.farmUnlocked && Math.hypot(villagePlot.x - game.player.x, villagePlot.y - game.player.y) < 70) {
                    c.save();
                    c.strokeStyle = "#ffe38a";
                    c.lineWidth = 3;
                    c.strokeRect(tx * TILE - cam.x + 2, ty * TILE - cam.y + 2, TILE - 4, TILE - 4);
                    c.fillStyle = "rgba(24, 14, 5, .9)";
                    c.fillRect(tx * TILE - cam.x + 11, ty * TILE - cam.y - 20, 27, 20);
                    c.fillStyle = "#fff0ad";
                    c.font = "bold 13px Georgia";
                    c.fillText("E", tx * TILE - cam.x + 20, ty * TILE - cam.y - 6);
                    c.restore();
                  }
                }
              }
            } else {
              drawCell(c, ground === 3 ? water : tiles, ground === 3 ? 0 : ground, tx * TILE - cam.x, ty * TILE - cam.y, TILE + 1, TILE + 1);
              const homesteadTile = farmTileAt(tx, ty, game.farmLevel);
              if (homesteadTile >= 0) drawCell(c, farmRegion, homesteadTile, tx * TILE - cam.x - 2, ty * TILE - cam.y - 2, TILE + 5, TILE + 5);
            }
          }
          const bridgeY = 21 * TILE;
          drawCell(c, tiles, 7, 39 * TILE - 74 - cam.x, bridgeY - 74 - cam.y, 148, 148);
          for (let i = 0; i < 30; i++) {
            const fx = ((i * 317) % WORLD_W) - cam.x;
            const fy = ((i * 191) % WORLD_H) - cam.y;
            if (fx > -40 && fx < W + 40 && fy > -40 && fy < H + 40) drawCell(c, tiles, 13, fx, fy, 42, 42);
          }
          const villageFarmFields = [
            { x: 72, y: 48, w: 8, h: 7, name: "حقل الخضروات" },
            { x: 81, y: 48, w: 10, h: 7, name: "حقل الحبوب" },
            { x: 92, y: 48, w: 10, h: 7, name: "حديقة السوق" },
            { x: 81, y: 56, w: 14, h: 7, name: "البستان الجنوبي" },
          ];
          for (const field of villageFarmFields) {
            const sx = field.x * TILE - cam.x;
            const sy = field.y * TILE - cam.y;
            const sw = field.w * TILE;
            const sh = field.h * TILE;
            if (sx > W || sy > H || sx + sw < 0 || sy + sh < 0) continue;
            c.save();
            c.strokeStyle = "rgba(230, 200, 117, .72)";
            c.lineWidth = 4;
            c.strokeRect(sx + 4, sy + 4, sw - 8, sh - 8);
            c.fillStyle = "rgba(27, 18, 8, .84)";
            c.fillRect(sx + 12, sy + sh - 36, 138, 27);
            c.fillStyle = "#ffe8a0";
            c.font = "bold 13px Georgia";
            c.fillText(field.name, sx + 21, sy + sh - 17);
            c.restore();
          }
          const farmFields = [
            { level: 1, x: 35, y: 29, w: 5, h: 5, name: "حديقة المنزل" },
            { level: 2, x: 40, y: 29, w: 7, h: 5, name: "حقل البئر" },
            { level: 3, x: 35, y: 35, w: 7, h: 5, name: "بستان الجنوب" },
            { level: 4, x: 42, y: 35, w: 9, h: 5, name: "أرض السوق" },
          ];
          for (const field of farmFields) {
            const sx = field.x * TILE - cam.x;
            const sy = field.y * TILE - cam.y;
            const sw = field.w * TILE;
            const sh = field.h * TILE;
            if (sx > W || sy > H || sx + sw < 0 || sy + sh < 0) continue;
            c.save();
            if (field.level > game.farmLevel) {
              c.fillStyle = "rgba(71, 55, 34, .42)";
              c.fillRect(sx + 5, sy + 5, sw - 10, sh - 10);
              c.strokeStyle = "rgba(205, 183, 125, .22)";
              c.lineWidth = 2;
              for (let stripe = -sh; stripe < sw; stripe += 34) {
                c.beginPath();
                c.moveTo(sx + stripe, sy + sh);
                c.lineTo(sx + stripe + sh, sy);
                c.stroke();
              }
            }
            c.strokeStyle = field.level <= game.farmLevel ? (game.farmStyle === "orchard" ? "#9bd36d" : game.farmStyle === "market" ? "#f0bd55" : "#d6c17d") : "#6c6752";
            c.lineWidth = 5;
            c.setLineDash(field.level <= game.farmLevel ? [] : [14, 10]);
            c.strokeRect(sx + 4, sy + 4, sw - 8, sh - 8);
            c.fillStyle = "rgba(10, 18, 12, .78)";
            c.fillRect(sx + 14, sy + 14, field.level <= game.farmLevel ? 132 : 205, 32);
            c.fillStyle = field.level <= game.farmLevel ? "#fff1b4" : "#b9b39b";
            c.font = "bold 15px Georgia";
            c.fillText(field.level <= game.farmLevel ? field.name : `${field.name} · مغلق بالمهمة`, sx + 24, sy + 36);
            c.restore();
          }
          const renderables: { y: number; draw: () => void }[] = [];
          for (const plot of game.farmPlots) {
            if (plot.id.startsWith("village-plot-")) continue;
            if (plot.unlockedAt > game.farmLevel) continue;
            renderables.push({ y: plot.y, draw: () => {
              const stage = cropStage(plot);
              drawCell(c, farmRegion, plot.watered ? 2 : 1, plot.x - 43 - cam.x, plot.y - 43 - cam.y, 86, 86);
              if (plot.crop) {
                const cell = CROP_META[plot.crop].row * 4 + Math.max(0, stage);
                drawCell(c, farmCrops, cell, plot.x - 37 - cam.x, plot.y - 39 - cam.y, 74, 74);
              }
              if (game.farmUnlocked && Math.hypot(plot.x - game.player.x, plot.y - game.player.y) < 70) {
                c.save();
                c.strokeStyle = "#ffe38a";
                c.lineWidth = 3;
                c.strokeRect(plot.x - 45 - cam.x, plot.y - 45 - cam.y, 90, 90);
                c.fillStyle = "rgba(24, 14, 5, .9)";
                c.fillRect(plot.x - 14 - cam.x, plot.y - 69 - cam.y, 28, 21);
                c.fillStyle = "#fff0ad";
                c.font = "bold 13px Georgia";
                c.fillText("E", plot.x - 5 - cam.x, plot.y - 54 - cam.y);
                c.restore();
              }
            }});
          }
          for (const item of WORLD_OBJECTS) {
            if (item.action === "chest" && game.openedChest) continue;
            if (item.action === "cage" && game.goblinPrisonerFreed) continue;
            renderables.push({ y: item.y, draw: () => {
              c.save();
              if (item.action === "trap" && game.disarmedTraps.includes(item.id)) c.globalAlpha = .35;
              if (item.action === "desertObelisk" && game.desertObelisks.includes(item.id)) {
                c.shadowColor = "#fff1a2";
                c.shadowBlur = 28;
              }
              if (item.action === "desertPlate" && game.desertPlates.includes(item.id)) c.globalAlpha = .65;
              if (item.action === "desertPlate") {
                const x = item.x - cam.x;
                const y = item.y - cam.y;
                const active = game.desertPlates.includes(item.id);
                c.fillStyle = active ? "rgba(255,218,91,.68)" : "rgba(90,55,27,.82)";
                c.strokeStyle = active ? "#fff2a5" : "#d4a757";
                c.lineWidth = 4;
                c.beginPath();
                c.ellipse(x, y - 8, 43, 20, 0, 0, Math.PI * 2);
                c.fill();
                c.stroke();
                c.beginPath();
                c.moveTo(x, y - 24);
                c.lineTo(x + 14, y - 8);
                c.lineTo(x, y + 8);
                c.lineTo(x - 14, y - 8);
                c.closePath();
                c.stroke();
              } else drawWorldObject(c, imageFor(item.atlas), item, cam);
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
            const npcSize = npc.atlas === "desertUnits" && npc.cell === 10 ? 94 : npc.atlas === "goblinUnits" || npc.atlas === "desertUnits" ? 74 : 68;
            renderables.push({ y: npc.y, draw: () => {
              if (npc.atlas === "npcs") drawGridCell(c, clearNpcAtlas, npc.cell, 32, 14, npc.x - 31 - cam.x, npc.y - 74 - cam.y, 62, 76);
              else drawCell(c, imageFor(npc.atlas ?? "sprites"), npc.cell, npc.x - npcSize / 2 - cam.x, npc.y - npcSize - cam.y, npcSize, npcSize);
            } });
          }
          for (const citizen of game.citizens ?? []) renderables.push({ y: citizen.y, draw: () => {
            const walking = Math.hypot(citizen.targetX - citizen.x, citizen.targetY - citizen.y) > 12 && citizen.pause <= 0;
            const bob = walking ? Math.sin(game.time * 9 + citizen.id) * 2 : 0;
            drawGridCell(c, clearNpcAtlas, CITY_CROWD_CELLS[citizen.id % CITY_CROWD_CELLS.length], 32, 14, citizen.x - 27 - cam.x, citizen.y - 66 - cam.y + bob, 54, 68);
          } });
          for (const enemy of game.enemies) {
            if (enemy.dead || (enemy.id === 499 && !game.desertBossUnlocked)) continue;
            const size = enemy.boss ? 154 : enemy.atlas === "desertUnits" ? (enemy.id >= 490 ? 124 : enemy.cell >= 5 ? 88 : 74) : enemy.atlas === "goblinUnits" ? (enemy.cell >= 8 && enemy.cell <= 11 ? 92 : 70) : enemy.atlas === "forest" && enemy.cell <= 5 ? 78 : 60;
            renderables.push({ y: enemy.y, draw: () => {
              c.save();
              if (enemy.boss && (enemy.specialTime ?? 0) > 0) {
                const targetX = (enemy.specialKind === "rootSlam" ? enemy.x : enemy.specialX ?? enemy.x) - cam.x;
                const targetY = (enemy.specialKind === "rootSlam" ? enemy.y : enemy.specialY ?? enemy.y) - cam.y;
                const radius = enemy.specialKind === "rootSlam" ? 150 : enemy.specialKind === "sunVortex" ? 125 : 100;
                c.strokeStyle = enemy.specialKind === "sunVortex" ? "rgba(255,196,67,.92)" : enemy.specialKind === "chiefCharge" ? "rgba(237,92,49,.92)" : "rgba(133,221,81,.9)";
                c.fillStyle = enemy.specialKind === "sunVortex" ? "rgba(238,165,45,.12)" : "rgba(196,73,42,.1)";
                c.lineWidth = 5;
                c.setLineDash([12, 8]);
                c.shadowColor = c.strokeStyle;
                c.shadowBlur = 18;
                c.beginPath();
                c.arc(targetX, targetY, radius * (.84 + Math.sin(game.time * 20) * .04), 0, Math.PI * 2);
                c.fill();
                c.stroke();
                if (enemy.specialKind === "chiefCharge") {
                  c.beginPath();
                  c.moveTo(enemy.x - cam.x, enemy.y - cam.y);
                  c.lineTo(targetX, targetY);
                  c.stroke();
                }
                c.setLineDash([]);
              }
              if (enemy.flash > 0) c.globalAlpha = .45;
              const bossPulse = enemy.boss ? Math.sin(game.time * (enemy.specialTime ? 15 : 5) + enemy.id) * (enemy.specialTime ? 7 : 3) : 0;
              drawCell(c, imageFor(enemy.atlas ?? "sprites"), enemy.cell, enemy.x - (size + bossPulse) / 2 - cam.x, enemy.y - size - bossPulse - cam.y, size + bossPulse, size + bossPulse);
              c.restore();
              if (!enemy.passive || enemy.hp < enemy.maxHp) {
                c.fillStyle = "#31120e";
                c.fillRect(enemy.x - 28 - cam.x, enemy.y - size - 9 - cam.y, 56, 5);
                c.fillStyle = enemy.boss ? "#d89a3b" : "#83c447";
                c.fillRect(enemy.x - 28 - cam.x, enemy.y - size - 9 - cam.y, 56 * Math.max(0, enemy.hp / enemy.maxHp), 5);
                if (enemy.boss) {
                  c.fillStyle = "#fff0ad";
                  c.font = "bold 10px Tahoma, Arial";
                  c.textAlign = "center";
                  c.fillText(enemy.id === 499 ? "حارس الشمس" : enemy.id === 299 ? "زعيم الغوبلن بونك" : "حارس الجذور", enemy.x - cam.x, enemy.y - size - 15 - cam.y);
                }
              }
            }});
          }
          renderables.sort((a, b) => a.y - b.y);
          for (const item of renderables) item.draw();
        }
        const p = game.player;
        if (p.x >= 138 * TILE && p.y >= 3 * TILE && p.y <= 41 * TILE) {
          for (const storm of SAND_STORMS) {
            const stormX = storm.x + Math.sin(game.time * .42 + storm.phase) * 110 - cam.x;
            const stormY = storm.y + Math.cos(game.time * .31 + storm.phase) * 75 - cam.y;
            c.save();
            c.translate(stormX, stormY);
            c.strokeStyle = "rgba(238,190,99,.78)";
            c.fillStyle = "rgba(187,125,54,.16)";
            c.shadowColor = "#f0c06b";
            c.shadowBlur = 12;
            c.lineWidth = 4;
            for (let ring = 0; ring < 4; ring++) {
              c.rotate(game.time * (ring % 2 ? -.35 : .45) + storm.phase);
              c.beginPath();
              c.ellipse(0, -ring * 13, storm.radius - ring * 8, 13 + ring * 2, 0, .2, Math.PI * 1.75);
              c.stroke();
            }
            c.beginPath();
            c.moveTo(-storm.radius * .55, 4);
            c.quadraticCurveTo(0, -105 - Math.sin(game.time * 4) * 8, storm.radius * .4, 3);
            c.quadraticCurveTo(0, 22, -storm.radius * .55, 4);
            c.fill();
            c.restore();
          }
        }
        for (const projectile of game.projectiles) {
          const angle = Math.atan2(projectile.vy, projectile.vx);
          c.save();
          c.translate(projectile.x - cam.x, projectile.y - cam.y);
          c.rotate(angle);
          c.shadowColor = projectile.kind === "piercing" ? "#fff2a5" : "#b9f4c8";
          c.shadowBlur = projectile.kind === "piercing" ? 18 : 8;
          c.strokeStyle = projectile.kind === "piercing" ? "#fff2a5" : "#e8d5a0";
          c.fillStyle = projectile.kind === "piercing" ? "#fff8ce" : "#d9b75f";
          c.lineWidth = projectile.kind === "piercing" ? 5 : 3;
          c.beginPath();
          c.moveTo(-22, 0);
          c.lineTo(14, 0);
          c.stroke();
          c.beginPath();
          c.moveTo(18, 0);
          c.lineTo(8, -6);
          c.lineTo(8, 6);
          c.closePath();
          c.fill();
          c.restore();
        }
        const moving = Math.hypot(p.vx, p.vy) > 24;
        const abilityCells = p.hero === "archer" ? [12, 13, 15] : [9, 10, 14];
        const directionRow = p.direction === "down" ? 0 : p.direction === "right" ? 1 : p.direction === "up" ? 2 : 3;
        const abilityActive = game.abilityTime > 0;
        const playerCell = abilityActive
          ? abilityCells[Math.max(0, game.abilitySlot)]
          : directionRow * 4 + (game.attackTime > 0 ? 3 : moving ? 1 + Math.floor(game.time * 10) % 2 : 0);
        const heroImage = abilityActive
          ? p.hero === "archer" ? archerAnim : warriorAnim
          : p.hero === "archer" ? archerDirectional : warriorDirectional;
        const heroSize = p.hero === "archer" ? 112 : 116;
        const flipHero = abilityActive && p.direction === "left";
        c.save();
        c.globalAlpha = p.invuln > 0 && Math.floor(game.time * 16) % 2 ? .45 : 1;
        if (game.boat && game.area === "village") {
          drawCell(c, ocean, 9, p.x - 58 - cam.x, p.y - 76 - cam.y, 116, 88);
        }
        const strideBob = moving && game.attackTime <= 0 ? Math.sin(game.time * 22) * 2 : 0;
        drawFacingCell(c, heroImage, playerCell, p.x - heroSize / 2 - cam.x, p.y - heroSize + 15 - cam.y + strideBob, heroSize, heroSize, flipHero);
        c.restore();
        if (game.abilityTime > 0 && game.abilitySlot === 2) {
          const [fx, fy] = facingVector(p.direction);
          const ex = p.x + fx * (p.hero === "archer" ? 190 : 155) - cam.x;
          const ey = p.y + fy * (p.hero === "archer" ? 190 : 155) - cam.y;
          c.save();
          c.strokeStyle = p.hero === "archer" ? "rgba(185,244,200,.8)" : "rgba(255,218,112,.85)";
          c.lineWidth = 5;
          c.shadowColor = c.strokeStyle;
          c.shadowBlur = 24;
          c.beginPath();
          c.arc(ex, ey, 85 + Math.sin(game.time * 18) * 8, 0, Math.PI * 2);
          c.stroke();
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
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("contextmenu", preventGameContextMenu);
    };
  }, [cookingOpen, dialog, farmOpen, fishBookOpen, inventoryOpen, vendorOpen, setPhase]);

  const press = (key: string, active: boolean) => {
    if (active) gameRef.current.keys.add(key);
    else gameRef.current.keys.delete(key);
  };

  return (
    <main className="pixel-game-shell">
      <canvas ref={canvasRef} className="pixel-game-canvas" aria-label="Top-down pixel art action RPG" />
      <aside className={`pixel-minimap ${phase === "title" || phase === "select" ? "hidden" : ""}`}>
        <header><span>الخريطة المباشرة</span><b>{hud.area}</b></header>
        <canvas ref={miniMapRef} aria-label="Live minimap with player and collectible locations" />
        <footer><i className="you">◆ YOU</i><i className="loot">◆ RESOURCES</i></footer>
      </aside>
      {phase === "title" && (
        <section className="pixel-title">
          <small>لعبة مغامرات وقتال بعالم بكسل أصلي</small>
          <h1>ABYSS <span>WALKER</span></h1>
          <p>تعود الشعلة الصامتة الأخيرة إلى القرية الهادئة.</p>
          <button onClick={() => hasSave ? startGame(false) : setPhase("select")}>{hasSave ? "متابعة المغامرة" : "اختر بطلك"}</button>
          {hasSave && <button className="pixel-new-journey" onClick={resetSave}>رحلة جديدة · حذف الحفظ</button>}
          <em dir="ltr">WASD / الأسهم · حركة &nbsp; RMB / J / SPACE · هجوم &nbsp; Q / R / F · قدرات &nbsp; I · الحقيبة</em>
        </section>
      )}
      {phase === "select" && (
        <section className="hero-select">
          <small>الحدود بحاجة إلى بطل</small>
          <h2>اختر بطلك</h2>
          <p>يستكشف البطلان العالم نفسه، لكن لكل منهما أسلوب قتال مختلف بالكامل.</p>
          <div className="hero-select-grid">
            <article className="hero-card warrior">
              <div className="hero-preview" />
              <h3>عمر، المحارب الصامت</h3>
              <strong>رمح · نور · قتال قريب</strong>
              <p>مقاتل صلب يملك ضربات واسعة واندفاعة مؤذية وإعصار رمح وهجوماً شمسياً ساحقاً.</p>
              <ul><li>Q · خطوة الشبح</li><li>R · إعصار الرمح</li><li>F · سقوط الرمح</li></ul>
              <button onClick={() => chooseHero("warrior")}>العب بعمر</button>
            </article>
            <article className="hero-card archer">
              <div className="hero-preview" />
              <h3>نعيمة، رامية الرياح</h3>
              <strong>قوس · رياح · قتال بعيد</strong>
              <p>رامية سريعة تستخدم سهماً خارقاً ووابل خمسة سهام ومطر سهام موجه من السماء.</p>
              <ul><li>Q · الضوء الخارق</li><li>R · وابل المروحة</li><li>F · مطر السماء</li></ul>
              <button onClick={() => chooseHero("archer")}>العب بنعيمة</button>
            </article>
          </div>
          <button className="hero-back" onClick={() => setPhase("title")}>رجوع</button>
        </section>
      )}
      {(phase === "playing" || phase === "dead") && (
        <>
          <header className="pixel-hud">
            <div className={`pixel-portrait ${hud.hero}`}>{hud.hero === "warrior" ? "◇" : "➶"}</div>
            <div><strong>{hud.hero === "warrior" ? "عمر" : "نعيمة"}</strong><small>المستوى 1 · {hud.hero === "warrior" ? "المحارب الصامت" : "رامية الرياح"}</small>
              <span className="pixel-bar hp"><i style={{ width: `${hud.hp / hud.maxHp * 100}%` }} /><b><em>♥ الصحة</em>{Math.ceil(hud.hp)} / {hud.maxHp}</b></span>
              <span className="pixel-bar mp"><i style={{ width: `${hud.energy / hud.maxEnergy * 100}%` }} /><b><em>◆ الطاقة</em>{Math.ceil(hud.energy)} / {hud.maxEnergy}</b></span>
            </div>
          </header>
          <div className="pixel-area"><small>طور المغامرة</small><strong>{hud.area}</strong></div>
          <div className="pixel-wallet"><span>● {hud.gold}</span><span>◆ {hud.shards}</span><button onClick={() => { mapRef.current = true; setMapOpen(true); }}>الخريطة</button><button onClick={() => { mapRef.current = false; setMapOpen(false); setInventoryTab("all"); setInventoryOpen(true); }}>الحقيبة · I</button><button onClick={() => setFishBookOpen(true)}>الأسماك</button></div>
          <aside className="pixel-quest">
            <small>{hud.area.includes("مزرعة") || hud.area.includes("بستان") || hud.area.includes("حظيرة") ? "سجل المزرعة" : hud.area.includes("زاهر") || hud.area.includes("الشمس") || hud.area.includes("القوافل") ? "مهمة الصحراء" : "المهمة الرئيسية"}</small>
            <strong>{hud.area.includes("مزرعة") || hud.area.includes("بستان") || hud.area.includes("حظيرة")
              ? !hud.farmUnlocked ? "تحدث مع المزارعة نيلا لتعلّم مهارة الزراعة"
                : hud.farmLevel >= 4 ? `اكتملت المزرعة · حصدت ${hud.harvestedTotal} محصولاً`
                  : `مهمة الحقل ${hud.farmLevel + 1}: احصد ${hud.farmLevel === 1 ? 8 : hud.farmLevel === 2 ? 24 : 48} ووفّر ${hud.farmLevel === 1 ? 150 : hud.farmLevel === 2 ? 400 : 750} ذهباً`
              : hud.area.includes("زاهر") || hud.area.includes("الشمس") || hud.area.includes("القوافل")
                ? hud.desertQuestStage === 0 ? "تحدث مع الأمير زاهر"
                  : hud.desertObelisks < 3 ? `أيقظ مسلات الشمس (${hud.desertObelisks}/3)`
                    : hud.desertPlates < 3 ? `اضغط الأختام المرآتية (${hud.desertPlates}/3)`
                      : !hud.desertBossUnlocked ? "اهزم حراس الكثبان وافتح القبر الملكي"
                        : hud.desertQuestStage < 5 ? "اهزم تنين الشمس"
                          : "صمت التاج المحترق"
                : hud.quest === 0 ? "تحدث مع الشيخ آش"
                  : hud.cooked === 0 ? "اجمع الأعشاب والفطر ثم اطبخ حساء الجذور في المنزل"
                    : hud.quest === 1 ? `اصطد الوحوش الفاسدة (${Math.min(3, hud.kills)}/3)`
                      : hud.quest === 2 ? "اهزم حارس الجذور"
                        : "الطريق الشمالي آمن"}</strong>
          </aside>
          <div className="pixel-hotbar hero-hotbar">
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }))}><b>RMB</b><span>{hud.hero === "warrior" ? "✦" : "➶"}</span><small>{hud.hero === "warrior" ? `رمح +${hud.supplies.spearLevel}` : `سهم +${hud.supplies.spearLevel}`}</small></button>
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" }))}><b>Q</b><span>{hud.hero === "warrior" ? "➤" : "⇥"}</span><small>{hud.abilityCooldowns[0] > 0 ? hud.abilityCooldowns[0].toFixed(1) : hud.hero === "warrior" ? "شبح" : "اختراق"}</small></button>
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }))}><b>R</b><span>{hud.hero === "warrior" ? "◌" : "⋙"}</span><small>{hud.abilityCooldowns[1] > 0 ? hud.abilityCooldowns[1].toFixed(1) : hud.hero === "warrior" ? "إعصار" : "وابل"}</small></button>
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }))}><b>F</b><span>{hud.hero === "warrior" ? "↯" : "⇈"}</span><small>{hud.abilityCooldowns[2] > 0 ? hud.abilityCooldowns[2].toFixed(1) : hud.hero === "warrior" ? "سقوط الرمح" : "مطر السماء"}</small></button>
            <button onClick={usePotion}><b>1</b><span>✚</span><small>جرعة {hud.supplies.potions}</small></button>
          </div>
          <div className="pixel-touch">
            <button onPointerDown={() => press("a", true)} onPointerUp={() => press("a", false)}>◀</button>
            <button onPointerDown={() => press("w", true)} onPointerUp={() => press("w", false)}>▲</button>
            <button onPointerDown={() => press("s", true)} onPointerUp={() => press("s", false)}>▼</button>
            <button onPointerDown={() => press("d", true)} onPointerUp={() => press("d", false)}>▶</button>
          </div>
          {toast && <div className="pixel-toast">{toast}</div>}
        </>
      )}
      {inventoryOpen && (
        <section className="pixel-character-inventory" role="dialog" aria-modal="true" aria-label="حقيبة ومعدات الشخصية">
          <div className="inventory-window">
            <button className="inventory-close" onClick={() => setInventoryOpen(false)} aria-label="إغلاق الحقيبة">×</button>
            <header className="inventory-title">
              <div><small>حقيبة المغامر</small><h2>الشخصية والمعدات</h2></div>
              <kbd>I</kbd>
            </header>
            <div className="inventory-layout">
              <aside className="inventory-character">
                <div className={`inventory-hero ${hud.hero}`} aria-hidden="true" />
                <h3>{hud.hero === "warrior" ? "عمر" : "نعيمة"}</h3>
                <p>المستوى 1 · {hud.hero === "warrior" ? "رمّاح النور" : "رامية الرياح"}</p>
                <div className="inventory-vitals">
                  <span><i className="health-dot" />الصحة <b>{Math.ceil(hud.hp)} / {hud.maxHp}</b></span>
                  <span><i className="mana-dot" />الطاقة <b>{Math.ceil(hud.energy)} / {hud.maxEnergy}</b></span>
                  <span><i className="armor-dot" />الدرع <b>+{hud.supplies.armorLevel}</b></span>
                </div>
              </aside>
              <section className="equipment-panel">
                <div className="inventory-section-heading"><div><small>التجهيز الحالي</small><h3>المعدات</h3></div><b>0 / 6</b></div>
                <div className="equipment-grid">
                  {[['⚔', 'السلاح'], ['◈', 'الدرع'], ['⌁', 'الرداء'], ['◇', 'التعويذة'], ['○', 'الخاتم'], ['▱', 'الأداة']].map(([icon, label]) => (
                    <article className="equipment-slot empty" key={label}><span>{icon}</span><div><strong>{label}</strong><small>فارغ</small></div></article>
                  ))}
                </div>
                <p className="equipment-note">لا توجد معدات بعد. الأسلحة والدروع التي تجمعها لاحقاً ستظهر هنا ويمكن تجهيزها من هذه الخانات.</p>
              </section>
              <section className="inventory-items">
                <div className="inventory-section-heading"><div><small>المواد المجموعة</small><h3>محتويات الحقيبة</h3></div><b>{Object.values(hud.inventory).reduce((sum, count) => sum + count, 0)} قطعة</b></div>
                <div className="inventory-tabs">
                  <button className={inventoryTab === "all" ? "active" : ""} onClick={() => setInventoryTab("all")}>الكل</button>
                  <button className={inventoryTab === "materials" ? "active" : ""} onClick={() => setInventoryTab("materials")}>المواد</button>
                  <button className={inventoryTab === "supplies" ? "active" : ""} onClick={() => setInventoryTab("supplies")}>المؤن</button>
                  <button className={inventoryTab === "equipment" ? "active" : ""} onClick={() => setInventoryTab("equipment")}>المعدات</button>
                </div>
                <div className="inventory-item-grid">
                  {(inventoryTab === "all" || inventoryTab === "materials") && (Object.keys(INGREDIENT_META) as Ingredient[]).map((kind) => (
                    <article key={kind} className={`inventory-item ${kind}`}><span>{INGREDIENT_META[kind].icon}</span><div><strong>{INGREDIENT_META[kind].label}</strong><small>مادة جمع</small></div><b>× {hud.inventory[kind]}</b></article>
                  ))}
                  {(inventoryTab === "all" || inventoryTab === "supplies") && <>
                    <article className="inventory-item potion"><span>♥</span><div><strong>جرعة علاج</strong><small>مادة استهلاكية</small></div><b>× {hud.supplies.potions}</b></article>
                    <article className="inventory-item bait"><span>⌁</span><div><strong>طُعم صيد</strong><small>مؤن الصيد</small></div><b>× {hud.supplies.bait}</b></article>
                  </>}
                  {inventoryTab === "equipment" && <p className="inventory-empty-state">لا توجد معدات في الحقيبة حالياً.<small>عند إضافة الأسلحة والدروع ستظهر هنا، ثم يمكن سحبها إلى خانات التجهيز.</small></p>}
                </div>
              </section>
            </div>
            <footer className="inventory-footer"><span>● {hud.gold} ذهب</span><span>◆ {hud.shards} شظايا</span><span>{hud.boat ? "⛵ القارب متاح" : "استكشف العالم للعثور على أدوات جديدة"}</span></footer>
          </div>
        </section>
      )}
      {dialog && (
        <section className="pixel-dialog">
          <div><strong>{dialog.name}</strong><p>{dialog.line}</p><button onClick={() => setDialog(null)}>متابعة</button></div>
        </section>
      )}
      {cookingOpen && (
        <section className="pixel-cooking">
          <div className="pixel-cooking-book">
            <button className="pixel-cooking-close" onClick={() => setCookingOpen(false)}>×</button>
            <small>منزلك · الموقد والحصاد</small>
            <h2>كتاب الطبخ الصامت</h2>
            <p>تعيد الوجبات صحتك وطاقتك. تأتي المكونات من الغابة والنهر ومناطق الصيد.</p>
            <div className="pixel-recipe-grid">
              <article><span>♨</span><h3>حساء الجذور</h3><p>عشبتان · فطر واحد</p><button onClick={() => cookMeal("stew")}>اطبخ</button></article>
              <article><span>♒</span><h3>حساء النهر</h3><p>سمكتان · عشبة واحدة</p><button onClick={() => cookMeal("chowder")}>اطبخ</button></article>
              <article><span>♨</span><h3>طبق الصياد</h3><p>قطعتا لحم · حبة توت</p><button onClick={() => cookMeal("plate")}>اطبخ</button></article>
            </div>
            <footer>PACK · ☘ {hud.inventory.herb} · ♧ {hud.inventory.mushroom} · ● {hud.inventory.berry} · ♒ {hud.inventory.fish} · ♨ {hud.inventory.meat}</footer>
          </div>
        </section>
      )}
      {fishBookOpen && (
        <section className="pixel-fish-book">
          <div>
            <button className="pixel-cooking-close" onClick={() => setFishBookOpen(false)}>×</button>
            <small>دليل مارو الميداني</small>
            <h2>أسماك الحدود</h2>
            <p>ارمِ الصنارة عند تموجات الأنهار والبحر الأزرق. الأسماك النادرة تمنح ذهباً أكثر.</p>
            <div className="pixel-fish-grid">
              {FISH_TYPES.map((fish, index) => {
                const count = hud.fishCaught.filter((caught) => caught === fish).length;
                return <article className={count ? "caught" : ""} key={fish}>
                  <span style={{ backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` }} />
                  <strong>{count ? fish : "غير معروف"}</strong><small>{count ? `تم صيده × ${count}` : "لم يُكتشف"}</small>
                </article>;
              })}
            </div>
          </div>
        </section>
      )}
      {farmOpen && (
        <section className="pixel-vendor pixel-farm">
          <div>
            <button className="pixel-cooking-close" onClick={() => { setFarmOpen(null); setActivePlotId(null); }}>×</button>
            <small>مزرعة مرج الشمس · مستوى الحقل {hud.farmLevel}</small>
            <h2>{farmOpen === "plant" ? "اختر البذور" : farmOpen === "stock" ? "الحظيرة ومتجر المنتجات" : "ترميم المزرعة"}</h2>
            {farmOpen === "plant" && <>
              <p>ازرع البذرة ثم تفاعل مع الحوض مرة أخرى لسقيها. تفتح مهام الحقول محاصيل إضافية.</p>
              <div className="pixel-vendor-wares pixel-crop-wares">
                {(Object.keys(CROP_META) as CropKind[]).map((kind) => <article key={kind}>
                  <span>{CROP_META[kind].icon}</span>
                  <h3>{CROP_META[kind].label.toUpperCase()}</h3>
                  <p>نمو {CROP_META[kind].growMs / 1000}ث · {CROP_META[kind].price} ذهب · الحقل {CROP_META[kind].unlockAt}</p>
                  <button disabled={!hud.seeds[kind] || CROP_META[kind].unlockAt > hud.farmLevel} onClick={() => plantCrop(kind)}>
                    {CROP_META[kind].unlockAt > hud.farmLevel ? `مغلق · الحقل ${CROP_META[kind].unlockAt}` : `ازرع · ${hud.seeds[kind]} بذور`}
                  </button>
                </article>)}
              </div>
            </>}
            {farmOpen === "stock" && <>
              <p>المحاصيل المحصودة آمنة في الحظيرة. بع صندوقاً واحداً أو جميع المنتجات.</p>
              <div className="pixel-vendor-wares pixel-crop-wares">
                {(Object.keys(CROP_META) as CropKind[]).map((kind) => <article key={kind}>
                  <span>{CROP_META[kind].icon}</span>
                  <h3>{CROP_META[kind].label.toUpperCase()} × {hud.produce[kind]}</h3>
                  <p>{CROP_META[kind].price} ذهب للحبة · البذور المتبقية {hud.seeds[kind]}</p>
                  <button disabled={!hud.produce[kind]} onClick={() => sellProduce(kind)}>بع الصندوق · {hud.produce[kind] * CROP_META[kind].price} ذهب</button>
                </article>)}
              </div>
              <button className="pixel-sell-all" onClick={() => sellProduce()}>بيع جميع المنتجات</button>
            </>}
            {farmOpen === "manage" && <>
              <p>تبدأ بأربعة أحواض. تفتح مهام الترميم أراضي ومحاصيل جديدة، بينما تبقى الأراضي المقفلة مغطاة بالعشب.</p>
              <div className="pixel-farm-summary">
                <b>مستوى الحقل {hud.farmLevel} / 4</b>
                <span>{hud.harvestedTotal} إجمالي المحاصيل</span>
                <span>{hud.farmRevenue} ذهب من بيع المنتجات</span>
              </div>
              <h3>اختر تخصص مزرعتك</h3>
              <div className="pixel-farm-styles">
                <button className={hud.farmStyle === "homestead" ? "active" : ""} onClick={() => chooseFarmStyle("homestead")}>مزرعة منزلية<br /><small>الحصاد يعيد بذوراً إضافية</small></button>
                <button className={hud.farmStyle === "orchard" ? "active" : ""} onClick={() => chooseFarmStyle("orchard")}>بستان فواكه<br /><small>الفراولة تعطي محصولاً إضافياً</small></button>
                <button className={hud.farmStyle === "market" ? "active" : ""} onClick={() => chooseFarmStyle("market")}>حديقة السوق<br /><small>المنتجات تباع بسعر أعلى 20%</small></button>
              </div>
              <button className="pixel-sell-all" disabled={hud.farmLevel >= 4} onClick={expandFarm}>
                {hud.farmLevel >= 4 ? "تم ترميم جميع الحقول" : `رمّم الحقل ${hud.farmLevel + 1} · ${hud.farmLevel === 1 ? 150 : hud.farmLevel === 2 ? 400 : 750} ذهب · ${hud.farmLevel === 1 ? 8 : hud.farmLevel === 2 ? 24 : 48} محصولاً`}
              </button>
            </>}
          </div>
        </section>
      )}
      {vendorOpen && (() => {
        const vendorName = vendorOpen === "weapons" ? "الحديد والجمر"
          : vendorOpen === "potions" ? "القارورة البنفسجية"
            : vendorOpen === "fish" ? "دكان صائد المد"
              : vendorOpen === "goblin" ? "بضائع غريبل القانونية تماماً" : "مؤن الشمس";
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
            <p>محفظتك: <b>● {hud.gold} ذهب</b></p>
            <div className="pixel-vendor-wares">
              {wares.map((ware) => <article key={ware.name}>
                <span>{ware.kind === "spear" ? "⚔" : ware.kind === "armor" ? "♜" : ware.kind === "potion" ? "⚗" : ware.kind === "bait" ? "⌁" : "♨"}</span>
                <h3>{ware.name}</h3><p>{ware.copy}</p>
                <button onClick={() => buyItem(ware.kind)}>شراء · {ware.cost} ذهب</button>
              </article>)}
            </div>
          </div>
        </section>;
      })()}
      {mapOpen && (
        <section className="pixel-map">
          <button onClick={() => { mapRef.current = false; setMapOpen(false); }}>×</button>
          <h2>خريطة الحدود العنصرية</h2>
          <div className="pixel-map-grid">
            <i className="village">القرية الهادئة</i><i className="home">⌂ منزلك</i>
            <i className="river">نهر المرآة</i><i className="grove">بستان الحارس</i>
            <i className="forest">الغابة الهامسة<br />صيد · جمع</i>
            <i className="city">مدينة سوق الفجر<br />متاجر · شخصيات</i>
            <i className="farm">مزرعة مرج الشمس<br />محاصيل · بستان · حظيرة</i>
            <i className="frontier">غابة برايرواتش<br />بوابة المغامرين</i>
            <i className="goblin">معسكر سناغتوث<br />سوق · سجن · زعيم الحرب</i>
            <i className="desert">قصر زاهر<br />ألغاز · حراس · تنين الشمس</i>
            <i className="coast">الساحل الأزرق<br />رصيف الصيد</i>
            <i className="ocean">البحر الأزرق<br />طريق القارب</i><i className="cache">مخبأ سري</i>
            <b style={{ left: `${Math.max(2, Math.min(96, hud.position.x / WORLD_W * 100))}%`, top: `${Math.max(3, Math.min(92, hud.position.y / WORLD_H * 100))}%` }}>◆ YOU</b>
          </div>
          <p>A single connected world: village life, farming and trade, wild forest, market city, goblin camps, the Qasr Zahar desert, coast and open-water routes.</p>
        </section>
      )}
      {phase === "dead" && <section className="pixel-dead"><h2>تخبو الشعلة</h2><button onClick={() => startGame(false)}>العودة إلى آخر حفظ</button></section>}
    </main>
  );
}
