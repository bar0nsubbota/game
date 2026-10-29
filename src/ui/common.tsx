import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { WeaponDef } from '../game/data';
import { drawWeaponIcon } from '../game/sprites';
import { cn } from '../utils/cn';

export function useWindowSize() {
  const [s, setS] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setS({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('orientationchange', f);
    };
  }, []);
  return s;
}

export function fmtTime(t: number) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function WeaponIcon({ w, size = 56 }: { w: WeaponDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = 2;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWeaponIcon(ctx, w, size);
  }, [w, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

export function Modal({ title, onClose, children, wide, icon }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean; icon?: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-2 backdrop-blur-[2px] sm:p-4">
      <div
        className={cn(
          'panel-ornate fade-in relative flex max-h-[94dvh] w-full flex-col rounded-xl',
          wide ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <div className="flex items-center gap-2 border-b border-amber-900/50 px-4 py-2.5">
          {icon}
          <h2 className="font-display flex-1 text-lg font-bold tracking-wide text-amber-200 sm:text-xl">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="btn-dark flex h-9 w-9 items-center justify-center rounded-full" aria-label="Закрыть">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="scroll-y flex-1 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}
