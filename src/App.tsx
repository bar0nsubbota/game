import { useMemo, useRef, useState } from 'react';
import { Keyboard, Play, Skull } from 'lucide-react';
import menuImg from './assets/menu.jpg';
import { GameScreen } from './ui/GameScreen';
import { HelpPanel, MetaPanel } from './ui/Panels';
import { initAudio } from './game/audio';
import { META_UPGRADES, loadMeta, saveMeta, upgradeCost, type Meta } from './game/meta';
import type { RunSummary } from './game/types';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'play'>('menu');
  const [runId, setRunId] = useState(0);
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [modal, setModal] = useState<null | 'meta' | 'help'>(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const embers = useMemo(
    () => Array.from({ length: 22 }).map((_, i) => ({
      left: `${(i * 37) % 100}%`, size: 2 + ((i * 7) % 5), dur: 7 + ((i * 13) % 9), delay: -((i * 5) % 12),
    })),
    [],
  );

  const start = () => { initAudio(); setRunId((r) => r + 1); setScreen('play'); };
  const onRunEnd = (s: RunSummary) => {
    const m = metaRef.current;
    const next: Meta = {
      ...m, souls: m.souls + s.souls, bestKills: Math.max(m.bestKills, s.kills), bestLevel: Math.max(m.bestLevel, s.level),
      wins: m.wins + (s.boss ? 1 : 0), runs: m.runs + 1,
    };
    saveMeta(next);
    setMeta(next);
  };
  const buyMeta = (k: keyof Meta['up']) => {
    const u = META_UPGRADES.find((x) => x.key === k)!;
    const lvl = meta.up[k];
    const cost = upgradeCost(u, lvl);
    if (lvl >= u.max || meta.souls < cost) return;
    const next: Meta = { ...meta, souls: meta.souls - cost, up: { ...meta.up, [k]: lvl + 1 } };
    saveMeta(next);
    setMeta(next);
  };

  if (screen === 'play') {
    return (
      <GameScreen
        key={runId}
        meta={meta}
        onRunEnd={onRunEnd}
        onMenu={() => setScreen('menu')}
        onRestart={() => { setRunId((r) => r + 1); }}
      />
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <img src={menuImg} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_28%]" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5 md:bg-gradient-to-r md:from-black md:via-black/60 md:to-transparent" />
      {embers.map((e, i) => (
        <span key={i} className="ember" style={{ left: e.left, width: e.size, height: e.size, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }} />
      ))}
      <div className="scroll-y absolute inset-0 flex flex-col items-center justify-end px-5 pb-8 text-center md:items-start md:justify-center md:pb-0 md:pl-[8vw] md:text-left" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="fade-in">
          <div className="font-display text-xs font-bold uppercase tracking-[0.28em] text-amber-500/90 sm:text-sm sm:tracking-[0.5em]">Тёмный слэш-рогалик</div>
          <h1 className="gold-text font-display text-6xl font-black leading-none tracking-wider drop-shadow-[0_4px_18px_rgba(255,140,40,0.35)] sm:text-8xl">NOCTIS</h1>
          <div className="font-display mt-1 text-lg font-bold uppercase tracking-[0.35em] text-red-400 sm:text-2xl">Клинки Бездны</div>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-300 md:mx-0">
            Вы ассасин с двумя клинками. Исследуйте подземелье, одолейте трёх хранителей печатей и бросьте вызов Костяному Королю.
          </p>
        </div>
        <div className="fade-in mt-6 flex w-full max-w-xs flex-col gap-2.5" style={{ animationDelay: '0.15s' }}>
          <button onClick={start} className="btn-gold btn-gold-sheen flex items-center justify-center gap-2 rounded-xl py-3.5 text-lg font-bold tracking-wide shadow-[0_0_30px_rgba(200,60,60,0.35)]">
            <Play size={20} /> Начать охоту
          </button>
          <button onClick={() => setModal('meta')} className="btn-dark flex items-center justify-center gap-2 rounded-xl py-3 font-semibold">
            <Skull size={18} className="text-violet-300" /> Святилище душ <span className="rounded-full bg-violet-900/70 px-2 text-sm text-violet-200">{meta.souls}</span>
          </button>
          <button onClick={() => setModal('help')} className="btn-dark flex items-center justify-center gap-2 rounded-xl py-3 font-semibold">
            <Keyboard size={18} /> Управление
          </button>
        </div>
        <div className="mt-4 text-xs text-zinc-500">
          Рекорд: {meta.bestKills} убийств · {meta.bestLevel} ур. · побед: {meta.wins} · ПК и телефон
        </div>
      </div>
      {modal === 'meta' && <MetaPanel meta={meta} onBuy={buyMeta} onClose={() => setModal(null)} />}
      {modal === 'help' && <HelpPanel onClose={() => setModal(null)} />}
    </div>
  );
}
