// Простой синтезатор звуков и мрачной музыки на WebAudio — без внешних файлов
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let musicTimer = 0;
const last: Record<string, number> = {};

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.55;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.7;
}
export function isMuted() { return muted; }

function ok(name: string, gap: number): boolean {
  const now = performance.now();
  if (last[name] && now - last[name] < gap) return false;
  last[name] = now;
  return true;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: AudioNode) {
  if (!ctx || !sfxGain) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest || sfxGain);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, sweep = 0) {
  if (!ctx || !sfxGain || !noiseBuf) return;
  const t0 = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  f.connect(g);
  g.connect(sfxGain);
  s.start(t0, Math.random() * 0.5);
  s.stop(t0 + dur + 0.05);
}

function startMusic() {
  if (!ctx || !musicGain) return;
  // тёмный дрон
  const mk = (f: number, type: OscillatorType, vol: number, lfo: number) => {
    if (!ctx || !musicGain) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = vol;
    const l = ctx.createOscillator();
    l.frequency.value = lfo;
    const lg = ctx.createGain();
    lg.gain.value = vol * 0.6;
    l.connect(lg);
    lg.connect(g.gain);
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 380;
    o.connect(fl);
    fl.connect(g);
    g.connect(musicGain);
    o.start();
    l.start();
  };
  mk(55, 'sawtooth', 0.22, 0.07);
  mk(55.4, 'sawtooth', 0.18, 0.05);
  mk(82.4, 'triangle', 0.16, 0.09);
  mk(110, 'sine', 0.1, 0.04);
  // редкие "колокола" в минорной гамме
  const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.55;
  const fb = ctx.createGain();
  fb.gain.value = 0.5;
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(musicGain);
  const bell = () => {
    if (ctx && musicGain && !muted) {
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
      tone(f, 2.4, 'sine', 0.12, 0, 0, delay);
      tone(f * 2.01, 1.4, 'sine', 0.04, 0, 0, delay);
    }
    musicTimer = window.setTimeout(bell, 2500 + Math.random() * 5000);
  };
  window.clearTimeout(musicTimer);
  musicTimer = window.setTimeout(bell, 1500);
}

export const sfx = {
  slash() { if (!ok('slash', 40)) return; noise(0.12, 0.35, 2600, 0.8, 'bandpass', 0, -1600); },
  hit() { if (!ok('hit', 30)) return; noise(0.07, 0.5, 900, 1.2); tone(160, 0.08, 'square', 0.15, -80); },
  crit() { if (!ok('crit', 30)) return; noise(0.12, 0.6, 1400, 1); tone(420, 0.14, 'sawtooth', 0.18, -250); },
  kill() { if (!ok('kill', 40)) return; tone(110, 0.22, 'sawtooth', 0.22, -60); noise(0.2, 0.4, 500, 0.8, 'lowpass'); },
  coin() { if (!ok('coin', 35)) return; tone(1180, 0.08, 'square', 0.1); tone(1560, 0.12, 'square', 0.1, 0, 0.06); },
  xp() { if (!ok('xp', 50)) return; tone(700 + Math.random() * 200, 0.07, 'sine', 0.06); },
  potion() { tone(380, 0.5, 'sine', 0.2, 500); noise(0.3, 0.2, 3000, 2, 'highpass'); },
  pickup() { tone(660, 0.12, 'triangle', 0.2); tone(880, 0.14, 'triangle', 0.2, 0, 0.08); tone(1320, 0.3, 'triangle', 0.2, 0, 0.16); },
  levelup() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, 0, i * 0.09)); },
  hurt() { if (!ok('hurt', 80)) return; tone(200, 0.2, 'sawtooth', 0.3, -120); noise(0.15, 0.4, 400, 1, 'lowpass'); },
  dash() { noise(0.18, 0.4, 1200, 0.7, 'bandpass', 0, -700); },
  skill(i: number) {
    if (i === 0) { noise(0.5, 0.5, 1800, 0.6, 'bandpass', 0, -1200); tone(300, 0.5, 'sawtooth', 0.12, 300); }
    else if (i === 1) { tone(900, 0.25, 'sine', 0.2, -700); noise(0.25, 0.4, 600, 0.6, 'lowpass'); tone(200, 0.3, 'sawtooth', 0.2, -100, 0.12); }
    else { tone(80, 0.9, 'sawtooth', 0.3, 160); tone(160, 0.9, 'square', 0.12, 240); noise(0.6, 0.4, 500, 0.5, 'lowpass'); }
  },
  chest() { noise(0.2, 0.4, 500, 1, 'lowpass'); tone(300, 0.3, 'triangle', 0.15, 200, 0.1); tone(900, 0.3, 'triangle', 0.12, 0, 0.2); },
  smash() { if (!ok('smash', 40)) return; noise(0.22, 0.6, 700, 0.6, 'bandpass', 0, -300); },
  boom() { noise(0.7, 0.9, 400, 0.5, 'lowpass', 0, -300); tone(70, 0.6, 'sawtooth', 0.4, -40); },
  boss() { tone(55, 1.6, 'sawtooth', 0.4, -15); tone(80, 1.6, 'square', 0.2, -30); noise(1.2, 0.5, 300, 0.5, 'lowpass'); },
  shrine() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.6, 'sine', 0.2, 0, i * 0.1)); },
  buy() { tone(880, 0.1, 'square', 0.12); tone(1320, 0.18, 'square', 0.12, 0, 0.07); },
  error() { tone(150, 0.2, 'square', 0.18, -40); },
  shoot() { if (!ok('shoot', 60)) return; noise(0.1, 0.25, 1800, 1, 'bandpass', 0, -800); },
  cast() { if (!ok('cast', 80)) return; tone(500, 0.3, 'sine', 0.15, 300); },
  ui() { tone(600, 0.05, 'square', 0.08); },
};
