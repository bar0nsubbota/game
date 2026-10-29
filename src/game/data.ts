// Игровые данные: оружие, артефакты, атрибуты, навыки, враги
export const TS = 48; // размер тайла в мире
export const MAP_W = 160;
export const MAP_H = 160;
export const SEAL_COUNT = 3;
export const MAX_POTIONS = 5;

export type EffectKind = 'none' | 'poison' | 'bleed' | 'burn' | 'freeze' | 'shadow' | 'holy';

export interface WeaponDef {
  id: string;
  name: string;
  effect: EffectKind;
  effectName: string;
  desc: string;
  cost: number;
  dmg: number;
  spd: number;
  range: number;
  arc: number;
  shape: 'dagger' | 'fang' | 'saw' | 'claw' | 'shard' | 'wisp' | 'sun';
  c: { blade: string; edge: string; glow: string; trail: string; hilt: string };
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'rusty', name: 'Ржавые клинки', effect: 'none', effectName: 'Без эффекта',
    desc: 'Простые кинжалы из старого арсенала. Надёжны, но лишены магии.',
    cost: 0, dmg: 1, spd: 1, range: 62, arc: 2.1, shape: 'dagger',
    c: { blade: '#9aa3ad', edge: '#eef3f8', glow: '#9fb4c8', trail: '#cfd8e3', hilt: '#4a3b2c' },
  },
  {
    id: 'venom', name: 'Ядовитые Клыки', effect: 'poison', effectName: 'Отравление',
    desc: 'Клыки гигантского паука. Каждый удар добавляет слой яда (до 6) — урон со временем растёт.',
    cost: 120, dmg: 1.08, spd: 1.08, range: 64, arc: 2.1, shape: 'fang',
    c: { blade: '#4fae3d', edge: '#d7ffb0', glow: '#7dff4a', trail: '#8cff5a', hilt: '#2d3b1f' },
  },
  {
    id: 'blood', name: 'Кровопийцы', effect: 'bleed', effectName: 'Кровотечение',
    desc: 'Зазубренные лезвия рвут плоть. До 5 слоёв кровотечения, а каждый слой даёт +8% урона по цели.',
    cost: 260, dmg: 1.18, spd: 1.0, range: 66, arc: 2.2, shape: 'saw',
    c: { blade: '#a31e30', edge: '#ff9a9a', glow: '#ff2e4d', trail: '#ff4b5f', hilt: '#2a1216' },
  },
  {
    id: 'cinder', name: 'Пепельные Когти', effect: 'burn', effectName: 'Поджог',
    desc: 'Раскалённые когти поджигают врагов. Горящие враги взрываются при смерти и поджигают соседей.',
    cost: 450, dmg: 1.25, spd: 1.05, range: 68, arc: 2.2, shape: 'claw',
    c: { blade: '#d9551a', edge: '#ffe08a', glow: '#ff8a1e', trail: '#ffa035', hilt: '#2b1c14' },
  },
  {
    id: 'frost', name: 'Ледяные Осколки', effect: 'freeze', effectName: 'Заморозка',
    desc: 'Холод сковывает цели. На 4-м слое враг замерзает на 1.5 сек и получает +40% урона.',
    cost: 700, dmg: 1.3, spd: 1.0, range: 70, arc: 2.2, shape: 'shard',
    c: { blade: '#5ec8f2', edge: '#eafcff', glow: '#7de3ff', trail: '#a8f0ff', hilt: '#1d2c3b' },
  },
  {
    id: 'shadow', name: 'Клинки Бездны', effect: 'shadow', effectName: 'Теневой удар',
    desc: '28% шанс призрачного удара (90% урона) и лечения. Даёт +10% к уклонению.',
    cost: 1000, dmg: 1.4, spd: 1.15, range: 72, arc: 2.3, shape: 'wisp',
    c: { blade: '#4b2a86', edge: '#d6a8ff', glow: '#9a5cff', trail: '#b57cff', hilt: '#14101f' },
  },
  {
    id: 'holy', name: 'Лезвия Рассвета', effect: 'holy', effectName: 'Божественная кара',
    desc: '18% шанс удара света по области. +50% урона по нежити. Убийства исцеляют.',
    cost: 1500, dmg: 1.55, spd: 1.1, range: 76, arc: 2.3, shape: 'sun',
    c: { blade: '#f4d97a', edge: '#ffffff', glow: '#ffe58a', trail: '#fff1b0', hilt: '#8a6a2a' },
  },
];

export type StatKey =
  | 'dmg' | 'atk' | 'hp' | 'move' | 'crit' | 'critDmg' | 'life' | 'dodge' | 'cdr' | 'regen' | 'gold' | 'xp' | 'magnet' | 'armor';

export const STAT_INFO: Record<StatKey, { label: string; pct: boolean }> = {
  dmg: { label: 'урон', pct: true },
  atk: { label: 'скорость атаки', pct: true },
  hp: { label: 'здоровье', pct: false },
  move: { label: 'скорость бега', pct: true },
  crit: { label: 'шанс крита', pct: true },
  critDmg: { label: 'крит. урон', pct: true },
  life: { label: 'вампиризм', pct: true },
  dodge: { label: 'уклонение', pct: true },
  cdr: { label: 'откат навыков', pct: true },
  regen: { label: 'регенерация', pct: false },
  gold: { label: 'золото', pct: true },
  xp: { label: 'опыт', pct: true },
  magnet: { label: 'радиус подбора', pct: false },
  armor: { label: 'броня', pct: true },
};

export function fmtStat(k: StatKey, v: number): string {
  const i = STAT_INFO[k];
  if (i.pct) return `+${Math.round(v * 100)}% ${i.label}`;
  if (k === 'regen') return `+${v.toFixed(1)} ХП/сек`;
  return `+${Math.round(v)} ${i.label}`;
}

export interface ArtifactBase { id: string; name: string; stat: StatKey; base: number; icon: string }
export const ARTIFACTS: ArtifactBase[] = [
  { id: 'ring_fury', name: 'Кольцо Ярости', stat: 'dmg', base: 0.06, icon: 'flame' },
  { id: 'amulet_swift', name: 'Амулет Стрижа', stat: 'atk', base: 0.06, icon: 'zap' },
  { id: 'heart_troll', name: 'Сердце Тролля', stat: 'hp', base: 18, icon: 'heart' },
  { id: 'boots_wind', name: 'Сапоги Ветра', stat: 'move', base: 0.05, icon: 'footprints' },
  { id: 'eye_hawk', name: 'Глаз Ястреба', stat: 'crit', base: 0.04, icon: 'eye' },
  { id: 'fang_vamp', name: 'Клык Вампира', stat: 'life', base: 0.02, icon: 'droplets' },
  { id: 'cloak_shade', name: 'Плащ Тени', stat: 'dodge', base: 0.03, icon: 'ghost' },
  { id: 'seal_time', name: 'Печать Времени', stat: 'cdr', base: 0.05, icon: 'hourglass' },
  { id: 'claw_wolf', name: 'Коготь Волка', stat: 'critDmg', base: 0.12, icon: 'crosshair' },
  { id: 'ruby_blood', name: 'Кровавый Рубин', stat: 'regen', base: 0.5, icon: 'gem' },
  { id: 'coin_midas', name: 'Монета Мидаса', stat: 'gold', base: 0.12, icon: 'coins' },
  { id: 'tome_sage', name: 'Том Мудреца', stat: 'xp', base: 0.12, icon: 'book' },
  { id: 'mag_lode', name: 'Магнитный Камень', stat: 'magnet', base: 35, icon: 'magnet' },
  { id: 'plate_iron', name: 'Пластина Стража', stat: 'armor', base: 0.04, icon: 'shield' },
];

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY: Record<Rarity, { label: string; color: string; mult: number }> = {
  common: { label: 'Обычный', color: '#b8bcc8', mult: 1 },
  rare: { label: 'Редкий', color: '#4aa8ff', mult: 1.7 },
  epic: { label: 'Эпический', color: '#b967ff', mult: 2.6 },
  legendary: { label: 'Легендарный', color: '#ffb02e', mult: 4 },
};

export interface ArtifactInst {
  uid: number;
  baseId: string;
  name: string;
  icon: string;
  rarity: Rarity;
  stat: StatKey;
  value: number;
}

export type AttrKey = 'dmg' | 'atk' | 'hp' | 'move' | 'crit' | 'cdr';
export const ATTRS: { key: AttrKey; name: string; desc: string }[] = [
  { key: 'dmg', name: 'Сила клинков', desc: '+12% к урону' },
  { key: 'atk', name: 'Скорость атаки', desc: '+9% к скорости атаки' },
  { key: 'hp', name: 'Живучесть', desc: '+16 к макс. здоровью' },
  { key: 'move', name: 'Проворство', desc: '+5% к скорости бега' },
  { key: 'crit', name: 'Точность убийцы', desc: '+3% к шансу крита' },
  { key: 'cdr', name: 'Мастерство теней', desc: '−4% к перезарядке навыков' },
];

export interface SkillDef { id: string; name: string; desc: string; key: string; cd: number; unlock: number }
export const SKILLS: SkillDef[] = [
  { id: 'whirl', name: 'Вихрь клинков', desc: 'Закручивается в смертельном вихре, рубя всех вокруг и сбивая вражеские снаряды.', key: '1', cd: 7, unlock: 1 },
  { id: 'shadow', name: 'Теневой шаг', desc: 'Телепорт за спину цели, мощный удар по области и 3 гарантированных крита.', key: '2', cd: 10, unlock: 3 },
  { id: 'dance', name: 'Танец смерти', desc: '7 сек: +60% скорости атаки, +25% бега, вампиризм и волны клинков.', key: '3', cd: 40, unlock: 6 },
];

export type EnemyKind =
  | 'bat' | 'goblin' | 'goblinArcher' | 'spider' | 'webSpider' | 'skeleton' | 'skelArcher'
  | 'necro' | 'orc' | 'shaman' | 'ogre' | 'wraith' | 'mimic' | 'boss';

export type ProjKind = 'arrow' | 'bolt' | 'web' | 'fire' | 'shadow' | 'bone' | 'dagger' | 'wave';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  dmg: number;
  speed: number;
  r: number;
  xp: number;
  gold: number;
  ai: 'melee' | 'lunge' | 'ranged' | 'bat' | 'boss';
  undead?: boolean;
  flying?: boolean;
  aggro: number;
  kbRes: number;
  h: number;
  atk?: { range: number; windup: number; recover: number; cd: number; shape: 'cone' | 'circle'; arc: number; reach: number; off: number };
  rng?: { min: number; max: number; windup: number; cd: number; proj: ProjKind; speed: number; count: number; spread: number };
  special?: 'necro' | 'shaman';
  poison?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  bat: { kind: 'bat', name: 'Пещерная летучая мышь', hp: 14, dmg: 6, speed: 165, r: 9, xp: 4, gold: 1, ai: 'bat', flying: true, aggro: 280, kbRes: 0, h: 22 },
  goblin: {
    kind: 'goblin', name: 'Гоблин', hp: 28, dmg: 8, speed: 135, r: 12, xp: 6, gold: 3, ai: 'melee', aggro: 300, kbRes: 0, h: 30,
    atk: { range: 30, windup: 0.32, recover: 0.5, cd: 1.0, shape: 'cone', arc: 1.6, reach: 44, off: 0 },
  },
  goblinArcher: {
    kind: 'goblinArcher', name: 'Гоблин-лучник', hp: 22, dmg: 8, speed: 105, r: 11, xp: 8, gold: 4, ai: 'ranged', aggro: 340, kbRes: 0, h: 30,
    rng: { min: 150, max: 260, windup: 0.45, cd: 1.8, proj: 'arrow', speed: 330, count: 1, spread: 0.06 },
  },
  spider: { kind: 'spider', name: 'Паук', hp: 24, dmg: 7, speed: 150, r: 11, xp: 7, gold: 2, ai: 'lunge', aggro: 320, kbRes: 0, h: 20, poison: true,
    atk: { range: 105, windup: 0.35, recover: 0.7, cd: 1.4, shape: 'cone', arc: 1.2, reach: 30, off: 0 } },
  webSpider: {
    kind: 'webSpider', name: 'Паук-плеватель', hp: 55, dmg: 9, speed: 100, r: 16, xp: 14, gold: 6, ai: 'ranged', aggro: 340, kbRes: 0.2, h: 30, poison: true,
    rng: { min: 170, max: 270, windup: 0.5, cd: 2.4, proj: 'web', speed: 260, count: 1, spread: 0.04 },
  },
  skeleton: {
    kind: 'skeleton', name: 'Скелет', hp: 45, dmg: 11, speed: 95, r: 13, xp: 9, gold: 4, ai: 'melee', undead: true, aggro: 300, kbRes: 0.1, h: 38,
    atk: { range: 36, windup: 0.45, recover: 0.6, cd: 1.3, shape: 'cone', arc: 1.7, reach: 50, off: 0 },
  },
  skelArcher: {
    kind: 'skelArcher', name: 'Скелет-лучник', hp: 34, dmg: 10, speed: 95, r: 13, xp: 11, gold: 5, ai: 'ranged', undead: true, aggro: 340, kbRes: 0.1, h: 38,
    rng: { min: 170, max: 280, windup: 0.5, cd: 2.0, proj: 'arrow', speed: 340, count: 1, spread: 0.05 },
  },
  necro: {
    kind: 'necro', name: 'Некромант', hp: 70, dmg: 14, speed: 90, r: 13, xp: 28, gold: 12, ai: 'ranged', undead: true, aggro: 360, kbRes: 0.2, h: 44, special: 'necro',
    rng: { min: 200, max: 300, windup: 0.55, cd: 2.2, proj: 'bolt', speed: 260, count: 1, spread: 0.03 },
  },
  orc: {
    kind: 'orc', name: 'Орк', hp: 130, dmg: 20, speed: 108, r: 17, xp: 22, gold: 10, ai: 'melee', aggro: 300, kbRes: 0.4, h: 48,
    atk: { range: 44, windup: 0.55, recover: 0.7, cd: 1.4, shape: 'cone', arc: 1.9, reach: 64, off: 0 },
  },
  shaman: {
    kind: 'shaman', name: 'Орк-шаман', hp: 80, dmg: 16, speed: 95, r: 15, xp: 26, gold: 12, ai: 'ranged', aggro: 360, kbRes: 0.3, h: 46, special: 'shaman',
    rng: { min: 190, max: 290, windup: 0.6, cd: 2.3, proj: 'fire', speed: 240, count: 1, spread: 0.03 },
  },
  ogre: {
    kind: 'ogre', name: 'Огр', hp: 380, dmg: 34, speed: 80, r: 25, xp: 70, gold: 35, ai: 'melee', aggro: 300, kbRes: 0.85, h: 72,
    atk: { range: 62, windup: 0.9, recover: 1.1, cd: 2.0, shape: 'circle', arc: 0, reach: 92, off: 48 },
  },
  wraith: {
    kind: 'wraith', name: 'Призрак', hp: 60, dmg: 15, speed: 115, r: 13, xp: 30, gold: 14, ai: 'ranged', undead: true, flying: true, aggro: 380, kbRes: 0.2, h: 44,
    rng: { min: 180, max: 280, windup: 0.5, cd: 2.6, proj: 'shadow', speed: 250, count: 3, spread: 0.35 },
  },
  mimic: { kind: 'mimic', name: 'Мимик', hp: 150, dmg: 18, speed: 150, r: 16, xp: 40, gold: 50, ai: 'lunge', aggro: 400, kbRes: 0.3, h: 30,
    atk: { range: 80, windup: 0.3, recover: 0.6, cd: 1.2, shape: 'cone', arc: 1.5, reach: 40, off: 0 } },
  boss: { kind: 'boss', name: 'Малгрот, Костяной Король', hp: 4200, dmg: 36, speed: 80, r: 34, xp: 600, gold: 400, ai: 'boss', undead: true, aggro: 0, kbRes: 1, h: 120 },
};

export function xpNeed(level: number): number {
  return Math.round(40 + 18 * level + 6 * level * level);
}

export interface ShrineInfo { name: string; desc: string; color: string }
export const SHRINES: Record<string, ShrineInfo> = {
  blood: { name: 'Алтарь крови', desc: 'Пожертвовать 25% здоровья ради артефакта', color: '#ff3355' },
  power: { name: 'Алтарь силы', desc: '+30% урона и +20% скорости атаки на 90 сек', color: '#ff9a2e' },
  life: { name: 'Источник жизни', desc: 'Полностью исцеляет и пополняет зелья', color: '#5dff9a' },
  fortune: { name: 'Алтарь удачи', desc: 'Ставка 80 золота — рискни и сорви куш', color: '#ffd84a' },
  curse: { name: 'Проклятый алтарь', desc: 'Призывает орду. Награда — эпический артефакт', color: '#b050ff' },
};

export const ROOM_NAMES: Record<string, string> = {
  camp: 'Лагерь странников', boss: 'Тронный зал', crypt: 'Склеп', nest: 'Паучье гнездо', orc: 'Стоянка орков',
  ogre: 'Логово огра', goblin: 'Гоблинская нора', haunted: 'Проклятый зал', treasure: 'Сокровищница',
  shrine: 'Святилище', storage: 'Кладовая', vault: 'Хранилище', corridor: 'Коридор', seal: 'Обитель печати',
};
