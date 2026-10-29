import { MAP_H, MAP_W, TS } from './data';
import type { Game } from './engine';
import { getGfx } from './gfx';
import * as S from './sprites';

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

export function minimapSize(w: number, h: number) {
  return Math.max(92, Math.min(150, Math.min(w, h) * 0.28));
}

export function renderGame(g: Game, now: number) {
  const gfx = getGfx();
  const ctx = g.ctx, W = g.W, H = g.H, dpr = g.dpr, zoom = g.zoom, p = g.p, map = g.map;
  const sh = g.cam.shake;
  const cx = g.cam.x + (Math.random() - 0.5) * sh, cy = g.cam.y + (Math.random() - 0.5) * sh;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050409';
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
        ctx.drawImage(gfx.floor[map.theme[i]][v & 3], px, py, TS + 1, TS + 1);
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
          ctx.fillStyle = 'rgba(255,50,100,0.16)'; ctx.beginPath(); ctx.arc(0, -18, 30 + Math.sin(now * 12) * 3, 0, TAU); ctx.fill();
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

  // ---- освещение
  const lw = Math.ceil(W * 0.5), lh = Math.ceil(H * 0.5);
  if (!lc) { lc = document.createElement('canvas'); lctx = lc.getContext('2d'); }
  if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
  const L = lctx!;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.globalCompositeOperation = 'source-over';
  L.globalAlpha = 1;
  L.fillStyle = 'rgba(6,5,12,0.9)';
  L.clearRect(0, 0, lw, lh);
  L.fillRect(0, 0, lw, lh);
  const ls = 0.5 * zoom;
  L.setTransform(ls, 0, 0, ls, lw / 2 - cx * ls, lh / 2 - cy * ls);
  L.globalCompositeOperation = 'destination-out';
  const light = (x: number, y: number, r: number, a = 1) => { L.globalAlpha = a; L.drawImage(gfx.light, x - r, y - r, r * 2, r * 2); };
  light(p.x, p.y - 14, 290 + Math.sin(now * 7) * 6, 1);
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
  for (const k of g.pickups) {
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
    // иконки статусов
    let ix = bx;
    const icon = (c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ix + 3, by + 9, 2.6, 0, TAU); ctx.fill(); ix += 7; };
    if (e.st.poison) icon('#7dff4a'); if (e.st.bleed) icon('#ff4b5f'); if (e.st.burnT > 0) icon('#ff9a2e'); if (e.st.chill) icon('#8fe8ff');
  }
  ctx.textAlign = 'center';
  for (const t of g.texts) {
    if (!inView(t.x, t.y, 60)) continue;
    const u = t.t / t.max;
    ctx.globalAlpha = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    const sz = 14 * t.size * (u < 0.15 ? 0.7 + u * 2 : 1);
    ctx.font = `800 ${sz}px "Trebuchet MS", sans-serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.text, t.x, t.y);
  }
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
    // мягкое кольцо-свечение
    ctx.globalAlpha = (1 - u) * 0.5;
    ctx.strokeStyle = f.col; ctx.lineWidth = 10 * (1 - u) + 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    // яркий тонкий ободок
    ctx.globalAlpha = (1 - u) * 0.95;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5 * (1 - u) + 0.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  } else if (f.kind === 'pillar') {
    const env = u < 0.4 ? u / 0.4 : (1 - u) / 0.6;
    const w = f.r * 0.9 * (0.6 + 0.4 * env);
    const gr = ctx.createLinearGradient(0, f.y - 260, 0, f.y);
    gr.addColorStop(0, 'rgba(255,240,170,0)'); gr.addColorStop(1, `rgba(255,240,170,${0.85 * env})`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gr; ctx.fillRect(f.x - w / 2, f.y - 260, w, 260);
    ctx.fillStyle = `rgba(255,255,255,${0.5 * env})`; ctx.fillRect(f.x - w / 5, f.y - 260, w / 2.5, 260);
    ctx.fillStyle = `rgba(255,230,140,${0.5 * env})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * env, f.r * 0.6 * env, 0, 0, TAU); ctx.fill();
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

function drawMinimap(g: Game, ctx: CanvasRenderingContext2D, W: number, H: number, now: number) {
  if (g.mmDirty) { g.mmCtx.putImageData(g.mmData, 0, 0); g.mmDirty = false; }
  const p = g.p;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (g.showMap) {
    const S = Math.min(W, H) * 0.86, x = (W - S) / 2, y = (H - S) / 2, k = S / MAP_W;
    ctx.fillStyle = 'rgba(6,5,12,0.88)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20,18,30,0.9)'; ctx.fillRect(x - 6, y - 6, S + 12, S + 12);
    ctx.strokeStyle = '#8a7030'; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, S + 12, S + 12);
    ctx.drawImage(g.mmOutline, 0, 0, MAP_W, MAP_H, x, y, S, S);
    ctx.drawImage(g.mm, 0, 0, MAP_W, MAP_H, x, y, S, S);
    markers(g, ctx, (tx, ty) => [x + tx * k, y + ty * k], k * 1.4 + 2, now);
    ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,8,17,0.82)';
    ctx.fillRect(x + 2, y + 2, S - 4, 22);
    ctx.fillStyle = '#d7b0ff';
    ctx.fillText(g.sealsCollected < g.world.guardians.length
      ? `Печати ${g.sealsCollected}/${g.world.guardians.length}  ·  фиолетовые метки: хранители`
      : 'Печати сняты · идите к красной метке', W / 2, y + 17);
    ctx.restore();
    return;
  }
  const S = minimapSize(W, H), x = W - S - 10, y = 10, T = 46, k = S / T;
  ctx.fillStyle = 'rgba(8,6,14,0.72)';
  ctx.beginPath(); ctx.roundRect(x, y, S, S, 10); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, S, S, 10); ctx.clip();
  const sx = p.x / TS - T / 2, sy = p.y / TS - T / 2;
  const cx0 = Math.max(0, sx), cy0 = Math.max(0, sy), cx1 = Math.min(MAP_W, sx + T), cy1 = Math.min(MAP_H, sy + T);
  ctx.drawImage(g.mm, cx0, cy0, cx1 - cx0, cy1 - cy0, x + (cx0 - sx) * k, y + (cy0 - sy) * k, (cx1 - cx0) * k, (cy1 - cy0) * k);
  markers(g, ctx, (tx, ty) => [x + (tx - sx) * k, y + (ty - sy) * k], 3, now, S, x, y);
  ctx.restore();
  ctx.strokeStyle = 'rgba(200,160,70,0.8)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x, y, S, S, 10); ctx.stroke();
  ctx.restore();
}

function markers(g: Game, ctx: CanvasRenderingContext2D, tf: (tx: number, ty: number) => [number, number], rad: number, now: number, S = 0, bx = 0, by = 0) {
  const p = g.p;
  const inside = (x: number, y: number) => S === 0 || (x > bx + 2 && x < bx + S - 2 && y > by + 2 && y < by + S - 2);
  for (const pr of g.props) {
    if (pr.dead) continue;
    const tx = pr.x / TS, ty = pr.y / TS;
    if (!g.explored[Math.floor(ty) * MAP_W + Math.floor(tx)]) continue;
    let col = '';
    if (pr.kind === 'merchant') col = '#6dff8a';
    else if (pr.kind === 'shrine' && pr.state === 0) col = '#d08aff';
    else if ((pr.kind === 'chest' || pr.kind === 'ironchest' || pr.kind === 'vault' || pr.kind === 'mimic') && pr.state === 0) col = '#ffd84a';
    if (!col) continue;
    const [px, py] = tf(tx, ty);
    if (!inside(px, py)) continue;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, rad * 0.7, 0, TAU); ctx.fill();
  }
  for (const e of g.enemies) {
    if (e.dead || e.seal || (e.state === 'idle' && !e.boss)) continue;
    const tx = e.x / TS, ty = e.y / TS;
    const [px, py] = tf(tx, ty);
    if (!inside(px, py)) continue;
    ctx.fillStyle = e.boss ? '#ff2a2a' : '#ff6a6a';
    ctx.beginPath(); ctx.arc(px, py, e.boss ? rad * 1.4 : rad * 0.55, 0, TAU); ctx.fill();
  }
  for (const guardian of g.world.guardians) {
    if (g.sealsMask & (1 << (guardian.id - 1))) continue;
    if (!g.showMap && !g.explored[Math.floor(guardian.y / TS) * MAP_W + Math.floor(guardian.x / TS)]) continue;
    const [px, py] = tf(guardian.x / TS, guardian.y / TS);
    if (!inside(px, py)) continue;
    const r = Math.max(4, rad * 1.35) + Math.sin(now * 4 + guardian.id) * 0.5;
    ctx.fillStyle = '#b874ff'; ctx.strokeStyle = '#e9c8ff'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px + r * 0.8, py);
    ctx.lineTo(px, py + r); ctx.lineTo(px - r * 0.8, py); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const b = g.world.boss;
  if ((g.showMap || g.explored[b.cy * MAP_W + b.cx]) && !g.bossDone) {
    const [px, py] = tf(b.cx, b.cy);
    if (inside(px, py)) { ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(px, py, rad * 1.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#12060a'; ctx.fillRect(px - rad * 0.8, py - rad * 0.4, rad * 0.55, rad * 0.55); ctx.fillRect(px + rad * 0.25, py - rad * 0.4, rad * 0.55, rad * 0.55); }
  }
  const [px, py] = tf(p.x / TS, p.y / TS);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, py, rad * (0.9 + 0.15 * Math.sin(now * 6)), 0, TAU); ctx.fill(); ctx.stroke();
}
