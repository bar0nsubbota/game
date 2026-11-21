import { MAP_H, MAP_W, TS } from './data';
import type { Game } from './engine';
import { getGfx } from './gfx';
import * as S from './sprites';
import { getWorldSprites } from './worldSprites';

const TAU = Math.PI * 2;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function rgba(hex: string, a: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface Drawable { y: number; k: number; o: unknown }
const list: Drawable[] = [];

let lc: HTMLCanvasElement | null = null;
let lctx: CanvasRenderingContext2D | null = null;
let mmCache: HTMLCanvasElement | null = null;
let mmCacheCtx: CanvasRenderingContext2D | null = null;
let mmCacheT = -99;
let mmCacheSz = 0;

export function minimapSize(w: number, h: number) {
  return Math.max(92, Math.min(150, Math.min(w, h) * 0.28));
}

export function renderGame(g: Game, now: number) {
  const gfx = getGfx();
  const ctx = g.ctx, W = g.W, H = g.H, dpr = g.dpr, zoom = g.zoom, p = g.p, map = g.map;
  const sh = g.cam.shake;
  const cx = g.cam.x + (Math.random() - 0.5) * sh, cy = g.cam.y + (Math.random() - 0.5) * sh;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#141322';
  ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
  const sc = dpr * zoom;
  const setWorld = () => ctx.setTransform(sc, 0, 0, sc, (dpr * W) / 2 - cx * sc, (dpr * H) / 2 - cy * sc);
  setWorld();
  const vw = W / zoom, vh = H / zoom;
  const left = cx - vw / 2, top = cy - vh / 2, right = cx + vw / 2, bottom = cy + vh / 2;
  const x0 = Math.max(0, Math.floor(left / TS) - 1), x1 = Math.min(MAP_W - 1, Math.floor(right / TS) + 1);
  const y0 = Math.max(0, Math.floor(top / TS) - 1), y1 = Math.min(MAP_H - 1, Math.floor(bottom / TS) + 2);
  ctx.imageSmoothingEnabled = true;

  // ---- тайлы
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * MAP_W + tx, k = map.kind[i];
      if (!k) continue;
      const px = tx * TS, py = ty * TS, v = map.variant[i], m = map.mask[i];
      if (k === 1) {
        const fl = gfx.floorBig[map.theme[i]] || gfx.floorBig[0];
        const span = 8;
        const sw = fl.width / span;
        ctx.drawImage(fl, (tx % span) * sw, (ty % span) * sw, sw, sw, px, py, TS + 1, TS + 1);
        if (m) {
          if (m & 1) ctx.drawImage(gfx.aoN, px, py, TS + 1, TS * 0.6);
          if (m & 2) ctx.drawImage(gfx.aoE, px + TS * 0.7, py, TS * 0.3 + 1, TS + 1);
          if (m & 4) ctx.drawImage(gfx.aoS, px, py + TS * 0.78, TS + 1, TS * 0.22 + 1);
          if (m & 8) ctx.drawImage(gfx.aoW, px, py, TS * 0.3, TS + 1);
        }
      } else if (k === 2) {
        ctx.drawImage(gfx.face[v % 3], px, py, TS + 1, TS + 1);
      } else {
        ctx.drawImage(gfx.top[v % 3], px, py, TS + 1, TS + 1);
        if (m) {
          ctx.fillStyle = '#3a3748';
          if (m & 1) ctx.fillRect(px, py, TS + 1, 3);
          if (m & 2) ctx.fillRect(px + TS - 3, py, 3, TS + 1);
          if (m & 8) ctx.fillRect(px, py, 3, TS + 1);
        }
      }
    }
  }
  // факелы на стенах
  for (const t of g.world.torches) {
    if (t.x < left - 40 || t.x > right + 40 || t.y < top - 60 || t.y > bottom + 40) continue;
    const fl = 1 + Math.sin(now * 9 + t.seed) * 0.08 + Math.sin(now * 17 + t.seed * 2) * 0.05;
    // кованый держатель
    ctx.strokeStyle = '#2a2730'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(t.x, t.y - 2); ctx.lineTo(t.x, t.y + 9); ctx.stroke();
    ctx.fillStyle = '#17151d';
    ctx.beginPath(); ctx.moveTo(t.x - 5, t.y - 7); ctx.lineTo(t.x + 5, t.y - 7); ctx.lineTo(t.x + 3, t.y - 1); ctx.lineTo(t.x - 3, t.y - 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a4552'; ctx.lineWidth = 1; ctx.stroke();
    // тёплое свечение у основания пламени
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * fl;
    ctx.drawImage(gfx.glow('#ff9a3a'), t.x - 26, t.y - 28, 52, 52);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    S.flame(ctx, t.x, t.y - 6, 4.6 * fl, 16 * fl, now, t.seed, '#ff8a22', '#ffe27a');
  }
  // ---- декали
  const inView = (x: number, y: number, m: number) => x > left - m && x < right + m && y > top - m && y < bottom + m;
  for (const d of g.stains) if (inView(d.x, d.y, 200)) S.drawDecal(ctx, d, now);
  // ---- реквизит на полу
  for (const pr of g.props) if (S.isFloorProp(pr.kind) && inView(pr.x, pr.y, 40)) S.drawProp(ctx, pr, now);
  // ---- зоны (телеграфы)
  for (const z of g.zones) {
    if (!inView(z.x, z.y, z.r + z.len + 100)) continue;
    drawZone(ctx, z);
  }
  if (g.boss && !g.bossDone && g.sealsCollected < g.world.guardians.length && inView(g.boss.x, g.boss.y, 170)) {
    ctx.save(); ctx.translate(g.boss.x, g.boss.y); ctx.scale(1, 0.55);
    ctx.strokeStyle = 'rgba(194,125,255,0.65)'; ctx.lineWidth = 3;
    ctx.setLineDash([13, 8]); ctx.lineDashOffset = -now * 12;
    ctx.beginPath(); ctx.arc(0, 0, 96 + Math.sin(now * 2) * 3, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  // ---- пылинки
  ctx.fillStyle = 'rgba(220,210,200,0.35)';
  for (const m of g.motes) {
    const mx = left + (((m.x * vw + now * 7 * (m.z + 0.3)) % vw) + vw) % vw;
    const my = top + (((m.y * vh - now * 5 * (m.z + 0.2)) % vh) + vh) % vh;
    ctx.globalAlpha = 0.15 + 0.2 * Math.sin(now * 1.5 + m.z * 20);
    ctx.beginPath(); ctx.arc(mx, my, 1 + m.z, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- сущности с сортировкой по Y
  list.length = 0;
  for (const pr of g.props) if (!S.isFloorProp(pr.kind) && inView(pr.x, pr.y, 70)) list.push({ y: pr.y, k: 0, o: pr });
  for (const e of g.enemies) if (inView(e.x, e.y, e.boss ? 200 : 100)) list.push({ y: e.y, k: 1, o: e });
  list.push({ y: p.y, k: 2, o: p });
  for (const k of g.pickups) if (inView(k.x, k.y, 40)) list.push({ y: k.y, k: 3, o: k });
  for (const c of g.critters) if (inView(c.x, c.y, 30)) list.push({ y: c.y, k: 4, o: c });
  list.sort((a, b) => a.y - b.y);
  const w = g.weapon();
  for (const gh of g.ghosts) {
    ctx.save(); ctx.translate(gh.x, gh.y);
    ctx.globalAlpha = Math.max(0, gh.t / 0.3) * 0.5;
    S.drawPlayer(ctx, { ...p, face: gh.face as 1 | -1, swing: 0, whirlT: 0 }, { ...w, c: { ...w.c, glow: gh.col } }, 1);
    ctx.restore();
  }
  for (const d of list) {
    switch (d.k) {
      case 0: S.drawProp(ctx, d.o as never, now); break;
      case 1: S.drawEnemy(ctx, d.o as never); break;
      case 2: {
        ctx.save(); ctx.translate(p.x, p.y);
        S.shadow(ctx, 0, 1, 12, 4.4, 0.45);
        // мягкий контровой ореол — герой читается на тёмном фоне
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.14;
        ctx.drawImage(gfx.glow(w.c.glow.length === 7 ? w.c.glow : '#cfd8e3'), -34, -54, 68, 68);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        const a = p.iframes > 0 && p.dashT <= 0 ? (Math.sin(now * 50) > 0 ? 0.5 : 0.95) : p.dashT > 0 ? 0.8 : 1;
        if (p.danceT > 0) {
          ctx.globalCompositeOperation = 'lighter';
          const dc = w.id === 'rusty' ? '#ff2e63' : w.c.glow;
          const dr = 42 + Math.sin(now * 14) * 5;
          const dg = ctx.createRadialGradient(0, -18, 4, 0, -18, dr);
          dg.addColorStop(0, rgba(w.id === 'rusty' ? '#ffd27a' : w.c.edge, 0.24));
          dg.addColorStop(0.5, rgba(dc, 0.26));
          dg.addColorStop(1, rgba(dc, 0));
          ctx.fillStyle = dg;
          ctx.beginPath(); ctx.arc(0, -18, dr, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        S.drawPlayer(ctx, p, w, a);
        ctx.restore();
        break;
      }
      case 3: S.drawPickup(ctx, d.o as never, now); break;
      default: S.drawCritter(ctx, d.o as never, now);
    }
  }
  // ---- снаряды
  for (const pr of g.projs) if (inView(pr.x, pr.y, 40)) S.drawProj(ctx, pr, now, w);
  // ---- эффекты
  for (const f of g.fx) drawFx(ctx, f);
  // ---- частицы
  for (const q of g.parts) {
    if (!inView(q.x, q.y, 40)) continue;
    const u = q.life / q.max;
    if (q.kind === 3) {
      // дым: растёт и бледнеет
      const s = q.size * (1 + (1 - u) * 2.4);
      ctx.globalAlpha = Math.min(0.5, u * 0.5);
      ctx.drawImage(gfx.smoke, q.x - s, q.y - s, s * 2, s * 2);
      continue;
    }
    if (q.kind === 4) {
      // тлеющий уголёк: яркое ядро + тёплое свечение (аддитивно)
      const s = q.size * (0.5 + u * 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, u * 1.4);
      ctx.drawImage(gfx.spark, q.x - s * 2, q.y - s * 2, s * 4, s * 4);
      ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    ctx.globalAlpha = Math.min(1, u * 1.6);
    if (q.kind === 2) {
      // неоновая искра: свечение вокруг ядра
      ctx.globalCompositeOperation = 'lighter';
      const s = q.size * (0.4 + u * 0.6);
      ctx.globalAlpha = Math.min(0.6, u * 0.8);
      ctx.drawImage(gfx.glow(q.col.length === 7 ? q.col : '#ffffff'), q.x - s * 2.2, q.y - s * 2.2, s * 4.4, s * 4.4);
      ctx.globalAlpha = Math.min(1, u * 1.6);
      ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(q.x, q.y, s / 2 + 0.3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    ctx.fillStyle = q.col;
    const s = q.size * (0.4 + u * 0.6);
    if (q.kind === 1) {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate((q.rot || 0) + (q.spin || 0) * (1 - u) * 6);
      ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
    } else { ctx.beginPath(); ctx.arc(q.x, q.y, s / 2 + 0.3, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // ---- освещение (0.25× на мобильных = в 4 раза меньше пикселей при той же мягкости)
  const lScale = g.isMobile ? 0.25 : 0.5;
  const lw = Math.max(1, Math.ceil(W * lScale)), lh = Math.max(1, Math.ceil(H * lScale));
  if (!lc) { lc = document.createElement('canvas'); lctx = lc.getContext('2d'); }
  if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
  const L = lctx!;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.globalCompositeOperation = 'source-over';
  L.globalAlpha = 1;
  L.fillStyle = 'rgba(14,12,28,0.28)';
  L.clearRect(0, 0, lw, lh);
  L.fillRect(0, 0, lw, lh);
  const ls = lScale * zoom;
  L.setTransform(ls, 0, 0, ls, lw / 2 - cx * ls, lh / 2 - cy * ls);
  L.globalCompositeOperation = 'destination-out';
  const light = (x: number, y: number, r: number, a = 1) => { L.globalAlpha = a; L.drawImage(gfx.light, x - r, y - r, r * 2, r * 2); };
  light(p.x, p.y - 14, 460 + Math.sin(now * 7) * 8, 1);
  const glows: { x: number; y: number; r: number; c: string; a: number }[] = [];
  for (const t of g.world.torches) {
    if (t.x < left - 260 || t.x > right + 260 || t.y < top - 260 || t.y > bottom + 260) continue;
    const fl = 1 + Math.sin(now * 9 + t.seed) * 0.07 + Math.sin(now * 17 + t.seed * 2) * 0.05;
    light(t.x, t.y + 20, 210 * fl, 0.97);
    glows.push({ x: t.x, y: t.y + 6, r: 170 * fl, c: '#ff8a2a', a: 0.3 });
    glows.push({ x: t.x, y: t.y + 2, r: 70 * fl, c: '#ffd27a', a: 0.3 });
  }
  for (const pr of g.props) {
    if (!pr.light || pr.dead || !inView(pr.x, pr.y, 320)) continue;
    const fl = 1 + Math.sin(now * 8 + pr.seed) * 0.07 + Math.sin(now * 15 + pr.seed) * 0.04;
    light(pr.x, pr.y - 12, pr.light * fl, 0.96);
    const warm = pr.kind === 'campfire' || pr.kind === 'orcfire';
    glows.push({ x: pr.x, y: pr.y - 14, r: pr.light * 0.65 * fl, c: pr.state > 0 && pr.kind === 'shrine' ? '#555566' : pr.lightCol, a: warm ? 0.32 : 0.22 });
    if (warm) glows.push({ x: pr.x, y: pr.y - 16, r: pr.light * 0.3 * fl, c: '#ffe29a', a: 0.3 });
  }
  for (const pr of g.projs) if (inView(pr.x, pr.y, 120)) { light(pr.x, pr.y - 12, 80, 0.9); glows.push({ x: pr.x, y: pr.y - 12, r: 60, c: pr.col.length === 7 ? pr.col : '#ffffff', a: 0.3 }); }
  for (const f of g.fx) {
    const u = f.t / f.dur;
    if (f.kind === 'ring') light(f.x, f.y, f.r * 1.2, 0.5 * (1 - u));
    else if (f.kind === 'slash') { light(f.x + Math.cos(f.a) * 30, f.y + Math.sin(f.a) * 30, 110, 0.6 * (1 - u)); glows.push({ x: f.x + Math.cos(f.a) * 34, y: f.y + Math.sin(f.a) * 34, r: 80, c: f.col.length === 7 ? f.col : '#ffffff', a: 0.25 * (1 - u) }); }
    else if (f.kind === 'pillar') light(f.x, f.y, f.r * 1.8, 0.8);
  }
  for (const e of g.enemies) {
    if (!inView(e.x, e.y, 200)) continue;
    if (e.boss) { light(e.x, e.y - 60, 240, 0.85); glows.push({ x: e.x, y: e.y - 66, r: 150, c: g.sealsCollected < g.world.guardians.length ? '#a64aff' : e.phase >= 3 ? '#a64aff' : '#ff4a2a', a: 0.22 }); }
    if (e.seal) { light(e.x, e.y - e.def.h * e.sc * 0.5, 125, 0.65); glows.push({ x: e.x, y: e.y - 20, r: 115, c: '#b475f9', a: 0.24 }); }
    if (e.st.burnT > 0) { light(e.x, e.y - 12, 90, 0.8); glows.push({ x: e.x, y: e.y - 12, r: 60, c: '#ff8a2a', a: 0.3 }); }
    if (e.state === 'windup' && e.def.kind === 'necro') glows.push({ x: e.x + 8, y: e.y - 40, r: 50, c: '#7dff8a', a: 0.3 });
    if (e.elite) glows.push({ x: e.x, y: e.y - 14, r: 46, c: e.elite === 'explosive' ? '#ff6a2a' : e.elite === 'fast' ? '#5adfff' : '#c0c8d8', a: 0.14 });
  }
  if (!g.isMobile) for (const k of g.pickups) {
    if (!inView(k.x, k.y, 100)) continue;
    if (k.kind === 'artifact') { light(k.x, k.y - 14, 90, 0.85); glows.push({ x: k.x, y: k.y - 16, r: 50, c: k.art ? ({ common: '#cfd4e0', rare: '#4aa8ff', epic: '#b967ff', legendary: '#ffb02e' })[k.art.rarity] : '#fff', a: 0.4 }); }
    else if (k.kind === 'gold') light(k.x, k.y - 6, 42, 0.5);
    else if (k.kind === 'xp') { light(k.x, k.y - 8, 48, 0.7); glows.push({ x: k.x, y: k.y - 8, r: 30, c: '#6ec0ff', a: 0.3 }); }
    else light(k.x, k.y - 10, 50, 0.6);
  }
  if (p.whirlT > 0 || p.danceT > 0) glows.push({ x: p.x, y: p.y - 16, r: 120, c: p.danceT > 0 ? '#ff3a6a' : w.c.glow.length === 7 ? w.c.glow : '#ffffff', a: 0.22 });
  glows.push({ x: p.x, y: p.y - 14, r: 120, c: w.c.glow.length === 7 ? w.c.glow : '#ffffff', a: 0.08 });
  L.globalAlpha = 1;
  L.globalCompositeOperation = 'source-over';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(lc, 0, 0, W, H);
  setWorld();
  ctx.globalCompositeOperation = 'lighter';
  for (const gl of glows) {
    ctx.globalAlpha = gl.a;
    ctx.drawImage(gfx.glow(gl.c), gl.x - gl.r, gl.y - gl.r, gl.r * 2, gl.r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // ---- полосы здоровья и числа
  for (const e of g.enemies) {
    if (e.boss || !inView(e.x, e.y, 60) || (e.hp >= e.maxHp && !e.elite && !e.seal) || e.spawnT > 0) continue;
    const bw = Math.max(26, e.r * 2.4), bx = e.x - bw / 2, by = e.y - e.def.h * e.sc - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = e.seal ? '#bd83ff' : e.elite ? '#ffb02e' : '#d12a3a'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 3);
    if (e.st.freezeT > 0) { ctx.fillStyle = '#8fe8ff'; ctx.fillRect(bx, by + 4, bw, 1.5); }
    if (e.elite || e.seal) {
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = e.seal ? '#e2c3ff' : '#ffd88a';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.5; ctx.strokeText(e.name, e.x, by - 3); ctx.fillText(e.name, e.x, by - 3);
    }
    // готические мини-иконки дебаффов (Яд, Кровотечение, Поджог, Холод/Заморозка)
    let ix = bx + 5;
    const iy = by + 11;
    const drawBadge = (bg: string, border: string, drawSym: (cx: number, cy: number) => void, stacks = 0) => {
      ctx.save();
      ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(ix - 5.5, iy - 5.5, 11, 11, 2.5); ctx.fill(); ctx.stroke();
      drawSym(ix, iy);
      if (stacks > 1) {
        ctx.font = 'bold 7.5px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.strokeText(String(stacks), ix + 6, iy + 6);
        ctx.fillText(String(stacks), ix + 6, iy + 6);
      }
      ctx.restore();
      ix += 13;
    };
    if (e.st.poison > 0) {
      drawBadge('#0c2414', '#4ade80', (cx, cy) => {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.quadraticCurveTo(cx + 3.8, cy + 1, cx, cy + 3.8); ctx.quadraticCurveTo(cx - 3.8, cy + 1, cx, cy - 4); ctx.fill();
        ctx.fillStyle = '#dcfce7'; ctx.beginPath(); ctx.arc(cx - 0.8, cy + 0.5, 1, 0, TAU); ctx.fill();
      }, e.st.poison);
    }
    if (e.st.bleed > 0) {
      drawBadge('#2b0a12', '#f43f5e', (cx, cy) => {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.moveTo(cx, cy - 4.2); ctx.lineTo(cx + 3.4, cy + 1.2); ctx.arc(cx, cy + 1.2, 3.4, 0, Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe4e6'; ctx.fillRect(cx - 1.4, cy, 1.1, 2);
      }, e.st.bleed);
    }
    if (e.st.burnT > 0) {
      drawBadge('#2b1206', '#fb923c', (cx, cy) => {
        const fl = Math.sin(now * 16 + e.id) * 0.8;
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(cx - 3.4, cy + 3.5); ctx.quadraticCurveTo(cx - 3.8, cy - 1, cx + fl, cy - 4.4); ctx.quadraticCurveTo(cx + 3.8, cy - 1, cx + 3.4, cy + 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.moveTo(cx - 1.6, cy + 3.2); ctx.quadraticCurveTo(cx, cy - 1.2, cx + 1.6, cy + 3.2); ctx.closePath(); ctx.fill();
      });
    }
    if (e.st.chill > 0 || e.st.freezeT > 0) {
      drawBadge('#082032', '#38bdf8', (cx, cy) => {
        ctx.strokeStyle = e.st.freezeT > 0 ? '#e0f2fe' : '#38bdf8'; ctx.lineWidth = 1.3;
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3;
          ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 3.8, cy - Math.sin(a) * 3.8); ctx.lineTo(cx + Math.cos(a) * 3.8, cy + Math.sin(a) * 3.8); ctx.stroke();
        }
      }, e.st.chill);
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of g.texts) {
    if (!inView(t.x, t.y, 70)) continue;
    const u = t.t / t.max;
    const alpha = u > 0.64 ? Math.max(0, 1 - (u - 0.64) / 0.36) : 1;
    // Пружинистый гача-вылет: быстрый поп 0.55 -> 1.24 -> 1.0
    const popScale = u < 0.12
      ? 0.55 + easeOut(u / 0.12) * 0.69
      : u < 0.26
        ? 1.24 - ((u - 0.12) / 0.14) * 0.24
        : u > 0.72
          ? 1 - ((u - 0.72) / 0.28) * 0.14
          : 1;
    const isLvl = t.text.includes('УРОВЕНЬ');
    const isCrit = isLvl || t.size >= 1.22 || t.text.includes('!');
    const basePx = isLvl ? 26 : isCrit ? 19.5 : 16.5;
    const sz = isLvl
      ? Math.min(36, basePx * popScale)
      : Math.min(27, basePx * Math.min(1.38, t.size) * popScale);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(t.x, t.y);
    ctx.font = `${isCrit ? 'italic ' : ''}900 ${sz.toFixed(1)}px "Segoe UI", "Trebuchet MS", system-ui, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Мягкая глубокая тень снизу для читаемости
    ctx.fillStyle = 'rgba(8,5,16,0.72)';
    ctx.fillText(t.text, 0, 2.2);

    // Плотный тёмный контур как в гача-RPG
    ctx.lineWidth = isCrit ? 4.8 : 4.0;
    ctx.strokeStyle = isCrit ? '#2b0d06' : '#110c1c';
    ctx.strokeText(t.text, 0, 0);

    // Глянцевая заливка (на мобилке — быстрый цвет без аллокации градиентов каждый кадр)
    if (g.isMobile) {
      ctx.fillStyle = isCrit ? '#ffd84a' : (t.col === '#fff' || t.col === '#ffffff' || t.col === '#eee') ? '#f8fafc' : t.col;
    } else {
      const grad = ctx.createLinearGradient(0, -sz * 0.55, 0, sz * 0.5);
      if (isCrit) {
        grad.addColorStop(0, '#fffbe0');
        grad.addColorStop(0.45, '#ffd43b');
        grad.addColorStop(1, '#ff6b1a');
      } else if (t.col === '#fff' || t.col === '#ffffff' || t.col === '#eee') {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.55, '#f1f5f9');
        grad.addColorStop(1, '#b8c4d8');
      } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.32, t.col);
        grad.addColorStop(1, t.col);
      }
      ctx.fillStyle = grad;
    }
    ctx.fillText(t.text, 0, 0);

    // Четырёхлучевая гача-искра на критах
    if (isCrit && u < 0.72) {
      const tw = ctx.measureText(t.text).width;
      const sx = tw * 0.52 + 3;
      const sy = -sz * 0.34;
      const sr = (4.5 + Math.sin(u * 20) * 1.2) * (1 - u * 0.4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(sx, sy - sr); ctx.lineTo(sx + sr * 0.28, sy - sr * 0.28);
      ctx.lineTo(sx + sr, sy); ctx.lineTo(sx + sr * 0.28, sy + sr * 0.28);
      ctx.lineTo(sx, sy + sr); ctx.lineTo(sx - sr * 0.28, sy + sr * 0.28);
      ctx.lineTo(sx - sr, sy); ctx.lineTo(sx - sr * 0.28, sy - sr * 0.28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;

  // ---- экранные эффекты
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(gfx.vignette, 0, 0, W, H);
  if (p.hurt > 0 || (p.hp / g.s.maxHp < 0.3 && !g.over)) {
    const a = Math.max(p.hurt * 1.4, p.hp / g.s.maxHp < 0.3 ? 0.18 + Math.sin(now * 5) * 0.08 : 0);
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(160,0,20,0)'); gr.addColorStop(1, `rgba(160,0,20,${Math.min(0.75, a)})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (g.over) { ctx.fillStyle = 'rgba(30,0,6,0.5)'; ctx.fillRect(0, 0, W, H); }
  drawMinimap(g, ctx, W, H, now);
}

function drawZone(ctx: CanvasRenderingContext2D, z: import('./types').Zone) {
  const u = Math.min(1, z.t / z.dur);
  const col = z.from === 'p' ? '#ffe58a' : z.col;
  ctx.save();
  if (z.done) {
    const f = 1 - (z.t - z.dur) / z.after;
    if (f <= 0) { ctx.restore(); return; }
    ctx.globalAlpha = f * 0.35;
    ctx.fillStyle = rgba(col, 1);
  } else {
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(col, 0.1 + u * 0.22);
    ctx.strokeStyle = rgba(col, 0.55 + u * 0.4);
    ctx.lineWidth = 2;
  }
  if (z.kind === 'circle') {
    ctx.translate(z.x, z.y); ctx.scale(1, 0.62);
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
    if (!z.done) {
      ctx.stroke();
      ctx.fillStyle = rgba(col, 0.25); ctx.beginPath(); ctx.arc(0, 0, z.r * u, 0, TAU); ctx.fill();
    }
  } else if (z.kind === 'cone') {
    ctx.translate(z.x, z.y); ctx.scale(1, 0.62);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, z.r, z.ang - z.arc / 2, z.ang + z.arc / 2); ctx.closePath(); ctx.fill();
    if (!z.done) {
      ctx.stroke();
      ctx.fillStyle = rgba(col, 0.25); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, z.r * u, z.ang - z.arc / 2, z.ang + z.arc / 2); ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.translate(z.x, z.y); ctx.rotate(z.ang); ctx.scale(1, 0.62);
    ctx.fillRect(0, -z.w / 2, z.len, z.w);
    if (!z.done) { ctx.strokeRect(0, -z.w / 2, z.len, z.w); ctx.fillStyle = rgba(col, 0.25); ctx.fillRect(0, -z.w / 2, z.len * u, z.w); }
  }
  ctx.restore();
}

function drawFx(ctx: CanvasRenderingContext2D, f: import('./types').Fx) {
  const u = f.t / f.dur;
  ctx.save();
  if (f.kind === 'slash') {
    ctx.translate(f.x, f.y);
    const a0 = f.a - (f.arc / 2) * f.side;
    const cur = a0 + f.arc * f.side * Math.min(1, u * 1.7);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    // внешнее неоновое свечение
    ctx.globalAlpha = Math.max(0, 1 - u) * 0.4;
    ctx.strokeStyle = f.col; ctx.lineWidth = (f.big ? 30 : 20) * (1 - u * 0.4);
    ctx.beginPath(); ctx.arc(0, 0, f.r * 0.9, a0, cur, f.side < 0); ctx.stroke();
    // цветная дуга
    ctx.globalAlpha = Math.max(0, 1 - u) * 0.9;
    ctx.lineWidth = (f.big ? 14 : 9) * (1 - u * 0.5);
    ctx.beginPath(); ctx.arc(0, 0, f.r * 0.9, a0, cur, f.side < 0); ctx.stroke();
    // яркое белое ядро
    ctx.globalAlpha = Math.max(0, 1 - u);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = (f.big ? 4 : 2.6) * (1 - u * 0.5);
    ctx.beginPath(); ctx.arc(0, 0, f.r, a0, cur, f.side < 0); ctx.stroke();
    // сверкающий остриё-кончик дуги
    const tipR = f.r;
    const tx = Math.cos(cur) * tipR, ty = Math.sin(cur) * tipR * 1;
    ctx.globalAlpha = Math.max(0, 1 - u) * 0.9;
    ctx.drawImage(getGfx().glow('#ffffff'), tx - (f.big ? 20 : 14), ty - (f.big ? 20 : 14), (f.big ? 40 : 28), (f.big ? 40 : 28));
    ctx.globalCompositeOperation = 'source-over';
  } else if (f.kind === 'ring') {
    ctx.translate(f.x, f.y); ctx.scale(1, 0.6);
    const r = f.r * easeOut(u);
    ctx.globalCompositeOperation = 'lighter';
    // двойная неоновая ударная волна
    ctx.globalAlpha = (1 - u) * 0.55;
    ctx.strokeStyle = f.col; ctx.lineWidth = 14 * (1 - u) + 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = (1 - u) * 0.32;
    ctx.strokeStyle = f.col; ctx.lineWidth = 6 * (1 - u) + 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.stroke();
    // яркий тонкий ободок
    ctx.globalAlpha = (1 - u) * 0.98;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - u) + 0.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  } else if (f.kind === 'pillar') {
    const env = u < 0.4 ? u / 0.4 : (1 - u) / 0.6;
    const w = f.r * 0.9 * (0.6 + 0.4 * env);
    const gr = ctx.createLinearGradient(0, f.y - 260, 0, f.y);
    const pcol = f.col && f.col.startsWith('#') ? f.col : '#ffe68a';
    gr.addColorStop(0, rgba(pcol, 0)); gr.addColorStop(1, rgba(pcol, 0.88 * env));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gr; ctx.fillRect(f.x - w / 2, f.y - 260, w, 260);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * env})`; ctx.fillRect(f.x - w / 5, f.y - 260, w / 2.5, 260);
    ctx.fillStyle = rgba(pcol, 0.55 * env); ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * env, f.r * 0.6 * env, 0, 0, TAU); ctx.fill();
  } else if (f.kind === 'beam') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - u; ctx.lineCap = 'round';
    ctx.strokeStyle = f.col; ctx.lineWidth = 14 * (1 - u) + 2;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * (1 - u);
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
  }
  ctx.restore();
}

// Живая палитра комнат для иллюстрированного фэнтези-атласа подземелья
const MAP_ROOM_STYLE: Record<string, { fillA: string; fillB: string; stroke: string }> = {
  camp:     { fillA: 'rgba(186,124,54,0.88)',  fillB: 'rgba(122,74,28,0.92)',  stroke: '#ffd97d' },
  shrine:   { fillA: 'rgba(34,168,158,0.86)',  fillB: 'rgba(18,104,104,0.92)', stroke: '#7df9e8' },
  treasure: { fillA: 'rgba(214,162,42,0.88)',  fillB: 'rgba(138,98,20,0.92)',  stroke: '#ffe98a' },
  vault:    { fillA: 'rgba(176,94,218,0.88)',  fillB: 'rgba(104,46,142,0.92)', stroke: '#ffd97d' },
  boss:     { fillA: 'rgba(182,36,62,0.88)',   fillB: 'rgba(102,16,34,0.94)',  stroke: '#ff7b96' },
  crypt:    { fillA: 'rgba(84,118,166,0.86)',  fillB: 'rgba(48,70,108,0.92)',  stroke: '#a8ccff' },
  haunted:  { fillA: 'rgba(112,86,174,0.86)',  fillB: 'rgba(68,48,116,0.92)',  stroke: '#cfb5ff' },
  nest:     { fillA: 'rgba(138,78,152,0.86)',  fillB: 'rgba(84,42,96,0.92)',   stroke: '#e5a8f5' },
  goblin:   { fillA: 'rgba(88,144,82,0.86)',   fillB: 'rgba(52,92,48,0.92)',   stroke: '#b0eb9f' },
  orc:      { fillA: 'rgba(168,86,62,0.86)',   fillB: 'rgba(106,48,34,0.92)',  stroke: '#f5a98c' },
  ogre:     { fillA: 'rgba(146,108,72,0.86)',  fillB: 'rgba(92,66,42,0.92)',   stroke: '#e0c09a' },
  storage:  { fillA: 'rgba(104,118,144,0.86)', fillB: 'rgba(64,74,94,0.92)',   stroke: '#bccce8' },
};
const MAP_ROOM_DEFAULT = { fillA: 'rgba(104,118,144,0.86)', fillB: 'rgba(64,74,94,0.92)', stroke: '#bccce8' };

function isRoomExplored(g: Game, r: import('./world').Room): boolean {
  const ex = g.explored;
  if (ex[r.cy * MAP_W + r.cx]) return true;
  const x0 = Math.max(0, r.x + 1), x1 = Math.min(MAP_W - 1, r.x + r.w - 2);
  const y0 = Math.max(0, r.y + 1), y1 = Math.min(MAP_H - 1, r.y + r.h - 2);
  return !!(ex[y0 * MAP_W + x0] || ex[y0 * MAP_W + x1] || ex[y1 * MAP_W + x0] || ex[y1 * MAP_W + x1]);
}

function drawVectorDungeon(
  g: Game,
  ctx: CanvasRenderingContext2D,
  tf: (tx: number, ty: number) => [number, number],
  scale: number,
  showUnexplored: boolean,
  clipMinX: number,
  clipMinY: number,
  clipMaxX: number,
  clipMaxY: number,
) {
  const map = g.world.map;
  const ex = g.explored;
  const corr = map.corr;

  const tilePx = Math.max(1.6, scale + 0.7);
  const startTx = Math.max(0, Math.floor(clipMinX) - 1);
  const endTx = Math.min(MAP_W - 1, Math.ceil(clipMaxX) + 1);
  const startTy = Math.max(0, Math.floor(clipMinY) - 1);
  const endTy = Math.min(MAP_H - 1, Math.ceil(clipMaxY) + 1);

  // Тёмная окантовка исследованных коридоров
  ctx.fillStyle = 'rgba(16, 12, 22, 0.85)';
  for (let ty = startTy; ty <= endTy; ty++) {
    const row = ty * MAP_W;
    for (let tx = startTx; tx <= endTx; tx++) {
      const idx = row + tx;
      if (!corr[idx] || !ex[idx]) continue;
      const [px, py] = tf(tx, ty);
      ctx.fillRect(px - 1, py - 1, tilePx + 2, tilePx + 2);
    }
  }
  // Неисследованные коридоры — деликатный чернильный набросок на пергаменте
  if (showUnexplored) {
    ctx.fillStyle = 'rgba(215, 192, 150, 0.14)';
    for (let ty = startTy; ty <= endTy; ty++) {
      const row = ty * MAP_W;
      for (let tx = startTx; tx <= endTx; tx++) {
        const idx = row + tx;
        if (!corr[idx] || ex[idx]) continue;
        const [px, py] = tf(tx, ty);
        ctx.fillRect(px, py, tilePx, tilePx);
      }
    }
  }
  // Исследованные коридоры — тёплый мощёный камень
  ctx.fillStyle = 'rgba(182, 166, 148, 0.82)';
  for (let ty = startTy; ty <= endTy; ty++) {
    const row = ty * MAP_W;
    for (let tx = startTx; tx <= endTx; tx++) {
      const idx = row + tx;
      if (!corr[idx] || !ex[idx]) continue;
      const [px, py] = tf(tx, ty);
      ctx.fillRect(px, py, tilePx, tilePx);
    }
  }

  // Комнаты с живыми внутренними деталями ландшафта
  for (const r of map.rooms) {
    if (r.x + r.w < clipMinX - 2 || r.x > clipMaxX + 2 || r.y + r.h < clipMinY - 2 || r.y > clipMaxY + 2) continue;
    const seen = isRoomExplored(g, r);
    if (!seen && !showUnexplored) continue;

    const [rx, ry] = tf(r.x, r.y);
    const rw = r.w * scale;
    const rh = r.h * scale;
    const rad = Math.min(7, scale * 1.25);

    ctx.save();
    ctx.beginPath();
    if (r.ellipse) {
      ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, TAU);
    } else {
      ctx.roundRect(rx, ry, rw, rh, rad);
    }

    if (seen) {
      const st = MAP_ROOM_STYLE[r.kind] || MAP_ROOM_DEFAULT;
      ctx.fillStyle = st.fillA;
      ctx.fill();

      ctx.strokeStyle = 'rgba(14, 10, 18, 0.92)';
      ctx.lineWidth = Math.max(2.4, scale * 0.45);
      ctx.stroke();
      ctx.strokeStyle = st.stroke;
      ctx.lineWidth = Math.max(1.2, scale * 0.24);
      ctx.stroke();

      // Лёгкий внутренний рельеф камня и детали биома
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,248,225,0.14)';
      ctx.fillRect(rx, ry, rw, Math.max(2.5, rh * 0.24));
      if (r.kind === 'boss') {
        ctx.strokeStyle = 'rgba(255,140,160,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.34, 0, TAU); ctx.stroke();
      } else if (r.kind === 'camp') {
        const fg = ctx.createRadialGradient(rx + rw / 2, ry + rh / 2, 1, rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.45);
        fg.addColorStop(0, 'rgba(255,220,110,0.45)');
        fg.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(rx, ry, rw, rh);
      }
      ctx.restore();
    } else {
      // Неразведанная комната: лёгкий пергаментный набросок поверх ландшафта
      ctx.fillStyle = r.kind === 'boss' ? 'rgba(130, 26, 48, 0.28)' : 'rgba(24, 18, 32, 0.36)';
      ctx.fill();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = r.kind === 'boss' ? 'rgba(255, 110, 130, 0.55)' : 'rgba(215, 192, 150, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

function drawMinimap(g: Game, ctx: CanvasRenderingContext2D, W: number, H: number, now: number) {
  if (g.mmDirty) { g.mmCtx.putImageData(g.mmData, 0, 0); g.mmDirty = false; }
  const p = g.p;
  const wb = getWorldSprites();
  const mapBgImg = wb.props.map_bg;
  ctx.save();

  if (g.showMap) {
    // --- ЖИВАЯ ИЛЛЮСТРИРОВАННАЯ КАРТА-АТЛАС ПОДЗЕМЕЛЬЯ ---
    const S = Math.min(W * 0.90, H * 0.80);
    const x = (W - S) / 2;
    const y = (H - S) / 2;
    const k = S / MAP_W;

    const bgDim = ctx.createRadialGradient(W / 2, H / 2, S * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    bgDim.addColorStop(0, 'rgba(14,11,22,0.84)');
    bgDim.addColorStop(1, 'rgba(5,4,10,0.96)');
    ctx.fillStyle = bgDim;
    ctx.fillRect(0, 0, W, H);

    const pad = 14;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - pad, y - pad - 28, S + pad * 2, S + pad * 2 + 60, 16);
    const cardGrad = ctx.createLinearGradient(x, y - pad - 28, x, y + S + pad + 32);
    cardGrad.addColorStop(0, '#2a2232');
    cardGrad.addColorStop(0.5, '#1d1724');
    cardGrad.addColorStop(1, '#14101a');
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = '#d8aa54';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - pad + 4, y - pad - 24, S + (pad - 4) * 2, S + (pad - 4) * 2 + 52, 12);
    ctx.strokeStyle = 'rgba(255,224,150,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, S, S, 10);
    ctx.clip();
    // Иллюстрированный подземный ландшафт (скалы, реки, мох, топография!)
    if (mapBgImg && mapBgImg.complete && mapBgImg.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mapBgImg, x, y, S, S);
      // Лёгкая приглушённая вуаль, чтобы комнаты и пины читались мгновенно
      ctx.fillStyle = 'rgba(14, 11, 20, 0.24)';
      ctx.fillRect(x, y, S, S);
    } else {
      ctx.fillStyle = '#1e1929';
      ctx.fillRect(x, y, S, S);
    }

    drawVectorDungeon(g, ctx, (tx, ty) => [x + tx * k, y + ty * k], k, true, 0, 0, MAP_W, MAP_H);
    markers(g, ctx, (tx, ty) => [x + tx * k, y + ty * k], Math.max(9, k * 1.9 + 4), now);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.font = '800 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = g.sealsCollected < g.world.guardians.length ? '#f5d0fe' : '#fde047';
    ctx.fillText(
      g.sealsCollected < g.world.guardians.length
        ? `КАРТА ПОДЗЕМЕЛЬЯ  ·  ПЕЧАТИ ${g.sealsCollected}/${g.world.guardians.length}`
        : 'КАРТА ПОДЗЕМЕЛЬЯ  ·  ТРОН КОРОЛЯ ОТКРЫТ',
      W / 2,
      y - 12,
    );

    const legY = y + S + 20;
    const legend: [string, string][] = [
      ['#38f2ff', 'Герой'],
      ['#c084fc', 'Печати'],
      ['#ef4444', 'Босс'],
      ['#fbbf24', 'Торговец'],
      ['#fde047', 'Сундуки'],
    ];
    ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
    const itemW = Math.min(90, S / legend.length);
    const startX = W / 2 - (itemW * legend.length) / 2 + itemW * 0.5;
    legend.forEach(([col, label], idx) => {
      const lx = startX + idx * itemW;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(lx - 24, legY - 3.5, 4.2, 0, TAU); ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(label, lx - 16, legY);
    });

    ctx.restore();
    return;
  }

  // --- КЭШИРУЕМАЯ ЖИВАЯ МИНИ-КАРТА В УГЛУ (обновляется ~5.5 раз/с вместо 60 = +20 FPS на телефоне!) ---
  const S = Math.round(minimapSize(W, H)), x = W - S - 10, y = 10, T = 42, k = S / T;
  const cacheDpr = g.isMobile ? 1 : Math.min(2, g.dpr);
  const pxS = Math.round(S * cacheDpr);
  if (!mmCache) { mmCache = document.createElement('canvas'); mmCacheCtx = mmCache.getContext('2d'); }
  if (mmCache.width !== pxS || mmCache.height !== pxS || mmCacheSz !== S) {
    mmCache.width = pxS; mmCache.height = pxS; mmCacheSz = S; mmCacheT = -99;
  }
  const interval = g.isMobile ? 0.18 : 0.08;
  if (now - mmCacheT >= interval || now < mmCacheT) {
    mmCacheT = now;
    const mc = mmCacheCtx!;
    mc.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
    mc.clearRect(0, 0, S, S);
    mc.save();
    mc.beginPath(); mc.roundRect(0, 0, S, S, 14); mc.clip();
    mc.fillStyle = '#1b1624';
    mc.fillRect(0, 0, S, S);

    const sx = p.x / TS - T / 2, sy = p.y / TS - T / 2;
    if (mapBgImg && mapBgImg.complete && mapBgImg.naturalWidth > 0) {
      mc.imageSmoothingEnabled = true;
      const mw = mapBgImg.naturalWidth, mh = mapBgImg.naturalHeight;
      const srcX = Math.max(0, Math.min(mw - (T / MAP_W) * mw, (sx / MAP_W) * mw));
      const srcY = Math.max(0, Math.min(mh - (T / MAP_H) * mh, (sy / MAP_H) * mh));
      mc.drawImage(mapBgImg, srcX, srcY, (T / MAP_W) * mw, (T / MAP_H) * mh, 0, 0, S, S);
      mc.fillStyle = 'rgba(14, 10, 20, 0.28)';
      mc.fillRect(0, 0, S, S);
    }
    drawVectorDungeon(g, mc, (tx, ty) => [(tx - sx) * k, (ty - sy) * k], k, false, sx, sy, sx + T, sy + T);
    markers(g, mc, (tx, ty) => [(tx - sx) * k, (ty - sy) * k], 7.5, now, S, 0, 0);
    mc.restore();

    // Кованая рамка без CPU shadowBlur
    mc.strokeStyle = '#d4a853';
    mc.lineWidth = 2.4;
    mc.beginPath(); mc.roundRect(1.2, 1.2, S - 2.4, S - 2.4, 13); mc.stroke();
    mc.strokeStyle = 'rgba(255,245,215,0.18)';
    mc.lineWidth = 1;
    mc.beginPath(); mc.roundRect(3.2, 3.2, S - 6.4, S - 6.4, 11); mc.stroke();
  }
  // Один быстрый drawImage вместо перерисовки всей миникарты каждый кадр!
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(x + 2, y + 3, S, S, 14); ctx.fill();
  ctx.drawImage(mmCache, x, y, S, S);
  ctx.restore();
}

function drawMapPin(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  px: number,
  py: number,
  size: number,
  glowCol?: string,
) {
  ctx.save();
  if (glowCol) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(glowCol, 0.34);
    ctx.beginPath(); ctx.arc(px, py, size * 0.56, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath(); ctx.arc(px, py + 1.5, size * 0.42, 0, TAU); ctx.fill();
    ctx.drawImage(img, px - size * 0.5, py - size * 0.5, size, size);
  }
  ctx.restore();
}

function markers(g: Game, ctx: CanvasRenderingContext2D, tf: (tx: number, ty: number) => [number, number], rad: number, now: number, S = 0, bx = 0, by = 0) {
  const p = g.p;
  const wb = getWorldSprites().props;
  const inside = (x: number, y: number) => S === 0 || (x > bx + 7 && x < bx + S - 7 && y > by + 7 && y < by + S - 7);

  // Пропы: Торговец (кастомный пин с мешком золота и фонарём), Сундуки (чиби-сундук), Алтари
  for (const pr of g.props) {
    if (pr.dead) continue;
    const tx = pr.x / TS, ty = pr.y / TS;
    if (!g.explored[Math.floor(ty) * MAP_W + Math.floor(tx)]) continue;
    const [px, py] = tf(tx, ty);
    if (!inside(px, py)) continue;
    if (pr.kind === 'merchant') {
      drawMapPin(ctx, wb.map_merchant, px, py, rad * 2.35, '#fbbf24');
    } else if (pr.kind === 'shrine' && pr.state === 0) {
      const r = rad * 0.65;
      ctx.save();
      ctx.fillStyle = '#0e0a16';
      ctx.beginPath(); ctx.moveTo(px, py - r - 1.5); ctx.lineTo(px + r * 0.75 + 1, py); ctx.lineTo(px, py + r + 1.5); ctx.lineTo(px - r * 0.75 - 1, py); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#38bdf8'; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px + r * 0.7, py); ctx.lineTo(px, py + r); ctx.lineTo(px - r * 0.7, py); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if ((pr.kind === 'chest' || pr.kind === 'ironchest' || pr.kind === 'vault' || pr.kind === 'mimic') && pr.state === 0) {
      const cImg = pr.kind === 'vault' ? wb.vault_closed : pr.kind === 'ironchest' ? wb.ironchest_closed : wb.chest_closed;
      drawMapPin(ctx, cImg, px, py, rad * (pr.kind === 'vault' ? 1.85 : 1.5), pr.kind === 'vault' ? '#facc15' : undefined);
    }
  }

  // Активные враги
  for (const e of g.enemies) {
    if (e.dead || e.seal || (e.state === 'idle' && !e.boss)) continue;
    const tx = e.x / TS, ty = e.y / TS;
    const [px, py] = tf(tx, ty);
    if (!inside(px, py)) continue;
    ctx.fillStyle = '#ff6b7a';
    ctx.strokeStyle = '#18090d';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, Math.max(2.4, rad * 0.3), 0, TAU); ctx.fill(); ctx.stroke();
  }

  // Хранители печатей: кастомная руническая печать-медальон
  for (const guardian of g.world.guardians) {
    if (g.sealsMask & (1 << (guardian.id - 1))) continue;
    if (!g.showMap && !g.explored[Math.floor(guardian.y / TS) * MAP_W + Math.floor(guardian.x / TS)]) continue;
    const [px, py] = tf(guardian.x / TS, guardian.y / TS);
    if (!inside(px, py)) continue;
    const pulse = 1 + Math.sin(now * 4.5 + guardian.id) * 0.08;
    drawMapPin(ctx, wb.map_seal, px, py, rad * 2.4 * pulse, '#c084fc');
  }

  // Босс: кастомная иконка коронованного рогатого черепа
  const b = g.world.boss;
  if ((g.showMap || g.explored[b.cy * MAP_W + b.cx]) && !g.bossDone) {
    const [px, py] = tf(b.cx, b.cy);
    if (inside(px, py)) {
      const pulse = 1 + Math.sin(now * 4.2) * 0.07;
      drawMapPin(ctx, wb.map_boss, px, py, rad * 2.75 * pulse, '#ef4444');
    }
  }

  // Герой: кастомный пин ассасина с маленьким бирюзовым указателем направления
  const [px, py] = tf(p.x / TS, p.y / TS);
  const hSz = rad * 2.45;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.lastDir);
  ctx.fillStyle = '#38f2ff';
  ctx.strokeStyle = '#090b14';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hSz * 0.52 + 4.5, 0);
  ctx.lineTo(hSz * 0.52 - 1, -3.5);
  ctx.lineTo(hSz * 0.52 - 1, 3.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  drawMapPin(ctx, wb.map_hero, px, py, hSz, '#38f2ff');
}
