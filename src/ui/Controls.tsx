import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPE, type ReactNode } from 'react';
import {
  FlaskConical, Gem, Ghost, Hand, KeyRound, Lock, Package, Skull, Store, Swords, Tornado, Wind,
} from 'lucide-react';
import type { Game } from '../game/engine';
import type { HudState } from '../game/types';
import { SKILLS } from '../game/data';
import { cn } from '../utils/cn';
import { useWindowSize } from './common';

const SKILL_ICON = [Tornado, Ghost, Skull];
const SKILL_COL = ['#6ac8ff', '#b57cff', '#ff3a6a'];

function vibrate(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* не поддерживается */ }
}

// ---------------------------------------------------------------- круглая кнопка
interface RB {
  size: number;
  color: string;
  cd?: number;
  max?: number;
  locked?: boolean;
  lockText?: string;
  active?: boolean;
  keyHint?: string;
  count?: string;
  label?: string;
  style?: CSSProperties;
  className?: string;
  big?: boolean;
  pulse?: boolean;
  disabled?: boolean;
  onDown?: () => void;
  onUp?: () => void;
  children: ReactNode;
}

function RoundBtn(p: RB) {
  const [pressed, setPressed] = useState(false);
  const frac = p.max && p.cd ? Math.min(1, p.cd / p.max) : 0;
  const off = p.locked || p.disabled;
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={p.label}
      onPointerDown={(e) => {
        e.preventDefault();
        if (off) return;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        setPressed(true);
        p.onDown?.();
      }}
      onPointerUp={() => { setPressed(false); p.onUp?.(); }}
      onPointerCancel={() => { setPressed(false); p.onUp?.(); }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn('pointer-events-auto relative flex touch-none select-none items-center justify-center rounded-full transition-transform duration-75', p.pulse && !off && 'pulse-glow', p.className)}
      style={{
        width: p.size,
        height: p.size,
        background: `radial-gradient(circle at 36% 28%, ${p.color}66, #12101a 74%)`,
        border: `2px solid ${p.active ? '#ffffff' : p.color + (off ? '55' : 'cc')}`,
        boxShadow: pressed ? `0 0 0 4px ${p.color}33, 0 0 22px ${p.color}aa` : p.active ? `0 0 18px ${p.color}` : '0 3px 10px rgba(0,0,0,.65), inset 0 0 10px rgba(0,0,0,.6)',
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        filter: off ? 'grayscale(0.7) brightness(0.65)' : 'none',
        ...p.style,
      }}
    >
      <div style={{ color: p.color }}>{p.children}</div>
      {frac > 0 && <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(0,0,0,.76) ${frac * 360}deg, transparent 0)` }} />}
      {frac > 0 && (p.cd ?? 0) >= 1 && <span className="pointer-events-none absolute text-sm font-black text-white [text-shadow:0_1px_3px_#000]">{Math.ceil(p.cd ?? 0)}</span>}
      {p.locked && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/70 text-[10px] font-bold text-zinc-300">
          <Lock size={13} />
          {p.lockText}
        </div>
      )}
      {p.keyHint && <span className="pointer-events-none absolute -right-1 -top-1 min-w-5 rounded border border-amber-600 bg-black/85 px-1 text-center text-[10px] font-bold text-amber-200">{p.keyHint}</span>}
      {p.count !== undefined && <span className="pointer-events-none absolute -bottom-1 -right-1 min-w-5 rounded-full border border-rose-400/70 bg-black/90 px-1 text-center text-[11px] font-bold text-rose-200">{p.count}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- джойстик
function Joystick({ game, size }: { game: Game; size: number }) {
  const zone = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState<{ id: number; ox: number; oy: number; kx: number; ky: number } | null>(null);
  const R = size * 0.42;
  const kRad = size * 0.22;
  const rel = (e: RPE) => {
    const r = zone.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: RPE) => {
    if (st) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = rel(e);
    setSt({ id: e.pointerId, ox: p.x, oy: p.y, kx: p.x, ky: p.y });
    game.setMove(0, 0);
  };
  const move = (e: RPE) => {
    if (!st || e.pointerId !== st.id) return;
    const p = rel(e);
    let dx = p.x - st.ox, dy = p.y - st.oy;
    const d = Math.hypot(dx, dy);
    const m = Math.min(1, d / R);
    if (d > R) { dx = (dx / R) * R; dy = (dy / R) * R; }
    setSt({ ...st, kx: st.ox + dx, ky: st.oy + dy });
    const dead = 0.07;
    const mag = m <= dead ? 0 : Math.min(1, (m - dead) / (1 - dead));
    if (d > 0.5) game.setMove((dx / Math.hypot(dx, dy)) * mag, (dy / Math.hypot(dx, dy)) * mag);
    else game.setMove(0, 0);
  };
  const up = (e: RPE) => {
    if (st && e.pointerId !== st.id) return;
    setSt(null);
    game.setMove(0, 0);
  };
  useEffect(() => () => game.setMove(0, 0), [game]);
  return (
    <div
      ref={zone}
      className="pointer-events-auto absolute bottom-0 left-0 top-[28%] w-[48%] touch-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ paddingLeft: 'env(safe-area-inset-left)' }}
    >
      {!st ? (
        <div className="absolute rounded-full border-2 border-white/15 bg-black/25" style={{ width: size, height: size, left: 22, bottom: 34 }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-white/15 bg-white/10" style={{ width: kRad * 2, height: kRad * 2 }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-between px-1 text-[10px] text-white/20"><span>◀</span><span>▶</span></div>
        </div>
      ) : (
        <>
          <div className="absolute rounded-full border-2 border-amber-200/40 bg-black/35" style={{ width: size, height: size, left: st.ox - size / 2, top: st.oy - size / 2 }} />
          <div className="absolute rounded-full border-2 border-amber-100/80 bg-amber-100/30 shadow-[0_0_18px_rgba(255,220,150,0.5)]" style={{ width: kRad * 2, height: kRad * 2, left: st.kx - kRad, top: st.ky - kRad }} />
        </>
      )}
    </div>
  );
}

const PROMPT_ICON: Record<string, typeof Package> = {
  chest: Package, ironchest: Package, mimic: Package, vault: KeyRound, shrine: Gem, sarcophagus: Skull, merchant: Store, locked: Lock,
};

export function Controls({ game, hud, touch }: { game: Game; hud: HudState; touch: boolean }) {
  const { w, h } = useWindowSize();
  const k = Math.max(0.76, Math.min(1.05, w / 390, h / (w > h ? 500 : 760)));
  const usableSkill = hud.skills;

  if (!touch) {
    const S = 52;
    return (
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-end gap-2.5">
        <RoundBtn size={S - 6} color="#ff6a8a" cd={hud.potionCd} max={1.2} keyHint="Q" count={String(hud.potions)} label="Зелье" onDown={() => game.trigger('potion')}>
          <FlaskConical size={22} />
        </RoundBtn>
        <RoundBtn size={S - 6} color="#d8e0f0" cd={hud.dashCd} max={hud.dashMax} keyHint="␣" label="Рывок" onDown={() => game.trigger('dash')}>
          <Wind size={22} />
        </RoundBtn>
        <div className="mx-1 h-8 w-px bg-amber-900/60" />
        {usableSkill.map((s, i) => {
          const Icon = SKILL_ICON[i];
          const d = SKILLS[i];
          return (
            <div key={d.id} className="flex flex-col items-center gap-0.5">
              <RoundBtn size={S} color={SKILL_COL[i]} cd={s.cd} max={s.max} locked={!s.unlocked} lockText={`Ур.${d.unlock}`} active={s.active} keyHint={d.key} label={d.name} onDown={() => game.trigger(('skill' + i) as 'skill0')}>
                <Icon size={S * 0.46} />
              </RoundBtn>
              <span className="text-[9px] font-semibold tracking-wide text-amber-200/70">{d.name.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const A = Math.max(78, Math.round(88 * k));
  const B = Math.max(46, Math.round(52 * k));
  const P = Math.max(44, Math.round(49 * k));
  const hasPrompt = !!hud.prompt;
  const actionMode = hasPrompt && !hud.danger;
  const showSmallAction = hasPrompt && hud.danger;
  const PromptIcon = PROMPT_ICON[hud.promptKind || ''] || Hand;
  const anchor = (right: number, bottom: number): CSSProperties => ({
    right: `calc(env(safe-area-inset-right, 0px) + ${Math.round(right * k)}px)`,
    bottom: `calc(env(safe-area-inset-bottom, 0px) + ${Math.round(bottom * k)}px)`,
  });
  const skillPositions: [number, number][] = [[124, 48], [104, 110], [57, 164]];

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <Joystick game={game} size={Math.round(128 * k)} />

      {/* Навыки огибают кнопку атаки дугой, как на геймпаде в портретном режиме. */}
      {usableSkill.map((s, i) => {
        const Icon = SKILL_ICON[i];
        const d = SKILLS[i];
        return (
          <RoundBtn
            key={d.id} size={B} color={SKILL_COL[i]} cd={s.cd} max={s.max}
            locked={!s.unlocked} lockText={`Ур.${d.unlock}`} active={s.active}
            className="absolute" style={anchor(...skillPositions[i])} label={d.name}
            onDown={() => { vibrate(6); game.trigger(('skill' + i) as 'skill0'); }}
          >
            <Icon size={B * 0.46} />
          </RoundBtn>
        );
      })}

      <RoundBtn size={P} color="#ff6a8a" cd={hud.potionCd} max={1.2}
        count={String(hud.potions)} className="absolute" style={anchor(6, 230)}
        label="Зелье здоровья" onDown={() => { vibrate(6); game.trigger('potion'); }}>
        <FlaskConical size={P * 0.46} />
      </RoundBtn>
      <RoundBtn size={P} color="#d8e0f0" cd={hud.dashCd} max={hud.dashMax}
        className="absolute" style={anchor(6, 125)}
        label="Рывок" onDown={() => { vibrate(6); game.trigger('dash'); }}>
        <Wind size={P * 0.46} />
      </RoundBtn>
      {showSmallAction && (
        <RoundBtn size={P} color="#ffd24a" pulse className="absolute"
          style={anchor(118, 217)} label="Действие"
          onDown={() => { vibrate(10); game.trigger('interact'); }}>
          <PromptIcon size={P * 0.46} />
        </RoundBtn>
      )}
      <RoundBtn
        size={A} color={actionMode ? '#ffd24a' : '#ff5a5a'}
        pulse={actionMode} active={actionMode} className="absolute"
        style={anchor(12, 26)} label={actionMode ? 'Действие' : 'Атака'}
        onDown={() => {
          vibrate(actionMode ? 12 : 6);
          if (actionMode) game.trigger('interact');
          else game.setAttackTouch(true);
        }}
        onUp={() => game.setAttackTouch(false)}
      >
        {actionMode ? <Hand size={A * 0.44} /> : <Swords size={A * 0.44} />}
      </RoundBtn>
      {hasPrompt && (
        <div className="fade-in pointer-events-none absolute flex max-w-[230px] items-center gap-1.5 rounded-lg border border-amber-500/80 bg-black/85 px-2 py-1 text-[11px] font-semibold leading-tight text-amber-100 shadow-[0_0_16px_rgba(0,0,0,0.8)]"
          style={anchor(65, 285)}>
          <PromptIcon size={14} className="shrink-0 text-amber-300" />
          <span>{hud.prompt}</span>
        </div>
      )}
    </div>
  );
}
