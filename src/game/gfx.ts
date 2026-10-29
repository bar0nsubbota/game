import { TS } from './data';
import { mulberry32 } from './world';

export const TEX = 4; // множитель разрешения текстур тайлов (чёткие детали)

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Палитры полов: базовый цвет камня + оттенок затирки/подсветки для каждой темы.
const FLOOR_PAL: { base: [number, number, number]; tint: [number, number, number]; moss: string; accent: string }[] = [
  { base: [52, 51, 64], tint: [96, 92, 118], moss: 'rgba(78,110,74,0.18)', accent: 'rgba(150,160,210,0.05)' }, // storage/base
  { base: [78, 62, 46], tint: [128, 104, 70], moss: 'rgba(120,120,70,0.14)', accent: 'rgba(255,190,110,0.07)' }, // camp
  { base: [46, 55, 73], tint: [86, 100, 134], moss: 'rgba(70,120,110,0.16)', accent: 'rgba(130,170,210,0.07)' }, // crypt
  { base: [60, 46, 72], tint: [108, 84, 128], moss: 'rgba(150,120,190,0.14)', accent: 'rgba(180,130,220,0.08)' }, // nest
  { base: [80, 52, 44], tint: [132, 88, 70], moss: 'rgba(120,70,40,0.16)', accent: 'rgba(255,120,80,0.07)' }, // orc
  { base: [70, 57, 48], tint: [120, 98, 78], moss: 'rgba(110,80,50,0.16)', accent: 'rgba(230,170,110,0.06)' }, // ogre
  { base: [40, 68, 76], tint: [74, 118, 128], moss: 'rgba(60,140,120,0.2)', accent: 'rgba(120,220,210,0.07)' }, // shrine
  { base: [84, 70, 44], tint: [150, 126, 74], moss: 'rgba(150,120,60,0.1)', accent: 'rgba(255,215,120,0.12)' }, // treasure/vault
  { base: [50, 34, 42], tint: [96, 62, 72], moss: 'rgba(130,40,50,0.14)', accent: 'rgba(255,70,80,0.09)' }, // boss
  { base: [56, 62, 46], tint: [98, 110, 78], moss: 'rgba(90,120,60,0.18)', accent: 'rgba(170,200,120,0.06)' }, // goblin
  { base: [40, 56, 72], tint: [78, 104, 134], moss: 'rgba(70,110,120,0.18)', accent: 'rgba(150,120,220,0.08)' }, // haunted
];

function lerpC(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const cstr = (c: [number, number, number]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// Модульная каменная плитка: неровная сетка кирпичей с фаской (псевдо-нормали),
// затиркой, трещинами, мхом и мелким гравием.
function makeFloor(theme: number, variant: number): HTMLCanvasElement {
  const S = TS * TEX;
  const c = mk(S, S);
  const g = c.getContext('2d')!;
  const rnd = mulberry32(theme * 131 + variant * 17 + 5);
  const pal = FLOOR_PAL[theme] || FLOOR_PAL[0];

  // тёмная затирка-подложка
  g.fillStyle = cstr(lerpC(pal.base, [8, 7, 11], 0.55));
  g.fillRect(0, 0, S, S);

  // разбивка на 2 или 3 ряда кирпичей со смещением
  const rows = variant % 2 === 0 ? 3 : 2;
  const rh = S / rows;
  const grout = Math.max(2, TEX * 1.1);
  for (let r = 0; r < rows; r++) {
    const cols = 2 + (r + variant) % 2;
    const offset = ((r % 2) * 0.5 + variant * 0.17) % 1;
    const cw = S / cols;
    for (let cIdx = -1; cIdx <= cols; cIdx++) {
      const bx = (cIdx + offset) * cw;
      const by = r * rh;
      const jig = (rnd() - 0.5) * cw * 0.08;
      const x = bx + grout / 2 + jig;
      const y = by + grout / 2;
      const w = cw - grout;
      const h = rh - grout;
      if (x + w < 0 || x > S) continue;
      drawStone(g, x, y, w, h, pal, rnd);
    }
  }

  // крупные трещины для некоторых вариантов
  if (variant >= 2) {
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = TEX * 0.7;
    g.lineCap = 'round';
    const cnt = 1 + (variant - 2);
    for (let k = 0; k < cnt; k++) {
      g.beginPath();
      let x = rnd() * S, y = rnd() * S;
      g.moveTo(x, y);
      const seg = 4 + (rnd() * 4 | 0);
      for (let i = 0; i < seg; i++) { x += (rnd() - 0.5) * S * 0.28; y += (rnd() - 0.5) * S * 0.28; g.lineTo(x, y); }
      g.stroke();
      // тонкий внутренний блик вдоль трещины
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = TEX * 0.3;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = TEX * 0.7;
    }
  }

  // пятна мха/накипи
  const mossN = theme === 3 || theme === 10 || theme === 2 || theme === 6 ? 5 : 2;
  for (let i = 0; i < mossN; i++) {
    const x = rnd() * S, y = rnd() * S, rr = S * (0.1 + rnd() * 0.22);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, pal.moss);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  // тематический акцент (руны/кровь/золото)
  if (theme === 8) {
    g.strokeStyle = 'rgba(190,40,40,0.16)';
    g.lineWidth = TEX * 0.8;
    g.beginPath();
    g.moveTo(S * 0.15, S * 0.5); g.lineTo(S * 0.5, S * 0.15); g.lineTo(S * 0.85, S * 0.5); g.lineTo(S * 0.5, S * 0.85); g.closePath();
    g.stroke();
  } else if (theme === 7) {
    g.fillStyle = pal.accent;
    g.fillRect(S * 0.08, S * 0.08, S * 0.84, S * 0.84);
  }

  // мелкий гравий и блёстки
  for (let i = 0; i < 90; i++) {
    const s = TEX * (0.4 + rnd() * 0.9);
    const bright = rnd() < 0.4;
    g.fillStyle = bright ? 'rgba(255,250,235,0.06)' : 'rgba(0,0,0,0.12)';
    g.fillRect(rnd() * S, rnd() * S, s, s);
  }

  // мягкое виньетирование тайла для глубины (усиливает ощущение объёма)
  const vg = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = vg;
  g.fillRect(0, 0, S, S);
  return c;
}

// Один каменный блок с фаской: верх/лево светлые, низ/право тёмные (псевдо-нормали).
function drawStone(
  g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  pal: { base: [number, number, number]; tint: [number, number, number] }, rnd: () => number,
) {
  const shade = (rnd() - 0.5) * 0.16;
  const base = lerpC(pal.base, pal.tint, 0.3 + shade + rnd() * 0.2);
  const rad = Math.min(w, h) * 0.16;
  // основное тело с мягким вертикальным градиентом
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, cstr(lerpC(base, [255, 255, 255], 0.1)));
  grad.addColorStop(0.5, cstr(base));
  grad.addColorStop(1, cstr(lerpC(base, [0, 0, 0], 0.22)));
  g.fillStyle = grad;
  rr(g, x, y, w, h, rad);
  g.fill();

  // фаска: светлые верх/лево
  g.lineWidth = Math.max(1, TEX * 0.55);
  g.strokeStyle = 'rgba(255,248,230,0.14)';
  g.beginPath();
  g.moveTo(x + rad, y + g.lineWidth * 0.5);
  g.lineTo(x + w - rad, y + g.lineWidth * 0.5);
  g.moveTo(x + g.lineWidth * 0.5, y + rad);
  g.lineTo(x + g.lineWidth * 0.5, y + h - rad);
  g.stroke();
  // тёмные низ/право
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.moveTo(x + rad, y + h - g.lineWidth * 0.5);
  g.lineTo(x + w - rad, y + h - g.lineWidth * 0.5);
  g.moveTo(x + w - g.lineWidth * 0.5, y + rad);
  g.lineTo(x + w - g.lineWidth * 0.5, y + h - rad);
  g.stroke();

  // внутренние щербинки/выбоины
  const chips = 3 + (rnd() * 4 | 0);
  for (let i = 0; i < chips; i++) {
    const cx = x + TEX + rnd() * (w - TEX * 2);
    const cy = y + TEX + rnd() * (h - TEX * 2);
    const cs = TEX * (0.6 + rnd() * 1.4);
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.05)';
    g.beginPath();
    g.ellipse(cx, cy, cs, cs * (0.5 + rnd() * 0.5), rnd() * 3, 0, 6.28);
    g.fill();
  }
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Стена-«лицо»: кладка крупных блоков с объёмной фаской, мхом, подтёками и карнизом.
function makeWallFace(v: number): HTMLCanvasElement {
  const S = TS * TEX;
  const c = mk(S, S);
  const g = c.getContext('2d')!;
  const rnd = mulberry32(900 + v * 31);
  g.fillStyle = '#0c0b12';
  g.fillRect(0, 0, S, S);
  const rows = 3, rh = S / rows, bw = S / 2.1, grout = TEX * 1.2;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2 ? bw / 2 : 0) + (rnd() - 0.5) * TEX;
    for (let x = -off; x < S; x += bw) {
      const w = bw - grout, y = row * rh + grout / 2, h = rh - grout;
      const base = 44 + rnd() * 24;
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, `rgb(${base + 20},${base + 18},${base + 30})`);
      grad.addColorStop(0.55, `rgb(${base},${base - 2},${base + 8})`);
      grad.addColorStop(1, `rgb(${base - 16},${base - 18},${base - 6})`);
      g.fillStyle = grad;
      rr(g, x + grout / 2, y, w, h, TEX * 1.3);
      g.fill();
      // фаска
      g.lineWidth = TEX * 0.5;
      g.strokeStyle = 'rgba(190,195,220,0.18)';
      g.beginPath(); g.moveTo(x + grout, y + TEX * 0.4); g.lineTo(x + w, y + TEX * 0.4); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.moveTo(x + grout, y + h - TEX * 0.4); g.lineTo(x + w, y + h - TEX * 0.4); g.stroke();
      // зернистость камня
      for (let i = 0; i < 22; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.05)';
        g.fillRect(x + grout + rnd() * w, y + rnd() * h, TEX * 0.7, TEX * 0.7);
      }
    }
  }
  // мох и подтёки сырости
  for (let i = 0; i < 2 + v; i++) {
    const x = rnd() * S, y = rnd() * S * 0.5;
    const gr = g.createLinearGradient(x, y, x, y + 70 + rnd() * 60);
    gr.addColorStop(0, 'rgba(58,96,58,0.26)');
    gr.addColorStop(1, 'rgba(58,96,58,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, TEX * (2 + rnd() * 3), S);
  }
  if (v === 1) {
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = TEX * 0.8;
    g.beginPath();
    let x = rnd() * S, y = 0;
    g.moveTo(x, y);
    for (let i = 0; i < 7; i++) { x += (rnd() - 0.5) * 24; y += 20 + rnd() * 14; g.lineTo(x, y); }
    g.stroke();
  }
  // карниз сверху
  const cap = g.createLinearGradient(0, 0, 0, S * 0.16);
  cap.addColorStop(0, 'rgba(180,185,215,0.4)');
  cap.addColorStop(1, 'rgba(180,185,215,0)');
  g.fillStyle = cap;
  g.fillRect(0, 0, S, S * 0.16);
  // глубокая тень у основания
  const ao = g.createLinearGradient(0, S * 0.62, 0, S);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.65)');
  g.fillStyle = ao;
  g.fillRect(0, S * 0.62, S, S * 0.38);
  return c;
}

function makeWallTop(v: number): HTMLCanvasElement {
  const S = TS * TEX;
  const c = mk(S, S);
  const g = c.getContext('2d')!;
  const rnd = mulberry32(400 + v * 13);
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#20202c');
  grad.addColorStop(1, '#14131c');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 200; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)';
    g.fillRect(rnd() * S, rnd() * S, TEX * (0.5 + rnd()), TEX * (0.5 + rnd()));
  }
  // плиты на верхушке
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = TEX * 0.6;
  g.strokeRect(TEX, TEX, S - TEX * 2, S - TEX * 2);
  g.strokeStyle = 'rgba(190,195,220,0.08)';
  g.lineWidth = TEX * 0.4;
  g.strokeRect(TEX * 1.6, TEX * 1.6, S - TEX * 3.2, S - TEX * 3.2);
  if (v === 2) {
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = TEX * 0.5;
    g.beginPath(); g.moveTo(S * 0.2, S * 0.3); g.lineTo(S * 0.5, S * 0.55); g.lineTo(S * 0.8, S * 0.5); g.stroke();
  }
  return c;
}

function grad(w: number, h: number, x0: number, y0: number, x1: number, y1: number, a: number): HTMLCanvasElement {
  const c = mk(w, h);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, `rgba(0,0,0,${a})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  return c;
}

function radial(size: number, stops: [number, string][]): HTMLCanvasElement {
  const c = mk(size, size);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

export interface Gfx {
  floor: HTMLCanvasElement[][];
  face: HTMLCanvasElement[];
  top: HTMLCanvasElement[];
  aoN: HTMLCanvasElement; aoS: HTMLCanvasElement; aoW: HTMLCanvasElement; aoE: HTMLCanvasElement;
  light: HTMLCanvasElement;
  softLight: HTMLCanvasElement;
  tintLight: (col: string) => HTMLCanvasElement;
  vignette: HTMLCanvasElement;
  glow: (col: string) => HTMLCanvasElement;
  smoke: HTMLCanvasElement;
  spark: HTMLCanvasElement;
  scratch: HTMLCanvasElement;
}

let G: Gfx | null = null;
export function getGfx(): Gfx {
  if (G) return G;
  const floor: HTMLCanvasElement[][] = [];
  for (let t = 0; t < FLOOR_PAL.length; t++) {
    floor.push([]);
    for (let v = 0; v < 4; v++) floor[t].push(makeFloor(t, v));
  }
  const glowCache = new Map<string, HTMLCanvasElement>();
  const tintCache = new Map<string, HTMLCanvasElement>();
  const vg = mk(256, 256);
  {
    const g = vg.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 54, 128, 128, 188);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    gr.addColorStop(1, 'rgba(0,0,0,0.82)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }
  // мягкое дымное облачко
  const smoke = radial(64, [[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
  // яркая искра с ядром
  const spark = radial(32, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,230,150,0.9)'], [0.7, 'rgba(255,140,40,0.4)'], [1, 'rgba(255,120,30,0)']]);
  G = {
    floor,
    face: [makeWallFace(0), makeWallFace(1), makeWallFace(2)],
    top: [makeWallTop(0), makeWallTop(1), makeWallTop(2)],
    aoN: grad(8, 32, 0, 0, 0, 32, 0.7),
    aoS: grad(8, 32, 0, 32, 0, 0, 0.4),
    aoW: grad(32, 8, 0, 0, 32, 0, 0.45),
    aoE: grad(32, 8, 32, 0, 0, 0, 0.45),
    light: radial(256, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.78)'], [0.62, 'rgba(255,255,255,0.28)'], [1, 'rgba(255,255,255,0)']]),
    softLight: radial(256, [[0, 'rgba(255,255,255,0.9)'], [0.45, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]),
    vignette: vg,
    scratch: mk(256, 256),
    smoke,
    spark,
    glow: (col: string) => {
      let c = glowCache.get(col);
      if (!c) {
        c = radial(128, [[0, col], [0.4, col + '88'], [1, col + '00']]);
        glowCache.set(col, c);
      }
      return c;
    },
    // окрашенный свет для тёплых факельных пятен на освещающем проходе
    tintLight: (col: string) => {
      let c = tintCache.get(col);
      if (!c) {
        c = radial(256, [[0, col], [0.5, col + '66'], [1, col + '00']]);
        tintCache.set(col, c);
      }
      return c;
    },
  };
  return G;
}
