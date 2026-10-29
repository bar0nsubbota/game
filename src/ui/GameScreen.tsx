import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Game } from '../game/engine';
import type { HudState, RunSummary } from '../game/types';
import type { Meta } from '../game/meta';
import { initAudio, isMuted, setMuted as setAudioMuted } from '../game/audio';
import { Hud, type ToastItem } from './Hud';
import { Controls } from './Controls';
import { EndPanel, HelpPanel, HeroPanel, PausePanel, ShopPanel, type HeroTab } from './Panels';

type Panel = null | 'shop' | 'hero' | 'pause' | 'help' | 'dead' | 'victory';

function setGameMap(game: Game, open: boolean) {
  game.showMap = open;
  game.paused = open;
  const mode = game.input.mode;
  game.setMove(0, 0);
  game.setAttackTouch(false);
  game.input.mode = mode;
  game.input.atkQueue = false;
  game.input.atkM = false;
  game.input.atkK = false;
  game.last = performance.now();
}

interface Props {
  meta: Meta;
  onRunEnd: (s: RunSummary) => void;
  onMenu: () => void;
  onRestart: () => void;
}

export function GameScreen({ meta, onRunEnd, onMenu, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [panel, setPanelState] = useState<Panel>(null);
  const [heroTab, setHeroTab] = useState<HeroTab>('attrs');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [banner, setBanner] = useState<{ id: number; title: string; sub?: string; color?: string } | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [touch, setTouch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [mapOpen, setMapOpen] = useState(false);
  const awarded = useRef(false);
  const idc = useRef(1);
  const panelRef = useRef<Panel>(null);
  const endRef = useRef(onRunEnd);
  endRef.current = onRunEnd;

  const setPanel = useCallback((p: Panel) => {
    panelRef.current = p;
    setPanelState(p);
    const g = gameRef.current;
    if (g) {
      g.paused = p !== null && p !== 'dead';
      g.showMap = false;
      setMapOpen(false);
      if (p !== null) {
        const mode = g.input.mode;
        g.setMove(0, 0); g.setAttackTouch(false); g.input.mode = mode;
        g.input.atkM = false; g.input.atkK = false; g.input.atkQueue = false;
      }
      g.last = performance.now();
    }
  }, []);

  const award = useCallback((s: RunSummary) => {
    if (awarded.current) return;
    awarded.current = true;
    endRef.current(s);
  }, []);

  useEffect(() => {
    initAudio();
    const g = new Game(
      canvasRef.current!,
      {
        onHud: setHud,
        onToast: (text, color, icon) => {
          const id = idc.current++;
          setToasts((t) => [...t.slice(-2), { id, text, color, icon }]);
          window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
        },
        onBanner: (title, sub, color) => {
          const id = idc.current++;
          setBanner({ id, title, sub, color });
          window.setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), 2700);
        },
        onShop: () => setPanel('shop'),
        onLevelUp: () => {},
        onDeath: (s) => { setSummary(s); award(s); setPanel('dead'); },
        onVictory: (s) => { setSummary(s); award(s); setPanel('victory'); },
      },
      meta,
      Math.floor(Math.random() * 1e9),
    );
    if (window.matchMedia('(pointer: coarse)').matches) g.input.mode = 'touch';
    gameRef.current = g;
    g.attach();
    g.emitHud();
    g.cb.onToast('Три хранителя защищают трон. Их фиолетовые метки видны на карте.', '#c995ff', 'gem');
    const onTouch = () => { setTouch(true); g.input.mode = 'touch'; };
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    const onVis = () => { if (document.hidden && panelRef.current === null) setPanel('pause'); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('touchstart', onTouch);
      g.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // горячие клавиши интерфейса
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const p = panelRef.current;
      const g = gameRef.current;
      if (!g || p === 'dead' || p === 'victory') return;
      if (g.showMap && (e.code === 'Escape' || e.code === 'KeyM')) {
        setGameMap(g, false);
        setMapOpen(false);
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') { setPanel(p ? (p === 'help' ? 'pause' : null) : 'pause'); }
      else if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); if (p === 'hero') setPanel(null); else if (!p) { setHeroTab('loot'); setPanel('hero'); } }
      else if (e.code === 'KeyU') { if (p === 'hero') setPanel(null); else if (!p) { setHeroTab('attrs'); setPanel('hero'); } }
      else if (e.code === 'KeyM' && !p) { setGameMap(g, true); setMapOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPanel]);

  const g = gameRef.current;
  const toggleMute = () => { const m = !muted; setAudioMuted(m); setMutedState(m); };
  const openHero = () => { setHeroTab(hud && hud.points > 0 ? 'attrs' : 'loot'); setPanel('hero'); };
  const toggleMap = () => {
    if (!g) return;
    const open = !g.showMap;
    setGameMap(g, open);
    setMapOpen(open);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" />
      {hud && g && !mapOpen && (
        <>
          <Hud hud={hud} toasts={toasts} touch={touch} muted={muted} onHero={openHero} onPause={() => setPanel('pause')} onMap={toggleMap} onMute={toggleMute} />
          <Controls game={g} hud={hud} touch={touch} />
        </>
      )}
      {mapOpen && (
        <button onClick={toggleMap} aria-label="Закрыть карту"
          className="btn-dark pointer-events-auto absolute right-3 top-3 z-30 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 'calc(env(safe-area-inset-right, 0px) + 12px)' }}>
          Закрыть карту <X size={16} />
        </button>
      )}
      {banner && !mapOpen && (
        <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[26%] z-20 flex flex-col items-center px-4 text-center">
          <div className="banner font-display text-3xl font-black uppercase sm:text-5xl" style={{ color: banner.color || '#ffd84a', textShadow: `0 0 24px ${banner.color || '#ffd84a'}, 0 3px 6px #000` }}>{banner.title}</div>
          {banner.sub && <div className="banner mt-1 text-sm font-semibold tracking-widest text-zinc-200 [text-shadow:0_2px_4px_#000] sm:text-base">{banner.sub}</div>}
        </div>
      )}
      {panel === 'shop' && hud && g && <ShopPanel game={g} hud={hud} onClose={() => setPanel(null)} />}
      {panel === 'hero' && hud && g && <HeroPanel game={g} hud={hud} tab={heroTab} setTab={setHeroTab} onClose={() => setPanel(null)} />}
      {panel === 'pause' && <PausePanel muted={muted} onResume={() => setPanel(null)} onHelp={() => setPanel('help')} onMute={toggleMute} onQuit={() => { if (g) award(g.summary()); onMenu(); }} />}
      {panel === 'help' && <HelpPanel onClose={() => setPanel('pause')} />}
      {panel === 'dead' && summary && <EndPanel kind="dead" summary={summary} onRestart={onRestart} onMenu={onMenu} />}
      {panel === 'victory' && summary && <EndPanel kind="victory" summary={summary} onRestart={onRestart} onMenu={onMenu} onContinue={() => setPanel(null)} />}
    </div>
  );
}
