import { MAP_H, MAP_W, SEAL_COUNT, TS, type EnemyKind } from './data';
import type { Decal, PropKind } from './types';

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RoomKind =
  | 'camp' | 'boss' | 'crypt' | 'nest' | 'orc' | 'ogre' | 'goblin' | 'haunted' | 'treasure' | 'shrine' | 'storage' | 'vault';

export const ROOM_THEME: Record<RoomKind, number> = {
  camp: 1, crypt: 2, nest: 3, orc: 4, ogre: 5, shrine: 6, treasure: 7, vault: 7, boss: 8, goblin: 9, storage: 9, haunted: 10,
};

export interface Room {
  id: number; x: number; y: number; w: number; h: number; cx: number; cy: number;
  kind: RoomKind; ellipse: boolean; dist: number; diff: number; sub: string; seal: number;
}

export interface MapData {
  tiles: Uint8Array;
  theme: Uint8Array;
  variant: Uint8Array;
  roomAt: Int16Array;
  corr: Uint8Array;
  kind: Uint8Array; // 0 пусто, 1 пол, 2 лицо стены, 3 верх стены
  mask: Uint8Array;
  rooms: Room[];
}

export interface SpawnE { kind: EnemyKind; x: number; y: number; room: number; diff?: number; seal?: number }
export interface SpawnP { kind: PropKind; x: number; y: number; sub: string; diff: number; room: number }
export interface GuardianMarker { id: number; x: number; y: number; room: number }

export interface World {
  map: MapData;
  enemies: SpawnE[];
  props: SpawnP[];
  torches: { x: number; y: number; seed: number }[];
  decals: Decal[];
  rats: { x: number; y: number }[];
  start: { x: number; y: number };
  boss: Room;
  startRoom: Room;
  guardians: GuardianMarker[];
}

export function buildWorld(seed: number): World {
  for (let a = 0; a < 30; a++) {
    const w = tryBuild(seed + a * 7919, false);
    if (w) return w;
  }
  return tryBuild(seed, true) as World;
}

function tryBuild(seed: number, force: boolean): World | null {
  const rand = mulberry32(seed);
  const W = MAP_W, H = MAP_H;
  const int = (n: number) => Math.floor(rand() * n);
  const tiles = new Uint8Array(W * H);
  const theme = new Uint8Array(W * H);
  const roomAt = new Int16Array(W * H).fill(-1);
  const corr = new Uint8Array(W * H);
  const rooms: Room[] = [];

  const tryRoom = (w: number, h: number, x: number, y: number, ellipse: boolean) => {
    for (const r of rooms) {
      if (!(x + w + 3 <= r.x || r.x + r.w + 3 <= x || y + h + 3 <= r.y || r.y + r.h + 3 <= y)) return false;
    }
    rooms.push({ id: rooms.length, x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), kind: 'storage', ellipse, dist: 0, diff: 0, sub: '', seal: 0 });
    return true;
  };
  tryRoom(22, 18, 3 + int(W - 22 - 6), 3 + int(H - 18 - 6), true);
  for (let i = 0; i < 3000 && rooms.length < 56; i++) {
    const w = 7 + int(10), h = 6 + int(8);
    tryRoom(w, h, 3 + int(W - w - 6), 3 + int(H - h - 6), w >= 9 && h >= 8 && rand() < 0.3);
  }
  if (rooms.length < 45 && !force) return null;

  for (const r of rooms) {
    for (let ty = r.y; ty < r.y + r.h; ty++) {
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        if (r.ellipse) {
          const nx = (tx + 0.5 - (r.x + r.w / 2)) / (r.w / 2);
          const ny = (ty + 0.5 - (r.y + r.h / 2)) / (r.h / 2);
          if (nx * nx + ny * ny > 1) continue;
        }
        tiles[ty * W + tx] = 1;
        roomAt[ty * W + tx] = r.id;
      }
    }
  }

  const carveTile = (x: number, y: number) => {
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) return;
    const i = y * W + x;
    tiles[i] = 1;
    corr[i] = 1;
  };
  const carve = (a: Room, b: Room) => {
    let x = a.cx, y = a.cy;
    const hFirst = rand() < 0.5;
    const stepX = () => { while (x !== b.cx) { carveTile(x, y); carveTile(x, y + 1); x += Math.sign(b.cx - x); } };
    const stepY = () => { while (y !== b.cy) { carveTile(x, y); carveTile(x + 1, y); y += Math.sign(b.cy - y); } };
    if (hFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    carveTile(x, y); carveTile(x + 1, y); carveTile(x, y + 1); carveTile(x + 1, y + 1);
  };
  const dist2 = (a: Room, b: Room) => Math.hypot(a.cx - b.cx, a.cy - b.cy);
  const edges = new Set<string>();
  const connected = [rooms[0]];
  const rest = rooms.slice(1);
  while (rest.length) {
    let best = 1e9, bi = 0, bj = 0;
    for (let i = 0; i < connected.length; i++) for (let j = 0; j < rest.length; j++) {
      const d = dist2(connected[i], rest[j]);
      if (d < best) { best = d; bi = i; bj = j; }
    }
    carve(connected[bi], rest[bj]);
    edges.add(connected[bi].id + '-' + rest[bj].id);
    connected.push(rest[bj]);
    rest.splice(bj, 1);
  }
  for (let k = 0; k < Math.floor(rooms.length / 3); k++) {
    const a = rooms[int(rooms.length)];
    let best = 1e9, bb: Room | null = null;
    for (const b of rooms) {
      if (b === a || edges.has(a.id + '-' + b.id) || edges.has(b.id + '-' + a.id)) continue;
      const d = dist2(a, b);
      if (d < best && d < 40) { best = d; bb = b; }
    }
    if (bb) { carve(a, bb); edges.add(a.id + '-' + bb.id); }
  }

  // маска дверных проёмов (запрет на реквизит)
  const noProp = new Uint8Array(W * H);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    if (corr[i] && roomAt[i] < 0) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) noProp[(y + dy) * W + x + dx] = 1;
    }
  }

  const boss = rooms[0];
  // колонны
  const pillar = (tx: number, ty: number, s: number) => {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      const i = (ty + dy) * W + tx + dx;
      if (tiles[i] && !noProp[i]) tiles[i] = 0;
    }
  };
  for (const r of rooms) {
    if (r === boss) {
      for (const [ox, oy] of [[-6, -5], [5, -5], [-6, 4], [5, 4]]) pillar(r.cx + ox, r.cy + oy, 2);
    } else if (r.w >= 11 && r.h >= 9 && rand() < 0.5) {
      for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) pillar(px, py, 1);
    }
  }

  // BFS
  const bfs = (sx: number, sy: number) => {
    const d = new Int32Array(W * H).fill(-1);
    const q = new Int32Array(W * H);
    let h = 0, t = 0;
    q[t++] = sy * W + sx; d[sy * W + sx] = 0;
    while (h < t) {
      const c = q[h++];
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !tiles[ni] || d[ni] >= 0) continue;
        d[ni] = d[c] + 1; q[t++] = ni;
      }
    }
    return d;
  };
  const dBoss = bfs(boss.cx, boss.cy);
  let startRoom = rooms[1], bestD = -1;
  for (const r of rooms) {
    if (r === boss) continue;
    const dd = dBoss[r.cy * W + r.cx];
    if (dd > bestD) { bestD = dd; startRoom = r; }
  }
  const dStart = bfs(startRoom.cx, startRoom.cy);
  const bossDist = Math.max(1, dStart[boss.cy * W + boss.cx]);
  if (!force && rooms.some((r) => dStart[r.cy * W + r.cx] < 0)) return null;
  for (const r of rooms) {
    r.dist = Math.max(0, dStart[r.cy * W + r.cx]);
    r.diff = Math.min(1, r.dist / bossDist);
  }

  // типы комнат
  boss.kind = 'boss';
  startRoom.kind = 'camp';
  const taken = new Set<Room>([boss, startRoom]);
  const pool = () => rooms.filter((r) => !taken.has(r));
  const pickClosest = (frac: number) => {
    let b: Room | null = null;
    for (const r of pool()) if (!b || Math.abs(r.diff - frac) < Math.abs(b.diff - frac)) b = r;
    return b;
  };
  for (const f of [0.45, 0.85]) {
    const r = pickClosest(f);
    if (r) { r.kind = 'camp'; taken.add(r); }
  }
  const pickRand = (cond: (r: Room) => boolean) => {
    const p = pool().filter(cond);
    return p.length ? p[int(p.length)] : null;
  };
  for (let i = 0; i < 3 && pool().length > 8; i++) {
    const r = pickRand((q) => q.diff > 0.2 && q.w * q.h >= 50);
    if (r) { r.kind = i === 0 ? 'vault' : 'treasure'; taken.add(r); }
  }
  const subs = ['blood', 'power', 'life', 'fortune', 'curse'].sort(() => rand() - 0.5);
  for (let i = 0; i < 5 && pool().length > 7; i++) {
    const r = pickRand((q) => q.diff > 0.08);
    if (r) { r.kind = 'shrine'; r.sub = subs[i]; taken.add(r); }
  }
  for (const r of pool()) {
    const d = r.diff;
    const opts: [RoomKind, number][] = d < 0.3
      ? [['goblin', 40], ['crypt', 15], ['nest', 25], ['storage', 20]]
      : d < 0.65
        ? [['goblin', 15], ['crypt', 25], ['nest', 20], ['orc', 30], ['storage', 10]]
        : [['orc', 25], ['ogre', 25], ['crypt', 20], ['haunted', 20], ['nest', 10]];
    let tot = 0; for (const o of opts) tot += o[1];
    let x = rand() * tot;
    for (const o of opts) { x -= o[1]; if (x <= 0) { r.kind = o[0]; break; } }
    if (r.kind === 'storage' && !opts.some((o) => o[0] === 'storage')) r.kind = 'goblin';
  }

  // Три хранителя разнесены по глубине подземелья. Без их печатей босс защищён.
  const guardians: GuardianMarker[] = [];
  const chosen: Room[] = [];
  const candidates = rooms.filter((r) => !taken.has(r) && r.kind !== 'storage');
  for (const target of [0.3, 0.58, 0.86]) {
    const available = candidates.filter((r) => !chosen.includes(r));
    available.sort((a, b) => {
      const score = (r: Room) => {
        const spacing = chosen.length ? Math.min(...chosen.map((o) => dist2(r, o))) : 100;
        return Math.abs(r.diff - target) + Math.max(0, 20 - spacing) * 0.025 + (r.w * r.h < 65 ? 0.12 : 0);
      };
      return score(a) - score(b);
    });
    const r = available[0];
    if (r) { r.seal = chosen.length + 1; chosen.push(r); }
  }
  for (const r of rooms) {
    const th = ROOM_THEME[r.kind];
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) {
      if (roomAt[ty * W + tx] === r.id) theme[ty * W + tx] = th;
    }
  }

  // ---- наполнение ----
  const used = new Uint8Array(W * H);
  // Стартовая клетка остаётся свободной от бочек, сундуков и торговца.
  const spawnX = Math.floor(startRoom.cx + 0.5 - 1.8);
  const spawnY = Math.floor(startRoom.cy + 0.5 + 0.4);
  used[spawnY * W + spawnX] = 1;
  const E: SpawnE[] = [];
  const P: SpawnP[] = [];
  const decals: Decal[] = [];
  const place = (r: Room, margin = 1, wallHug = false) => {
    for (let k = 0; k < 50; k++) {
      const tx = r.x + int(r.w), ty = r.y + int(r.h);
      const i = ty * W + tx;
      if (!tiles[i] || roomAt[i] !== r.id || noProp[i] || used[i]) continue;
      if (wallHug) {
        if (tiles[i - 1] && tiles[i + 1] && tiles[i - W] && tiles[i + W]) continue;
      } else {
        let ok = true;
        for (let dy = -margin; dy <= margin && ok; dy++) for (let dx = -margin; dx <= margin; dx++) if (!tiles[i + dy * W + dx]) { ok = false; break; }
        if (!ok) continue;
      }
      used[i] = 1;
      return { x: tx * TS + TS / 2 + (rand() - 0.5) * TS * 0.4, y: ty * TS + TS / 2 + (rand() - 0.5) * TS * 0.3 };
    }
    return null;
  };
  const addE = (kind: EnemyKind, r: Room, n = 1) => {
    for (let i = 0; i < n; i++) { const q = place(r, 1); if (q) E.push({ kind, x: q.x, y: q.y, room: r.id }); }
  };
  const addP = (kind: PropKind, r: Room, n: number, margin = 0, wall = false, sub = '') => {
    for (let i = 0; i < n; i++) {
      const q = place(r, margin, wall);
      if (q) P.push({ kind, x: q.x, y: q.y, sub, diff: r.diff, room: r.id });
    }
  };
  const addDecals = (r: Room, kinds: Decal['kind'][], n: number) => {
    for (let i = 0; i < n; i++) {
      const tx = r.x + int(r.w), ty = r.y + int(r.h);
      if (!tiles[ty * W + tx]) continue;
      const k = kinds[int(kinds.length)];
      decals.push({ kind: k, x: tx * TS + rand() * TS, y: ty * TS + rand() * TS, r: 14 + rand() * 22, rot: rand() * 6.28, seed: int(1000), col: '' });
    }
  };
  const rp = (r: Room) => ({ x: r.cx * TS + TS / 2, y: r.cy * TS + TS / 2 });

  for (const r of rooms) {
    const k = (r.w * r.h) / 85;
    const d = r.diff;
    const cp = rp(r);
    switch (r.kind) {
      case 'camp': {
        P.push({ kind: 'campfire', x: cp.x, y: cp.y, sub: '', diff: d, room: r.id });
        used[r.cy * W + r.cx] = 1;
        // торговец ставится только на свободный проходимый тайл
        const mq = place(r, 1) || { x: cp.x + TS * 2, y: cp.y - TS * 0.3 };
        P.push({ kind: 'merchant', x: mq.x, y: mq.y, sub: '', diff: d, room: r.id });
        addP('barrel', r, 2 + int(2), 0, true); addP('crate', r, 2, 0, true); addP('candles', r, 2);
        addDecals(r, ['rug'], 1); addDecals(r, ['crack', 'bones'], 2);
        break;
      }
      case 'crypt': {
        addE('skeleton', r, Math.round(4 + k * 2) + int(2));
        if (d > 0.2) addE('skelArcher', r, 1 + int(2));
        if (d > 0.35) addE('necro', r, d > 0.7 ? 2 : 1);
        addP('sarcophagus', r, 2 + int(2), 0, true); addP('bones', r, 3); addP('candles', r, 2); addP('barrel', r, 1, 0, true);
        addDecals(r, ['bones', 'crack', 'moss'], 6);
        break;
      }
      case 'nest': {
        addE('spider', r, Math.round(5 + k * 3));
        if (d > 0.25) addE('webSpider', r, 1 + int(2));
        addP('web', r, 5 + int(3), 0); addP('cocoon', r, 3 + int(2), 0, true); addP('bones', r, 2);
        addDecals(r, ['moss', 'crack', 'ichor'], 6);
        break;
      }
      case 'orc': {
        addE('orc', r, 3 + int(d * 3));
        addE('goblin', r, 2 + int(2));
        if (d > 0.45) addE('shaman', r, 1);
        P.push({ kind: 'orcfire', x: cp.x, y: cp.y, sub: '', diff: d, room: r.id }); used[r.cy * W + r.cx] = 1;
        addP('crate', r, 2, 0, true); addP('barrel', r, 2, 0, true); addP('bomb', r, 1 + int(2), 0, true); addP('bones', r, 3);
        addDecals(r, ['blood', 'bones', 'scorch'], 7);
        break;
      }
      case 'ogre': {
        addE('ogre', r, d > 0.75 ? 2 : 1);
        addE('goblin', r, 3 + int(2));
        if (d > 0.6) addE('orc', r, 1);
        addP('barrel', r, 3, 0, true); addP('crate', r, 3, 0, true); addP('bones', r, 4); addP('bomb', r, 1, 0, true);
        addDecals(r, ['blood', 'bones'], 8);
        break;
      }
      case 'goblin': {
        addE('goblin', r, Math.round(5 + k * 2));
        addE('goblinArcher', r, 1 + int(2) + (d > 0.3 ? 1 : 0));
        if (d > 0.25) addE('bat', r, 2);
        addP('crate', r, 3, 0, true); addP('barrel', r, 3, 0, true); addP('bomb', r, 1, 0, true);
        if (rand() < 0.4) addP('chest', r, 1, 1);
        addDecals(r, ['blood', 'bones', 'crack'], 5);
        break;
      }
      case 'haunted': {
        addE('wraith', r, 3 + int(2));
        addE('bat', r, 3 + int(3));
        addE('skeleton', r, 2);
        addP('brazier', r, 2, 1, false, 'blue'); addP('candles', r, 4); addP('bones', r, 3); addP('sarcophagus', r, 1, 0, true);
        addDecals(r, ['rune', 'crack', 'moss'], 6);
        break;
      }
      case 'treasure': {
        const n = 2 + int(2);
        const mimic = rand() < 0.4 ? int(n) : -1;
        for (let i = 0; i < n; i++) addP(i === mimic ? 'mimic' : (rand() < 0.45 ? 'ironchest' : 'chest'), r, 1, 1);
        addP('spikes', r, 3 + int(3), 1); addP('brazier', r, 2, 1);
        addE(d > 0.4 ? 'orc' : 'skeleton', r, 1); addE(d > 0.3 ? 'skelArcher' : 'goblin', r, 2);
        addDecals(r, ['rug', 'rug', 'crack'], 3);
        break;
      }
      case 'vault': {
        P.push({ kind: 'vault', x: cp.x, y: cp.y, sub: '', diff: d, room: r.id }); used[r.cy * W + r.cx] = 1;
        addP('ironchest', r, 1, 1); addP('spikes', r, 4, 1); addP('brazier', r, 2, 1);
        addE(d > 0.4 ? 'orc' : 'skeleton', r, 2); addE(d > 0.3 ? 'necro' : 'skelArcher', r, 1); addE('goblin', r, 1);
        decals.push({ kind: 'rune', x: cp.x, y: cp.y, r: 70, rot: 0, seed: 7, col: '#ffcc55' });
        break;
      }
      case 'shrine': {
        P.push({ kind: 'shrine', x: cp.x, y: cp.y, sub: r.sub, diff: d, room: r.id }); used[r.cy * W + r.cx] = 1;
        addP('candles', r, 3); addP('brazier', r, 2, 1);
        if (r.sub !== 'curse') addE(d > 0.45 ? 'orc' : 'skeleton', r, int(2) + 1);
        decals.push({ kind: 'rune', x: cp.x, y: cp.y, r: 62, rot: 0, seed: 3, col: '' });
        break;
      }
      case 'storage': {
        addP('barrel', r, 5 + int(4), 0, true); addP('crate', r, 4 + int(4), 0, true); addP('bomb', r, 1 + int(2), 0, true);
        addE('goblin', r, 3); addE('bat', r, 2);
        if (rand() < 0.3) addP('chest', r, 1, 1);
        addDecals(r, ['crack', 'bones'], 3);
        break;
      }
      case 'boss': {
        E.push({ kind: 'boss', x: cp.x, y: cp.y - TS, room: r.id });
        for (const [ox, oy] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
          const bx = cp.x + ox * TS, by = cp.y + oy * TS;
          const ti = Math.floor(by / TS) * W + Math.floor(bx / TS);
          if (tiles[ti]) P.push({ kind: 'brazier', x: bx, y: by, sub: 'red', diff: 1, room: r.id });
        }
        decals.push({ kind: 'rune', x: cp.x, y: cp.y, r: 190, rot: 0, seed: 11, col: '#ff3b3b' });
        addP('bones', r, 8); addDecals(r, ['blood', 'bones', 'crack', 'scorch'], 14);
        break;
      }
    }
    if (r.seal > 0) {
      const kind: EnemyKind = r.kind === 'nest' ? 'webSpider' : r.kind === 'ogre' ? 'ogre'
        : r.kind === 'haunted' ? 'wraith' : r.kind === 'crypt' ? 'necro'
          : r.kind === 'orc' ? 'orc' : 'skeleton';
      const q = place(r, 1) || cp;
      E.push({ kind, x: q.x, y: q.y, room: r.id, seal: r.seal });
      guardians.push({ id: r.seal, x: q.x, y: q.y, room: r.id });
      decals.push({ kind: 'rune', x: q.x, y: q.y, r: 64, rot: 0, seed: r.seal * 9, col: '#a86bff' });
    }
  }

  // Патрули делают длинные коридоры живыми, но не мешают передышке у лагерей.
  const cor: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (corr[i] && roomAt[i] < 0 && dStart[i] > 14 && dStart[i] < bossDist - 10) cor.push(i);
  }
  const patrols: number[] = [];
  for (let i = 0; i < 28 && cor.length; i++) {
    const idx = cor[int(cor.length)];
    const x = idx % W, y = (idx / W) | 0;
    const dd = Math.min(1, dStart[idx] / bossDist);
    if (i < 14) {
      P.push({ kind: i % 3 === 0 ? 'web' : 'spikes', x: x * TS + TS / 2, y: y * TS + TS / 2, sub: '', diff: dd, room: -1 });
    }
    if (i % 2 !== 0 || patrols.some((prev) => {
      const px = prev % W, py = (prev / W) | 0;
      return (x - px) ** 2 + (y - py) ** 2 < 81;
    })) continue;
    patrols.push(idx);
    const kinds: EnemyKind[] = dd < 0.33 ? ['bat', 'goblin'] : dd < 0.68
      ? ['skeleton', 'spider', 'goblinArcher'] : ['skeleton', 'orc', 'wraith'];
    for (let n = 0; n < 2; n++) {
      const nx = x + (n === 1 && tiles[idx + 1] ? 1 : 0);
      E.push({ kind: kinds[int(kinds.length)], x: nx * TS + TS / 2, y: y * TS + TS / 2, room: -1, diff: dd });
    }
  }

  // факелы
  const torches: { x: number; y: number; seed: number }[] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (tiles[i] || !tiles[i + W]) continue;
    const inRoom = roomAt[i + W] >= 0;
    if (rand() > (inRoom ? 0.22 : 0.09)) continue;
    const tx = x * TS + TS / 2, ty = y * TS + TS * 0.55;
    let near = false;
    for (const t of torches) if (Math.abs(t.x - tx) < TS * 3.4 && Math.abs(t.y - ty) < TS * 3.4) { near = true; break; }
    if (!near) torches.push({ x: tx, y: ty, seed: rand() * 100 });
  }

  // крысы
  const rats: { x: number; y: number }[] = [];
  for (let i = 0; i < 65; i++) {
    const r = rooms[int(rooms.length)];
    const tx = r.x + int(r.w), ty = r.y + int(r.h);
    if (tiles[ty * W + tx]) rats.push({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
  }

  // классификация тайлов для рендера
  const kind = new Uint8Array(W * H);
  const mask = new Uint8Array(W * H);
  const variant = new Uint8Array(W * H);
  const fl = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H && tiles[y * W + x] === 1 ? 1 : 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    variant[i] = int(256);
    if (tiles[i]) {
      kind[i] = 1;
      mask[i] = (fl(x, y - 1) ? 0 : 1) | (fl(x + 1, y) ? 0 : 2) | (fl(x, y + 1) ? 0 : 4) | (fl(x - 1, y) ? 0 : 8);
    } else {
      if (fl(x, y + 1)) kind[i] = 2;
      else {
        let any = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (fl(x + dx, y + dy)) any = true;
        kind[i] = any ? 3 : 0;
      }
      mask[i] = fl(x, y - 1) | (fl(x + 1, y) << 1) | (fl(x, y + 1) << 2) | (fl(x - 1, y) << 3);
    }
  }

  const map: MapData = { tiles, theme, variant, roomAt, corr, kind, mask, rooms };
  const sp = rp(startRoom);
  return {
    map, enemies: E, props: P, torches, decals, rats,
    start: { x: sp.x - TS * 1.8, y: sp.y + TS * 0.4 }, boss, startRoom, guardians: guardians.slice(0, SEAL_COUNT),
  };
}
