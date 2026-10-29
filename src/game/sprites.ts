import { RARITY, type WeaponDef } from './data';
import type { Critter, Decal, Enemy, Pickup, PlayerState, Prop, Proj } from './types';

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const OUT = 'rgba(8,6,12,0.72)';
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function ell(c: C, x: number, y: number, rx: number, ry: number, fill: string, stroke = true) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke(); }
}
function poly(c: C, pts: number[], fill: string, stroke = true) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = 1.1; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); }
}
function limb(c: C, x1: number, y1: number, x2: number, y2: number, w: number, col: string) {
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.strokeStyle = OUT; c.lineWidth = w + 1.8; c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
}
function rr(c: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = true) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
  if (stroke) { c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke(); }
}
export function shadow(c: C, x: number, y: number, rx: number, ry: number, a = 0.4) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = `rgba(0,0,0,${a})`; c.fill();
}
// Светящийся глаз с мягким ореолом (аддитивно) — для врагов во тьме.
function glowEye(c: C, x: number, y: number, r: number, col: string, halo = 2.4) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r * halo);
  g.addColorStop(0, col); g.addColorStop(0.45, col + 'aa'); g.addColorStop(1, col + '00');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * halo, 0, TAU); c.fill();
  c.restore();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.5, 0, TAU); c.fill();
}
// Вертикальный градиент-заливка внутри произвольного пути (вызывать сразу после построения пути).
function vgrad(c: C, y0: number, y1: number, a: string, b: string) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a); g.addColorStop(1, b);
  return g;
}
// Блик-полумесяц поверх округлого объёма.
function sheen(c: C, x: number, y: number, rx: number, ry: number, rot: number, a = 0.18) {
  c.save(); c.globalAlpha = a; c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); c.restore();
}
export function flame(c: C, x: number, y: number, w: number, h: number, t: number, seed: number, outer: string, inner: string) {
  const f = Math.sin(t * 9 + seed) * 0.12 + Math.sin(t * 15 + seed * 2) * 0.08;
  for (let k = 0; k < 2; k++) {
    const s = k === 0 ? 1 : 0.55;
    c.fillStyle = k === 0 ? outer : inner;
    c.beginPath();
    c.moveTo(x - w * s, y);
    c.quadraticCurveTo(x - w * s * 1.15, y - h * s * 0.55, x + f * w * s * 2.2, y - h * s * (1 + f));
    c.quadraticCurveTo(x + w * s * 1.15, y - h * s * 0.55, x + w * s, y);
    c.closePath(); c.fill();
  }
}

// ---------------------------------------------------------------- клинки
function bladePath(c: C, shape: WeaponDef['shape'], L: number) {
  c.beginPath();
  switch (shape) {
    case 'dagger': c.moveTo(2, -2.4); c.lineTo(L * 0.82, -2); c.lineTo(L, 0); c.lineTo(L * 0.82, 2); c.lineTo(2, 2.4); break;
    case 'fang': c.moveTo(2, -2.6); c.quadraticCurveTo(L * 0.6, -5, L, 5.5); c.quadraticCurveTo(L * 0.55, 1.2, 2, 2.6); break;
    case 'saw': {
      c.moveTo(2, -2.6); c.lineTo(L * 0.9, -2.2); c.lineTo(L, 0.5);
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const x = L * 0.92 - L * 0.9 * (i / n);
        c.lineTo(x, 2.2); c.lineTo(x - (L * 0.9) / n * 0.5, 4.8);
      }
      break;
    }
    case 'claw':
      c.moveTo(2, -3); c.quadraticCurveTo(L * 0.5, -8, L, 4); c.quadraticCurveTo(L * 0.62, 0.5, L * 0.5, 2.4);
      c.quadraticCurveTo(L * 0.45, 4, L * 0.22, 6.5); c.quadraticCurveTo(L * 0.3, 2.5, 2, 3);
      break;
    case 'shard':
      c.moveTo(2, -2); c.lineTo(L * 0.3, -5); c.lineTo(L * 0.5, -2.5); c.lineTo(L * 0.78, -4); c.lineTo(L, 0);
      c.lineTo(L * 0.7, 3); c.lineTo(L * 0.45, 2); c.lineTo(L * 0.25, 4.5); c.lineTo(2, 2);
      break;
    case 'wisp':
      c.moveTo(2, -2.4); c.bezierCurveTo(L * 0.3, -6, L * 0.6, 4, L, -1.5); c.bezierCurveTo(L * 0.6, 6, L * 0.3, -1, 2, 2.4);
      break;
    case 'sun': c.moveTo(2, -3.2); c.lineTo(L * 0.8, -3); c.lineTo(L, 0); c.lineTo(L * 0.8, 3); c.lineTo(2, 3.2); break;
  }
  c.closePath();
}

export function drawBlade(c: C, w: WeaponDef, L: number) {
  const col = w.c;
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = col.hilt; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-5, 0); c.lineTo(1, 0); c.stroke();
  c.strokeStyle = w.shape === 'sun' ? '#e8c050' : '#6a6a78'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(1.5, -3.8); c.lineTo(1.5, 3.8); c.stroke();
  if (w.shape === 'sun') {
    poly(c, [1, -3, -2, -8, 5, -5], '#f0cc5a'); poly(c, [1, 3, -2, 8, 5, 5], '#f0cc5a');
  }
  bladePath(c, w.shape, L);
  c.globalAlpha *= 0.35; c.lineWidth = 6; c.strokeStyle = col.glow; c.lineJoin = 'round'; c.stroke();
  c.globalAlpha /= 0.35;
  const g = c.createLinearGradient(0, 0, L, 0);
  g.addColorStop(0, col.blade); g.addColorStop(0.7, col.edge); g.addColorStop(1, col.edge);
  c.fillStyle = g; c.fill();
  c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(4, -0.4); c.lineTo(L * 0.8, -0.2); c.stroke();
  c.restore();
}

export function drawWeaponIcon(c: C, w: WeaponDef, size: number) {
  c.clearRect(0, 0, size, size);
  const k = size / 56;
  const bg = c.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.6);
  bg.addColorStop(0, w.c.glow + '55'); bg.addColorStop(1, w.c.glow + '00');
  c.fillStyle = bg; c.fillRect(0, 0, size, size);
  for (const a of [-Math.PI * 0.27, -Math.PI * 0.73]) {
    c.save(); c.translate(size / 2, size * 0.86); c.rotate(a); c.scale(k, k); c.translate(-2, 0);
    drawBlade(c, w, 36); c.restore();
  }
}

// ---------------------------------------------------------------- игрок
export function drawPlayer(c: C, p: PlayerState, w: WeaponDef, alpha = 1) {
  const t = p.anim;
  const mv = p.moving ? 1 : 0;
  const run = Math.sin(t * 14) * mv;
  // дыхание покоя + бег
  const breathe = Math.sin(t * 2.2) * 0.6 * (1 - mv);
  const bob = Math.abs(Math.sin(t * 14)) * 1.7 * mv + breathe;
  const col = w.c;
  c.save();
  c.globalAlpha = alpha;
  c.scale(p.face, 1);
  const sw = Math.sin(t * 6) * 1.5 + mv * 5;
  const flap = Math.sin(t * 9) * mv * 2 + Math.sin(t * 1.8) * (1 - mv);

  // --- развевающийся рваный плащ (сзади) с рваной кромкой ---
  c.beginPath();
  c.moveTo(-1, -28 - bob);
  c.bezierCurveTo(-10 - sw, -23 - bob, -13 - sw - mv * 4, -11, -12 - sw * 1.4 - mv * 5, -1 + flap);
  // рваный низ плаща
  c.lineTo(-9 - sw * 0.7, -4 + flap * 0.5); c.lineTo(-7 - sw * 0.5, -6); c.lineTo(-4.5, -3.5);
  c.lineTo(-2.5, -6); c.lineTo(-0.5, -3); c.lineTo(1, -13); c.closePath();
  c.fillStyle = vgrad(c, -28, -2, '#2a2038', '#120c1c'); c.fill();
  c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // внутренняя подкладка плаща
  c.save(); c.globalAlpha = alpha * 0.5;
  poly(c, [-1, -26 - bob, -7 - sw, -12, -5 - sw, -4, -1, -11], '#3a1420', false);
  c.restore();

  // углы клинков
  const conv = (a: number) => (p.face === 1 ? a : Math.PI - a);
  let aF = 0.75, aB = 2.35;
  const whirl = p.whirlT > 0;
  if (p.swing > 0 && !whirl) {
    const u = 1 - p.swing;
    const e = easeOut(clamp(u * 1.15, 0, 1));
    const blend = clamp(p.swing * 3, 0, 1);
    const A = 1.3;
    const wf = conv(p.swingAim + p.swingSide * A * (2 * e - 1));
    const wb = conv(p.swingAim - p.swingSide * A * (2 * e - 1) * 0.8 + 0.25);
    aF = lerp(aF, wf, blend); aB = lerp(aB, wb, blend);
  }
  const sF = { x: 3, y: -24 - bob }, sB = { x: -3, y: -24 - bob };
  const drawArm = (s: { x: number; y: number }, a: number, len: number, front: boolean) => {
    const ex = s.x + Math.cos(a) * 4, ey = s.y + Math.sin(a) * 4 + 1; // локоть
    const hx = s.x + Math.cos(a) * 8, hy = s.y + Math.sin(a) * 8 + 2; // кисть
    limb(c, s.x, s.y, ex, ey, 4.2, front ? '#342a46' : '#271f36');
    limb(c, ex, ey, hx, hy, 3.4, front ? '#2a2238' : '#201a2c');
    // наруч с ремнями
    c.save(); c.translate((s.x + hx) / 2, (s.y + hy) / 2); c.rotate(a);
    rr(c, -3, -2.6, 6, 5.2, 1.4, '#43372a', false);
    c.strokeStyle = '#1c150f'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-2, -2.4); c.lineTo(-2, 2.4); c.moveTo(1, -2.4); c.lineTo(1, 2.4); c.stroke();
    c.restore();
    c.save(); c.translate(hx, hy); c.rotate(a); drawBlade(c, w, len); c.restore();
    ell(c, hx, hy, 2.1, 2.1, '#14101c', false);
  };
  if (whirl) {
    const a0 = t * 20;
    for (let i = 0; i < 2; i++) {
      c.save(); c.translate(0, -18); c.rotate(a0 + i * Math.PI); c.translate(8, 0); drawBlade(c, w, 30); c.restore();
    }
  } else drawArm(sB, aB, 24, false);

  // --- ноги с сапогами и наколенниками ---
  const lf = -3 + run * 5.5, lb = 3 - run * 5.5;
  limb(c, -2.5, -11 - bob, lf, -3 - Math.max(0, -run) * 3, 4.6, '#191320');
  limb(c, 3, -11 - bob, lb, -3 - Math.max(0, run) * 3, 4.6, '#221a2e');
  // сапоги
  poly(c, [lf - 3.4, -3.4 - Math.max(0, -run) * 3, lf + 3.6, -3.4 - Math.max(0, -run) * 3, lf + 4.4, -0.4 - Math.max(0, -run) * 3, lf - 3.6, -0.4 - Math.max(0, -run) * 3], '#0d0a12');
  poly(c, [lb - 3.4, -3.4 - Math.max(0, run) * 3, lb + 3.6, -3.4 - Math.max(0, run) * 3, lb + 4.4, -0.4 - Math.max(0, run) * 3, lb - 3.6, -0.4 - Math.max(0, run) * 3], '#100c16');

  // --- торс: слоистая кожаная броня ---
  c.beginPath(); c.roundRect(-6.4, -29 - bob, 12.8, 18, 3.2);
  c.fillStyle = vgrad(c, -29 - bob, -11 - bob, '#352c46', '#1e1830'); c.fill();
  c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // нагрудные пластины
  poly(c, [-5.4, -27 - bob, 5.4, -27 - bob, 4.2, -20 - bob, -4.2, -20 - bob], '#3f3452', false);
  sheen(c, -2.5, -25 - bob, 2.2, 3.4, -0.3, 0.12);
  // кожаные ремни крест-накрест
  c.strokeStyle = '#43372a'; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-5, -27 - bob); c.lineTo(5, -14 - bob); c.moveTo(5, -27 - bob); c.lineTo(-5, -14 - bob); c.stroke();
  c.strokeStyle = '#2a2018'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(-5, -27 - bob); c.lineTo(5, -14 - bob); c.moveTo(5, -27 - bob); c.lineTo(-5, -14 - bob); c.stroke();
  // пояс с золотой пряжкой
  rr(c, -6.6, -15 - bob, 13.2, 3.6, 1, '#2a1c14');
  rr(c, -1.6, -15.2 - bob, 3.2, 4, 0.8, '#d8ad4e', false);
  ell(c, 0, -13.3 - bob, 0.9, 0.9, '#5a3a14', false);

  // --- шарф-воротник из рваной ткани ---
  poly(c, [-5.8, -30 - bob, 5.8, -30 - bob, 5, -25.5 - bob, -5, -25.5 - bob], '#a8243a');
  poly(c, [-4, -28.5 - bob, -13 - mv * 5 - sw, -25 + Math.sin(t * 8) * 2 - bob, -19 - mv * 6 - sw, -19 + Math.sin(t * 8 + 1) * 2 - bob, -11 - sw, -22 - bob, -7, -24 - bob], '#8d1d2f');
  poly(c, [-6, -27 - bob, -11 - sw, -24 - bob, -9 - sw, -21 - bob, -6, -24 - bob], '#6a1522', false);

  // --- голова в капюшоне с острым силуэтом ---
  poly(c, [-5.5, -40 - bob, -11.5, -33.5 - bob, -6.5, -29.5 - bob, -2, -35 - bob], '#201829'); // задний клин капюшона
  c.beginPath();
  c.moveTo(-5.5, -32 - bob);
  c.quadraticCurveTo(-6.5, -41.5 - bob, 1.5, -42 - bob);
  c.quadraticCurveTo(8.5, -41 - bob, 8, -33 - bob);
  c.quadraticCurveTo(5, -30 - bob, -2, -31 - bob);
  c.closePath();
  c.fillStyle = vgrad(c, -42 - bob, -30 - bob, '#322746', '#191223'); c.fill();
  c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // тень лица внутри капюшона
  ell(c, 3, -33.6 - bob, 4.3, 4.6, '#06040a', false);
  // светящиеся глаза
  glowEye(c, 2.7, -34 - bob, 1.25, col.glow);
  glowEye(c, 6.1, -34 - bob, 1.25, col.glow);
  // блик на капюшоне
  sheen(c, -1.5, -39 - bob, 3.2, 1.5, -0.4, 0.14);

  if (!whirl) drawArm(sF, aF, 26, true);
  c.restore();
}

// ---------------------------------------------------------------- враги
interface A { t: number; mv: number; wind: number; sw: number; run: number; bob: number }
const armAng = (a: A, idle: number, raise: number, strike: number) =>
  a.wind > 0 ? lerp(idle, raise, easeOut(a.wind)) : a.sw > 0 ? lerp(idle, strike, a.sw) : idle;

function goblin(c: C, _e: Enemy, a: A, archer: boolean) {
  const skin = archer ? '#5a9a3c' : '#62a640', skinD = '#3f6e28';
  const by = a.bob;
  // сгорбленные ноги
  limb(c, -2.5, -8, -2.5 + a.run * 3.5, 0, 3.6, '#352818');
  limb(c, 2.5, -8, 2.5 - a.run * 3.5, 0, 3.6, '#412f1c');
  poly(c, [-3 + a.run * 3.5 - 2, -1, -3 + a.run * 3.5 + 3, -1, -3 + a.run * 3.5 + 2.4, 1, -3 + a.run * 3.5 - 2.4, 1], '#0e0a06', false);
  // рваная набедренная повязка
  poly(c, [-6, -11 + by, 6, -11 + by, 5, -1, 2, -3, -0.5, -1.5, -3, -3, -5, -1.5], '#5a4430');
  // сутулый торс (кожаные лохмотья)
  c.beginPath(); c.moveTo(-6, -11 + by); c.quadraticCurveTo(-7, -19 + by, -3, -21 + by);
  c.lineTo(6, -20 + by); c.quadraticCurveTo(7, -13 + by, 6, -11 + by); c.closePath();
  c.fillStyle = vgrad(c, -21 + by, -11 + by, skin, skinD); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // ребра/мускулатура
  c.strokeStyle = 'rgba(20,40,12,0.5)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(-3, -17 + by); c.lineTo(3, -16.5 + by); c.moveTo(-3, -14.5 + by); c.lineTo(3, -14 + by); c.stroke();
  // рваная туника
  poly(c, [-6, -13 + by, 6, -13 + by, 5, -7, 2.5, -9.5, 0, -7.5, -2.5, -9.5, -5, -7.5], '#6a2a1c', false);
  // металлический наплечник на правом плече
  ell(c, -5, -19 + by, 3.6, 3, '#7a7e88');
  ell(c, -5, -19 + by, 3.6, 3, 'rgba(255,255,255,0.12)', false);
  poly(c, [-7.5, -20 + by, -5, -24 + by, -2.5, -20 + by], '#9aa0aa', false);
  // уши
  poly(c, [-4, -24 + by, -13, -29 + by, -5, -20 + by], skin); poly(c, [-10, -27.5 + by, -12.5, -29 + by, -9, -25 + by], skinD, false);
  poly(c, [5, -24 + by, 13, -30 + by, 6, -20 + by], skin); poly(c, [9, -28 + by, 12, -30 + by, 8, -26 + by], skinD, false);
  // голова, вытянутая вперёд
  c.beginPath(); c.moveTo(-5, -22 + by); c.quadraticCurveTo(-6, -28 + by, 1, -28.5 + by);
  c.quadraticCurveTo(9, -28 + by, 10, -23 + by); c.quadraticCurveTo(8, -19 + by, 0, -20 + by); c.closePath();
  c.fillStyle = vgrad(c, -28 + by, -20 + by, skin, skinD); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // крючковатый нос
  poly(c, [7, -24 + by, 12, -22.5 + by, 7, -21 + by], skinD, false);
  // бровь и злой глаз
  c.strokeStyle = '#17260c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, -26 + by); c.lineTo(6.5, -25 + by); c.stroke();
  glowEye(c, 4.6, -24 + by, 1.1, '#ffd23a', 2.2);
  // клыки
  poly(c, [3, -20.5 + by, 3.8, -18.4 + by, 4.6, -20.5 + by], '#f5f0dc', false);
  poly(c, [6, -20.5 + by, 6.7, -18.6 + by, 7.3, -20.5 + by], '#f5f0dc', false);
  if (archer) {
    // капюшон из звериной шкуры
    c.beginPath(); c.moveTo(-5, -24 + by); c.quadraticCurveTo(-2, -32 + by, 6, -30 + by);
    c.quadraticCurveTo(10, -28 + by, 9, -24 + by); c.quadraticCurveTo(2, -27 + by, -5, -24 + by); c.closePath();
    c.fillStyle = '#4a3a22'; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    poly(c, [-5, -24 + by, -8, -22 + by, -4, -21 + by], '#3a2c18', false);
    // колчан за спиной
    rr(c, -9, -20 + by, 3.4, 9, 1, '#3a2a18', false);
    for (const ox of [-8.4, -7.2]) { c.strokeStyle = '#d8c090'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(ox, -20 + by); c.lineTo(ox, -24 + by); c.stroke(); poly(c, [ox - 1, -24 + by, ox + 1, -24 + by, ox, -26 + by], '#eee', false); }
    // составной лук из дерева и кости
    const draw = a.wind;
    const hx = 8 + draw * -2, hy = -16 + by;
    limb(c, 3, -18 + by, hx, hy, 2.6, skin);
    c.strokeStyle = '#7a5428'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.arc(11, -16 + by, 12, -1.2, 1.2); c.stroke();
    c.strokeStyle = '#c8b48a'; c.lineWidth = 1; // костяные накладки
    c.beginPath(); c.arc(11, -16 + by, 12, -1.2, -0.6); c.moveTo(11 + Math.cos(0.6) * 12, -16 + by + Math.sin(0.6) * 12); c.arc(11, -16 + by, 12, 0.6, 1.2); c.stroke();
    c.strokeStyle = '#eee'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(11 + Math.cos(-1.2) * 12, -16 + by + Math.sin(-1.2) * 12); c.lineTo(11 - draw * 9 + 1, -16 + by); c.lineTo(11 + Math.cos(1.2) * 12, -16 + by + Math.sin(1.2) * 12); c.stroke();
    if (draw > 0.1) { c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(11 - draw * 9 + 1, -16 + by); c.lineTo(21, -16 + by); c.stroke(); poly(c, [21, -17 + by, 24, -16 + by, 21, -15 + by], '#cfd4dc', false); }
  } else {
    // зазубренный ржавый короткий меч
    const ang = armAng(a, 0.7, -2.1, 1.1);
    const hx = 4 + Math.cos(ang) * 7, hy = -16 + by + Math.sin(ang) * 7;
    limb(c, 4, -16 + by, hx, hy, 3, skin);
    c.save(); c.translate(hx, hy); c.rotate(ang);
    rr(c, -3, -1.4, 4, 2.8, 1, '#2a1c12', false); // рукоять
    poly(c, [1, -2.2, 2, 2.2, 3, -2.2], '#5a4228', false); // гарда
    // клинок с зазубринами
    poly(c, [3, -2, 10, -1.6, 13, -0.5, 16, 0, 13, 1, 10, 1.6, 3, 2], '#8a7a6a');
    poly(c, [5, -1.8, 8, -0.4, 11, -1.4], 'rgba(120,60,30,0.5)', false); // ржавчина
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(4, -0.6); c.lineTo(13, -0.3); c.stroke();
    c.restore();
  }
}

function skeleton(c: C, _e: Enemy, a: A, archer: boolean) {
  const bone = '#d8cfa8', boneD = '#a89a74', eye = '#5ad0ff';
  const by = a.bob;
  // ноги-кости с суставами
  limb(c, -2.5, -17, -3 + a.run * 3.5, 0, 2.4, bone);
  limb(c, 2.5, -17, 3 - a.run * 3.5, 0, 2.4, bone);
  ell(c, -3 + a.run * 3.5, -0.5, 2.2, 1.4, boneD, false);
  ell(c, 3 - a.run * 3.5, -0.5, 2.2, 1.4, boneD, false);
  // таз
  poly(c, [-4.5, -17 + by, 4.5, -17 + by, 3.5, -13 + by, -3.5, -13 + by], boneD, false);
  // позвоночник
  limb(c, 0, -17 + by, 0, -28 + by, 2.2, bone);
  for (let i = 0; i < 3; i++) ell(c, 0, -19 - i * 3 + by, 1.6, 1, boneD, false);
  // грудная клетка с рёбрами и тенью внутри
  c.beginPath(); c.ellipse(0, -24 + by, 6.6, 6.8, 0, 0, TAU); c.fillStyle = bone; c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  ell(c, 0, -23 + by, 3.4, 4.6, 'rgba(20,16,12,0.5)', false); // полость
  c.strokeStyle = boneD; c.lineWidth = 1.4; c.lineCap = 'round';
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-5.5, -28 + i * 2.7 + by); c.quadraticCurveTo(0, -26 + i * 2.7 + by, 5.5, -28 + i * 2.7 + by); c.stroke(); }
  // ключицы-наплечники
  ell(c, -5, -29 + by, 2.4, 1.6, bone); ell(c, 5, -29 + by, 2.4, 1.6, bone);
  // череп — вытянутый, с трещинами
  c.beginPath(); c.moveTo(-4.5, -34 + by); c.quadraticCurveTo(-5, -40 + by, 1, -40.5 + by);
  c.quadraticCurveTo(7, -40 + by, 7, -34.5 + by); c.quadraticCurveTo(6, -31 + by, 3, -30.5 + by);
  c.lineTo(2.4, -28.5 + by); c.lineTo(0.4, -30.6 + by); c.quadraticCurveTo(-3, -31 + by, -4.5, -34 + by); c.closePath();
  c.fillStyle = vgrad(c, -40 + by, -30 + by, '#e6ddbc', boneD); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // трещина на черепе
  c.strokeStyle = 'rgba(60,50,36,0.6)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(1, -40 + by); c.lineTo(0, -37 + by); c.lineTo(1.5, -35.5 + by); c.stroke();
  // глазницы с холодным светом
  ell(c, 0.6, -35.6 + by, 1.9, 2.2, '#100c0a', false);
  ell(c, 4.4, -35.6 + by, 1.9, 2.2, '#100c0a', false);
  glowEye(c, 1, -35.4 + by, 0.95, eye, 2); glowEye(c, 4.6, -35.4 + by, 0.95, eye, 2);
  poly(c, [2.4, -32.5 + by, 3.4, -31 + by, 1.8, -31 + by], '#2a221c', false); // нос
  // зубы
  c.fillStyle = '#efe7cc'; for (let i = 0; i < 4; i++) c.fillRect(0.6 + i * 1.2, -30.4 + by, 0.9, 1.6);
  if (archer) {
    // истлевшая кожаная броня
    poly(c, [-5, -28 + by, 5, -28 + by, 4, -22 + by, -4, -22 + by], 'rgba(70,50,30,0.6)', false);
    // колчан
    rr(c, -8, -29 + by, 3.2, 8, 1, '#3a2a18', false);
    for (const ox of [-7.4, -6.2]) { poly(c, [ox - 0.8, -29 + by, ox + 0.8, -29 + by, ox, -31.5 + by], '#ddd', false); }
    // костяной лук с призрачной стрелой
    const draw = a.wind;
    limb(c, 2, -25 + by, 9 - draw * 3, -22 + by, 2.2, bone);
    c.strokeStyle = '#b8ac86'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.arc(11, -22 + by, 12, -1.15, 1.15); c.stroke();
    c.strokeStyle = 'rgba(90,208,255,0.8)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(11 + Math.cos(-1.15) * 12, -22 + by + Math.sin(-1.15) * 12); c.lineTo(11 - draw * 9, -22 + by); c.lineTo(11 + Math.cos(1.15) * 12, -22 + by + Math.sin(1.15) * 12); c.stroke();
    if (draw > 0.2) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(120,220,255,0.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(11 - draw * 9, -22 + by); c.lineTo(22, -22 + by); c.stroke();
      poly(c, [22, -23.4 + by, 25, -22 + by, 22, -20.6 + by], '#bfefff', false);
      c.restore();
    }
  } else {
    // полусгнивший щит на предплечье
    const sa = armAng(a, -0.5, -0.5, -0.5);
    ell(c, -6, -23 + by, 4.6, 6, '#6a4a2a'); ell(c, -6, -23 + by, 4.6, 6, 'rgba(0,0,0,0.3)', false);
    ell(c, -6, -23 + by, 2, 2.4, '#8a8a92'); // умбон
    c.strokeStyle = '#4a3420'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-9.5, -23 + by); c.lineTo(-2.5, -23 + by); c.stroke();
    void sa;
    // древний зазубренный меч
    const ang = armAng(a, 0.5, -2.3, 1.3);
    const hx = 4 + Math.cos(ang) * 7, hy = -25 + by + Math.sin(ang) * 7;
    limb(c, 4, -25 + by, hx, hy, 2.3, bone);
    c.save(); c.translate(hx, hy); c.rotate(ang);
    rr(c, -3, -1.1, 4, 2.2, 1, '#43372a', false);
    poly(c, [1, -2.4, 2, 2.4, 3, -2.4], '#6a5438', false);
    poly(c, [3, -1.8, 12, -1.5, 18, -0.5, 22, 0, 18, 1, 12, 1.6, 3, 1.8], '#9a9aa2');
    poly(c, [8, -1.6, 10, -0.4, 13, -1.5], 'rgba(60,70,50,0.4)', false); // патина
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(4, -0.5); c.lineTo(18, -0.3); c.stroke();
    c.restore();
  }
}

function necro(c: C, _e: Enemy, a: A) {
  const hv = Math.sin(a.t * 3) * 2.2 - 3;
  const purple = '#9a5cff';
  // чёрная роба с рваным подолом
  c.beginPath(); c.moveTo(-6, -30 + hv);
  c.quadraticCurveTo(-14, -12 + hv, -12, -1 + hv + Math.sin(a.t * 5) * 1);
  for (let i = 0; i < 7; i++) c.lineTo(-12 + i * 4, -1 + hv + (i % 2 ? 3.5 : -1) + Math.sin(a.t * 6 + i) * 1.4);
  c.quadraticCurveTo(14, -12 + hv, 6, -30 + hv); c.closePath();
  c.fillStyle = vgrad(c, -30 + hv, 0 + hv, '#2a1740', '#0e0818'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // руническая вышивка по краю (светящаяся)
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(154,92,255,0.6)'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-9, -6 + hv); c.lineTo(9, -6 + hv); c.stroke();
  for (let i = -2; i <= 2; i++) { c.strokeRect(i * 4 - 0.8, -8 + hv, 1.6, 1.6); }
  c.restore();
  // пояс
  rr(c, -7, -19 + hv, 14, 2.6, 1, '#4a2a6a', false);
  // капюшон с острым силуэтом
  c.beginPath(); c.moveTo(-6, -29 + hv); c.quadraticCurveTo(-7, -40 + hv, 0.5, -42 + hv);
  c.quadraticCurveTo(8, -40 + hv, 7, -29 + hv); c.quadraticCurveTo(3, -31 + hv, 0, -30.5 + hv);
  c.quadraticCurveTo(-3, -31 + hv, -6, -29 + hv); c.closePath();
  c.fillStyle = vgrad(c, -42 + hv, -29 + hv, '#331f4e', '#160d24'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // чёрная тень лица и два фиолетовых глаза
  ell(c, 0.5, -33 + hv, 4, 4.4, '#04030a', false);
  glowEye(c, -1, -33.4 + hv, 1.15, purple, 2.2); glowEye(c, 2.2, -33.4 + hv, 1.15, purple, 2.2);
  // посох с черепом и тёмным кристаллом
  const raise = a.wind;
  const sy = -26 + hv;
  limb(c, 4, sy, 10, sy + 5 - raise * 14, 3, '#2c1a44');
  limb(c, 11, -3 + hv, 11, -34 + hv, 2.4, '#4a3420');
  c.strokeStyle = '#2a1c10'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(11, -10 + hv); c.lineTo(11, -30 + hv); c.stroke();
  // череп на навершии
  ell(c, 11, -37 + hv, 3.6, 3.4, '#ded3b4');
  c.fillStyle = '#20160e'; c.fillRect(9.4, -37.6 + hv, 1.5, 1.6); c.fillRect(12, -37.6 + hv, 1.5, 1.6);
  poly(c, [10, -34.6 + hv, 12, -34.6 + hv, 11, -33.2 + hv], '#ded3b4', false);
  // парящий кристалл с пульсирующим свечением
  const pul = 3.4 + Math.sin(a.t * 6) * 0.7 + raise * 3;
  c.save(); c.globalCompositeOperation = 'lighter';
  const gl = c.createRadialGradient(11, -45 + hv, 0, 11, -45 + hv, pul * 2.4);
  gl.addColorStop(0, 'rgba(154,92,255,0.7)'); gl.addColorStop(1, 'rgba(154,92,255,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(11, -45 + hv, pul * 2.4, 0, TAU); c.fill();
  c.restore();
  poly(c, [11, -45 - pul + hv, 11 + pul * 0.7, -45 + hv, 11, -45 + pul + hv, 11 - pul * 0.7, -45 + hv], '#b98cff');
  poly(c, [11, -45 - pul + hv, 11, -45 + hv, 11 - pul * 0.7, -45 + hv], '#e4ccff', false);
}

function spider(c: C, e: Enemy, a: A, big: boolean) {
  const crouch = a.wind * 3;
  const body = big ? '#352a22' : '#3b2d26', abd = big ? '#1f2a14' : '#281d18';
  const legCol = big ? '#241c14' : '#241a15';
  const drawLegs = (far: boolean) => {
    for (let i = 0; i < 4; i++) {
      const bx = -4 + i * 3.3;
      const ph = a.t * 16 + i * 1.7 + (far ? Math.PI : 0);
      const lift = Math.max(0, Math.sin(ph)) * a.mv * 4;
      const fx = bx + (i - 1.5) * 6.5 + Math.cos(ph) * 3 * a.mv;
      const kx = bx + (i - 1.5) * 3.6, ky = -18 + (far ? 1.5 : 0) + crouch * 0.5;
      c.lineCap = 'round'; c.lineJoin = 'round';
      // двухсегментная нога с коленом вверх
      c.beginPath(); c.moveTo(bx, -8.5 + crouch); c.lineTo(kx, ky); c.lineTo(fx, -lift);
      c.strokeStyle = OUT; c.lineWidth = 3.6; c.stroke();
      c.strokeStyle = far ? '#160f0b' : legCol; c.lineWidth = 1.9; c.stroke();
      // коготь на кончике
      c.strokeStyle = far ? '#160f0b' : '#120c08'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx, -lift); c.lineTo(fx + (i < 2 ? -2 : 2), -lift + 2); c.stroke();
    }
  };
  drawLegs(true);
  // брюшко
  ell(c, -7, -9 + crouch, 8.4, 6.8, abd);
  if (big) {
    // раздутое светящееся лаймовое брюхо с костяными шипами
    c.save(); c.globalCompositeOperation = 'lighter';
    const gl = c.createRadialGradient(-7, -9 + crouch, 1, -7, -9 + crouch, 11);
    gl.addColorStop(0, 'rgba(150,255,60,0.5)'); gl.addColorStop(1, 'rgba(150,255,60,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(-7, -9 + crouch, 11, 0, TAU); c.fill(); c.restore();
    ell(c, -7, -8 + crouch, 6.4, 5, '#7cc820'); ell(c, -8, -9 + crouch, 3.6, 3, '#aef04a', false);
    for (const [sx, sy] of [[-12, -12], [-10, -14], [-5, -13], [-13, -8]]) poly(c, [sx + 7, sy + 10 + crouch - 10, sx, sy + crouch, sx + 2, sy + 2 + crouch], '#e8e0cf', false);
    // токсичный пар
    c.save(); c.globalAlpha = 0.25 + Math.sin(a.t * 4) * 0.1; c.fillStyle = '#9af050';
    c.beginPath(); c.arc(-7, -16 + crouch + Math.sin(a.t * 3) * 1, 3, 0, TAU); c.fill(); c.restore();
  } else {
    poly(c, [-10, -11 + crouch, -4, -11 + crouch, -7, -5 + crouch], '#1a140f', false);
    // чёрные отметины
    ell(c, -7, -9 + crouch, 3, 2.2, '#120d09', false);
  }
  // головогрудь
  ell(c, 1.5, -9 + crouch, 6.2, 5, body);
  ell(c, 5.5, -10 + crouch, 3.2, 2.8, body);
  sheen(c, 0, -11 + crouch, 3, 1.4, -0.3, 0.1);
  // кластер блестящих глаз
  const eyeCol = big ? '#aef04a' : '#ff4a3a';
  for (const [x, y, r] of [[5, -11.4, 1], [7, -10.6, 0.8], [4, -10.8, 0.7], [6.4, -9.4, 0.7], [8, -9.8, 0.6]]) glowEye(c, x, (y as number) + crouch, r as number, eyeCol, 1.8);
  // хелицеры с каплями яда
  poly(c, [8, -8 + crouch, 11, -4.5 + crouch, 7.4, -6 + crouch], '#1a120c', false);
  poly(c, [8.5, -7.5 + crouch, 11.5, -4 + crouch, 8, -5.5 + crouch], '#1a120c', false);
  c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(150,255,60,0.85)';
  c.beginPath(); c.arc(11, -3.5 + crouch + (a.t * 20 % 4), 1, 0, TAU); c.fill(); c.restore();
  drawLegs(false);
  if (e.mv < 0.01 && !big) { /* idle */ }
}

function bat(c: C, _e: Enemy, a: A) {
  const hv = -22 + Math.sin(a.t * 4) * 2.5;
  const fl = Math.sin(a.t * 26);
  // перепончатое крыло с раздвоенными пальцами и когтями
  const wing = (dark: boolean, side: number) => {
    const col = dark ? '#211a2a' : '#302440';
    const yl = hv - 9 - fl * 8, yl2 = hv - 5 - fl * 10;
    c.beginPath();
    c.moveTo(side * 1, hv - 2);
    c.lineTo(side * 6, yl);
    c.lineTo(side * 11, yl2 - 1); c.lineTo(side * 9, yl2 + 2); // палец
    c.lineTo(side * 16, yl2); c.lineTo(side * 13.5, yl2 + 3.5); // палец
    c.lineTo(side * 13, hv + 1 - fl * 6); c.lineTo(side * 8, hv + 2);
    c.lineTo(side * 5, hv + 6); c.lineTo(side * 1, hv + 2);
    c.closePath();
    c.fillStyle = col; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    // прожилки крыла
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(side * 2, hv); c.lineTo(side * 10, yl2); c.moveTo(side * 2, hv); c.lineTo(side * 14, yl2 + 1); c.stroke();
  };
  wing(true, 1);
  // пушистое тело из тёмно-серой шерсти
  ell(c, 0, hv, 4.4, 5.6, '#3a3640');
  ell(c, 0, hv + 1, 3.6, 4.4, '#4a454f', false);
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-2 + i * 1.3, hv - 2); c.lineTo(-2.4 + i * 1.3, hv + 4); c.stroke(); }
  // заострённая мордочка
  ell(c, 3.4, hv - 3.5, 3.4, 3.1, '#434050');
  // большие уши
  poly(c, [1.5, hv - 6, 2.2, hv - 12, 4.6, hv - 6.5], '#3a3640'); poly(c, [2.2, hv - 7, 2.7, hv - 10.5, 3.8, hv - 7], '#20303a', false);
  poly(c, [4.2, hv - 6.5, 6.4, hv - 11, 7, hv - 5.5], '#3a3640'); poly(c, [4.8, hv - 7, 5.9, hv - 9.8, 6.4, hv - 6.5], '#20303a', false);
  // горящие красные глаза
  glowEye(c, 2.8, hv - 4, 0.95, '#ff3030', 2.2);
  glowEye(c, 5.2, hv - 4, 0.8, '#ff3030', 2.2);
  // острые клыки
  poly(c, [3.2, hv - 1.6, 3.6, hv + 0.6, 4.2, hv - 1.6], '#fff', false);
  poly(c, [4.4, hv - 1.6, 4.8, hv + 0.4, 5.4, hv - 1.6], '#fff', false);
  wing(false, -1);
}

function orc(c: C, _e: Enemy, a: A, shaman: boolean) {
  const skin = shaman ? '#6f8a72' : '#5f7a52', dk = shaman ? '#4a5f4e' : '#42583a', skinL = shaman ? '#86a088' : '#7a966a';
  const by = a.bob;
  // массивные ноги
  limb(c, -4.5, -15, -5 + a.run * 4, 0, 6, dk);
  limb(c, 4.5, -15, 5 - a.run * 4, 0, 6, dk);
  ell(c, -5 + a.run * 4, -1.5, 4.8, 2.6, '#201810'); ell(c, 5 - a.run * 4, -1.5, 4.8, 2.6, '#201810');
  // левая рука (сзади)
  limb(c, -8, -30 + by, -11, -19 + by, 5.6, dk);
  ell(c, -11, -18 + by, 3, 3, skin);
  // мощный торс
  c.beginPath(); c.ellipse(0, -25 + by, 11, 11.5, 0, 0, TAU);
  c.fillStyle = vgrad(c, -36 + by, -14 + by, skinL, dk); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // грудные мышцы
  c.strokeStyle = 'rgba(20,30,16,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -30 + by); c.lineTo(0, -22 + by); c.stroke();
  if (shaman) {
    // шкура-накидка шамана
    poly(c, [-10, -32 + by, 10, -32 + by, 12, -8 + by, -12, -8 + by], '#6a4a3a', false);
    poly(c, [-10, -32 + by, 10, -32 + by, 8, -26 + by, -8, -26 + by], '#7a5a44', false);
  } else {
    // тяжёлая щербатая железная броня
    poly(c, [-9, -33 + by, 9, -33 + by, 10, -15 + by, -10, -15 + by], '#4a4e58', false);
    c.fillStyle = '#3a3e46'; c.fillRect(-9, -26 + by, 18, 1.6); c.fillRect(-9, -21 + by, 18, 1.6);
    sheen(c, -4, -29 + by, 2.4, 4, -0.2, 0.12);
    // заклёпки
    c.fillStyle = '#6a6e78'; for (const ox of [-7, 7]) for (const oy of [-30, -24, -18]) { c.beginPath(); c.arc(ox, oy + by, 0.9, 0, TAU); c.fill(); }
  }
  // широкий пояс
  rr(c, -10.5, -17 + by, 21, 3.8, 1, '#2c1e14', false);
  rr(c, -1.6, -17.4 + by, 3.4, 4.6, 0.8, '#b8923e', false);
  // железные наплечники
  for (const sx of [-1, 1]) {
    ell(c, sx * 10, -31 + by, 4.6, 3.6, shaman ? '#5a4436' : '#5a5e68');
    ell(c, sx * 10, -31 + by, 4.6, 3.6, 'rgba(255,255,255,0.1)', false);
    if (!shaman) poly(c, [sx * 7, -32 + by, sx * 10, -37 + by, sx * 13, -32 + by], '#44484f', false);
  }
  // шея и голова
  limb(c, 0, -32 + by, 1, -37 + by, 4, skin);
  ell(c, 1, -41 + by, 8, 7.4, skin);
  ell(c, 0, -43 + by, 7, 3.4, skinL, false); // лоб-блик
  // тяжёлая челюсть и клыки
  poly(c, [-4, -38 + by, 6, -38 + by, 5, -34 + by, -3, -34 + by], dk, false);
  poly(c, [-1, -35 + by, -0.4, -31.5 + by, 1.2, -35 + by], '#f3ead0', false); // нижний клык
  poly(c, [3, -35 + by, 3.6, -31.5 + by, 5, -35 + by], '#f3ead0', false);
  // надбровье и красные глаза
  poly(c, [-3, -43 + by, 7, -43 + by, 7, -41 + by, -3, -40.5 + by], dk, false);
  glowEye(c, 4.6, -40.5 + by, 1.1, shaman ? '#ffd23a' : '#ff5a2a', 2.2);
  glowEye(c, 0.6, -40.5 + by, 1, shaman ? '#ffd23a' : '#ff5a2a', 2);
  if (shaman) {
    // перья, черепки животных и амулеты
    for (let i = 0; i < 3; i++) poly(c, [-4 + i * 3, -46 + by, -3 + i * 3, -55 + by - i, -1.6 + i * 3, -46 + by], ['#c44a2a', '#e8c040', '#3a98c8'][i], false);
    ell(c, -7, -36 + by, 2, 2.2, '#ded3b4'); // маленький череп-амулет
    c.fillStyle = '#1a140c'; c.fillRect(-7.8, -36.4 + by, 0.7, 0.8); c.fillRect(-6.4, -36.4 + by, 0.7, 0.8);
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.7; c.beginPath(); c.arc(-3, -34 + by, 5, 0.3, 1.5); c.stroke(); // ожерелье
    // посох с цепью, плюющийся искрами
    const raise = a.wind;
    limb(c, 8, -31 + by, 14, -26 + by - raise * 8, 4.6, skin);
    limb(c, 14, -4, 14, -50, 2.6, '#5a3a22');
    c.strokeStyle = '#6a6a72'; c.lineWidth = 0.7; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(14 + (i % 2 ? 1 : -1), -14 - i * 4, 1, 0, TAU); c.stroke(); } // цепь
    poly(c, [10, -50 + by, 18, -50 + by, 14, -56 + by], '#6a4a2a', false); // навершие-рогатина
    const pr = 4.2 + Math.sin(a.t * 7) * 0.8 + raise * 3;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gl = c.createRadialGradient(14, -52, 0, 14, -52, pr * 2.3);
    gl.addColorStop(0, 'rgba(255,150,40,0.7)'); gl.addColorStop(1, 'rgba(255,150,40,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(14, -52, pr * 2.3, 0, TAU); c.fill(); c.restore();
    ell(c, 14, -52, pr, pr, '#ffb040'); ell(c, 13, -53, pr * 0.4, pr * 0.4, '#ffe8a0', false);
  } else {
    // щит на спине
    ell(c, 9, -33 + by, 4.6, 5.4, '#4a3420');
    // окровавленный тяжёлый орочий топор
    const ang = armAng(a, 0.45, -2.5, 1.5);
    const hx = 8 + Math.cos(ang) * 8, hy = -29 + by + Math.sin(ang) * 8;
    limb(c, 8, -29 + by, hx, hy, 5.4, skin);
    c.save(); c.translate(hx, hy); c.rotate(ang);
    rr(c, -6, -1.8, 24, 3.6, 1, '#3a2614', false); // рукоять
    // лезвие топора
    c.beginPath(); c.moveTo(14, -3); c.quadraticCurveTo(30, -12, 32, 0); c.quadraticCurveTo(30, 12, 14, 3); c.closePath();
    c.fillStyle = vgrad(c, -10, 10, '#a0a4ac', '#60646c'); c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke();
    poly(c, [18, -6, 26, -8, 28, 0, 26, 8, 18, 6], 'rgba(130,20,20,0.35)', false); // кровь
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(16, -2); c.quadraticCurveTo(28, -6, 30, 0); c.stroke();
    c.restore();
  }
}

function ogre(c: C, _e: Enemy, a: A) {
  const skin = '#8f8276', dk = '#625a50', skinL = '#a39688';
  const by = a.bob * 1.4;
  // толстые ноги
  limb(c, -7, -22, -8 + a.run * 4, 0, 11, dk);
  limb(c, 7, -22, 8 - a.run * 4, 0, 11, dk);
  ell(c, -8 + a.run * 4, -2, 7.4, 3.4, '#241c14'); ell(c, 8 - a.run * 4, -2, 7.4, 3.4, '#241c14');
  // левая рука
  limb(c, -13, -50 + by, -18, -30 + by, 9.5, dk);
  ell(c, -18, -29 + by, 5, 5, skin);
  // громадный каменистый торс
  c.beginPath(); c.ellipse(0, -31 + by, 18, 17, 0, 0, TAU);
  c.fillStyle = vgrad(c, -48 + by, -14 + by, skinL, dk); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  // каменная текстура кожи — бугры и шрамы
  c.fillStyle = 'rgba(0,0,0,0.14)';
  for (const [ox, oy, rx] of [[-8, -34, 3], [6, -28, 3.6], [-3, -22, 3], [10, -38, 2.4], [-11, -26, 2.6]]) { c.beginPath(); c.ellipse(ox, oy + by, rx as number, (rx as number) * 0.7, 0, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(70,30,20,0.5)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(-6, -40 + by); c.lineTo(-2, -30 + by); c.moveTo(8, -36 + by); c.lineTo(5, -28 + by); c.stroke(); // шрамы
  sheen(c, -7, -38 + by, 5, 7, -0.3, 0.1);
  // рваная набедренная повязка
  poly(c, [-15, -18 + by, 15, -18 + by, 13, -3 + by, 0, -8 + by, -13, -3 + by], '#4a3426');
  // цепи на торсе
  c.strokeStyle = '#5a5e66'; c.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-14 + i * 5, -24 + by + Math.sin(i) * 1.5, 1.4, 0, TAU); c.stroke(); }
  ell(c, 0, -10 + by, 3.6, 3.4, '#e6dfc8'); // пупок/шрам
  // толстая шея и голова
  ell(c, 2, -44 + by, 13, 8, skin);
  ell(c, 4, -57 + by, 9.4, 8.4, skin);
  ell(c, 5, -61 + by, 7, 3.4, skinL, false);
  // тяжёлая челюсть
  ell(c, 4, -52.5 + by, 8.4, 4.6, dk);
  poly(c, [0, -52 + by, 1.6, -58.5 + by, 3.4, -52 + by], '#f3ead0'); // клыки снизу
  poly(c, [7, -52 + by, 8.8, -58.5 + by, 10.4, -52 + by], '#f3ead0');
  // маленький злой глаз (один большой + прищур)
  poly(c, [2, -60 + by, 11, -60 + by, 11, -58 + by, 2, -57.5 + by], dk, false);
  glowEye(c, 7.4, -58 + by, 1.3, '#ffcf3a', 2); glowEye(c, 1.6, -58 + by, 0.7, '#ffcf3a', 1.6);
  // рога-наросты
  poly(c, [-2, -63 + by, -4, -69 + by, 0, -64 + by], skinL, false);
  poly(c, [9, -63 + by, 12, -68 + by, 11, -63 + by], skinL, false);
  // огромная шипастая дубина-бревно
  const ang = armAng(a, 0.4, -2.7, 1.7);
  const hx = 16 + Math.cos(ang) * 11, hy = -48 + by + Math.sin(ang) * 11;
  limb(c, 16, -48 + by, hx, hy, 9, skin);
  c.save(); c.translate(hx, hy); c.rotate(ang);
  c.beginPath(); c.moveTo(-8, -4); c.lineTo(20, -6); c.lineTo(40, -11); c.lineTo(46, 0); c.lineTo(40, 11); c.lineTo(20, 6); c.lineTo(-8, 4); c.closePath();
  c.fillStyle = vgrad(c, -11, 11, '#6a4a2a', '#3c2816'); c.fill();
  c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // кольца древесины
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(44, 0, 2.4, 9, 0, -1.2, 1.2); c.stroke();
  // железные шипы
  for (const [x, y] of [[24, -9], [32, -11], [40, -12], [28, 9], [36, 10], [44, 9]]) poly(c, [(x as number) - 2.4, y as number, (x as number) + 1.4, (y as number) + ((y as number) < 0 ? -7 : 7), (x as number) + 3.6, y as number], '#9a9aa4', false);
  c.restore();
}

function wraith(c: C, _e: Enemy, a: A) {
  const hv = -10 + Math.sin(a.t * 2.5) * 3;
  c.save();
  // клубящиеся теневые завитки позади (аддитивные)
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3;
  for (let i = 0; i < 3; i++) {
    const wx = Math.sin(a.t * 2 + i * 2) * 8, wy = -20 + hv - i * 4;
    const gl = c.createRadialGradient(wx, wy, 0, wx, wy, 7);
    gl.addColorStop(0, 'rgba(90,150,230,0.5)'); gl.addColorStop(1, 'rgba(90,150,230,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(wx, wy, 7, 0, TAU); c.fill();
  }
  c.restore();
  c.globalAlpha *= 0.85;
  // рваный полупрозрачный саван с развевающимися лентами
  c.beginPath(); c.moveTo(-6, -32 + hv);
  c.quadraticCurveTo(-15, -14 + hv, -13, 3 + hv);
  for (let i = 0; i < 8; i++) c.lineTo(-13 + i * 3.7, 3 + hv + (i % 2 ? 7 : 0) + Math.sin(a.t * 5 + i) * 2.5);
  c.quadraticCurveTo(15, -14 + hv, 6, -32 + hv); c.closePath();
  const g = c.createLinearGradient(0, -32 + hv, 0, 10 + hv);
  g.addColorStop(0, 'rgba(130,165,215,0.85)'); g.addColorStop(0.55, 'rgba(70,105,175,0.6)'); g.addColorStop(1, 'rgba(60,95,165,0)');
  c.fillStyle = g; c.fill();
  // складки савана
  c.strokeStyle = 'rgba(180,205,245,0.3)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(-4, -26 + hv); c.lineTo(-6, -6 + hv); c.moveTo(4, -26 + hv); c.lineTo(6, -6 + hv); c.stroke();
  // капюшон-пустота
  c.beginPath(); c.moveTo(-6, -30 + hv); c.quadraticCurveTo(-7, -40 + hv, 0, -41 + hv);
  c.quadraticCurveTo(7, -40 + hv, 6, -30 + hv); c.quadraticCurveTo(0, -32 + hv, -6, -30 + hv); c.closePath();
  c.fillStyle = 'rgba(25,40,70,0.9)'; c.fill();
  ell(c, 0, -33 + hv, 4.6, 5, '#03060e', false); // чёрная бездна лица
  // холодные голубые глаза
  glowEye(c, -1.6, -33.4 + hv, 1.1, '#9fe0ff', 2.4); glowEye(c, 2, -33.4 + hv, 1.1, '#9fe0ff', 2.4);
  // призрачные когтистые руки
  const raise = a.wind;
  c.strokeStyle = 'rgba(150,185,235,0.85)'; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(4, -24 + hv); c.quadraticCurveTo(12, -20 + hv - raise * 10, 16, -22 + hv - raise * 14); c.stroke();
  c.beginPath(); c.moveTo(-4, -24 + hv); c.quadraticCurveTo(-11, -22 + hv, -14, -26 + hv); c.stroke();
  if (raise > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(150,110,255,${0.4 + raise * 0.5})`; c.beginPath(); c.arc(17, -23 + hv - raise * 14, 3 + raise * 4, 0, TAU); c.fill();
    c.restore();
  }
  c.restore();
}

function mimic(c: C, _e: Enemy, a: A) {
  const hop = Math.abs(Math.sin(a.t * 10)) * a.mv * 5 + a.wind * -2;
  const open = clamp(0.3 + a.wind * 0.7 + a.sw * 0.55 + Math.sin(a.t * 6) * 0.1, 0, 1.2);
  c.translate(0, -hop);
  // маленькие когтистые лапки
  limb(c, -9, -3, -11 + a.run * 3, 3 + hop, 3.6, '#2e2014'); limb(c, 9, -3, 11 - a.run * 3, 3 + hop, 3.6, '#2e2014');
  poly(c, [-13 + a.run * 3, 2 + hop, -9 + a.run * 3, 2 + hop, -11 + a.run * 3, 5 + hop], '#120c06', false);
  poly(c, [9 - a.run * 3, 2 + hop, 13 - a.run * 3, 2 + hop, 11 - a.run * 3, 5 + hop], '#120c06', false);
  // --- нижний корпус сундука ---
  c.beginPath(); c.roundRect(-15, -15, 30, 14, 2.5);
  c.fillStyle = vgrad(c, -15, -1, '#7e5330', '#4a3018'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // доски
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-15, -8); c.lineTo(15, -8); c.stroke();
  // железные оковки
  c.fillStyle = '#9a7e36'; c.fillRect(-10, -15, 3, 14); c.fillRect(7, -15, 3, 14);
  c.fillStyle = '#6a5222'; for (const ox of [-8.5, 8.5]) for (const oy of [-13, -4]) { c.beginPath(); c.arc(ox, oy, 0.9, 0, TAU); c.fill(); }
  // --- глотка: дёсны, язык, зубы ---
  ell(c, 0, -15, 13, 3.6 + open * 3, '#5a0e1a');
  // длинный язык
  const tl = open * 14;
  c.beginPath(); c.moveTo(-3, -15); c.quadraticCurveTo(2, -15 + tl * 0.7, 0, -15 + tl); c.quadraticCurveTo(-2, -15 + tl * 0.7, -5, -15); c.closePath();
  c.fillStyle = '#d8486a'; c.fill();
  ell(c, 0, -15 + tl, 2, 1.4, '#e86a86', false);
  // нижние зубы
  for (let i = 0; i < 7; i++) poly(c, [-13 + i * 4.2, -15, -11.4 + i * 4.2, -11 + open * 2, -9.8 + i * 4.2, -15], '#f6f0dc', false);
  // --- верхняя крышка, распахивается ---
  c.save(); c.translate(-14, -15); c.rotate(-open * 1.15);
  c.beginPath(); c.roundRect(0, -15, 29, 15, 3);
  c.fillStyle = vgrad(c, -15, 0, '#8a5d36', '#5a3a1e'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = '#9a7e36'; c.fillRect(5, -15, 3, 15); c.fillRect(21, -15, 3, 15);
  // верхние клыки (свисают вниз)
  for (let i = 0; i < 7; i++) poly(c, [2 + i * 4.2, 0, 3.6 + i * 4.2, -4 - open * 2, 5.2 + i * 4.2, 0], '#f6f0dc', false);
  // злые глаза на внутренней стороне крышки
  glowEye(c, 9, -9, 1.4, '#ffd23a', 2.2); glowEye(c, 19, -9, 1.4, '#ffd23a', 2.2);
  c.restore();
}

function boss(c: C, e: Enemy, a: A) {
  const bone = '#ddd4b6', metal = '#2e2e3c', metalL = '#4a4a5c', gold = '#d8ad4e';
  const ph = e.phase;
  const necro = ph >= 3 ? '#b56bff' : '#ff8a2a';
  const by = a.bob * 1.5;
  const sw = Math.sin(a.t * 3) * 3;
  // --- королевский плащ с рваной золотой каймой ---
  c.beginPath(); c.moveTo(-7, -92 + by); c.bezierCurveTo(-32 - sw, -70, -38 - sw, -28, -30 - sw * 1.5 - a.mv * 6, -1);
  c.lineTo(-20, -5); c.lineTo(-14, -1); c.lineTo(-7, -5); c.lineTo(-1, -3); c.lineTo(4, -50 + by); c.closePath();
  c.fillStyle = vgrad(c, -92, 0, '#6a1226', '#200610'); c.fill(); c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = 'rgba(200,160,70,0.5)'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(-20, -5); c.lineTo(-30 - sw, -1); c.stroke();
  // --- ноги в латах ---
  limb(c, -8, -44 + by, -9 + a.run * 7, -4, 7.5, bone); limb(c, 8, -44 + by, 9 - a.run * 7, -4, 7.5, bone);
  rr(c, -16 + a.run * 7, -17, 14, 9, 2, metal); rr(c, 3 - a.run * 7, -17, 14, 9, 2, metal);
  for (const lx of [-9 + a.run * 7, 9 - a.run * 7]) { poly(c, [lx - 7, -8, lx + 7, -8, lx + 5, -1, lx - 5, -1], '#1a1a24', false); } // сабатоны
  // --- позвоночник и таз ---
  ell(c, 0, -46 + by, 12, 5, bone);
  limb(c, 0, -47 + by, 0, -78 + by, 5.4, bone);
  for (let i = 0; i < 4; i++) ell(c, 0, -52 - i * 6 + by, 2.4, 1.4, '#b8ac86', false);
  // --- грудная клетка с светящимся ядром ---
  ell(c, 0, -68 + by, 18, 19, bone);
  ell(c, 0, -67 + by, 11, 13, 'rgba(18,14,10,0.55)', false);
  c.strokeStyle = 'rgba(40,32,26,0.85)'; c.lineWidth = 2.2; c.lineCap = 'round';
  for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-16, -78 + i * 6.5 + by); c.quadraticCurveTo(0, -74 + i * 6.5 + by, 16, -78 + i * 6.5 + by); c.stroke(); }
  // пульсирующее некротическое ядро
  const pul = 5 + Math.sin(a.t * 5) * 1.3 + ph;
  c.save(); c.globalCompositeOperation = 'lighter';
  const core = c.createRadialGradient(0, -66 + by, 0, 0, -66 + by, pul * 2.6);
  core.addColorStop(0, necro); core.addColorStop(0.5, necro + '80'); core.addColorStop(1, necro + '00');
  c.fillStyle = core; c.beginPath(); c.arc(0, -66 + by, pul * 2.6, 0, TAU); c.fill(); c.restore();
  ell(c, 0, -66 + by, pul, pul, ph >= 3 ? '#e6c0ff' : '#ffce90');
  // --- готические наплечники с шипами ---
  for (const sx of [-1, 1]) {
    c.beginPath(); c.ellipse(sx * 20, -82 + by, 11, 8, 0, 0, TAU);
    c.fillStyle = vgrad(c, -90, -74, metalL, metal); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
    c.strokeStyle = gold; c.lineWidth = 1.6; c.beginPath(); c.ellipse(sx * 20, -82 + by, 11, 8, 0, 0.2, 2.9); c.stroke();
    poly(c, [sx * 15, -87 + by, sx * 20, -101 + by, sx * 25, -87 + by], '#44444f'); // шип
    poly(c, [sx * 17, -86 + by, sx * 20, -95 + by, sx * 23, -86 + by], metalL, false);
  }
  // --- череп короля ---
  c.beginPath(); c.ellipse(2, -99 + by, 11.5, 10.5, 0, 0, TAU);
  c.fillStyle = vgrad(c, -110, -90, '#efe6c8', '#c3b890'); c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  ell(c, 3, -90 + by, 8.5, 4.2, '#cfc7ad'); // челюсть
  c.fillStyle = '#efe6c8'; for (let i = 0; i < 5; i++) c.fillRect(-2 + i * 2.4, -91 + by, 1.6, 2.4); // зубы
  // трещина
  c.strokeStyle = 'rgba(60,50,36,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -108 + by); c.lineTo(-2, -103 + by); c.lineTo(0, -100 + by); c.stroke();
  // глазницы с пылающим светом
  ell(c, 6, -100 + by, 3.6, 4, '#120b08', false); ell(c, -3, -100 + by, 3.2, 3.8, '#120b08', false);
  glowEye(c, 6.4, -100 + by, 1.6, necro, 2.4); glowEye(c, -2.6, -100 + by, 1.4, necro, 2.4);
  // --- чёрная корона с треснувшим рубином ---
  c.beginPath();
  c.moveTo(-9, -107 + by); c.lineTo(-8.5, -120 + by); c.lineTo(-4, -110 + by); c.lineTo(0, -123 + by);
  c.lineTo(4, -110 + by); c.lineTo(8.5, -120 + by); c.lineTo(11, -107 + by); c.closePath();
  c.fillStyle = vgradColor(c, '#3a3a46', '#1a1a22', -122, -106); c.fill();
  c.lineWidth = 1; c.strokeStyle = gold; c.stroke();
  // золотые кончики
  for (const [cx, cy] of [[0, -123], [-8.5, -120], [8.5, -120]]) ell(c, cx, (cy as number) + by, 1.3, 1.3, gold, false);
  // рубин
  c.save(); c.globalCompositeOperation = 'lighter';
  const rg = c.createRadialGradient(1, -112 + by, 0, 1, -112 + by, 5);
  rg.addColorStop(0, 'rgba(255,60,90,0.8)'); rg.addColorStop(1, 'rgba(255,60,90,0)');
  c.fillStyle = rg; c.beginPath(); c.arc(1, -112 + by, 5, 0, TAU); c.fill(); c.restore();
  poly(c, [1, -115 + by, 3.2, -112 + by, 1, -109 + by, -1.2, -112 + by], '#e0284a');
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(1, -115 + by); c.lineTo(0.2, -110 + by); c.stroke(); // трещина
  // короны пламя
  if (ph >= 2) {
    for (let i = 0; i < 5; i++) flame(c, -9 + i * 5, -119 + by, 3, 11 + Math.sin(a.t * 8 + i) * 3, a.t, i * 3, ph >= 3 ? '#a64aff88' : '#ff7a2a88', ph >= 3 ? '#e0a0ff99' : '#ffd05a99');
  }
  // --- левая костяная рука ---
  limb(c, -21, -78 + by, -27, -60 + by, 7.5, bone);
  ell(c, -27, -59 + by, 3.4, 3.4, bone);
  // --- двуручный меч в некротическом пламени ---
  const ang = armAng(a, 0.5, -2.45, 1.75);
  const sx0 = 21, sy0 = -78 + by;
  const hx = sx0 + Math.cos(ang) * 14, hy = sy0 + Math.sin(ang) * 14;
  limb(c, sx0, sy0, hx, hy, 8, bone);
  ell(c, hx, hy, 5.5, 5.5, metal);
  c.save(); c.translate(hx, hy); c.rotate(ang);
  // рукоять и гарда
  rr(c, -12, -2.6, 16, 5.2, 2, '#2a1c12', false);
  poly(c, [4, -8, 4, 8, 9, 8, 9, -8], gold);
  ell(c, 7, 0, 2, 2, '#e0284a', false); // камень в гарде
  // клинок
  c.beginPath(); c.moveTo(9, -6.5); c.lineTo(72, -5); c.lineTo(90, 0); c.lineTo(72, 5); c.lineTo(9, 6.5); c.closePath();
  c.fillStyle = vgrad(c, -7, 7, '#52525f', '#2c2c38'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // дол и блик
  c.strokeStyle = 'rgba(220,210,255,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(12, 0); c.lineTo(84, 0); c.stroke();
  // некротическое пламя вдоль лезвия (аддитивно)
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const fx = 14 + i * 8, fy = (i % 2 ? -1 : 1) * 6;
    const fr = 5 + Math.sin(a.t * 10 + i) * 2.5;
    const gl = c.createRadialGradient(fx, fy, 0, fx, fy, fr);
    gl.addColorStop(0, ph >= 3 ? 'rgba(200,140,255,0.85)' : 'rgba(255,150,60,0.85)');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(fx, fy, fr, 0, TAU); c.fill();
  }
  c.restore();
  c.restore();
}
// helper: вертикальный градиент из двух цветов на фикс. диапазоне (для poly нужна заливка строкой — используем для crown)
function vgradColor(c: C, a: string, b: string, y0: number, y1: number): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g;
}

const KIND: Record<string, (c: C, e: Enemy, a: A) => void> = {
  goblin: (c, e, a) => goblin(c, e, a, false),
  goblinArcher: (c, e, a) => goblin(c, e, a, true),
  skeleton: (c, e, a) => skeleton(c, e, a, false),
  skelArcher: (c, e, a) => skeleton(c, e, a, true),
  necro, bat, ogre, wraith, mimic, boss,
  spider: (c, e, a) => spider(c, e, a, false),
  webSpider: (c, e, a) => spider(c, e, a, true),
  orc: (c, e, a) => orc(c, e, a, false),
  shaman: (c, e, a) => orc(c, e, a, true),
};

let scratch: HTMLCanvasElement | null = null;
let sctx: CanvasRenderingContext2D | null = null;

export function drawEnemy(c: C, e: Enemy) {
  const def = e.def;
  const sc = e.sc;
  const fn = KIND[def.kind];
  const a: A = {
    t: e.anim, mv: e.mv, wind: e.wind, sw: e.swing,
    run: Math.sin(e.anim * (7 + e.speed / 18)) * e.mv,
    bob: Math.abs(Math.sin(e.anim * (7 + e.speed / 18))) * -1.4 * e.mv,
  };
  const shR = Math.max(8, def.r * 1.3 * sc);
  shadow(c, e.x, e.y + 1, shR, shR * 0.38, def.flying ? 0.22 : 0.42);
  if (e.elite) {
    const col = e.elite === 'fast' ? '#5adfff' : e.elite === 'armored' ? '#b9c3d6' : '#ff7a3a';
    c.save(); c.translate(e.x, e.y); c.scale(1, 0.38);
    c.strokeStyle = col; c.lineWidth = 3; c.globalAlpha = 0.65 + Math.sin(e.anim * 5) * 0.2;
    c.beginPath(); c.arc(0, 0, shR * 1.25, 0, TAU); c.stroke(); c.restore();
  }
  if (e.seal) {
    c.save(); c.translate(e.x, e.y); c.scale(1, 0.43);
    c.rotate(e.anim * 0.3);
    c.strokeStyle = '#bd83ff'; c.lineWidth = 2.2;
    c.globalAlpha = 0.75 + Math.sin(e.anim * 4) * 0.15;
    c.setLineDash([8, 5]);
    c.beginPath(); c.arc(0, 0, shR * 1.55, 0, TAU); c.stroke();
    c.setLineDash([]); c.restore();
  }
  const body = (ctx: C, ox: number, oy: number) => {
    ctx.save(); ctx.translate(ox, oy + (e.spawnT > 0 ? e.spawnT * 14 : 0));
    if (e.spawnT > 0) ctx.globalAlpha = clamp(1 - e.spawnT, 0.1, 1);
    ctx.scale(e.face * sc, sc);
    fn(ctx, e, a);
    ctx.restore();
  };
  const frozen = e.st.freezeT > 0;
  if (e.flash > 0 || frozen) {
    if (!scratch) { scratch = document.createElement('canvas'); scratch.width = 340; scratch.height = 340; sctx = scratch.getContext('2d'); }
    const s = sctx!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, 340, 340);
    body(s, 170, 280);
    s.globalCompositeOperation = 'source-atop';
    s.fillStyle = e.flash > 0 ? `rgba(255,255,255,${Math.min(0.85, 0.3 + e.flash * 5)})` : 'rgba(130,215,255,0.55)';
    s.fillRect(0, 0, 340, 340);
    s.globalCompositeOperation = 'source-over';
    c.drawImage(scratch, e.x - 170, e.y - 280);
  } else body(c, e.x, e.y);
  if (e.seal) {
    const y = e.y - e.def.h * sc - 29 + Math.sin(e.anim * 3) * 3;
    c.save(); c.translate(e.x, y);
    c.fillStyle = 'rgba(185,108,255,0.2)';
    c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fill();
    poly(c, [0, -10, 7, 0, 0, 10, -7, 0], '#b475f9');
    poly(c, [0, -10, 0, 2, -7, 0], '#e9cbff', false);
    c.restore();
  }
}

// ---------------------------------------------------------------- реквизит
export function isFloorProp(k: string) { return k === 'spikes' || k === 'web' || k === 'bones'; }

function barrel(c: C, _p: Prop, bomb: boolean, t: number) {
  shadow(c, 0, 1, 14, 4.5, 0.38);
  const g = c.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, bomb ? '#5a1a14' : '#4a3220'); g.addColorStop(0.45, bomb ? '#b0382c' : '#7e5a34'); g.addColorStop(1, bomb ? '#3a100c' : '#35241a');
  c.beginPath(); c.moveTo(-10, -26); c.quadraticCurveTo(-15, -13, -11.5, 0); c.lineTo(11.5, 0); c.quadraticCurveTo(15, -13, 10, -26); c.closePath();
  c.fillStyle = g; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1;
  for (const x of [-5, 0, 5]) { c.beginPath(); c.moveTo(x, -26); c.lineTo(x * 1.2, 0); c.stroke(); }
  c.fillStyle = '#2e2e38'; c.fillRect(-12.6, -20, 25.2, 3); c.fillRect(-12.8, -7, 25.6, 3);
  ell(c, 0, -26, 10, 3.4, bomb ? '#7a2a20' : '#8a6640'); ell(c, 0, -26, 7, 2.2, bomb ? '#4a1812' : '#5a4228', false);
  if (bomb) {
    ell(c, 0, -13.5, 3.4, 3.2, '#e8e0c8'); c.fillStyle = '#1a1210'; c.fillRect(-2, -14.4, 1.4, 1.6); c.fillRect(0.6, -14.4, 1.4, 1.6);
    limb(c, 3, -28, 6, -35, 1.4, '#8a6a3a');
    c.fillStyle = Math.sin(t * 20) > 0 ? '#ffe04a' : '#ff8a2a'; c.beginPath(); c.arc(6, -35.5, 2 + Math.sin(t * 30) * 0.6, 0, TAU); c.fill();
  }
}

function crate(c: C) {
  shadow(c, 0, 1, 15, 4.5, 0.38);
  rr(c, -12.5, -23, 25, 23, 1.5, '#7a5834');
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-12.5, -15, 25, 1.4); c.fillRect(-12.5, -8, 25, 1.4);
  rr(c, -12.5, -23, 25, 4, 1, '#8e6a40', false);
  c.strokeStyle = '#4e3820'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-11, -21); c.lineTo(11, -2); c.moveTo(11, -21); c.lineTo(-11, -2); c.stroke();
  c.fillStyle = '#3a3a44';
  for (const [x, y] of [[-10, -21], [10, -21], [-10, -3], [10, -3]]) { c.beginPath(); c.arc(x, y, 1.2, 0, TAU); c.fill(); }
}

function chestDraw(c: C, p: Prop, t: number, kind: string) {
  shadow(c, 0, 1, 19, 5, 0.4);
  const pal = kind === 'ironchest' ? { b: '#464c58', l: '#5e6674', t: '#a6b4c8' }
    : kind === 'vault' ? { b: '#241f2e', l: '#33293f', t: '#e6bc4a' } : { b: '#6b4526', l: '#82562f', t: '#b8963a' };
  const open = p.state === 1;
  rr(c, -16, -14, 32, 14, 2, pal.b);
  c.fillStyle = pal.t; c.fillRect(-10, -14, 3, 14); c.fillRect(7, -14, 3, 14);
  if (!open) {
    c.beginPath(); c.moveTo(-16, -14); c.bezierCurveTo(-16, -30, 16, -30, 16, -14); c.closePath();
    c.fillStyle = pal.l; c.fill(); c.lineWidth = 1.2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = pal.t; c.fillRect(-10, -26, 3, 11); c.fillRect(7, -26, 3, 11);
    ell(c, 0, -14, 3.4, 4, pal.t);
    c.fillStyle = '#1a1210'; c.fillRect(-0.8, -15.5, 1.6, 3.6);
    if (kind === 'vault') {
      c.fillStyle = `rgba(255,200,80,${0.15 + Math.sin(t * 3) * 0.08})`; c.beginPath(); c.arc(0, -14, 14, 0, TAU); c.fill();
    }
  } else {
    poly(c, [-16, -14, 16, -14, 14, -31, -14, -31], pal.l);
    ell(c, 0, -14, 14.5, 3.8, '#ffdd78');
    c.fillStyle = 'rgba(255,230,140,0.4)'; c.beginPath(); c.ellipse(0, -18, 14, 9, 0, 0, TAU); c.fill();
  }
}

function shrine(c: C, p: Prop, t: number) {
  const col = ({ blood: '#ff3355', power: '#ff9a2e', life: '#5dff9a', fortune: '#ffd84a', curse: '#b050ff' } as Record<string, string>)[p.sub] || '#fff';
  const used = p.state > 0;
  const k = used ? '#6a6a74' : col;
  shadow(c, 0, 1, 22, 6.5, 0.4);
  c.strokeStyle = used ? 'rgba(120,120,130,0.3)' : col + '99'; c.lineWidth = 2; c.setLineDash([6, 5]);
  c.beginPath(); c.ellipse(0, 0, 26 + Math.sin(t * 2) * 1.5, 9, 0, 0, TAU); c.stroke(); c.setLineDash([]);
  poly(c, [-14, 0, -11, -9, 11, -9, 14, 0], '#4e4e5c');
  poly(c, [-9, -9, -7, -21, 7, -21, 9, -9], '#62626f');
  rr(c, -12, -25, 24, 5, 2, '#7a7a88');
  const fy = -37 + Math.sin(t * 2.4) * 3;
  if (!used) { c.fillStyle = col + '33'; c.beginPath(); c.arc(0, fy, 14, 0, TAU); c.fill(); }
  poly(c, [0, fy - 9, 6, fy, 0, fy + 9, -6, fy], k);
  poly(c, [0, fy - 9, 3, fy, 0, fy + 4], 'rgba(255,255,255,0.45)', false);
}

function sarcophagus(c: C, p: Prop) {
  shadow(c, 0, 1, 27, 6, 0.4);
  rr(c, -22, -17, 44, 17, 3, '#5a5a66');
  if (p.state === 0) {
    rr(c, -24, -26, 48, 12, 5, '#8a8a98');
    c.fillStyle = '#5a5a68'; c.fillRect(-1.6, -25, 3.2, 10); c.fillRect(-6, -21, 12, 3);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(10, -26); c.lineTo(14, -20); c.lineTo(11, -15); c.stroke();
  } else {
    rr(c, -2, -22, 30, 11, 4, '#7a7a88');
    c.fillStyle = '#0a0810'; c.fillRect(-20, -17, 22, 5);
  }
}

function brazier(c: C, p: Prop, t: number) {
  shadow(c, 0, 1, 12, 4, 0.4);
  limb(c, -6, 0, -3, -14, 2.4, '#33333c'); limb(c, 6, 0, 3, -14, 2.4, '#33333c'); limb(c, 0, 0, 0, -14, 2.4, '#33333c');
  poly(c, [-11, -22, 11, -22, 7, -13, -7, -13], '#3e3e48');
  const blue = p.sub === 'blue', red = p.sub === 'red';
  flame(c, 0, -22, 8, 22, t, p.seed, blue ? '#3a8aff' : red ? '#d82a2a' : '#ff8a22', blue ? '#a8e0ff' : red ? '#ffb05a' : '#ffe27a');
}

function campfire(c: C, p: Prop, t: number, orc: boolean) {
  shadow(c, 0, 2, 22, 8, 0.4);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    ell(c, Math.cos(a) * 17, Math.sin(a) * 6 - 2, 4.2, 3, '#585866');
  }
  limb(c, -12, -2, 10, -9, 4.4, '#4a2e1a'); limb(c, 12, -2, -10, -9, 4.4, '#4a2e1a');
  if (orc) { ell(c, -17, -5, 3.4, 2.6, '#e6dfc8'); }
  flame(c, 0, -6, 11, 30 + Math.sin(t * 7 + p.seed) * 3, t, p.seed, orc ? '#d8381a' : '#ff8a22', '#ffe27a');
}

function merchant(c: C, _p: Prop, t: number) {
  const bob = Math.sin(t * 2) * 0.8;
  shadow(c, 0, 1, 17, 5.5, 0.42);
  // --- переполненный мешок с товарами за спиной ---
  c.beginPath(); c.moveTo(-20, -12); c.quadraticCurveTo(-24, -34 + bob, -14, -40 + bob);
  c.quadraticCurveTo(-5, -38 + bob, -6, -12); c.closePath();
  c.fillStyle = vgrad(c, -40, -12, '#7a5632', '#4a3420'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // перетяжка мешка
  rr(c, -21, -40 + bob, 15, 5, 2.5, '#8a6238');
  c.strokeStyle = '#2a1c10'; c.lineWidth = 1; c.beginPath(); c.moveTo(-18, -40 + bob); c.lineTo(-18, -35 + bob); c.moveTo(-12, -40 + bob); c.lineTo(-12, -35 + bob); c.stroke();
  // торчащие предметы: свитки, бутыль, монеты
  poly(c, [-18, -40 + bob, -16, -47 + bob, -14, -40 + bob], '#d8c79a', false); // свиток
  ell(c, -16, -47 + bob, 2, 1.2, '#b8a274', false);
  rr(c, -12, -46 + bob, 3.4, 6, 1.4, '#4aa0d8'); ell(c, -10.3, -46 + bob, 1.7, 0.8, '#8ad0f0', false); // синяя бутыль
  rr(c, -11.6, -47.5 + bob, 2.6, 2, 0.6, '#8a6a3a', false); // пробка
  ell(c, -8, -43 + bob, 1.8, 1.8, '#ffcf3a'); ell(c, -6.5, -42 + bob, 1.6, 1.6, '#ffcf3a'); // монеты
  // лямка
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-6, -32 + bob); c.quadraticCurveTo(0, -30, 2, -22); c.stroke();
  // --- тяжёлая шерстяная мантия ---
  c.beginPath(); c.moveTo(-7, -34 + bob); c.quadraticCurveTo(-14, -14, -12, 0);
  c.lineTo(12, 0); c.quadraticCurveTo(14, -14, 7, -34 + bob); c.closePath();
  c.fillStyle = vgrad(c, -34, 0, '#4a3360', '#241433'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  // складки ткани
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-4, -30 + bob); c.lineTo(-6, -2); c.moveTo(4, -30 + bob); c.lineTo(6, -2); c.moveTo(0, -28 + bob); c.lineTo(0, -2); c.stroke();
  // вышитый оккультный символ (светящийся)
  c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(200,160,255,0.55)'; c.lineWidth = 0.9;
  c.beginPath(); c.arc(0, -18, 3.2, 0, TAU); c.stroke();
  for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i / 5) * TAU; c.beginPath(); c.moveTo(0, -18); c.lineTo(Math.cos(an) * 3.2, -18 + Math.sin(an) * 3.2); c.stroke(); }
  c.restore();
  // золотая оторочка подола
  rr(c, -10, -15, 20, 2.6, 1, '#c8a24a', false);
  // воротник
  poly(c, [-7, -33 + bob, 7, -33 + bob, 5, -28 + bob, -5, -28 + bob], '#3a2850', false);
  // --- капюшон с настороженным лицом ---
  c.beginPath(); c.moveTo(-6, -33 + bob); c.quadraticCurveTo(-7, -42 + bob, 0, -43 + bob);
  c.quadraticCurveTo(7, -42 + bob, 6, -33 + bob); c.quadraticCurveTo(0, -35 + bob, -6, -33 + bob); c.closePath();
  c.fillStyle = vgrad(c, -43, -33, '#4a3360', '#2a1a3c'); c.fill(); c.lineWidth = 1.1; c.strokeStyle = OUT; c.stroke();
  ell(c, 1, -36 + bob, 4.4, 4.6, '#0a060f', false); // тень лица
  glowEye(c, -0.6, -36.4 + bob, 1, '#ffd84a', 2); glowEye(c, 2.6, -36.4 + bob, 1, '#ffd84a', 2);
  // --- посох-фонарь ---
  limb(c, 8, -30 + bob, 14, -28 + bob, 2.4, '#4a3360');
  limb(c, 15, -40 + bob, 15, -16 + bob, 1.4, '#6a4a2a');
  poly(c, [12, -40 + bob, 18, -40 + bob, 15, -44 + bob], '#8a6a3a', false); // держатель
  rr(c, 12, -40 + bob, 6, 7, 1.5, '#5a4428', false); // корпус фонаря
  c.save(); c.globalCompositeOperation = 'lighter';
  const lg = c.createRadialGradient(15, -36 + bob, 0, 15, -36 + bob, 13 + Math.sin(t * 6));
  lg.addColorStop(0, 'rgba(255,200,110,0.6)'); lg.addColorStop(1, 'rgba(255,200,110,0)');
  c.fillStyle = lg; c.beginPath(); c.arc(15, -36 + bob, 13 + Math.sin(t * 6), 0, TAU); c.fill(); c.restore();
  flame(c, 15, -34 + bob, 2, 5, t, 3, '#ff9a3a', '#ffe27a');
  // --- вращающаяся золотая монета над головой ---
  const cy = -54 + Math.sin(t * 3) * 2;
  const cw = Math.abs(Math.cos(t * 4)) * 4 + 1;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
  c.drawImage(getGfxGlow('#ffcf3a'), 15 - 11, cy - 11, 22, 22); c.restore();
  c.beginPath(); c.ellipse(15, cy, cw, 4.2, 0, 0, TAU);
  c.fillStyle = vgrad(c, cy - 4, cy + 4, '#ffe89a', '#c88a1e'); c.fill();
  c.lineWidth = 0.8; c.strokeStyle = '#8a5a10'; c.stroke();
  if (cw > 2) { c.fillStyle = '#8a5a10'; c.font = 'bold 5px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✦', 15, cy); }
}
// лёгкий доступ к кэшу свечения для монеты торговца
let _glowCanvasCache: Map<string, HTMLCanvasElement> | null = null;
function getGfxGlow(col: string): HTMLCanvasElement {
  if (!_glowCanvasCache) _glowCanvasCache = new Map();
  let cv = _glowCanvasCache.get(col);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(0.4, col + '88'); gr.addColorStop(1, col + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    _glowCanvasCache.set(col, cv);
  }
  return cv;
}

function spikes(c: C, p: Prop) {
  ell(c, 0, 0, 15, 8, '#15121a', false);
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 15, 8, 0, 0, TAU); c.stroke();
  const h = p.state === 2 ? 15 : p.state === 1 ? 4 : 1.2;
  if (p.state === 1) { c.fillStyle = 'rgba(255,60,60,0.25)'; c.beginPath(); c.ellipse(0, 0, 15, 8, 0, 0, TAU); c.fill(); }
  for (const [x, y] of [[-8, -1], [0, -3], [8, -1], [-4, 3], [4, 3], [0, 0.5]]) {
    poly(c, [x - 2.2, y, x, y - h, x + 2.2, y], p.state === 2 ? '#c8ccd6' : '#6a6e78', p.state !== 0);
  }
}

function web(c: C, p: Prop) {
  c.save(); c.globalAlpha = 0.55; c.strokeStyle = '#e8e8f0'; c.lineWidth = 0.9; c.translate(0, -4); c.scale(1, 0.62);
  const n = 8; const R = 22;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + p.seed; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); c.stroke(); }
  for (let r = 6; r <= R; r += 5.5) {
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU + p.seed; const rr2 = r * (i % 2 ? 0.88 : 1);
      if (i === 0) c.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); else c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
    }
    c.stroke();
  }
  c.restore();
}

function bonesProp(c: C, p: Prop) {
  let s = p.seed * 997;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 4; i++) {
    const x = (r() - 0.5) * 26, y = (r() - 0.5) * 10, a = r() * TAU, l = 5 + r() * 5;
    limb(c, x - Math.cos(a) * l, y - Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5, 2, '#cfc7ad');
    ell(c, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5, 1.8, 1.6, '#cfc7ad', false);
  }
  if (r() < 0.75) {
    const x = (r() - 0.5) * 12;
    ell(c, x, -3, 5.4, 4.8, '#e0d9c2');
    c.fillStyle = '#15100c'; c.fillRect(x - 3, -4.4, 2, 2.4); c.fillRect(x + 1, -4.4, 2, 2.4);
  }
}

function candles(c: C, p: Prop, t: number) {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 6, h = 6 + ((i * 7 + Math.floor(p.seed)) % 5);
    rr(c, x - 1.6, -h, 3.2, h, 1, '#e8dcc0', false);
    flame(c, x, -h, 1.6, 5, t, p.seed + i * 2, '#ffb030', '#fff0a0');
  }
}

function cocoon(c: C, p: Prop, t: number) {
  const wig = Math.sin(t * 7 + p.seed) * (p.hit > 0 ? 3 : 0.6);
  shadow(c, 0, 1, 9, 3, 0.3);
  limb(c, 0, -34, 0, -24, 1, '#cfd0d8');
  c.save(); c.translate(wig, 0);
  ell(c, 0, -14, 9, 13, '#cfd2da');
  c.strokeStyle = 'rgba(120,125,140,0.7)'; c.lineWidth = 1;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, -14, 9, 4 + i * 3, 0, 0.2, Math.PI - 0.2); c.stroke(); }
  ell(c, 2, -18, 4, 5, 'rgba(120,180,120,0.25)', false);
  c.restore();
}

export function drawProp(c: C, p: Prop, t: number) {
  c.save();
  c.translate(p.x + (p.hit > 0 ? Math.sin(p.hit * 90) * 2 * Math.min(1, p.hit * 6) : 0), p.y);
  switch (p.kind) {
    case 'barrel': barrel(c, p, false, t); break;
    case 'bomb': barrel(c, p, true, t); break;
    case 'crate': shadow(c, 0, 0, 0, 0, 0); crate(c); break;
    case 'chest': case 'ironchest': case 'vault': case 'mimic': chestDraw(c, p, t, p.kind === 'mimic' ? 'chest' : p.kind); break;
    case 'shrine': shrine(c, p, t); break;
    case 'sarcophagus': sarcophagus(c, p); break;
    case 'brazier': brazier(c, p, t); break;
    case 'campfire': campfire(c, p, t, false); break;
    case 'orcfire': campfire(c, p, t, true); break;
    case 'merchant': merchant(c, p, t); break;
    case 'spikes': spikes(c, p); break;
    case 'web': web(c, p); break;
    case 'bones': bonesProp(c, p); break;
    case 'candles': candles(c, p, t); break;
    case 'cocoon': cocoon(c, p, t); break;
  }
  c.restore();
}

// ---------------------------------------------------------------- предметы
export function drawPickup(c: C, k: Pickup, t: number) {
  c.save();
  c.translate(k.x, k.y);
  const bob = k.kind === 'artifact' ? Math.sin(t * 3 + k.id) * 3 : 0;
  shadow(c, 0, 1, k.kind === 'artifact' ? 9 : 5, 2.4, 0.35);
  c.translate(0, -k.z - bob);
  switch (k.kind) {
    case 'gold': {
      const w = Math.abs(Math.cos(t * 6 + k.id)) * 4 + 0.8;
      ell(c, 0, -5, w, 4.4, '#ffcf3a'); c.strokeStyle = '#9a6a14'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -5, w * 0.6, 3, 0, 0, TAU); c.stroke();
      break;
    }
    case 'xp': {
      c.fillStyle = 'rgba(110,190,255,0.35)'; c.beginPath(); c.arc(0, -8, 6 + Math.sin(t * 8 + k.id) * 1, 0, TAU); c.fill();
      c.fillStyle = '#bfe6ff'; c.beginPath(); c.arc(0, -8, 2.6, 0, TAU); c.fill();
      break;
    }
    case 'potion': {
      const by = Math.sin(t * 4 + k.id) * 1.5;
      ell(c, 0, -8 + by, 6, 6.4, '#c4203a'); ell(c, -1.6, -9.6 + by, 1.8, 2.2, 'rgba(255,255,255,0.55)', false);
      rr(c, -2.4, -18 + by, 4.8, 6, 1, '#b8dce8'); rr(c, -2.8, -20 + by, 5.6, 3, 1, '#7a5a34');
      break;
    }
    case 'key': {
      const by = Math.sin(t * 4 + k.id) * 1.5;
      c.strokeStyle = '#ffd24a'; c.lineWidth = 2.6; c.beginPath(); c.arc(-4, -10 + by, 3.4, 0, TAU); c.moveTo(-0.6, -10 + by); c.lineTo(8, -10 + by); c.moveTo(5, -10 + by); c.lineTo(5, -6 + by); c.moveTo(8, -10 + by); c.lineTo(8, -6.4 + by); c.stroke();
      break;
    }
    case 'artifact': {
      const rc = k.art ? RARITY[k.art.rarity].color : '#fff';
      c.fillStyle = rc + '44'; c.beginPath(); c.arc(0, -14, 13 + Math.sin(t * 4) * 1.5, 0, TAU); c.fill();
      c.fillStyle = '#14101c'; c.strokeStyle = rc; c.lineWidth = 2; c.beginPath(); c.arc(0, -14, 9, 0, TAU); c.fill(); c.stroke();
      poly(c, [0, -21, 5.5, -14, 0, -7, -5.5, -14], rc, false); poly(c, [0, -21, 0, -14, -5.5, -14], 'rgba(255,255,255,0.55)', false);
      break;
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- снаряды
export function drawProj(c: C, p: Proj, t: number, w: WeaponDef) {
  c.save();
  c.translate(p.x, p.y - 12);
  const ang = Math.atan2(p.vy, p.vx);
  switch (p.kind) {
    case 'arrow':
      c.rotate(ang); c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-9, 0); c.lineTo(8, 0); c.stroke();
      poly(c, [8, -2, 13, 0, 8, 2], '#bbb', false); poly(c, [-9, 0, -12, -2.4, -7, 0, -12, 2.4], '#ddd', false);
      break;
    case 'dagger':
      c.rotate(ang + t * 0); c.translate(-8, 0); drawBlade(c, w, 16);
      break;
    case 'web':
      c.fillStyle = 'rgba(230,230,240,0.85)'; c.beginPath(); c.arc(0, 0, 5.5, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(120,120,140,0.9)'; c.lineWidth = 0.8; for (let i = 0; i < 4; i++) { const a = i * 0.8 + t * 3; c.beginPath(); c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(-Math.cos(a) * 6, -Math.sin(a) * 6); c.stroke(); }
      break;
    case 'wave': {
      c.rotate(ang); c.strokeStyle = p.col; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.arc(-8, 0, 16, -0.9, 0.9); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.arc(-8, 0, 16, -0.8, 0.8); c.stroke();
      break;
    }
    default: {
      const r = p.kind === 'fire' ? 7 : 5.5;
      c.fillStyle = p.col + '44'; c.beginPath(); c.arc(0, 0, r * 2, 0, TAU); c.fill();
      c.fillStyle = p.col; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-1, -1, r * 0.4, 0, TAU); c.fill();
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- прочее
export function drawCritter(c: C, r: Critter, t: number) {
  c.save(); c.translate(r.x, r.y); c.scale(r.face, 1);
  const sp = Math.hypot(r.vx, r.vy) > 5 ? 1 : 0;
  shadow(c, 0, 1, 6, 2, 0.3);
  const w = Math.sin(t * 30 + r.t) * sp;
  limb(c, -3, -2, -3 + w * 2, 0, 1, '#4a3c36'); limb(c, 3, -2, 3 - w * 2, 0, 1, '#4a3c36');
  ell(c, 0, -3.4, 5.4, 3, '#5e4e46');
  ell(c, 5, -3.4, 2.6, 1.9, '#6a5a52');
  poly(c, [4.5, -5.2, 5.5, -7.2, 6.4, -5], '#c89a9a', false);
  c.fillStyle = '#111'; c.fillRect(6, -4.2, 1, 1);
  c.strokeStyle = '#c89a9a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -3.4); c.quadraticCurveTo(-9, -3 + Math.sin(t * 8) * 2, -11, -5); c.stroke();
  c.restore();
}

export function drawDecal(c: C, d: Decal, t: number) {
  c.save(); c.translate(d.x, d.y);
  let s = d.seed * 131 + 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  switch (d.kind) {
    case 'blood': case 'ichor': {
      c.fillStyle = d.kind === 'blood' ? 'rgba(100,14,18,0.5)' : 'rgba(70,110,40,0.4)';
      for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse((r() - 0.5) * d.r, (r() - 0.5) * d.r * 0.5, d.r * (0.2 + r() * 0.35), d.r * (0.1 + r() * 0.2), r() * 3, 0, TAU); c.fill(); }
      break;
    }
    case 'bones': {
      for (let i = 0; i < 3; i++) {
        const x = (r() - 0.5) * d.r * 1.4, y = (r() - 0.5) * d.r * 0.6, a = r() * TAU, l = 4 + r() * 5;
        c.strokeStyle = '#a8a08a'; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l * 0.5); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5); c.stroke();
      }
      break;
    }
    case 'crack': {
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.4; c.beginPath();
      let x = 0, y = 0; c.moveTo(x, y);
      for (let i = 0; i < 5; i++) { x += (r() - 0.4) * d.r * 0.6; y += (r() - 0.5) * d.r * 0.4; c.lineTo(x, y); }
      c.stroke(); break;
    }
    case 'moss': {
      c.fillStyle = 'rgba(70,120,70,0.22)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse((r() - 0.5) * d.r, (r() - 0.5) * d.r * 0.6, d.r * 0.4, d.r * 0.25, r() * 3, 0, TAU); c.fill(); }
      break;
    }
    case 'scorch': {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, d.r); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, d.r, d.r * 0.55, 0, 0, TAU); c.fill(); break;
    }
    case 'rug': {
      c.rotate(d.rot * 0.1); c.scale(1, 0.62);
      c.fillStyle = 'rgba(110,22,34,0.75)'; c.fillRect(-d.r * 1.6, -d.r, d.r * 3.2, d.r * 2);
      c.strokeStyle = 'rgba(210,170,70,0.7)'; c.lineWidth = 2; c.strokeRect(-d.r * 1.5, -d.r * 0.9, d.r * 3, d.r * 1.8);
      c.strokeStyle = 'rgba(210,170,70,0.4)'; c.beginPath(); c.arc(0, 0, d.r * 0.5, 0, TAU); c.stroke();
      break;
    }
    case 'rune': {
      c.scale(1, 0.55);
      const col = d.col || '#5ad1c8';
      const pulse = 0.35 + Math.sin(t * 1.6 + d.seed) * 0.12;
      c.globalAlpha = pulse; c.strokeStyle = col; c.lineWidth = 2.4;
      c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, 0, d.r * 0.82, 0, TAU); c.stroke();
      c.rotate(t * 0.15);
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU * 2.5; const x = Math.cos(a) * d.r * 0.82, y = Math.sin(a) * d.r * 0.82; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * d.r * 0.9, Math.sin(a) * d.r * 0.9); c.lineTo(Math.cos(a) * d.r, Math.sin(a) * d.r); c.stroke(); }
      break;
    }
  }
  c.restore();
}
