import { Coins, FlaskConical, Gem, KeyRound, Pause, Skull, Star, Volume2, VolumeX } from 'lucide-react';
import type { HudState } from '../game/types';
import { minimapSize } from '../game/render';
import { MAX_POTIONS, WEAPONS } from '../game/data';
import { cn } from '../utils/cn';
import { fmtTime, useWindowSize } from './common';
import { Icon } from './icons';
import { HERO_PORTRAIT, HERO_PORTRAITS } from './skillIcons';

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
  viewSize?: { w: number; h: number };
}

export function Hud({ hud, toasts, touch, muted, onHero, onPause, onMap, onMute, viewSize }: Props) {
  const win = useWindowSize();
  const w = viewSize ? viewSize.w : win.w;
  const h = viewSize ? viewSize.h : win.h;
  const mm = minimapSize(w, h);
  const hpPct = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / hud.xpNeed) * 100));
  const low = hpPct < 0.3;

  const equipped = WEAPONS.find((x) => x.id === hud.weapon) || WEAPONS[0];
  const gemCol = equipped.id === 'rusty' ? '#38bdf8' : equipped.c.glow;
  const portraitSrc = HERO_PORTRAITS[hud.weapon] || HERO_PORTRAIT;

  const iconBtn = 'pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#4d5b72] bg-gradient-to-b from-[#1e2431] to-[#0e1119] text-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.16)] transition-[filter,transform] hover:brightness-125 active:scale-95';

  const hpClip = 'polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0 100%)';
  const xpClip = 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)';
  const lvlClip = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Брутальный кованый HUD персонажа (левый верхний угол) */}
      <div className="absolute left-2.5 top-2" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)' }}>
        <div className="relative flex items-center">
          {/* Ромбовидный кованый медальон героя — клик открывает прокачку */}
          <button
            type="button"
            onClick={onHero}
            aria-label="Герой и прокачка характеристик"
            title="Герой и характеристики"
            className="pointer-events-auto relative z-20 flex h-[74px] w-[78px] shrink-0 cursor-pointer items-center justify-center transition-transform hover:scale-[1.03] active:scale-95"
          >
            {/* Боковые кованые железные выступы-лезвия */}
            <svg viewBox="0 0 88 84" className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
              <defs>
                <linearGradient id="ironHorn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#64748b" />
                  <stop offset="45%" stopColor="#2c3545" />
                  <stop offset="100%" stopColor="#0f141e" />
                </linearGradient>
              </defs>
              <path d="M18 42 L4 36 Q2 24 11 19 Q12 29 22 30 Z" fill="url(#ironHorn)" stroke="#090b10" strokeWidth="2.2" />
              <path d="M70 42 L84 36 Q86 24 77 19 Q76 29 66 30 Z" fill="url(#ironHorn)" stroke="#090b10" strokeWidth="2.2" />
            </svg>

            {/* Повёрнутая на 45° кованая стальная ромб-рама с идеально отцентрированным портретом */}
            <div className="relative flex h-[54px] w-[54px] rotate-45 items-center justify-center rounded-[7px] border-[2.5px] border-[#6b7c96] bg-gradient-to-br from-[#344054] via-[#1b2230] to-[#0a0d14] p-[3px] shadow-[0_0_0_2px_#080a0f,0_6px_16px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.28)]">
              <div className="relative h-full w-full overflow-hidden rounded-[4px] border border-[#0b0e14] bg-[#101520]">
                <img
                  src={portraitSrc}
                  alt="Герой"
                  draggable={false}
                  className="absolute left-1/2 top-1/2 h-[146%] w-[146%] max-w-none -translate-x-1/2 -translate-y-1/2 -rotate-45 object-cover"
                />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.62)]" />
              </div>
              {/* Кристалл в нижней вершине ромба в цвет надетого клинка */}
              <span
                className="absolute -bottom-[5px] -right-[5px] h-2.5 w-2.5 rounded-[1px] border border-[#090c12]"
                style={{ background: gemCol, boxShadow: `0 0 9px ${gemCol}` }}
              />
            </div>

            {/* Кованый золотой индикатор свободных очков */}
            {hud.points > 0 && (
              <span className="pulse-glow absolute -top-0.5 right-0.5 z-30 flex h-5 min-w-5 items-center justify-center rounded border border-amber-200 bg-gradient-to-b from-amber-300 to-orange-600 px-1 text-[11px] font-black text-black shadow-[0_0_12px_rgba(245,158,11,0.9)]">
                +{hud.points}
              </span>
            )}
          </button>

          {/* Правая часть: кованый HP-бар, ступенчатый XP-бар и угловая плашка уровня (без лишней надписи NOCTIS) */}
          <div className="-ml-5 flex flex-col pt-1">
            {/* Основной кованый HP-бар */}
            <div
              className={cn('w-[174px] bg-gradient-to-b from-[#667791] via-[#2b3445] to-[#11151e] p-[2.5px] shadow-[0_5px_14px_rgba(0,0,0,0.82)] sm:w-[244px]', low && 'animate-pulse')}
              style={{ clipPath: hpClip }}
            >
              <div
                className="relative h-[24px] overflow-hidden bg-[#0a090d] shadow-[inset_0_2px_7px_rgba(0,0,0,0.95)]"
                style={{ clipPath: hpClip }}
              >
                <div
                  className="absolute inset-y-0 left-0 transition-[width] duration-150"
                  style={{
                    width: `${hpPct * 100}%`,
                    background: 'linear-gradient(180deg, #b91c1c 0%, #dc2626 28%, #881313 68%, #450a0a 100%)',
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-35 mix-blend-multiply"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 18% 55%, #1c0303 0%, transparent 40%), radial-gradient(circle at 52% 35%, #240404 0%, transparent 45%), radial-gradient(circle at 82% 65%, #1a0202 0%, transparent 42%)',
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-300/45 via-amber-200/35 to-transparent" />
                </div>

                <div className="absolute inset-0 flex items-center justify-center pl-2 font-display text-[12px] font-black tracking-wider text-amber-200 [text-shadow:0_1px_2px_#000,0_2px_4px_#000]">
                  {Math.ceil(hud.hp)}/{Math.round(hud.maxHp)}
                </div>
              </div>
            </div>

            {/* Ступенчатый XP-бар */}
            <div className="-mt-[1px] w-[130px] bg-gradient-to-b from-[#55647c] via-[#262f3f] to-[#0f131c] p-[2px] shadow-[0_4px_10px_rgba(0,0,0,0.75)] sm:w-[178px]" style={{ clipPath: xpClip }}>
              <div className="relative h-[10px] overflow-hidden bg-[#0c111d]" style={{ clipPath: xpClip }}>
                <div
                  className="absolute inset-y-0 left-0 transition-[width] duration-200"
                  style={{
                    width: `${xpPct}%`,
                    background: 'linear-gradient(180deg, #bae6fd 0%, #38bdf8 38%, #0284c7 80%, #0c4a6e 100%)',
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-white/55" />
                </div>
              </div>
            </div>

            {/* Угловая стальная плашка уровня */}
            <div className="mt-0.5 flex items-center pl-4">
              <button
                type="button"
                onClick={onHero}
                className="pointer-events-auto flex items-center gap-1 bg-gradient-to-r from-[#1d2c42]/95 via-[#253a57]/90 to-[#1a273b]/80 py-[1px] pl-2.5 pr-4 text-[12px] font-black tracking-wide text-sky-200 shadow-[0_2px_6px_rgba(0,0,0,0.8)] transition-colors hover:text-white"
                style={{ clipPath: lvlClip }}
              >
                <span className="text-[9px] font-bold uppercase text-sky-400/85">УР</span>
                <span>{hud.level}</span>
              </button>
              <div className="-ml-1 h-[2px] w-16 bg-gradient-to-r from-sky-400/75 via-slate-400/40 to-transparent" />
            </div>
          </div>
        </div>

        {/* Ресурсы + Печати в одном аккуратном ряду */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="flex items-center gap-1 rounded border border-[#4a576d]/70 bg-[#10141e]/88 px-2 py-0.5 text-amber-300 shadow"><Coins size={13} />{hud.gold}</span>
          <span className="flex items-center gap-1 rounded border border-[#4a576d]/70 bg-[#10141e]/88 px-2 py-0.5 text-red-400 shadow"><FlaskConical size={13} />{hud.potions}/{MAX_POTIONS}</span>
          <span className={cn('flex items-center gap-1 rounded border bg-[#10141e]/88 px-2 py-0.5 shadow', hud.keys ? 'border-amber-500/60 text-amber-200' : 'border-[#333c4d]/60 text-slate-500')}><KeyRound size={13} />{hud.keys}</span>
          <span className="flex items-center gap-1 rounded border border-[#4a576d]/70 bg-[#10141e]/88 px-2 py-0.5 text-slate-200 shadow"><Skull size={13} />{hud.kills}</span>
          <button
            type="button"
            onClick={onMap}
            aria-label="Печати и карта"
            title="Печати хранителей (открыть карту)"
            className={cn(
              'pointer-events-auto flex items-center gap-1 rounded border bg-[#10141e]/90 px-2 py-0.5 shadow transition-transform active:scale-95',
              hud.seals === hud.sealsTotal ? 'border-amber-400/80 text-amber-200' : 'border-violet-400/60 text-violet-200',
            )}
          >
            <Gem size={13} className={hud.seals === hud.sealsTotal ? 'text-amber-300' : 'text-violet-300'} />
            <span>{hud.seals}/{hud.sealsTotal}</span>
          </button>
        </div>

        <div className="mt-1 pl-0.5 text-[11px] font-semibold text-slate-300/70 [text-shadow:0_1px_2px_#000]">
          {hud.room} · {fmtTime(hud.time)}
        </div>

        {hud.points > 0 && (
          <button onClick={onHero} className="btn-gold btn-gold-sheen pulse-glow pointer-events-auto mt-1.5 flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold shadow-[0_4px_14px_rgba(245,158,11,0.35)]">
            <Star size={14} className="text-amber-300" /> Очки: {hud.points} — распределить
          </button>
        )}

        {hud.buffs.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {hud.buffs.map((b) => (
              <span key={b.name} className="rounded px-2 py-0.5 text-[10px] font-black text-black shadow" style={{ background: b.color }}>
                {b.name}{b.t > 0 ? ` ${Math.ceil(b.t)}с` : ''}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1.5">
          {toasts.slice(-2).map((t) => (
            <div key={t.id} className="hud-panel toast-in flex max-w-[calc(100vw-190px)] items-center gap-2 rounded border-l-4 px-2.5 py-1.5 text-[10px] font-semibold leading-tight sm:max-w-[320px] sm:text-xs" style={{ borderLeftColor: t.color || '#999', color: t.color || '#ddd' }}>
              {t.icon && <Icon name={t.icon} size={15} />}
              <span className="leading-tight">{t.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Кликабельная зона прямо поверх миникарты */}
      <button
        type="button"
        onClick={onMap}
        aria-label="Открыть полную карту"
        title="Открыть карту"
        className="pointer-events-auto absolute cursor-pointer rounded-xl transition-shadow hover:ring-2 hover:ring-amber-300/60 active:scale-[0.98]"
        style={{ top: 10, right: 10, width: mm, height: mm }}
      />

      {/* Кнопки справа под миникартой (только звук и пауза) */}
      <div className="absolute flex gap-2" style={h < 520 ? { top: 10, right: mm + 22 } : { top: mm + 20, right: 10 }}>
        <button className={iconBtn} onClick={onMute} aria-label="Звук">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
        <button className={iconBtn} onClick={onPause} aria-label="Пауза"><Pause size={20} /></button>
      </div>

      {/* Босс */}
      {hud.boss && (
        <div className="absolute left-2.5 top-[112px] w-[calc(100vw-150px)] lg:left-1/2 lg:top-3 lg:w-[560px] lg:-translate-x-1/2">
          <div className="font-display mb-1 text-center text-sm font-bold uppercase tracking-[0.25em] text-red-300 [text-shadow:0_0_12px_#f00,0_2px_2px_#000] sm:text-base">{hud.boss.name}</div>
          <div className="bar-track relative h-4 overflow-hidden rounded border-2 border-[#5c6b85] shadow-[0_0_18px_rgba(200,40,40,0.45)]">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-b from-red-500 via-red-700 to-red-950 transition-[width] duration-200" style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }}>
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
          <div className="hud-panel fade-in flex items-center gap-2 rounded-lg border border-[#526078] px-3.5 py-1.5 text-sm font-semibold text-amber-100">
            <kbd className="gold-trim rounded bg-gradient-to-b from-amber-900 to-amber-950 px-1.5 py-0.5 text-xs font-bold text-amber-300">E</kbd>
            {hud.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
