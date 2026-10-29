import { Backpack, Coins, FlaskConical, Gem, KeyRound, Map as MapIcon, Pause, Skull, Star, Volume2, VolumeX } from 'lucide-react';
import type { HudState } from '../game/types';
import { minimapSize } from '../game/render';
import { MAX_POTIONS } from '../game/data';
import { cn } from '../utils/cn';
import { fmtTime, useWindowSize } from './common';
import { Icon } from './icons';

export interface ToastItem { id: number; text: string; color?: string; icon?: string }

interface Props {
  hud: HudState;
  toasts: ToastItem[];
  touch: boolean;
  muted: boolean;
  onHero: () => void;
  onPause: () => void;
  onMap: () => void;
  onMute: () => void;
}

export function Hud({ hud, toasts, touch, muted, onHero, onPause, onMap, onMute }: Props) {
  const { w, h } = useWindowSize();
  const mm = minimapSize(w, h);
  const hpPct = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const low = hpPct < 0.3;
  const iconBtn = 'hud-panel pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-lg text-amber-200/90 transition-[filter,transform] hover:brightness-125 active:scale-95';
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Левый верхний блок */}
      <div className="absolute left-2 top-2" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)' }}>
        <div className="hud-panel flex items-center gap-2.5 rounded-xl p-1.5 pr-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#211a2c] to-[#0c0912] text-lg font-black text-amber-200 shadow-[0_0_14px_rgba(240,190,80,0.35),inset_0_0_8px_rgba(0,0,0,0.7)]">
            <span className="absolute inset-0 rounded-full border-2 border-amber-500/80" />
            <span className="absolute inset-[3px] rounded-full border border-amber-200/20" />
            <span className="font-display [text-shadow:0_1px_2px_#000]">{hud.level}</span>
          </div>
          <div className="w-[150px] sm:w-[230px]">
            <div className={cn('bar-track relative h-5 overflow-hidden rounded-md gold-trim', low && 'animate-pulse')}>
              <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-rose-400 via-red-600 to-red-900 transition-[width] duration-150" style={{ width: `${hpPct * 100}%` }}>
                <div className="bar-gloss absolute inset-x-0 top-0 h-1/2" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-bold tracking-wide text-white [text-shadow:0_1px_2px_#000,0_0_4px_#000]">
                {Math.ceil(hud.hp)} / {Math.round(hud.maxHp)}
              </div>
            </div>
            <div className="bar-track relative mt-1 h-2 overflow-hidden rounded-md border border-indigo-900/70">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 via-violet-500 to-fuchsia-500 transition-[width] duration-200" style={{ width: `${Math.min(100, (hud.xp / hud.xpNeed) * 100)}%` }}>
                <div className="bar-gloss absolute inset-x-0 top-0 h-1/2" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="hud-chip flex items-center gap-1 rounded-md px-1.5 py-0.5 text-amber-300"><Coins size={13} />{hud.gold}</span>
          <span className="hud-chip flex items-center gap-1 rounded-md px-1.5 py-0.5 text-rose-300"><FlaskConical size={13} />{hud.potions}/{MAX_POTIONS}</span>
          <span className={cn('hud-chip flex items-center gap-1 rounded-md px-1.5 py-0.5', hud.keys ? 'text-yellow-200' : 'text-zinc-500')}><KeyRound size={13} />{hud.keys}</span>
          <span className="hud-chip flex items-center gap-1 rounded-md px-1.5 py-0.5 text-zinc-300"><Skull size={13} />{hud.kills}</span>
        </div>
        <div className="mt-1 text-[11px] font-medium text-amber-200/50 [text-shadow:0_1px_2px_#000]">
          {hud.room} · {fmtTime(hud.time)}
        </div>
        <button onClick={onMap} aria-label="Показать карту и печати"
          className="pointer-events-auto mt-1.5 flex items-center gap-1.5 rounded-md border border-violet-500/50 bg-black/70 px-2 py-1 text-[11px] font-semibold text-violet-200 shadow-[0_0_10px_rgba(100,55,160,0.15)]">
          <Gem size={13} className="text-violet-300" />
          <span>{hud.seals === hud.sealsTotal ? 'Трон открыт' : `Печати ${hud.seals}/${hud.sealsTotal}`}</span>
          <span className="flex gap-0.5">
            {Array.from({ length: hud.sealsTotal }, (_, i) => (
              <span key={i} className={cn('h-1.5 w-1.5 rotate-45 border', i < hud.seals ? 'border-violet-200 bg-violet-400' : 'border-violet-500/70 bg-transparent')} />
            ))}
          </span>
          <MapIcon size={12} className="ml-0.5 text-violet-300/75" />
        </button>
        {hud.points > 0 && (
          <button onClick={onHero} className="btn-gold btn-gold-sheen pulse-glow pointer-events-auto mt-1.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold">
            <Star size={14} className="text-amber-300" /> Очки: {hud.points} — распределить
          </button>
        )}
        {hud.buffs.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {hud.buffs.map((b) => (
              <span key={b.name} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-black" style={{ background: b.color }}>
                {b.name}{b.t > 0 ? ` ${Math.ceil(b.t)}с` : ''}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-col gap-1.5">
          {toasts.slice(-2).map((t) => (
            <div key={t.id} className="hud-panel toast-in flex max-w-[calc(100vw-190px)] items-center gap-2 rounded-md border-l-4 px-2 py-1 text-[10px] font-semibold leading-tight sm:max-w-[320px] sm:text-xs" style={{ borderLeftColor: t.color || '#999', color: t.color || '#ddd' }}>
              {t.icon && <Icon name={t.icon} size={15} />}
              <span className="leading-tight">{t.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Кнопки справа под миникартой */}
      <div className="absolute flex gap-1.5" style={h < 520 ? { top: 10, right: mm + 22 } : { top: mm + 20, right: 10 }}>
        <button className={iconBtn} onClick={onMap} aria-label="Карта"><MapIcon size={18} /></button>
        <button className={iconBtn} onClick={onHero} aria-label="Герой">
          <Backpack size={18} />
          {hud.points > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-black">{hud.points}</span>}
        </button>
        <button className={iconBtn} onClick={onMute} aria-label="Звук">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <button className={iconBtn} onClick={onPause} aria-label="Пауза"><Pause size={18} /></button>
      </div>

      {/* Босс */}
      {hud.boss && (
        <div className="absolute left-2.5 top-[104px] w-[calc(100vw-150px)] lg:left-1/2 lg:top-3 lg:w-[560px] lg:-translate-x-1/2">
          <div className="font-display mb-1 text-center text-sm font-bold uppercase tracking-[0.25em] text-red-300 [text-shadow:0_0_12px_#f00,0_2px_2px_#000] sm:text-base">{hud.boss.name}</div>
          <div className="bar-track relative h-4 overflow-hidden rounded-md border-2 border-amber-700/70 shadow-[0_0_18px_rgba(200,40,40,0.35)]">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-rose-400 via-red-600 to-red-950 transition-[width] duration-200" style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }}>
              <div className="bar-gloss absolute inset-x-0 top-0 h-1/2" />
            </div>
            <div className="absolute inset-y-0 left-[33%] w-px bg-amber-200/40" />
            <div className="absolute inset-y-0 left-[66%] w-px bg-amber-200/40" />
          </div>
        </div>
      )}

      {/* Подсказка взаимодействия (ПК) */}
      {hud.prompt && !touch && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
          <div className="hud-panel fade-in flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-amber-100">
            <kbd className="gold-trim rounded bg-gradient-to-b from-amber-900 to-amber-950 px-1.5 py-0.5 text-xs font-bold text-amber-300">E</kbd>
            {hud.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
