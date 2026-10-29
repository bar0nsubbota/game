import {
  ARTIFACTS, ATTRS, ENEMIES, MAP_H, MAP_W, MAX_POTIONS, RARITY, ROOM_NAMES, SHRINES, SKILLS, TS, WEAPONS, fmtStat, xpNeed,
  type ArtifactInst, type AttrKey, type EnemyKind, type ProjKind, type Rarity, type WeaponDef,
} from './data';
import type {
  Critter, Decal, Enemy, Fx, Ghost, HudState, Part, Pickup, PlayerState, Prop, PropKind, Proj, RunSummary, Stats, TextPop, Zone,
} from './types';
import { buildWorld, type MapData, type World } from './world';
import { sfx } from './audio';
import type { Meta } from './meta';
import { renderGame } from './render';

export interface GameCallbacks {
  onHud: (s: HudState) => void;
  onToast: (text: string, color?: string, icon?: string) => void;
  onBanner: (title: string, sub?: string, color?: string) => void;
  onShop: () => void;
  onLevelUp: () => void;
  onDeath: (s: RunSummary) => void;
  onVictory: (s: RunSummary) => void;
}

const PR = 10; // footprint игрока
const PROJ_COL: Record<string, string> = { arrow: '#d8c090', bolt: '#7dff8a', web: '#e8e8f0', fire: '#ff9a2e', shadow: '#b57cff', bone: '#e6dfc8' };
const rand = Math.random;
const rr = (a: number, b: number) => a + rand() * (b - a);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const PROP_DEF: Record<PropKind, { r: number; hp: number; solid: boolean; light?: number; col?: string }> = {
  barrel: { r: 13, hp: 14, solid: true }, crate: { r: 13, hp: 16, solid: true }, bomb: { r: 13, hp: 10, solid: true },
  chest: { r: 17, hp: 0, solid: true }, ironchest: { r: 17, hp: 0, solid: true }, vault: { r: 18, hp: 0, solid: true },
  mimic: { r: 17, hp: 0, solid: true },
  shrine: { r: 20, hp: 0, solid: true, light: 150, col: '#9a8aff' },
  sarcophagus: { r: 24, hp: 70, solid: true },
  brazier: { r: 10, hp: 0, solid: true, light: 210, col: '#ff9a3a' },
  campfire: { r: 14, hp: 0, solid: true, light: 280, col: '#ff8a2a' },
  orcfire: { r: 14, hp: 0, solid: true, light: 230, col: '#ff5a2a' },
  merchant: { r: 14, hp: 0, solid: true, light: 120, col: '#ffcf66' },
  spikes: { r: 14, hp: 0, solid: false }, web: { r: 20, hp: 6, solid: false }, bones: { r: 10, hp: 0, solid: false },
  candles: { r: 6, hp: 0, solid: false, light: 90, col: '#ffb84a' },
  cocoon: { r: 10, hp: 12, solid: true },
};

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cb: GameCallbacks;
  meta: Meta;
  W = 800; H = 600; dpr = 1; zoom = 1;
  world: World;
  map: MapData;
  p: PlayerState;
  s: Stats = { dmg: 14, atkSpd: 2.4, maxHp: 100, moveSpd: 215, crit: 0.05, critDmg: 1.6, life: 0, dodge: 0, cdr: 0, regen: 0, gold: 0, xp: 0, magnet: 90, armor: 0 };
  enemies: Enemy[] = [];
  byId = new Map<number, Enemy>();
  props: Prop[] = [];
  grid = new Map<number, Prop[]>();
  pickups: Pickup[] = [];
  projs: Proj[] = [];
  zones: Zone[] = [];
  fx: Fx[] = [];
  parts: Part[] = [];
  texts: TextPop[] = [];
  critters: Critter[] = [];
  ghosts: Ghost[] = [];
  stains: Decal[] = [];
  cam = { x: 0, y: 0, shake: 0 };
  input = { mx: 0, my: 0, atkM: false, atkK: false, atkT: false, atkQueue: false, queueT: 0, mode: 'mouse' as 'mouse' | 'touch', mouseX: 0, mouseY: 0 };
  keys = new Set<string>();
  time = 0; kills = 0; goldEarned = 0;
  paused = false; over = false; victoryT = -1; bossDone = false;
  idc = 1; hitstop = 0;
  flow = new Int16Array(MAP_W * MAP_H);
  flowT = 0; flowTx = -1; flowTy = -1;
  hudT = 0;
  explored = new Uint8Array(MAP_W * MAP_H);
  mm: HTMLCanvasElement;
  mmOutline: HTMLCanvasElement;
  mmCtx: CanvasRenderingContext2D;
  mmData: ImageData;
  mmDirty = true; exploreT = 0;
  showMap = false;
  boss: Enemy | null = null;
  bossActive = false;
  sealsMask = 0;
  lockHintT = -100;
  get sealsCollected() {
    return this.world.guardians.reduce((n, g) => n + Number((this.sealsMask & (1 << (g.id - 1))) !== 0), 0);
  }
  prompt: string | null = null;
  promptKind: string | null = null;
  interactProp: Prop | null = null;
  lastInteract = 0;
  roomName = '';
  motes: { x: number; y: number; z: number }[] = [];
  raf = 0; last = 0;
  tmp: Prop[] = [];
  lowFx = false;

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks, meta: Meta, seed: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.meta = meta;
    this.world = buildWorld(seed);
    this.map = this.world.map;
    const m = meta.up;
    this.p = {
      x: this.world.start.x, y: this.world.start.y, kx: 0, ky: 0, face: 1, lastDir: 0,
      hp: 100, level: 1, xp: 0, gold: m.gold * 40, keys: 0, potions: 2 + m.potion, points: 0,
      attrs: { dmg: 0, atk: 0, hp: 0, move: 0, crit: 0, cdr: 0 },
      artifacts: [], owned: ['rusty'], weapon: 'rusty', wLevels: {},
      atkCd: 0, combo: 0, swing: 0, swingDur: 0.25, swingSide: 1, swingAim: 0,
      dashT: 0, dashCd: 0, dashDir: 0, ghostT: 0, iframes: 0, potionCd: 0, skillCd: [0, 0, 0],
      whirlT: 0, whirlTick: 0, danceT: 0, danceFx: 0, critCharges: 0, power: 0, poisonT: 0, slowT: 0,
      anim: 0, moving: false, hurt: 0, stepT: 0, casting: 0, fade: 1,
    };
    this.recalc();
    this.p.hp = this.s.maxHp;
    for (const d of this.world.decals) this.stains.push(d);
    for (const sp of this.world.props) this.addProp(sp.kind, sp.x, sp.y, sp.sub, sp.diff);
    for (const se of this.world.enemies) this.spawnEnemy(se.kind, se.x, se.y, se.room, { diff: se.diff, seal: se.seal });
    for (const r of this.world.rats) this.critters.push({ x: r.x, y: r.y, vx: 0, vy: 0, t: rand() * 5, face: 1, flee: 0 });
    for (let i = 0; i < 36; i++) this.motes.push({ x: rand(), y: rand(), z: rand() });
    this.mm = document.createElement('canvas');
    this.mm.width = MAP_W; this.mm.height = MAP_H;
    this.mmCtx = this.mm.getContext('2d')!;
    this.mmData = this.mmCtx.createImageData(MAP_W, MAP_H);
    this.mmOutline = document.createElement('canvas');
    this.mmOutline.width = MAP_W; this.mmOutline.height = MAP_H;
    const outlineCtx = this.mmOutline.getContext('2d')!;
    const outline = outlineCtx.createImageData(MAP_W, MAP_H);
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      const k = this.map.kind[i], o = i * 4;
      if (k === 1) {
        outline.data[o] = 76; outline.data[o + 1] = 65; outline.data[o + 2] = 94;
        outline.data[o + 3] = this.map.roomAt[i] >= 0 ? 155 : 190;
      } else if (k === 2 || k === 3) {
        outline.data[o] = 37; outline.data[o + 1] = 32; outline.data[o + 2] = 47; outline.data[o + 3] = 105;
      }
    }
    outlineCtx.putImageData(outline, 0, 0);
    this.cam.x = this.p.x; this.cam.y = this.p.y;
    this.exploreAround();
    this.resize();
  }

  // ------------------------------------------------------------ жизненный цикл
  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.noCtx);
    window.addEventListener('resize', this.resize);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.noCtx);
    window.removeEventListener('resize', this.resize);
  }
  noCtx = (e: Event) => e.preventDefault();
  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.75 : 2);
    this.W = w; this.H = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.zoom = Math.max(0.85, Math.min(1.5, Math.min(w, h) / 560));
  };
  frame = (ts: number) => {
    const raw = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    if (!this.paused && !this.over) this.update(raw);
    else if (this.over) { this.updateFx(raw); this.updateCam(raw); }
    this.hudT += raw;
    if (this.hudT > 0.05) { this.hudT = 0; this.emitHud(); }
    renderGame(this, ts / 1000);
    this.raf = requestAnimationFrame(this.frame);
  };

  // ------------------------------------------------------------ ввод
  onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    this.input.mode = this.input.mode === 'touch' ? 'touch' : 'mouse';
    if (k === 'KeyJ' || k === 'KeyK') this.input.atkK = true;
    if (this.paused || this.over) return;
    if (k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') this.dash();
    else if (k >= 'Digit1' && k <= 'Digit3') this.useSkill(+k.slice(5) - 1);
    else if (k === 'KeyQ') this.usePotion();
    else if (k === 'KeyE' || k === 'Enter') this.interact();
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'KeyJ' || e.code === 'KeyK') this.input.atkK = this.keys.has('KeyJ') || this.keys.has('KeyK');
  };
  onBlur = () => { this.keys.clear(); this.input.atkK = false; this.input.atkM = false; };
  onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.input.mode = 'mouse';
    this.setMouse(e);
    if (e.button === 0) this.input.atkM = true;
    else if (e.button === 2 && !this.paused) this.dash();
  };
  onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.input.mode = 'mouse';
    this.setMouse(e);
  };
  onPointerUp = (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) this.input.atkM = false; };
  setMouse(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.input.mouseX = e.clientX - r.left; this.input.mouseY = e.clientY - r.top;
  }
  // сенсорное управление
  setMove(x: number, y: number) { this.input.mx = x; this.input.my = y; this.input.mode = 'touch'; }
  setAttackTouch(b: boolean) {
    if (b && !this.input.atkT) { this.input.atkQueue = true; this.input.queueT = this.time; }
    this.input.atkT = b; this.input.mode = 'touch';
  }
  trigger(name: 'dash' | 'potion' | 'interact' | 'skill0' | 'skill1' | 'skill2') {
    if (this.paused || this.over) return;
    if (name === 'dash') this.dash();
    else if (name === 'potion') this.usePotion();
    else if (name === 'interact') this.interact();
    else this.useSkill(+name.slice(5));
  }
  mouseWorld() {
    return { x: this.cam.x + (this.input.mouseX - this.W / 2) / this.zoom, y: this.cam.y + (this.input.mouseY - this.H / 2) / this.zoom };
  }
  getAim(): number {
    const p = this.p;
    if (this.input.mode === 'mouse') {
      const m = this.mouseWorld();
      return Math.atan2(m.y - p.y, m.x - p.x);
    }
    const t = this.nearestEnemy(p.x, p.y, 320);
    if (t) return Math.atan2(t.y - p.y, t.x - p.x);
    return p.lastDir;
  }
  enemyNear(x: number, y: number, range: number): boolean {
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (e.state === 'idle' && !e.boss) continue;
      if (Math.hypot(e.x - x, e.y - y) < range + e.r) return true;
    }
    return false;
  }
  nearestEnemy(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ------------------------------------------------------------ характеристики
  weapon(): WeaponDef { return WEAPONS.find((w) => w.id === this.p.weapon) || WEAPONS[0]; }
  recalc() {
    const p = this.p, a = p.attrs, w = this.weapon(), wl = p.wLevels[w.id] || 0;
    let dmg = 0.12 * a.dmg + this.meta.up.dmg * 0.04, atk = 0.09 * a.atk, hp = 100 + 16 * a.hp + 12 * this.meta.up.hp;
    let mv = 0.05 * a.move, crit = 0.05 + 0.03 * a.crit, critDmg = 1.6, life = 0, dodge = w.effect === 'shadow' ? 0.1 : 0;
    let cdr = 0.04 * a.cdr, regen = 0, gold = 0, xp = 0, magnet = 90, armor = 0;
    for (const r of p.artifacts) {
      const v = r.value;
      switch (r.stat) {
        case 'dmg': dmg += v; break; case 'atk': atk += v; break; case 'hp': hp += v; break; case 'move': mv += v; break;
        case 'crit': crit += v; break; case 'critDmg': critDmg += v; break; case 'life': life += v; break; case 'dodge': dodge += v; break;
        case 'cdr': cdr += v; break; case 'regen': regen += v; break; case 'gold': gold += v; break; case 'xp': xp += v; break;
        case 'magnet': magnet += v; break; case 'armor': armor += v; break;
      }
    }
    if (p.power > 0) { dmg += 0.3; atk += 0.2; }
    if (p.danceT > 0) { atk += 0.6; mv += 0.25; life += 0.06; }
    const s = this.s, old = s.maxHp;
    s.dmg = 14 * (1 + dmg) * w.dmg * (1 + 0.12 * wl);
    s.atkSpd = Math.min(9, 2.4 * (1 + atk) * w.spd);
    s.maxHp = hp;
    s.moveSpd = Math.min(430, 215 * (1 + mv));
    s.crit = Math.min(0.9, crit); s.critDmg = critDmg; s.life = life; s.dodge = Math.min(0.6, dodge);
    s.cdr = Math.min(0.5, cdr); s.regen = regen; s.gold = gold; s.xp = xp; s.magnet = magnet; s.armor = Math.min(0.6, armor);
    if (s.maxHp > old && old > 0) p.hp += s.maxHp - old;
    p.hp = Math.min(p.hp, s.maxHp);
  }

  // ------------------------------------------------------------ спавн
  addProp(kind: PropKind, x: number, y: number, sub: string, diff: number): Prop {
    const d = PROP_DEF[kind];
    const pr: Prop = {
      id: this.idc++, kind, x, y, r: d.r, hp: d.hp, solid: d.solid, state: 0, t: 0, hit: 0, seed: rand() * 100, sub, diff,
      light: d.light || 0, lightCol: d.col || '#ffffff', dead: false,
    };
    if (kind === 'brazier') pr.lightCol = sub === 'blue' ? '#4aa0ff' : sub === 'red' ? '#ff3a3a' : '#ff9a3a';
    if (kind === 'shrine') pr.lightCol = SHRINES[sub]?.color || '#9a8aff';
    this.props.push(pr);
    const k = this.gk(x, y);
    const arr = this.grid.get(k);
    if (arr) arr.push(pr); else this.grid.set(k, [pr]);
    return pr;
  }
  gk(x: number, y: number) { return Math.floor(y / 96) * 1000 + Math.floor(x / 96); }
  propsNear(x: number, y: number): Prop[] {
    const out = this.tmp; out.length = 0;
    const cx = Math.floor(x / 96), cy = Math.floor(y / 96);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = this.grid.get((cy + j) * 1000 + cx + i);
      if (a) for (const p of a) if (!p.dead) out.push(p);
    }
    return out;
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number, room: number, o: { diff?: number; minion?: boolean; owner?: number; rise?: boolean; chase?: boolean; shrine?: number; seal?: number } = {}): Enemy {
    const def = ENEMIES[kind];
    const isBoss = kind === 'boss';
    const diff = o.diff ?? (room >= 0 ? this.map.rooms[room].diff : 0.5);
    const hpS = isBoss ? 1 : 1 + diff * 1.3, dmgS = isBoss ? 1 : 1 + diff * 0.8;
    let elite: Enemy['elite'] = '';
    if (!isBoss && !o.minion && !o.seal && kind !== 'mimic' && diff > 0.08 && def.hp >= 22 && rand() < 0.06 + diff * 0.07) {
      elite = (['fast', 'armored', 'explosive'] as const)[Math.floor(rand() * 3)];
    }
    const el = elite !== '';
    const guardianHp = o.seal ? (kind === 'ogre' ? 1.7 : kind === 'orc' ? 2.2 : 3.1) : 1;
    const hp = def.hp * hpS * (el ? 2.6 : 1) * guardianHp * (o.minion ? 0.7 : 1);
    const sc = o.seal ? 1.3 : el ? 1.22 : 1;
    const e: Enemy = {
      id: this.idc++, kind, def, name: o.seal ? `Хранитель печати ${o.seal}` : el ? def.name + ' (элита)' : def.name,
      x, y, kx: 0, ky: 0, hp, maxHp: hp, dmg: def.dmg * dmgS * (el ? 1.35 : o.seal ? 1.13 : 1), speed: def.speed * (elite === 'fast' ? 1.35 : 1),
      r: def.r * sc, sc, elite, state: o.chase ? 'chase' : 'idle', t: 0, cd: rr(0.2, 1), face: rand() < 0.5 ? 1 : -1, aim: 0, hx: x, hy: y,
      los: false, losT: rand() * 0.2, flash: 0, anim: rand() * 10, mv: 0, wind: 0, swing: 0,
      st: { poison: 0, poisonT: 0, bleed: 0, bleedT: 0, burnT: 0, chill: 0, chillT: 0, freezeT: 0 },
      dotT: 0, dotAcc: 0, dotCol: '#fff', ownerId: o.owner || 0, minion: !!o.minion, boss: isBoss, phase: 1,
      act: 0, a: 0, b: rr(2, 8), c: 0, strafe: rand() < 0.5 ? 1 : -1, dead: false, room, diff,
      spawnT: o.rise ? 1 : 0, invuln: 0, shrine: o.shrine || 0, seal: o.seal || 0,
    };
    if (isBoss) this.boss = e;
    this.enemies.push(e);
    this.byId.set(e.id, e);
    return e;
  }

  // ------------------------------------------------------------ основной цикл
  update(rawDt: number) {
    let dt = rawDt;
    if (this.hitstop > 0) { this.hitstop -= rawDt; dt *= 0.06; }
    this.time += dt;
    this.updatePlayer(dt);
    this.updateFlow(dt);
    this.updateEnemies(dt);
    this.updateProjs(dt);
    this.updateZones(dt);
    this.updateProps(dt);
    this.updatePickups(dt);
    this.updateCritters(dt);
    this.updateFx(dt);
    this.updateCam(dt);
    this.exploreT -= dt;
    if (this.exploreT <= 0) { this.exploreT = 0.2; this.exploreAround(); }
    this.findInteract();
    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0) this.cb.onVictory(this.summary());
    }
  }

  // ------------------------------------------------------------ игрок
  updatePlayer(dt: number) {
    const p = this.p, s = this.s;
    p.anim += dt;
    p.atkCd -= dt; p.iframes -= dt; p.dashCd -= dt; p.potionCd -= dt; p.hurt = Math.max(0, p.hurt - dt);
    for (let i = 0; i < p.skillCd.length; i++) p.skillCd[i] -= dt;
    if (p.swing > 0) p.swing -= dt / p.swingDur;
    if (p.power > 0) { p.power -= dt; if (p.power <= 0) { p.power = 0; this.recalc(); } }
    if (p.danceT > 0) {
      p.danceT -= dt; p.danceFx -= dt;
      if (p.danceFx <= 0) { p.danceFx = 0.05; this.ghosts.push({ x: p.x, y: p.y, face: p.face, t: 0.3, col: '#ff3a6a' }); }
      if (p.danceT <= 0) { p.danceT = 0; this.recalc(); }
    }
    // регенерация
    if (s.regen > 0 && p.hp < s.maxHp) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
    if (p.poisonT > 0) { p.poisonT -= dt; p.hp = Math.max(1, p.hp - 3.5 * dt); if (rand() < 0.15) this.burst(p.x, p.y - 14, 1, '#7dff4a', 25, 0.6, 2.4); }
    if (p.slowT > 0) p.slowT -= dt;
    // ввод движения
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (mx === 0 && my === 0) { mx = this.input.mx; my = this.input.my; }
    let ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
    let slow = 1;
    if (p.whirlT > 0) slow *= 0.65;
    if (p.slowT > 0) slow *= 0.55;
    for (const pr of this.propsNear(p.x, p.y)) if (pr.kind === 'web' && Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 6) { slow *= 0.5; break; }
    p.moving = ml > 0.1 && p.dashT <= 0;
    if (p.dashT > 0) {
      p.dashT -= dt;
      const sp = 800;
      this.moveBody(p, Math.cos(p.dashDir) * sp * dt, Math.sin(p.dashDir) * sp * dt, PR);
      p.ghostT -= dt;
      if (p.ghostT <= 0) { p.ghostT = 0.028; this.ghosts.push({ x: p.x, y: p.y, face: p.face, t: 0.26, col: '#9a5cff' }); }
      p.iframes = Math.max(p.iframes, 0.05);
    } else if (ml > 0.05) {
      const sp = s.moveSpd * slow * ml;
      this.moveBody(p, (mx / ml) * sp * dt, (my / ml) * sp * dt, PR);
      p.lastDir = Math.atan2(my, mx);
      if (Math.abs(mx) > 0.15) p.face = mx > 0 ? 1 : -1;
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = 0.28; this.part(p.x, p.y, rr(-12, 12), rr(-8, 0), 0.4, 2, 'rgba(140,130,150,0.5)', 0, 0, 0.1); }
    }
    // импульс (отдача от атаки)
    if (p.kx || p.ky) {
      this.moveBody(p, p.kx * dt, p.ky * dt, PR);
      const f = Math.pow(0.0003, dt); p.kx *= f; p.ky *= f;
      if (Math.abs(p.kx) + Math.abs(p.ky) < 6) p.kx = p.ky = 0;
    }
    // атака
    const queueFresh = this.input.atkQueue && this.time - this.input.queueT < 0.4;
    const wantAtk = this.input.atkM || this.input.atkK || this.input.atkT || queueFresh;
    if (wantAtk && p.atkCd <= 0 && p.dashT <= 0) { this.playerAttack(); this.input.atkQueue = false; }
    else if (wantAtk && p.swing <= 0 && this.input.mode === 'touch') { /* автоповорот */ const a = this.getAim(); if (this.nearestEnemy(p.x, p.y, 250)) p.face = Math.cos(a) >= 0 ? 1 : -1; }
    // вихрь
    if (p.whirlT > 0) {
      p.whirlT -= dt; p.whirlTick -= dt;
      if (p.whirlTick <= 0) { p.whirlTick = 0.13; this.whirlHit(); }
    }
  }

  rollHit(mult: number, forceCrit = false) {
    const s = this.s;
    let v = s.dmg * mult * rr(0.9, 1.1);
    const crit = forceCrit || rand() < s.crit;
    if (crit) v *= s.critDmg;
    return { v, crit };
  }

  playerAttack() {
    const p = this.p, s = this.s, w = this.weapon();
    const aim = this.getAim();
    p.atkCd = 1 / s.atkSpd;
    p.combo = (p.combo + 1) % 3;
    const fin = p.combo === 2;
    p.swing = 1; p.swingDur = Math.min(0.3, 0.85 / s.atkSpd); p.swingSide = (p.swingSide === 1 ? -1 : 1) as 1 | -1; p.swingAim = aim;
    p.face = Math.cos(aim) >= 0 ? 1 : -1;
    p.kx += Math.cos(aim) * 150; p.ky += Math.sin(aim) * 150;
    const range = w.range * (fin ? 1.2 : 1), arc = w.arc * (fin ? 1.2 : 1);
    const force = p.critCharges > 0;
    if (force) p.critCharges--;
    this.fx.push({ kind: 'slash', x: p.x, y: p.y - 10, x2: 0, y2: 0, a: aim, r: range, arc, side: p.swingSide, t: 0, dur: 0.2, col: w.c.trail, big: fin });
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > range + e.r) continue;
      if (d > e.r + 14) {
        const da = Math.abs(wrapA(Math.atan2(dy, dx) - aim));
        if (da > arc / 2 + Math.atan2(e.r, d)) continue;
      }
      const h = this.rollHit(fin ? 1.5 : 1, force);
      this.hitEnemy(e, h.v, { crit: h.crit, ang: Math.atan2(dy, dx), kb: fin ? 300 : 190, proc: true });
      hits++;
    }
    for (const pr of this.props) {
      if (pr.dead || pr.hp <= 0) continue;
      const dx = pr.x - p.x, dy = pr.y - p.y, d = Math.hypot(dx, dy);
      if (d > range + pr.r) continue;
      if (d > pr.r + 10 && Math.abs(wrapA(Math.atan2(dy, dx) - aim)) > arc / 2 + 0.4) continue;
      this.damageProp(pr, s.dmg * 1.2);
    }
    if (p.danceT > 0) {
      const sp = 440;
      this.projs.push({ x: p.x, y: p.y, vx: Math.cos(aim) * sp, vy: Math.sin(aim) * sp, r: 16, dmg: s.dmg * 0.6, life: 0.55, from: 'p', kind: 'wave', pierce: 99, hit: [], col: '#ff4d7a', effect: 'none', crit: false, poison: false, slow: false, dead: false, src: 0 });
    }
    if (hits > 0) { this.shake(fin ? 5 : 2.5); if (fin) this.hitstop = Math.max(this.hitstop, 0.04); } else sfx.slash();
  }

  // ------------------------------------------------------------ навыки
  dash() {
    const p = this.p;
    if (p.dashCd > 0 || p.dashT > 0) return;
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (!mx && !my) { mx = this.input.mx; my = this.input.my; }
    p.dashDir = Math.hypot(mx, my) > 0.1 ? Math.atan2(my, mx) : (this.input.mode === 'mouse' ? this.getAim() : p.lastDir);
    if (Math.cos(p.dashDir) !== 0) p.face = Math.cos(p.dashDir) >= 0 ? 1 : -1;
    p.dashT = 0.17; p.dashCd = 1.0 * (1 - this.s.cdr * 0.5);
    p.iframes = Math.max(p.iframes, 0.28);
    sfx.dash();
    this.burst(p.x, p.y, 8, 'rgba(160,150,180,0.6)', 70, 0.5, 4);
  }

  useSkill(i: number) {
    const p = this.p, s = this.s, w = this.weapon();
    const sk = SKILLS[i];
    if (!sk) return;
    if (p.level < sk.unlock) { this.cb.onToast(`«${sk.name}» откроется на ${sk.unlock} уровне`, '#9a9ab0'); return; }
    if (p.skillCd[i] > 0 || p.dashT > 0) return;
    const cd = sk.cd * (1 - s.cdr);
    sfx.skill(i);
    if (i === 0) {
      p.skillCd[0] = cd; p.whirlT = 0.7; p.whirlTick = 0;
      this.ring(p.x, p.y, 115, w.c.trail, 0.5);
    } else if (i === 1) {
      p.skillCd[1] = cd;
      const t = this.nearestEnemy(p.x, p.y, 380);
      let tx: number, ty: number;
      if (t) { const a = Math.atan2(t.y - p.y, t.x - p.x); tx = t.x + Math.cos(a) * (t.r + 18); ty = t.y + Math.sin(a) * (t.r + 18); }
      else { const a = this.getAim(); tx = p.x + Math.cos(a) * 230; ty = p.y + Math.sin(a) * 230; }
      let nx = p.x, ny = p.y;
      for (let k = 0; k <= 12; k++) {
        const px = tx + (p.x - tx) * (k / 12), py = ty + (p.y - ty) * (k / 12);
        if (!this.blockedBox(px, py, PR)) { nx = px; ny = py; break; }
      }
      this.fx.push({ kind: 'beam', x: p.x, y: p.y - 12, x2: nx, y2: ny - 12, a: 0, r: 0, arc: 0, side: 1, t: 0, dur: 0.35, col: '#b57cff', big: false });
      this.burst(p.x, p.y - 10, 18, '#7a4cc0', 120, 0.6, 5);
      p.x = nx; p.y = ny;
      this.burst(p.x, p.y - 10, 22, '#b57cff', 160, 0.6, 5);
      p.iframes = Math.max(p.iframes, 0.9); p.critCharges = 3;
      this.ring(p.x, p.y, 100, '#b57cff', 0.4);
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < 100 + e.r) { const h = this.rollHit(2.4, true); this.hitEnemy(e, h.v, { crit: true, ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 260, proc: true }); }
      }
      this.shake(8);
    } else {
      p.skillCd[2] = cd; p.danceT = 7; this.recalc();
      this.ring(p.x, p.y, 160, '#ff3a6a', 0.7);
      this.burst(p.x, p.y - 14, 30, '#ff3a6a', 200, 0.8, 5);
      this.shake(9);
      this.cb.onBanner('ТАНЕЦ СМЕРТИ', '', '#ff3a6a');
    }
  }

  whirlHit() {
    const p = this.p, s = this.s, w = this.weapon();
    const R = 112;
    this.ring(p.x, p.y, R, w.c.trail, 0.25);
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < R + e.r) { const h = this.rollHit(0.8); this.hitEnemy(e, h.v, { crit: h.crit, ang: Math.atan2(e.y - p.y, e.x - p.x), kb: 230, proc: true }); }
    }
    for (const pr of this.props) if (!pr.dead && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < R + pr.r) this.damageProp(pr, s.dmg);
    for (const pj of this.projs) if (pj.from === 'e' && Math.hypot(pj.x - p.x, pj.y - p.y) < R + 20) { pj.dead = true; this.burst(pj.x, pj.y - 12, 5, pj.col, 80, 0.3, 2); }
    this.shake(3);
  }

  usePotion() {
    const p = this.p, s = this.s;
    if (p.potions <= 0) { this.cb.onToast('Нет зелий здоровья', '#ff6a6a'); sfx.error(); return; }
    if (p.hp >= s.maxHp || p.potionCd > 0) return;
    p.potions--; p.potionCd = 1.2;
    this.heal(s.maxHp * 0.45 + 20);
    sfx.potion();
    this.ring(p.x, p.y, 50, '#ff4a6a', 0.5);
    this.burst(p.x, p.y - 12, 16, '#ff6a8a', 70, 0.8, 3, -60);
  }

  heal(n: number) {
    const p = this.p;
    const before = p.hp;
    p.hp = Math.min(this.s.maxHp, p.hp + n);
    const d = Math.round(p.hp - before);
    if (d > 0) this.text(p.x, p.y - 44, '+' + d, '#6dff8a', 1);
  }

  hurtPlayer(dmg: number, sx: number, sy: number, o: { poison?: boolean; slow?: boolean } = {}): boolean {
    const p = this.p;
    if (this.over || p.iframes > 0 || p.dashT > 0) return false;
    if (rand() < this.s.dodge) { this.text(p.x, p.y - 44, 'Уклонение!', '#b7e8ff', 0.9); p.iframes = 0.25; return false; }
    const d = Math.max(1, Math.round(dmg * (1 - this.s.armor)));
    p.hp -= d; p.iframes = 0.5; p.hurt = 0.35;
    this.shake(7);
    this.text(p.x, p.y - 44, '-' + d, '#ff4a4a', 1.2);
    sfx.hurt();
    this.burst(p.x, p.y - 14, 8, '#b01028', 110, 0.5, 3, 200);
    const a = Math.atan2(p.y - sy, p.x - sx);
    p.kx += Math.cos(a) * 200; p.ky += Math.sin(a) * 200;
    if (o.poison) p.poisonT = 3.5;
    if (o.slow) p.slowT = 1.8;
    if (p.hp <= 0) this.die();
    return true;
  }

  die() {
    if (this.over) return;
    this.over = true;
    this.p.hp = 0;
    this.burst(this.p.x, this.p.y - 14, 40, '#b01028', 220, 1, 4, 200);
    sfx.kill();
    window.setTimeout(() => this.cb.onDeath(this.summary()), 1300);
  }

  summary(): RunSummary {
    const souls = Math.floor(this.kills * 1.2 + this.p.level * 15 + (this.bossDone ? 250 : 0) + this.sealsCollected * 30 + this.goldEarned / 20);
    return { kills: this.kills, level: this.p.level, time: this.time, gold: this.goldEarned, boss: this.bossDone, souls };
  }

  addXp(v: number) {
    const p = this.p;
    p.xp += v;
    let need = xpNeed(p.level);
    while (p.xp >= need) {
      p.xp -= need; p.level++; p.points += 2;
      this.p.hp = Math.min(this.s.maxHp, this.p.hp + this.s.maxHp * 0.3);
      sfx.levelup();
      this.fx.push({ kind: 'ring', x: p.x, y: p.y, x2: 0, y2: 0, a: 0, r: 88, arc: 0, side: 1, t: 0, dur: 0.55, col: '#ffd84a', big: false });
      this.burst(p.x, p.y - 14, 18, '#ffd84a', 150, 0.8, 2.6, -40);
      this.text(p.x, p.y - 56, `УРОВЕНЬ ${p.level}!`, '#ffd84a', 1.5);
      this.cb.onBanner(`Уровень ${p.level}`, '+2 очка характеристик', '#ffd84a');
      const un = SKILLS.find((s) => s.unlock === p.level);
      if (un) this.cb.onToast(`Новый навык: ${un.name} [${un.key}]`, '#b57cff', 'sparkles');
      this.cb.onLevelUp();
      need = xpNeed(p.level);
    }
  }

  spendPoint(k: AttrKey): boolean {
    const p = this.p;
    if (p.points <= 0) return false;
    p.points--; p.attrs[k]++;
    this.recalc(); sfx.ui(); this.emitHud();
    return true;
  }

  // ------------------------------------------------------------ артефакты и лут
  rollRarity(luck = 0, min: Rarity = 'common'): Rarity {
    const x = rand();
    const pl = 0.02 + luck * 0.06, pe = 0.09 + luck * 0.12, pr = 0.28 + luck * 0.15;
    let r: Rarity = x < pl ? 'legendary' : x < pl + pe ? 'epic' : x < pl + pe + pr ? 'rare' : 'common';
    const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
    if (order.indexOf(r) < order.indexOf(min)) r = min;
    return r;
  }
  makeArtifact(rarity: Rarity): ArtifactInst {
    const b = ARTIFACTS[Math.floor(rand() * ARTIFACTS.length)];
    const m = RARITY[rarity].mult;
    let v = b.base * m;
    if (b.stat === 'hp' || b.stat === 'magnet') v = Math.round(v);
    else if (b.stat === 'regen') v = Math.round(v * 10) / 10;
    else v = Math.round(v * 100) / 100;
    return { uid: this.idc++, baseId: b.id, name: b.name, icon: b.icon, rarity, stat: b.stat, value: v };
  }
  giveArtifact(a: ArtifactInst) {
    const p = this.p;
    p.artifacts.unshift(a);
    this.recalc();
    const rc = RARITY[a.rarity];
    this.cb.onToast(`${a.name} · ${rc.label}: ${fmtStat(a.stat, a.value)}`, rc.color, a.icon);
    this.text(p.x, p.y - 62, a.name, rc.color, 1.1);
    sfx.pickup();
    this.ring(p.x, p.y, 60, rc.color, 0.6);
    this.burst(p.x, p.y - 14, 16, rc.color, 120, 0.8, 3, -30);
  }
  pickup(kind: Pickup['kind'], x: number, y: number, value = 1, art?: ArtifactInst) {
    const a = rand() * Math.PI * 2, sp = rr(40, 130);
    this.pickups.push({ id: this.idc++, kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, z: 6, vz: rr(200, 330), value, art, t: 0, dead: false });
  }
  dropGold(x: number, y: number, total: number, maxN = 8) {
    total = Math.max(1, Math.round(total * (1 + this.s.gold)));
    const n = Math.max(1, Math.min(maxN, Math.round(total / 6)));
    let left = total;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.max(1, Math.round(total / n));
      left -= v;
      if (v > 0) this.pickup('gold', x, y, v);
    }
  }
  dropXp(x: number, y: number, total: number) {
    total = Math.max(1, Math.round(total * (1 + this.s.xp)));
    const n = total > 40 ? 3 : total > 12 ? 2 : 1;
    for (let i = 0; i < n; i++) this.pickup('xp', x, y, Math.max(1, Math.round(total / n)));
  }
  dropLoot(e: Enemy) {
    const d = e.def, el = e.elite !== '';
    if (e.minion) { this.dropXp(e.x, e.y, 2); return; }
    const gs = (1 + e.diff * 0.8) * (el ? 3 : 1);
    this.dropGold(e.x, e.y, d.gold * gs * rr(0.7, 1.3));
    this.dropXp(e.x, e.y, d.xp * (1 + e.diff * 0.8) * (el ? 3 : 1));
    if (rand() < 0.07 + (el ? 0.3 : 0) + (d.hp > 100 ? 0.08 : 0)) this.pickup('potion', e.x, e.y);
    if (rand() < 0.025 + (el ? 0.55 : 0) + (d.hp > 100 ? 0.07 : 0)) this.pickup('artifact', e.x, e.y, 1, this.makeArtifact(this.rollRarity(el ? 0.5 : 0.1)));
    if (rand() < (el ? 0.45 : 0.01)) this.pickup('key', e.x, e.y);
  }

  // ------------------------------------------------------------ урон врагам
  hitEnemy(e: Enemy, dmg: number, o: { crit?: boolean; ang?: number; kb?: number; proc?: boolean; col?: string } = {}) {
    if (e.dead || e.spawnT > 0) return;
    if (e.boss && this.sealsCollected < this.world.guardians.length) {
      if (this.time - this.lockHintT > 6) {
        this.lockHintT = this.time;
        this.cb.onToast(`Трон запечатан. Победите хранителей: ${this.sealsCollected}/${this.world.guardians.length}`, '#c794ff', 'gem');
        this.text(e.x, e.y - e.def.h, 'ТРОН ЗАПЕЧАТАН', '#d7a0ff', 1);
        sfx.error();
      }
      return;
    }
    if (e.invuln > 0) { this.text(e.x, e.y - e.def.h, 'Неуязвим', '#aaa', 0.8); return; }
    const w = this.weapon();
    let d = dmg;
    if (e.elite === 'armored') d *= 0.65;
    if (e.st.freezeT > 0) d *= 1.4;
    if (e.st.bleed > 0) d *= 1 + 0.08 * e.st.bleed;
    if (w.effect === 'holy' && e.def.undead) d *= 1.5;
    d = Math.max(1, Math.round(d));
    e.hp -= d; e.flash = 0.12;
    if (e.state === 'idle' && !e.boss) this.alertGroup(e);
    const kb = (o.kb || 0) * (1 - e.def.kbRes);
    if (kb > 0 && o.ang !== undefined && e.state !== 'windup') { e.kx += Math.cos(o.ang) * kb; e.ky += Math.sin(o.ang) * kb; }
    const crit = !!o.crit;
    this.text(e.x + rr(-6, 6), e.y - e.def.h * e.sc, String(d) + (crit ? '!' : ''), o.col || (crit ? '#ffd84a' : '#ffffff'), crit ? 1.35 : 1);
    this.burst(e.x, e.y - e.def.h * 0.5, crit ? 8 : 4, o.col || (crit ? '#ffe28a' : w.c.glow), 130, 0.35, 2.2);
    if (e.def.undead) this.burst(e.x, e.y - e.def.h * 0.5, 2, '#d9d1b8', 100, 0.5, 2, 200);
    else this.burst(e.x, e.y - e.def.h * 0.5, 3, e.def.kind === 'spider' || e.def.kind === 'webSpider' ? '#7a9a2a' : '#9a1424', 110, 0.5, 2.4, 260);
    if (crit) sfx.crit(); else sfx.hit();
    if (this.s.life > 0 && !o.col) this.heal(Math.max(0.5, d * this.s.life));
    if (o.proc) this.applyEffect(e, d);
    if (e.hp <= 0) this.killEnemy(e, o.ang);
  }

  applyEffect(e: Enemy, d: number) {
    const w = this.weapon(), st = e.st;
    switch (w.effect) {
      case 'poison': st.poison = Math.min(6, st.poison + 1); st.poisonT = 4.5; break;
      case 'bleed': st.bleed = Math.min(5, st.bleed + 1); st.bleedT = 5; break;
      case 'burn': st.burnT = 3.5; break;
      case 'freeze':
        st.chill = Math.min(4, st.chill + 1); st.chillT = 3.5;
        if (st.chill >= 4) {
          st.chill = 0; st.freezeT = 1.5;
          this.cancelZones(e);
          if (e.state === 'windup' || e.state === 'strike' || e.state === 'roar') { if (!e.boss) e.state = 'chase'; }
          e.wind = 0;
          this.text(e.x, e.y - e.def.h - 12, 'ЗАМОРОЖЕН', '#8fe8ff', 1);
          this.burst(e.x, e.y - e.def.h * 0.5, 14, '#bff4ff', 140, 0.6, 3);
        }
        break;
      case 'shadow':
        if (rand() < 0.28) {
          this.fx.push({ kind: 'slash', x: e.x, y: e.y - 14, x2: 0, y2: 0, a: rr(0, 6.28), r: 50, arc: 2.6, side: 1, t: 0, dur: 0.25, col: '#b57cff', big: true });
          this.burst(e.x, e.y - 14, 10, '#9a5cff', 130, 0.5, 3);
          this.hitEnemy(e, d * 0.9, { col: '#c89cff' });
          this.heal(2);
        }
        break;
      case 'holy':
        if (rand() < 0.18) this.zone({ kind: 'circle', x: e.x, y: e.y, r: 74, dur: 0.35, dmg: d * 1.6, from: 'p', col: '#ffe58a', style: 'holy' });
        break;
      default: break;
    }
  }

  cancelZones(e: Enemy) { for (const z of this.zones) if (z.src === e.id && !z.done) { z.done = true; z.dead = true; } }

  killEnemy(e: Enemy, ang?: number) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.cancelZones(e);
    this.dropLoot(e);
    const col = e.def.undead ? '#d9d1b8' : e.kind === 'spider' || e.kind === 'webSpider' ? '#7a9a2a' : '#9a1424';
    this.burst(e.x, e.y - e.def.h * 0.4, 14, col, 180, 0.7, 3.4, 260);
    this.burst(e.x, e.y - e.def.h * 0.4, 6, '#ffffff', 150, 0.3, 2);
    if (this.stains.length < 400) {
      const bones = e.def.undead;
      this.stains.push({ kind: bones ? 'bones' : e.kind === 'spider' || e.kind === 'webSpider' ? 'ichor' : 'blood', x: e.x, y: e.y, r: 16 + e.r, rot: rand() * 6, seed: Math.floor(rand() * 999), col: '' });
    }
    sfx.kill();
    this.shake(e.boss ? 14 : e.def.hp > 100 ? 6 : 2);
    this.hitstop = Math.max(this.hitstop, e.def.hp > 100 ? 0.09 : 0.03);
    if (ang !== undefined) { /* направление смерти */ }
    if (e.st.burnT > 0) {
      this.ring(e.x, e.y, 90, '#ff9a2e', 0.4);
      for (const o of this.enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 95) o.st.burnT = 3.5;
      this.burst(e.x, e.y - 10, 18, '#ff9a2e', 170, 0.6, 3.6, -80);
    }
    if (e.elite === 'explosive') this.zone({ kind: 'circle', x: e.x, y: e.y, r: 85, dur: 0.6, dmg: 26 * (1 + e.diff * 0.8), from: 'x', col: '#ff6a2a', style: 'boom' });
    if (this.weapon().effect === 'holy') this.heal(this.s.maxHp * 0.015 + 1);
    if (e.seal) this.claimSeal(e);
    if (e.boss) this.bossDefeated(e);
    if (e.shrine) { /* награда в updateProps */ }
  }

  claimSeal(e: Enemy) {
    const bit = 1 << (e.seal - 1);
    if (this.sealsMask & bit) return;
    this.sealsMask |= bit;
    const count = this.sealsCollected;
    const total = this.world.guardians.length;
    this.ring(e.x, e.y, 165, '#bb79ff', 0.8);
    this.burst(e.x, e.y - 28, 28, '#c995ff', 170, 0.9, 4, -40);
    this.pickup('artifact', e.x, e.y, 1, this.makeArtifact(this.rollRarity(0.45, 'rare')));
    this.dropGold(e.x, e.y, 45 + e.diff * 50, 8);
    this.heal(this.s.maxHp * 0.25);
    this.shake(11);
    sfx.shrine();
    if (count === total) {
      this.cb.onBanner('ТРОН ОТКРЫТ', 'Все печати сняты. Костяной Король ждёт вас.', '#d5a4ff');
    } else {
      this.cb.onBanner(`ПЕЧАТЬ ${count}/${total}`, 'Сила хранителя ваша. Ищите следующего на карте.', '#d5a4ff');
    }
  }

  bossDefeated(e: Enemy) {
    this.bossDone = true;
    this.bossActive = false;
    this.victoryT = 3.4;
    this.cb.onBanner('Малгрот повержен', 'Королевство теней пало', '#ffd84a');
    sfx.boom();
    this.shake(20);
    this.ring(e.x, e.y, 300, '#ffd84a', 1.2);
    for (const o of this.enemies) if (!o.dead && o.ownerId === e.id) { o.hp = 0; this.killEnemy(o); }
    this.dropGold(e.x, e.y, 400, 24);
    this.dropXp(e.x, e.y, 600);
    for (let i = 0; i < 3; i++) this.pickup('artifact', e.x, e.y, 1, this.makeArtifact(this.rollRarity(1, i === 0 ? 'legendary' : 'epic')));
    this.pickup('potion', e.x, e.y); this.pickup('potion', e.x, e.y);
  }

  alertGroup(e: Enemy) {
    e.state = 'chase';
    for (const o of this.enemies) {
      if (o.state === 'idle' && !o.dead && !o.boss && o.room === e.room && Math.abs(o.x - e.x) < 280 && Math.abs(o.y - e.y) < 280) o.state = 'chase';
    }
  }

  tickStatus(e: Enemy, dt: number): boolean {
    const st = e.st, base = this.s.dmg;
    let dot = 0, col = '';
    if (st.poisonT > 0) { st.poisonT -= dt; dot += base * 0.26 * st.poison * dt; col = '#7dff4a'; if (st.poisonT <= 0) st.poison = 0; }
    if (st.bleedT > 0) { st.bleedT -= dt; dot += base * 0.32 * st.bleed * dt; col = '#ff4b5f'; if (st.bleedT <= 0) st.bleed = 0; }
    if (st.burnT > 0) { st.burnT -= dt; dot += base * 0.55 * dt; col = '#ff9a2e'; if (rand() < 0.4) this.part(e.x + rr(-6, 6), e.y - rr(4, e.def.h), rr(-10, 10), -rr(30, 70), 0.5, 3, '#ff9a2e', 0, 2, 0.5); }
    if (st.chillT > 0) { st.chillT -= dt; if (st.chillT <= 0) st.chill = 0; }
    if (dot > 0) {
      e.hp -= dot; e.dotAcc += dot; e.dotCol = col; e.dotT -= dt;
      if (e.dotT <= 0) { e.dotT = 0.55; this.text(e.x + rr(-8, 8), e.y - e.def.h * e.sc - 4, String(Math.max(1, Math.round(e.dotAcc))), col, 0.85); e.dotAcc = 0; }
      if (st.poisonT > 0 && rand() < 0.08) this.part(e.x + rr(-6, 6), e.y - rr(6, 22), 0, -30, 0.7, 2.4, '#7dff4a', 0, 0, 1);
      if (e.hp <= 0) { this.killEnemy(e); return false; }
    }
    return true;
  }

  // ------------------------------------------------------------ враги и ИИ
  updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.abs(dx) > 1300 || Math.abs(dy) > 1300) continue;
      this.updateEnemy(e, dt);
    }
    // разделение
    const act: Enemy[] = [];
    for (const e of this.enemies) if (!e.dead && e.state !== 'idle' && e.spawnT <= 0 && Math.abs(e.x - p.x) < 700 && Math.abs(e.y - p.y) < 700) act.push(e);
    for (let i = 0; i < act.length; i++) {
      const a = act[i];
      for (let j = i + 1; j < act.length; j++) {
        const b = act[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = (a.r + b.r) * 0.8;
        if (d < m && d > 0.01) {
          const push = (m - d) * 0.5, nx = dx / d, ny = dy / d;
          if (!a.boss && a.state !== 'windup') this.moveBody(a, -nx * push, -ny * push, a.r * 0.72, !!a.def.flying);
          if (!b.boss && b.state !== 'windup') this.moveBody(b, nx * push, ny * push, b.r * 0.72, !!b.def.flying);
        }
      }
      const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy), m = a.r * 0.8 + PR;
      if (d < m && d > 0.01 && !a.def.flying) this.moveBody(a, (dx / d) * (m - d) * 0.6, (dy / d) * (m - d) * 0.6, a.r * 0.72);
    }
    if (this.enemies.some((e) => e.dead)) {
      this.enemies = this.enemies.filter((e) => { if (e.dead) this.byId.delete(e.id); return !e.dead; });
    }
  }

  updateEnemy(e: Enemy, dt: number) {
    const p = this.p, d = e.def;
    e.anim += dt; e.flash = Math.max(0, e.flash - dt); e.swing = Math.max(0, e.swing - dt * 4);
    e.cd -= dt; e.invuln = Math.max(0, e.invuln - dt);
    if (e.spawnT > 0) { e.spawnT -= dt * 1.2; return; }
    if (!this.tickStatus(e, dt)) return;
    if (e.kx || e.ky) {
      this.moveBody(e, e.kx * dt, e.ky * dt, e.r * 0.72, !!d.flying);
      const f = Math.pow(0.0008, dt); e.kx *= f; e.ky *= f;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 8) e.kx = e.ky = 0;
    }
    if (e.st.freezeT > 0) { e.st.freezeT -= dt; e.mv = 0; return; }
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
    e.losT -= dt;
    if (e.losT <= 0) { e.los = dist < 750 && this.los(e.x, e.y, p.x, p.y); e.losT = 0.12 + rand() * 0.12; }
    e.mv = 0;
    if (e.boss) { this.aiBoss(e, dt, dist); return; }
    if (e.state === 'idle') {
      if (dist < d.aggro && (e.los || dist < 140)) this.alertGroup(e);
      return;
    }
    if (dist > 1150 && !e.minion) { e.state = 'idle'; e.x = e.hx; e.y = e.hy; return; }
    const chill = 1 - Math.min(0.6, e.st.chill * 0.15);
    const spd = e.speed * chill;
    const ang = Math.atan2(dy, dx);
    switch (d.ai) {
      case 'melee': this.aiMelee(e, dt, dist, ang, spd); break;
      case 'lunge': this.aiLunge(e, dt, dist, ang, spd); break;
      case 'ranged': this.aiRanged(e, dt, dist, ang, spd); break;
      case 'bat': this.aiBat(e, dt, dist, ang, spd); break;
      default: break;
    }
  }

  steerTo(e: Enemy, tx: number, ty: number, spd: number, dt: number, flow: boolean) {
    let ax = tx - e.x, ay = ty - e.y;
    if (flow && !e.los) { const f = this.flowDir(e.x, e.y); if (f) { ax = f.x; ay = f.y; } }
    const l = Math.hypot(ax, ay) || 1;
    ax /= l; ay /= l;
    this.moveBody(e, ax * spd * dt, ay * spd * dt, e.r * 0.72, !!e.def.flying);
    e.mv = 1;
  }

  startWindup(e: Enemy, ang: number, dur: number, zone: boolean) {
    e.state = 'windup'; e.t = dur; e.a = dur; e.aim = ang; e.wind = 0.01;
    e.face = Math.cos(ang) >= 0 ? 1 : -1;
    const atk = e.def.atk;
    if (zone && atk) {
      if (atk.shape === 'cone') this.zone({ kind: 'cone', x: e.x, y: e.y, r: atk.reach * e.sc, ang, arc: atk.arc, dur, dmg: e.dmg, from: 'e', src: e.id, poison: !!e.def.poison });
      else this.zone({ kind: 'circle', x: e.x + Math.cos(ang) * atk.off, y: e.y + Math.sin(ang) * atk.off, r: atk.reach, len: atk.off, ang, dur, dmg: e.dmg, from: 'e', src: e.id, style: 'slam' });
    }
  }

  aiMelee(e: Enemy, dt: number, dist: number, ang: number, spd: number) {
    const atk = e.def.atk!, p = this.p;
    const mul = e.elite === 'fast' ? 0.8 : 1;
    if (e.state === 'chase') {
      e.face = p.x >= e.x ? 1 : -1;
      if (dist <= atk.range * e.sc && e.cd <= 0) { this.startWindup(e, ang, atk.windup, true); return; }
      if (dist > atk.range * 0.7) this.steerTo(e, p.x, p.y, spd, dt, true);
    } else if (e.state === 'windup') {
      e.t -= dt; e.wind = Math.min(1, 1 - e.t / e.a);
      if (e.t <= 0) { e.wind = 0; e.swing = 1; e.state = 'recover'; e.t = atk.recover; e.cd = atk.cd * mul; if (e.def.kind === 'ogre') this.shake(5); }
    } else if (e.state === 'recover') {
      e.t -= dt; if (e.t <= 0) e.state = 'chase';
    }
  }

  aiLunge(e: Enemy, dt: number, dist: number, ang: number, spd: number) {
    const atk = e.def.atk!, p = this.p;
    if (e.state === 'chase') {
      e.face = p.x >= e.x ? 1 : -1;
      if (dist <= atk.range && e.cd <= 0 && (e.los || dist < 60)) { this.startWindup(e, ang, atk.windup, false); return; }
      if (dist > 50) this.steerTo(e, p.x, p.y, spd, dt, true);
    } else if (e.state === 'windup') {
      e.t -= dt; e.wind = Math.min(1, 1 - e.t / e.a);
      if (e.t <= 0) {
        e.wind = 0; e.state = 'strike'; e.t = 0.24; e.b = 0;
        e.kx = Math.cos(e.aim) * 640; e.ky = Math.sin(e.aim) * 640; e.swing = 1;
      }
    } else if (e.state === 'strike') {
      e.t -= dt;
      if (!e.b && Math.hypot(p.x - e.x, p.y - e.y) < e.r + PR + 8) {
        e.b = 1;
        this.hurtPlayer(e.dmg, e.x, e.y, { poison: !!e.def.poison });
      }
      if (e.t <= 0) { e.state = 'recover'; e.t = atk.recover; e.cd = atk.cd; }
    } else if (e.state === 'recover') {
      e.t -= dt; if (e.t <= 0) e.state = 'chase';
    }
  }

  aiRanged(e: Enemy, dt: number, dist: number, ang: number, spd: number) {
    const r = e.def.rng!, p = this.p;
    e.b -= dt;
    if (e.state === 'chase') {
      e.face = p.x >= e.x ? 1 : -1;
      if (dist < r.min) {
        this.moveBody(e, -Math.cos(ang) * spd * dt, -Math.sin(ang) * spd * dt, e.r * 0.72, !!e.def.flying); e.mv = 1;
      } else if (dist > r.max || !e.los) {
        this.steerTo(e, p.x, p.y, spd, dt, true);
      } else {
        e.c -= dt; if (e.c <= 0) { e.c = rr(1.2, 2.6); e.strafe = (e.strafe === 1 ? -1 : 1); }
        this.moveBody(e, -Math.sin(ang) * e.strafe * spd * 0.55 * dt, Math.cos(ang) * e.strafe * spd * 0.55 * dt, e.r * 0.72, !!e.def.flying); e.mv = 0.7;
      }
      if (e.def.special === 'necro' && e.b <= 0 && dist < 420) {
        const n = this.enemies.filter((o) => !o.dead && o.ownerId === e.id).length;
        if (n < 3) { e.state = 'roar'; e.t = e.a = 0.9; e.act = 1; return; }
        e.b = 3;
      }
      if (e.def.special === 'shaman' && e.b <= 0 && dist < 500) {
        e.b = 9;
        let healed = 0;
        for (const o of this.enemies) {
          if (o.dead || o === e || o.hp >= o.maxHp * 0.9 || Math.hypot(o.x - e.x, o.y - e.y) > 240) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.35); healed++;
          this.text(o.x, o.y - o.def.h, '+HP', '#6dff8a', 0.9);
          this.burst(o.x, o.y - 12, 8, '#6dff8a', 60, 0.7, 2.5, -40);
        }
        if (healed) { this.ring(e.x, e.y, 120, '#6dff8a', 0.5); sfx.cast(); }
      }
      if (e.cd <= 0 && e.los && dist < r.max + 50) this.startWindup(e, ang, r.windup, false);
    } else if (e.state === 'windup') {
      e.t -= dt; e.wind = Math.min(1, 1 - e.t / e.a);
      e.face = p.x >= e.x ? 1 : -1;
      if (e.t <= 0) {
        e.wind = 0; e.swing = 0.6;
        this.shoot(e);
        e.state = 'recover'; e.t = 0.4; e.cd = r.cd * (e.elite === 'fast' ? 0.8 : 1);
      }
    } else if (e.state === 'roar') {
      e.t -= dt; e.wind = Math.min(1, 1 - e.t / e.a);
      if (e.t <= 0) {
        e.wind = 0; e.state = 'recover'; e.t = 0.4; e.b = 10;
        for (let i = 0; i < 2; i++) this.summonNear(e, 'skeleton', 50);
        sfx.cast(); this.ring(e.x, e.y, 90, '#7dff8a', 0.5);
      }
    } else if (e.state === 'recover') {
      e.t -= dt; if (e.t <= 0) e.state = 'chase';
    }
  }

  aiBat(e: Enemy, dt: number, dist: number, ang: number, spd: number) {
    const p = this.p;
    e.face = p.x >= e.x ? 1 : -1;
    if (e.state === 'recover') {
      e.t -= dt;
      this.moveBody(e, (-Math.cos(ang) + Math.sin(e.anim * 4) * 0.5) * spd * dt, (-Math.sin(ang) + Math.cos(e.anim * 4) * 0.5) * spd * dt, e.r * 0.72, true);
      e.mv = 1;
      if (e.t <= 0) e.state = 'chase';
      return;
    }
    const w = Math.sin(e.anim * 5) * 0.8;
    this.moveBody(e, (Math.cos(ang) - Math.sin(ang) * w * 0.6) * spd * dt, (Math.sin(ang) + Math.cos(ang) * w * 0.6) * spd * dt, e.r * 0.72, true);
    e.mv = 1;
    if (dist < e.r + PR + 8 && e.cd <= 0) {
      this.hurtPlayer(e.dmg, e.x, e.y);
      e.cd = 1.1; e.state = 'recover'; e.t = 0.7;
    }
  }

  shoot(e: Enemy) {
    const r = e.def.rng!, p = this.p;
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < r.count; i++) {
      const a = base + (i - (r.count - 1) / 2) * r.spread + rr(-0.04, 0.04);
      this.projs.push({
        x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14, vx: Math.cos(a) * r.speed, vy: Math.sin(a) * r.speed,
        r: r.proj === 'fire' ? 9 : 6, dmg: e.dmg, life: 2.4, from: 'e', kind: r.proj, pierce: 0, hit: [], col: PROJ_COL[r.proj] || '#fff',
        effect: 'none', crit: false, poison: !!e.def.poison && r.proj === 'web', slow: r.proj === 'web', dead: false, src: e.id,
      });
    }
    if (r.proj === 'arrow') sfx.shoot(); else sfx.cast();
  }

  summonNear(e: Enemy, kind: EnemyKind, rad: number) {
    for (let k = 0; k < 12; k++) {
      const a = rand() * 6.28, d = rr(rad * 0.6, rad * 1.5);
      const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
      if (this.blockedBox(x, y, 12)) continue;
      const m = this.spawnEnemy(kind, x, y, e.room, { minion: true, owner: e.id, rise: true, chase: true, diff: Math.min(e.diff, 0.9) });
      this.burst(m.x, m.y, 8, '#9a8a6a', 70, 0.6, 3);
      return m;
    }
    return null;
  }

  // ------------------------------------------------------------ босс
  aiBoss(e: Enemy, dt: number, dist: number) {
    const p = this.p;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.state === 'idle') {
      const ti = Math.floor(p.y / TS) * MAP_W + Math.floor(p.x / TS);
      if (this.map.roomAt[ti] === e.room || dist < 330) {
        if (this.sealsCollected < this.world.guardians.length) {
          if (this.time - this.lockHintT > 10) {
            this.lockHintT = this.time;
            this.cb.onBanner('ТРОН ЗАПЕЧАТАН', `Найдите хранителей: ${this.sealsCollected}/${this.world.guardians.length}. Они отмечены на карте.`, '#c995ff');
          }
          return;
        }
        e.state = 'roar'; e.t = e.a = 2.2; e.invuln = 2.2; this.bossActive = true;
        sfx.boss(); this.shake(14);
        this.cb.onBanner(e.def.name, 'Хозяин подземелья пробудился', '#ff4a4a');
        this.ring(e.x, e.y, 260, '#ff3a3a', 1.2);
      }
      return;
    }
    if (e.state === 'roar') {
      e.t -= dt; e.wind = Math.min(1, 1 - e.t / e.a) * 0.6;
      if (rand() < 0.4) this.burst(e.x + rr(-30, 30), e.y - rr(0, 90), 1, e.phase >= 3 ? '#c690ff' : '#ff8a2a', 60, 0.8, 3, -40);
      if (e.t <= 0) { e.state = 'chase'; e.wind = 0; e.cd = 0.8; }
      return;
    }
    e.face = p.x >= e.x ? 1 : -1;
    const frac = e.hp / e.maxHp;
    const np = frac < 0.33 ? 3 : frac < 0.66 ? 2 : 1;
    if (np > e.phase && e.state !== 'strike') {
      e.phase = np; e.state = 'roar'; e.t = e.a = 1.6; e.invuln = 1.6; this.cancelZones(e);
      sfx.boss(); this.shake(16);
      this.ring(e.x, e.y, 300, np >= 3 ? '#c690ff' : '#ff8a2a', 1);
      for (let i = 0; i < 3; i++) this.summonNear(e, 'skeleton', 110);
      this.cb.onBanner(`Фаза ${np}`, np >= 3 ? 'Малгрот в ярости!' : 'Кости дрожат…', np >= 3 ? '#c690ff' : '#ff8a2a');
      return;
    }
    if (dist > 1000) { e.state = 'idle'; this.bossActive = false; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3); e.x = e.hx; e.y = e.hy; return; }
    const spd = e.speed * (1 + 0.18 * (e.phase - 1));
    const gap = Math.max(0.5, 1.2 - 0.2 * e.phase);
    if (e.state === 'chase') {
      if (dist > 70) this.steerTo(e, p.x, p.y, spd, dt, true);
      if (e.cd <= 0) this.bossPick(e, dist, ang);
    } else if (e.state === 'windup') {
      e.t -= dt; e.wind = Math.min(1, 1 - e.t / e.a);
      if (e.act === 3 || e.act === 1) { /* зафиксированное направление */ }
      if (e.t <= 0) this.bossExecute(e, ang, gap);
    } else if (e.state === 'strike') {
      e.t -= dt;
      this.moveBody(e, Math.cos(e.aim) * 470 * dt, Math.sin(e.aim) * 470 * dt, e.r * 0.72);
      e.mv = 1;
      if (rand() < 0.5) this.part(e.x + rr(-20, 20), e.y, rr(-20, 20), -rr(10, 50), 0.5, 5, 'rgba(150,140,150,0.5)', 0, 0, 0.2);
      if (!e.b && Math.hypot(p.x - e.x, p.y - e.y) < e.r + PR + 14) { e.b = 1; this.hurtPlayer(e.dmg * 1.2, e.x, e.y); }
      if (e.t <= 0 || this.blockedBox(e.x + Math.cos(e.aim) * 30, e.y + Math.sin(e.aim) * 30, e.r * 0.72)) { e.state = 'recover'; e.t = 0.9; e.cd = gap; this.shake(6); }
    } else if (e.state === 'recover') {
      e.t -= dt;
      if (e.c > 0) { e.c -= dt; if (e.c <= 0) this.bossNova(e, 0.5); }
      if (e.t <= 0) e.state = 'chase';
    }
  }

  bossPick(e: Enemy, dist: number, ang: number) {
    const opts: [number, number][] = [];
    const minions = this.enemies.filter((o) => !o.dead && o.ownerId === e.id).length;
    if (dist < 180) { opts.push([1, 4]); if (e.phase >= 2) opts.push([2, 2]); if (e.phase >= 3) opts.push([6, 1.5]); }
    else {
      opts.push([3, 3]);
      if (e.phase >= 2) opts.push([4, 2]);
      if (e.phase >= 3) opts.push([6, 3]);
      if (minions < 5) opts.push([5, 1.4]);
    }
    let tot = 0; for (const o of opts) tot += o[1];
    let x = rand() * tot, act = opts[0][0];
    for (const o of opts) { x -= o[1]; if (x <= 0) { act = o[0]; break; } }
    e.act = act; e.state = 'windup'; e.aim = ang;
    const p = this.p;
    if (act === 1) { e.t = e.a = 0.75; this.zone({ kind: 'cone', x: e.x, y: e.y, r: 160, ang, arc: 2.4, dur: 0.75, dmg: e.dmg, from: 'e', src: e.id }); }
    else if (act === 2) { e.t = e.a = 0.95; this.zone({ kind: 'circle', x: e.x, y: e.y, r: 175, dur: 0.95, dmg: e.dmg * 0.9, from: 'e', src: e.id, style: 'slam', len: 0 }); }
    else if (act === 3) { e.t = e.a = 0.95; this.zone({ kind: 'line', x: e.x, y: e.y, r: 0, ang, len: 470, w: 84, dur: 0.95, dmg: 0, from: 'e', src: e.id }); }
    else if (act === 4) { e.t = e.a = 0.9; }
    else if (act === 5) { e.t = e.a = 1.2; this.ring(e.x, e.y, 80, '#9a8a6a', 1.2); }
    else {
      e.t = e.a = 0.8;
      this.zone({ kind: 'circle', x: p.x, y: p.y, r: 62, dur: 1.0, dmg: e.dmg * 0.8, from: 'e', col: '#ff3a3a' });
      for (let i = 0; i < 7; i++) {
        const a = rand() * 6.28, d = rr(60, 260);
        const zx = p.x + Math.cos(a) * d, zy = p.y + Math.sin(a) * d;
        if (!this.blockedBox(zx, zy, 6)) this.zone({ kind: 'circle', x: zx, y: zy, r: 62, dur: 1.0 + i * 0.1, dmg: e.dmg * 0.8, from: 'e', col: '#ff3a3a' });
      }
    }
  }

  bossExecute(e: Enemy, ang: number, gap: number) {
    e.wind = 0; e.swing = 1;
    switch (e.act) {
      case 1: e.state = 'recover'; e.t = 0.7; e.cd = gap; this.shake(9); sfx.hit(); break;
      case 2: e.state = 'recover'; e.t = 0.9; e.cd = gap; this.shake(12); break;
      case 3: e.state = 'strike'; e.t = 0.62; e.b = 0; sfx.dash(); break;
      case 4: this.bossNova(e, 0); e.state = 'recover'; e.t = 0.9; e.cd = gap; if (e.phase >= 3) e.c = 0.45; break;
      case 5: {
        e.state = 'recover'; e.t = 0.6; e.cd = gap;
        const n = 3 + e.phase;
        for (let i = 0; i < n; i++) this.summonNear(e, i % 4 === 3 ? 'skelArcher' : 'skeleton', 120);
        sfx.cast();
        break;
      }
      default: e.state = 'recover'; e.t = 1.0; e.cd = gap; break;
    }
    void ang;
  }

  bossNova(e: Enemy, off: number) {
    const n = 14 + e.phase * 4, sp = 180 + e.phase * 25, o = rand() * 6.28 + off;
    for (let i = 0; i < n; i++) {
      const a = o + (i / n) * Math.PI * 2;
      this.projs.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 8, dmg: e.dmg * 0.55, life: 3.2, from: 'e', kind: 'shadow', pierce: 0, hit: [], col: e.phase >= 3 ? '#e0a0ff' : '#b57cff', effect: 'none', crit: false, poison: false, slow: false, dead: false, src: e.id });
    }
    this.ring(e.x, e.y, 140, '#b57cff', 0.6);
    sfx.cast(); this.shake(7);
  }

  // ------------------------------------------------------------ снаряды и зоны
  updateProjs(dt: number) {
    const p = this.p;
    for (const pr of this.projs) {
      pr.life -= dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.life <= 0) { pr.dead = true; continue; }
      const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS);
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || !this.map.tiles[ty * MAP_W + tx]) {
        pr.dead = true; this.burst(pr.x, pr.y - 10, 4, pr.col, 70, 0.3, 2); continue;
      }
      if (rand() < 0.5) this.part(pr.x, pr.y - 12, rr(-8, 8), rr(-8, 8), 0.3, 2.4, pr.col, 0, 2, 0.1);
      if (pr.from === 'e') {
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 8) {
          if (this.hurtPlayer(pr.dmg, pr.x - pr.vx, pr.y - pr.vy, { poison: pr.poison, slow: pr.slow })) pr.dead = true;
          else if (p.dashT <= 0 && p.iframes <= 0) pr.dead = true;
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || pr.hit.includes(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < pr.r + e.r) {
            pr.hit.push(e.id);
            const ang = Math.atan2(pr.vy, pr.vx);
            const w = this.weapon();
            if (pr.kind === 'wave') this.hitEnemy(e, pr.dmg, { crit: false, ang, kb: 120, col: '#ff7aa0' });
            else this.hitEnemy(e, pr.dmg, { crit: pr.crit, ang, kb: 130, proc: w.effect !== 'none' });
            pr.pierce--;
            if (pr.pierce < 0) { pr.dead = true; break; }
          }
        }
        if (!pr.dead && pr.kind === 'dagger') for (const b of this.propsNear(pr.x, pr.y)) if (b.hp > 0 && Math.hypot(b.x - pr.x, b.y - pr.y) < b.r + 6) { this.damageProp(b, this.s.dmg); pr.dead = true; break; }
      }
    }
    if (this.projs.some((x) => x.dead)) this.projs = this.projs.filter((x) => !x.dead);
  }

  zone(o: Partial<Zone> & Pick<Zone, 'kind' | 'x' | 'y' | 'dur' | 'dmg' | 'from'>): Zone {
    const z: Zone = { r: 0, ang: 0, arc: 0, len: 0, w: 0, t: 0, after: 0.25, col: '#ff3030', src: 0, done: false, dead: false, poison: false, style: 'hit', crit: false, ...o };
    this.zones.push(z);
    if (z.style === 'holy') this.fx.push({ kind: 'pillar', x: z.x, y: z.y, x2: 0, y2: 0, a: 0, r: z.r, arc: 0, side: 1, t: 0, dur: z.dur + 0.35, col: '#ffe58a', big: false });
    return z;
  }

  updateZones(dt: number) {
    for (const z of this.zones) {
      z.t += dt;
      if (z.src && !z.done) {
        const e = this.byId.get(z.src);
        if (e && !e.dead) {
          if (z.kind === 'cone') { z.x = e.x; z.y = e.y; if (!e.boss) z.ang = e.aim; }
          else if (z.kind === 'circle' && z.len > 0) { z.x = e.x + Math.cos(z.ang) * z.len; z.y = e.y + Math.sin(z.ang) * z.len; }
          else if (z.kind === 'circle' && e.boss) { z.x = e.x; z.y = e.y; }
          else if (z.kind === 'line') { z.x = e.x; z.y = e.y; }
        } else if (!e || e.dead) { z.done = true; z.dead = true; }
      }
      if (!z.done && z.t >= z.dur) { z.done = true; this.resolveZone(z); }
      if (z.t >= z.dur + z.after) z.dead = true;
    }
    if (this.zones.some((z) => z.dead)) this.zones = this.zones.filter((z) => !z.dead);
  }

  resolveZone(z: Zone) {
    const p = this.p;
    const inside = (x: number, y: number, rad: number) => {
      const dx = x - z.x, dy = y - z.y;
      if (z.kind === 'circle') return Math.hypot(dx, dy) <= z.r + rad;
      if (z.kind === 'cone') {
        const d = Math.hypot(dx, dy);
        if (d > z.r + rad) return false;
        if (d < rad + 8) return true;
        return Math.abs(wrapA(Math.atan2(dy, dx) - z.ang)) <= z.arc / 2 + Math.atan2(rad, d);
      }
      const c = Math.cos(z.ang), s = Math.sin(z.ang);
      const al = dx * c + dy * s, pe = -dx * s + dy * c;
      return al >= -rad && al <= z.len + rad && Math.abs(pe) <= z.w / 2 + rad;
    };
    if (z.from !== 'p' && z.dmg > 0 && inside(p.x, p.y, PR)) this.hurtPlayer(z.dmg, z.x, z.y, { poison: z.poison });
    if (z.from !== 'e') {
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (inside(e.x, e.y, e.r * 0.8)) this.hitEnemy(e, z.dmg * rr(0.92, 1.08), { ang: Math.atan2(e.y - z.y, e.x - z.x), kb: 180, col: z.style === 'holy' ? '#ffe58a' : undefined });
      }
      for (const b of this.props) if (!b.dead && b.hp > 0 && inside(b.x, b.y, b.r)) this.damageProp(b, 999);
    }
    if (z.style === 'boom') {
      this.ring(z.x, z.y, z.r, '#ff8a2a', 0.5);
      this.burst(z.x, z.y - 10, 26, '#ff8a2a', 230, 0.7, 4.5, -40);
      this.burst(z.x, z.y - 10, 14, '#ffe27a', 160, 0.5, 3);
      sfx.boom(); this.shake(12);
      this.stains.push({ kind: 'scorch', x: z.x, y: z.y, r: z.r * 0.8, rot: 0, seed: 1, col: '' });
    } else if (z.style === 'slam') {
      this.ring(z.x, z.y, z.r, '#c8b8a0', 0.45);
      this.burst(z.x, z.y, 12, 'rgba(160,150,140,0.7)', 150, 0.6, 5);
      this.shake(9); sfx.hit();
    } else if (z.style === 'holy') {
      this.burst(z.x, z.y - 14, 16, '#fff3b0', 150, 0.6, 3, -60);
      sfx.cast();
    }
  }

  // ------------------------------------------------------------ реквизит и взаимодействие
  damageProp(pr: Prop, dmg: number) {
    if (pr.dead || pr.hp <= 0) return;
    pr.hp -= dmg; pr.hit = 0.25;
    this.burst(pr.x, pr.y - 10, 3, pr.kind === 'sarcophagus' ? '#aaa' : '#8a6a3a', 80, 0.4, 2.4);
    if (pr.hp <= 0) this.breakProp(pr);
  }

  breakProp(pr: Prop) {
    pr.dead = true;
    const d = pr.diff;
    sfx.smash();
    const wood = pr.kind === 'barrel' || pr.kind === 'crate' || pr.kind === 'bomb';
    this.burst(pr.x, pr.y - 10, 12, wood ? '#8a6a3a' : '#a8a8b0', 150, 0.6, 3.4, 300);
    switch (pr.kind) {
      case 'barrel': case 'crate':
        if (rand() < 0.6) this.dropGold(pr.x, pr.y, (3 + d * 8) * rr(0.6, 1.4), 3);
        if (rand() < 0.07) this.pickup('potion', pr.x, pr.y);
        if (rand() < 0.03) this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.1)));
        break;
      case 'bomb':
        this.zone({ kind: 'circle', x: pr.x, y: pr.y, r: 105, dur: 0.05, dmg: 55 * (1 + d * 0.5), from: 'x', col: '#ff6a2a', style: 'boom', after: 0.1 });
        break;
      case 'sarcophagus': this.openSarco(pr); break;
      case 'cocoon': {
        for (let i = 0; i < 2; i++) this.spawnEnemy('spider', pr.x + rr(-14, 14), pr.y + rr(-8, 8), -1, { diff: d, chase: true, rise: false, minion: false });
        this.burst(pr.x, pr.y - 12, 10, '#cfd2da', 90, 0.6, 3);
        break;
      }
      default: break;
    }
  }

  openSarco(pr: Prop) {
    if (pr.state) return;
    pr.state = 1; pr.hp = 0;
    this.ring(pr.x, pr.y, 60, '#8a8a98', 0.5);
    this.burst(pr.x, pr.y - 12, 14, '#8a8a98', 90, 0.6, 3);
    if (rand() < 0.7) {
      const n = 2 + Math.floor(pr.diff * 2);
      for (let i = 0; i < n; i++) this.spawnEnemy(i === 0 && pr.diff > 0.5 ? 'skelArcher' : 'skeleton', pr.x + rr(-34, 34), pr.y + rr(10, 36), -1, { diff: pr.diff, rise: true, chase: true });
      this.cb.onToast('Мертвецы восстают!', '#c8c0a0', 'skull');
    }
    this.dropGold(pr.x, pr.y, (14 + pr.diff * 24) * rr(0.8, 1.3), 5);
    if (rand() < 0.2) this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.3)));
    if (rand() < 0.15) this.pickup('potion', pr.x, pr.y);
  }

  openChest(pr: Prop) {
    if (pr.state) return;
    pr.state = 1;
    sfx.chest();
    const tier = pr.kind === 'chest' ? 0 : pr.kind === 'ironchest' ? 1 : 2;
    const d = pr.diff;
    this.ring(pr.x, pr.y, 50, '#ffd84a', 0.5);
    this.burst(pr.x, pr.y - 16, 18, '#ffd84a', 140, 0.8, 3, 200);
    this.dropGold(pr.x, pr.y, (20 + d * 40) * (1 + tier * 1.3) * rr(0.8, 1.3), 10);
    if (rand() < 0.3 + tier * 0.2) this.pickup('potion', pr.x, pr.y);
    const artChance = [0.28, 0.65, 1][tier];
    if (rand() < artChance) this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.25 + tier * 0.35, tier === 2 ? 'rare' : 'common')));
    if (tier === 2) this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.8, 'epic')));
    if (tier === 1 && rand() < 0.25) this.pickup('key', pr.x, pr.y);
    if (tier === 0 && rand() < 0.1) this.pickup('key', pr.x, pr.y);
  }

  useShrine(pr: Prop) {
    if (pr.state > 0) return;
    const p = this.p, s = this.s;
    const col = SHRINES[pr.sub]?.color || '#fff';
    switch (pr.sub) {
      case 'blood':
        if (p.hp < s.maxHp * 0.35) { this.cb.onToast('Слишком мало здоровья для жертвы', '#ff6a6a'); sfx.error(); return; }
        p.hp -= s.maxHp * 0.25;
        this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.6, 'rare')));
        this.cb.onToast('Кровь принята. Алтарь дарует артефакт.', col, 'droplets');
        break;
      case 'power': p.power = 90; this.recalc(); this.cb.onToast('Мощь алтаря: +30% урона, +20% скорости атаки (90 сек)', col, 'flame'); break;
      case 'life': p.hp = s.maxHp; p.potions = Math.min(MAX_POTIONS, p.potions + 2); this.cb.onToast('Вы полностью исцелены. +2 зелья', col, 'heart'); break;
      case 'fortune':
        if (p.gold < 80) { this.cb.onToast('Нужно 80 золота для ставки', '#ff6a6a'); sfx.error(); return; }
        p.gold -= 80;
        { const r = rand();
          if (r < 0.45) { this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.5, 'rare'))); this.cb.onToast('Удача улыбнулась — артефакт!', col, 'clover'); }
          else if (r < 0.8) { this.dropGold(pr.x, pr.y, 200 + pr.diff * 160, 14); this.cb.onToast('Куш! Золото сыплется из алтаря', col, 'coins'); }
          else this.cb.onToast('Алтарь безмолвствует…', '#9a9ab0', 'dices'); }
        break;
      case 'curse': {
        pr.state = 2;
        const pool: EnemyKind[] = pr.diff < 0.4 ? ['skeleton', 'goblin', 'skelArcher', 'spider'] : ['orc', 'skeleton', 'necro', 'wraith', 'goblin', 'skelArcher'];
        for (let i = 0; i < 7; i++) {
          for (let k = 0; k < 10; k++) {
            const a = rand() * 6.28, dd = rr(110, 170);
            const x = pr.x + Math.cos(a) * dd, y = pr.y + Math.sin(a) * dd;
            if (this.blockedBox(x, y, 12)) continue;
            this.spawnEnemy(pool[Math.floor(rand() * pool.length)], x, y, -1, { diff: pr.diff, rise: true, chase: true, shrine: pr.id });
            this.burst(x, y, 8, '#b050ff', 90, 0.7, 3);
            break;
          }
        }
        this.cb.onBanner('Проклятие!', 'Уничтожьте призванных врагов', '#b050ff');
        sfx.boss(); this.shake(8); this.ring(pr.x, pr.y, 180, '#b050ff', 0.8);
        return;
      }
    }
    pr.state = 1;
    sfx.shrine();
    this.ring(pr.x, pr.y, 110, col, 0.8);
    this.burst(pr.x, pr.y - 30, 24, col, 150, 1, 3.2, -40);
  }

  findInteract() {
    const p = this.p;
    let best: Prop | null = null, bd = 1e9;
    for (const pr of this.propsNear(p.x, p.y)) {
      const k = pr.kind;
      if (!(k === 'chest' || k === 'ironchest' || k === 'vault' || k === 'mimic' || k === 'shrine' || k === 'sarcophagus' || k === 'merchant')) continue;
      if ((k === 'chest' || k === 'ironchest' || k === 'vault' || k === 'sarcophagus') && pr.state) continue;
      if (k === 'shrine' && pr.state) continue;
      // мертвец не даст открыть сундук, пока рядом враги — приоритет у боя
      const d = Math.hypot(pr.x - p.x, pr.y - p.y);
      const reach = k === 'merchant' ? pr.r + 62 : pr.r + 46;
      if (d > reach) continue;
      if (d < bd) { bd = d; best = pr; }
    }
    this.interactProp = best;
    this.promptKind = best ? best.kind : null;
    if (!best) { this.prompt = null; return; }
    switch (best.kind) {
      case 'chest': this.prompt = 'Открыть сундук'; break;
      case 'mimic': this.prompt = 'Открыть сундук'; break;
      case 'ironchest': this.prompt = 'Открыть железный сундук'; break;
      case 'vault': this.prompt = p.keys > 0 ? 'Открыть хранилище (1 ключ)' : 'Заперто — нужен ключ'; break;
      case 'shrine': this.prompt = best.state === 2 ? 'Алтарь активен' : `${SHRINES[best.sub].name}: ${SHRINES[best.sub].desc}`; break;
      case 'sarcophagus': this.prompt = 'Вскрыть саркофаг'; break;
      case 'merchant': this.prompt = 'Торговец: клинки и припасы'; break;
      default: this.prompt = null;
    }
  }

  interact() {
    if (this.paused || this.over) return;
    const pr = this.interactProp;
    if (!pr) return;
    const now = performance.now();
    if (now - this.lastInteract < 220) return;
    this.lastInteract = now;
    const p = this.p;
    switch (pr.kind) {
      case 'chest': case 'ironchest': this.openChest(pr); break;
      case 'vault':
        if (p.keys > 0) { p.keys--; this.openChest(pr); } else { this.cb.onToast('Нужен ключ. Их роняют элитные враги.', '#ff6a6a', 'key'); sfx.error(); }
        break;
      case 'mimic': {
        pr.dead = true;
        const m = this.spawnEnemy('mimic', pr.x, pr.y, -1, { diff: pr.diff, chase: true });
        m.state = 'windup'; m.t = m.a = 0.4; m.aim = Math.atan2(p.y - m.y, p.x - m.x); m.cd = 0;
        this.cb.onBanner('Мимик!', 'Это была ловушка', '#ff6a6a');
        this.burst(pr.x, pr.y - 14, 18, '#ffd84a', 150, 0.6, 3);
        this.shake(8); sfx.boss();
        break;
      }
      case 'shrine': if (pr.state === 0) this.useShrine(pr); break;
      case 'sarcophagus': this.openSarco(pr); break;
      case 'merchant': this.cb.onShop(); break;
      default: break;
    }
  }

  updateProps(dt: number) {
    const p = this.p;
    for (const pr of this.props) {
      if (pr.dead) continue;
      if (pr.hit > 0) pr.hit -= dt;
      const dx = pr.x - p.x, dy = pr.y - p.y;
      if (Math.abs(dx) > 800 || Math.abs(dy) > 800) continue;
      pr.t += dt;
      switch (pr.kind) {
        case 'spikes': {
          const ph = (this.time + pr.seed * 3) % 3.4;
          const ns = ph < 2.2 ? 0 : ph < 2.7 ? 1 : ph < 3.2 ? 2 : 0;
          if (ns === 2 && pr.state !== 2) {
            for (const e of this.enemies) if (!e.dead && !e.def.flying && e.spawnT <= 0 && Math.hypot(e.x - pr.x, e.y - pr.y) < pr.r + e.r * 0.6) this.hitEnemy(e, 28 * (1 + pr.diff), { col: '#ccc' });
          }
          pr.state = ns;
          if (ns === 2 && Math.hypot(dx, dy) < pr.r + 6) this.hurtPlayer(16 * (1 + pr.diff * 0.8), pr.x, pr.y);
          break;
        }
        case 'campfire':
          if (Math.hypot(dx, dy) < 130 && p.hp < this.s.maxHp) {
            p.hp = Math.min(this.s.maxHp, p.hp + 6 * dt);
            if (rand() < 0.15) this.part(p.x + rr(-10, 10), p.y - 10, 0, -40, 0.8, 2.6, '#6dff8a', 0, 2, 1);
          }
          if (rand() < 0.55) this.part(pr.x + rr(-6, 6), pr.y - 12 - rr(0, 6), rr(-14, 14), -rr(45, 120), 1.1, 2.6, rand() < 0.4 ? '#ffe27a' : '#ff9a3a', 0, 4, 0.5);
          if (rand() < 0.22) this.part(pr.x + rr(-5, 5), pr.y - 24, rr(-10, 10), -rr(28, 50), 1.9, 7, 'rgba(60,54,52,0.5)', 0, 3, 0.7);
          break;
        case 'orcfire': case 'brazier': {
          const col = pr.kind === 'brazier' ? pr.lightCol : '#ff7a30';
          if (rand() < 0.5) this.part(pr.x + rr(-5, 5), pr.y - 22 - rr(0, 4), rr(-10, 10), -rr(40, 95), 1, 2.4, col, 0, 4, 0.5);
          if (rand() < 0.14) this.part(pr.x + rr(-4, 4), pr.y - 30, rr(-8, 8), -rr(24, 46), 1.6, 6, 'rgba(50,46,46,0.45)', 0, 3, 0.7);
          break;
        }
        case 'shrine':
          if (pr.state === 2) {
            if (!this.enemies.some((e) => !e.dead && e.shrine === pr.id)) {
              pr.state = 1;
              this.cb.onBanner('Проклятие снято', 'Алтарь дарует награду', '#b050ff');
              this.pickup('artifact', pr.x, pr.y, 1, this.makeArtifact(this.rollRarity(0.8, 'epic')));
              this.dropGold(pr.x, pr.y, 120 + pr.diff * 160, 12);
              sfx.shrine(); this.ring(pr.x, pr.y, 140, '#b050ff', 0.8);
            }
          } else if (!pr.state && rand() < 0.15) this.part(pr.x + rr(-14, 14), pr.y - 20, 0, -rr(15, 40), 1.2, 2.2, pr.lightCol, 0, 2, 1);
          break;
        default: break;
      }
    }
    for (const t of this.world.torches) {
      if (Math.abs(t.x - p.x) > 620 || Math.abs(t.y - p.y) > 520) continue;
      if (rand() < 0.16) this.part(t.x + rr(-3, 3), t.y - 14, rr(-8, 8), -rr(30, 70), 1, 2, rand() < 0.4 ? '#ffe49a' : '#ffa040', 0, 4, 0.55);
      if (rand() < 0.05) this.part(t.x + rr(-2, 2), t.y - 20, rr(-6, 6), -rr(20, 40), 1.4, 4.5, 'rgba(50,46,46,0.4)', 0, 3, 0.7);
    }
    if (this.props.some((x) => x.dead)) {
      const dead = this.props.filter((x) => x.dead);
      this.props = this.props.filter((x) => !x.dead);
      for (const d of dead) {
        const arr = this.grid.get(this.gk(d.x, d.y));
        if (arr) { const i = arr.indexOf(d); if (i >= 0) arr.splice(i, 1); }
      }
    }
  }

  updatePickups(dt: number) {
    const p = this.p, s = this.s;
    for (const k of this.pickups) {
      k.t += dt;
      k.vz -= 900 * dt; k.z += k.vz * dt;
      if (k.z < 0) { k.z = 0; k.vz = Math.abs(k.vz) > 80 ? -k.vz * 0.4 : 0; k.vx *= 0.7; k.vy *= 0.7; }
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
      if (!this.blockedBox(nx, ny, 3)) { k.x = nx; k.y = ny; } else { k.vx = -k.vx * 0.5; k.vy = -k.vy * 0.5; }
      const f = Math.pow(0.2, dt); k.vx *= f; k.vy *= f;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
      let mag = s.magnet;
      if (k.kind === 'xp') mag = 340; else if (k.kind === 'artifact') mag = Math.max(120, s.magnet); else if (k.kind === 'key') mag = 160;
      const can = k.t > 0.4 && (k.kind !== 'potion' || p.potions < MAX_POTIONS);
      if (can && d < mag && d > 1) {
        const sp = (k.kind === 'xp' ? 420 : 330) + (1 - d / mag) * 300;
        k.x += (dx / d) * sp * dt; k.y += (dy / d) * sp * dt;
        k.vx = 0; k.vy = 0; if (k.z < 6) k.z = 6 + Math.sin(k.t * 10) * 2;
      }
      if (can && d < 22) {
        k.dead = true;
        switch (k.kind) {
          case 'gold': p.gold += k.value; this.goldEarned += k.value; sfx.coin(); this.text(p.x, p.y - 40, '+' + k.value, '#ffd84a', 0.85); break;
          case 'xp': sfx.xp(); this.addXp(k.value); break;
          case 'potion': p.potions++; sfx.potion(); this.text(p.x, p.y - 40, '+Зелье', '#ff6a8a', 0.95); this.cb.onToast('Подобрано зелье здоровья', '#ff6a8a', 'flask'); break;
          case 'key': p.keys++; sfx.pickup(); this.cb.onToast('Найден ключ от хранилища', '#ffd24a', 'key'); break;
          case 'artifact': if (k.art) this.giveArtifact(k.art); break;
        }
      }
    }
    if (this.pickups.some((x) => x.dead)) this.pickups = this.pickups.filter((x) => !x.dead);
  }

  updateCritters(dt: number) {
    const p = this.p;
    for (const r of this.critters) {
      const dx = r.x - p.x, dy = r.y - p.y;
      if (Math.abs(dx) > 700 || Math.abs(dy) > 700) continue;
      r.t -= dt;
      const d = Math.hypot(dx, dy);
      if (d < 120) { r.flee = 0.6; r.vx = (dx / d) * 170; r.vy = (dy / d) * 170; }
      else if (r.t <= 0) {
        r.t = rr(0.6, 3);
        if (rand() < 0.5) { r.vx = 0; r.vy = 0; } else { const a = rand() * 6.28; r.vx = Math.cos(a) * 34; r.vy = Math.sin(a) * 34; }
      }
      const nx = r.x + r.vx * dt, ny = r.y + r.vy * dt;
      if (!this.blockedBox(nx, ny, 5)) { r.x = nx; r.y = ny; } else { r.vx = -r.vx; r.vy = -r.vy; r.t = 0.3; }
      if (Math.abs(r.vx) > 3) r.face = r.vx > 0 ? 1 : -1;
    }
  }

  // ------------------------------------------------------------ визуальные эффекты
  shake(a: number) { this.cam.shake = Math.min(18, Math.max(this.cam.shake, a)); }
  part(x: number, y: number, vx: number, vy: number, life: number, size: number, col: string, grav = 0, kind: 0 | 1 | 2 | 3 | 4 = 0, drag = 0) {
    if (this.parts.length > 560) return;
    this.parts.push({ x, y, vx, vy, life, max: life, size, col, grav, kind, drag, spin: (rand() - 0.5) * 2, rot: rand() * 6.28 });
  }
  burst(x: number, y: number, n: number, col: string, speed: number, life: number, size: number, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = rand() * 6.28, sp = rr(0.3, 1) * speed;
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.8, life * rr(0.6, 1.2), size * rr(0.6, 1.2), col, grav, rand() < 0.5 ? 0 : 1, 0.05);
    }
  }
  ring(x: number, y: number, r: number, col: string, dur: number) {
    this.fx.push({ kind: 'ring', x, y, x2: 0, y2: 0, a: 0, r, arc: 0, side: 1, t: 0, dur, col, big: false });
  }
  text(x: number, y: number, text: string, col: string, size = 1) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x, y, vy: -46, t: 0, max: 0.95 + size * 0.15, text, col, size });
  }

  updateFx(dt: number) {
    for (const f of this.fx) f.t += dt;
    if (this.fx.some((f) => f.t >= f.dur)) this.fx = this.fx.filter((f) => f.t < f.dur);
    for (const q of this.parts) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt;
      if (q.drag) { const f = Math.pow(q.drag, dt); q.vx *= f; q.vy *= f; }
    }
    if (this.parts.some((q) => q.life <= 0)) this.parts = this.parts.filter((q) => q.life > 0);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= Math.pow(0.15, dt); }
    if (this.texts.some((t) => t.t >= t.max)) this.texts = this.texts.filter((t) => t.t < t.max);
    for (const g of this.ghosts) g.t -= dt;
    if (this.ghosts.some((g) => g.t <= 0)) this.ghosts = this.ghosts.filter((g) => g.t > 0);
  }

  updateCam(dt: number) {
    const p = this.p, c = this.cam;
    let tx = p.x, ty = p.y - 10;
    if (this.input.mode === 'mouse') {
      tx += ((this.input.mouseX - this.W / 2) / this.zoom) * 0.12;
      ty += ((this.input.mouseY - this.H / 2) / this.zoom) * 0.12;
    }
    const f = 1 - Math.pow(0.0005, dt);
    c.x += (tx - c.x) * f; c.y += (ty - c.y) * f;
    c.shake = Math.max(0, c.shake - dt * 28);
  }

  // ------------------------------------------------------------ карта
  exploreAround() {
    const p = this.p, R = 9;
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    const cols: [number, number, number][] = [[70, 72, 98], [70, 130, 80], [84, 96, 140], [120, 84, 140], [140, 84, 72], [140, 104, 72], [70, 150, 160], [176, 144, 60], [180, 54, 64], [100, 112, 80], [80, 112, 154]];
    const d = this.mmData.data;
    for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if ((x - tx) * (x - tx) + (y - ty) * (y - ty) > R * R) continue;
      const i = y * MAP_W + x;
      if (this.explored[i]) continue;
      this.explored[i] = 1; this.mmDirty = true;
      const k = this.map.kind[i], o = i * 4;
      if (k === 1) { const c = cols[this.map.theme[i]] || cols[0]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
      else if (k === 2 || k === 3) { d[o] = 26; d[o + 1] = 26; d[o + 2] = 40; d[o + 3] = 255; }
    }
    const ri = this.map.roomAt[ty * MAP_W + tx];
    this.roomName = ri >= 0 ? ROOM_NAMES[this.map.rooms[ri].seal ? 'seal' : this.map.rooms[ri].kind] : ROOM_NAMES.corridor;
  }

  // ------------------------------------------------------------ коллизии и поиск пути
  blockedBox(x: number, y: number, fr: number): boolean {
    const x0 = Math.floor((x - fr) / TS), x1 = Math.floor((x + fr) / TS), y0 = Math.floor((y - fr) / TS), y1 = Math.floor((y + fr) / TS);
    const t = this.map.tiles;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || !t[ty * MAP_W + tx]) return true;
    }
    return false;
  }
  propBlocked(x: number, y: number, fr: number, ox: number, oy: number): boolean {
    for (const pr of this.propsNear(x, y)) {
      if (!pr.solid) continue;
      const R = pr.r + fr * 0.6;
      const d = Math.hypot(x - pr.x, y - pr.y);
      if (d < R && d < Math.hypot(ox - pr.x, oy - pr.y)) return true;
    }
    return false;
  }
  moveBody(o: { x: number; y: number }, dx: number, dy: number, fr: number, fly = false) {
    if (dx !== 0) {
      const nx = o.x + dx;
      if (!this.blockedBox(nx, o.y, fr) && (fly || !this.propBlocked(nx, o.y, fr, o.x, o.y))) o.x = nx;
    }
    if (dy !== 0) {
      const ny = o.y + dy;
      if (!this.blockedBox(o.x, ny, fr) && (fly || !this.propBlocked(o.x, ny, fr, o.x, o.y))) o.y = ny;
    }
  }
  los(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), n = Math.ceil(d / 16);
    const t = this.map.tiles;
    for (let i = 1; i < n; i++) {
      const tx = Math.floor((x1 + (dx * i) / n) / TS), ty = Math.floor((y1 + (dy * i) / n) / TS);
      if (!t[ty * MAP_W + tx]) return false;
    }
    return true;
  }
  updateFlow(dt: number) {
    this.flowT -= dt;
    const tx = Math.floor(this.p.x / TS), ty = Math.floor(this.p.y / TS);
    if (this.flowT > 0 || (tx === this.flowTx && ty === this.flowTy)) return;
    this.flowT = 0.12; this.flowTx = tx; this.flowTy = ty;
    const f = this.flow, t = this.map.tiles;
    f.fill(-1);
    const q = new Int32Array(MAP_W * MAP_H);
    let h = 0, e = 0;
    const s = ty * MAP_W + tx;
    q[e++] = s; f[s] = 0;
    while (h < e) {
      const c = q[h++], cx = c % MAP_W, cy = (c / MAP_W) | 0, cd = f[c];
      if (cd >= 55) continue;
      if (cx > 0 && t[c - 1] && f[c - 1] < 0) { f[c - 1] = cd + 1; q[e++] = c - 1; }
      if (cx < MAP_W - 1 && t[c + 1] && f[c + 1] < 0) { f[c + 1] = cd + 1; q[e++] = c + 1; }
      if (cy > 0 && t[c - MAP_W] && f[c - MAP_W] < 0) { f[c - MAP_W] = cd + 1; q[e++] = c - MAP_W; }
      if (cy < MAP_H - 1 && t[c + MAP_W] && f[c + MAP_W] < 0) { f[c + MAP_W] = cd + 1; q[e++] = c + MAP_W; }
    }
  }
  flowDir(x: number, y: number): { x: number; y: number } | null {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return null;
    const cur = this.flow[ty * MAP_W + tx];
    if (cur < 0) return null;
    let best = cur, bx = 0, by = 0;
    const t = this.map.tiles;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const v = this.flow[ny * MAP_W + nx];
      if (v < 0) continue;
      if (dx && dy && (!t[ty * MAP_W + nx] || !t[ny * MAP_W + tx])) continue;
      if (v < best) { best = v; bx = dx; by = dy; }
    }
    if (best === cur) return { x: this.p.x - x, y: this.p.y - y };
    return { x: (tx + bx + 0.5) * TS - x, y: (ty + by + 0.5) * TS - y };
  }

  // ------------------------------------------------------------ магазин
  sharpenCost(): number {
    const w = this.weapon();
    const idx = WEAPONS.indexOf(w), lvl = this.p.wLevels[w.id] || 0;
    return Math.round(40 + 45 * (lvl + 1) * (1 + idx * 0.4));
  }
  buyWeapon(id: string): boolean {
    const p = this.p, w = WEAPONS.find((x) => x.id === id);
    if (!w) return false;
    if (!p.owned.includes(id)) {
      if (p.gold < w.cost) { sfx.error(); return false; }
      p.gold -= w.cost; p.owned.push(id);
      this.cb.onToast(`Куплено: ${w.name}`, w.c.glow, 'swords');
    }
    p.weapon = id; this.recalc(); sfx.buy(); this.emitHud();
    return true;
  }
  sharpen(): boolean {
    const p = this.p, w = this.weapon(), lvl = p.wLevels[w.id] || 0;
    const c = this.sharpenCost();
    if (lvl >= 5 || p.gold < c) { sfx.error(); return false; }
    p.gold -= c; p.wLevels[w.id] = lvl + 1; this.recalc(); sfx.buy(); this.emitHud();
    return true;
  }
  buyPotion(): boolean {
    const p = this.p;
    if (p.gold < 45 || p.potions >= MAX_POTIONS) { sfx.error(); return false; }
    p.gold -= 45; p.potions++; sfx.buy(); this.emitHud();
    return true;
  }
  buyKey(): boolean {
    const p = this.p;
    if (p.gold < 120) { sfx.error(); return false; }
    p.gold -= 120; p.keys++; sfx.buy(); this.emitHud();
    return true;
  }

  // ------------------------------------------------------------ HUD
  snapshot(): HudState {
    const p = this.p, s = this.s;
    const boss = this.boss && this.bossActive && !this.boss.dead ? { name: this.boss.def.name, hp: Math.max(0, this.boss.hp), max: this.boss.maxHp } : null;
    const buffs: HudState['buffs'] = [];
    if (p.power > 0) buffs.push({ name: 'Мощь алтаря', t: p.power, color: '#ff9a2e' });
    if (p.danceT > 0) buffs.push({ name: 'Танец смерти', t: p.danceT, color: '#ff3a6a' });
    if (p.critCharges > 0) buffs.push({ name: `Крит ×${p.critCharges}`, t: 0, color: '#b57cff' });
    if (p.poisonT > 0) buffs.push({ name: 'Яд', t: p.poisonT, color: '#7dff4a' });
    return {
      hp: p.hp, maxHp: s.maxHp, xp: p.xp, xpNeed: xpNeed(p.level), level: p.level, gold: p.gold, keys: p.keys, potions: p.potions, points: p.points,
      dashCd: Math.max(0, p.dashCd), dashMax: 1.0 * (1 - s.cdr * 0.5), potionCd: Math.max(0, p.potionCd),
      skills: SKILLS.map((k, i) => ({ cd: Math.max(0, p.skillCd[i]), max: k.cd * (1 - s.cdr), unlocked: p.level >= k.unlock, active: (i === 0 && p.whirlT > 0) || (i === 2 && p.danceT > 0) })),
      weapon: p.weapon, owned: p.owned.slice(), wLevels: { ...p.wLevels }, attrs: { ...p.attrs }, stats: { ...s }, artifacts: p.artifacts.slice(),
      boss, seals: this.sealsCollected, sealsTotal: this.world.guardians.length,
      prompt: this.prompt, promptKind: this.promptKind, danger: this.enemyNear(p.x, p.y, 150),
      kills: this.kills, time: this.time, buffs, room: this.roomName, bossDone: this.bossDone,
    };
  }
  emitHud() { this.cb.onHud(this.snapshot()); }
}

export { ATTRS };
export type { ProjKind };
