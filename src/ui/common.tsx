import { useEffect, useRef, useState, type ReactNode, type TouchEvent as RTE } from 'react';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; st: number; rot: boolean } | null>(null);

  const onTouchStart = (e: RTE<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || e.touches.length !== 1) return;
    // Определяем, находимся ли внутри CSS-повёрнутого на 90° горизонтального контейнера
    const r = el.getBoundingClientRect();
    const isRot90 = window.innerHeight > window.innerWidth && r.height > r.width && el.clientWidth > el.clientHeight;
    dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, st: el.scrollTop, rot: isRot90 };
  };

  const onTouchMove = (e: RTE<HTMLDivElement>) => {
    const el = scrollRef.current;
    const d = dragRef.current;
    if (!el || !d || e.touches.length !== 1) return;
    if (d.rot) {
      // В rotate(90deg) визуальный свайп «вверх/вниз» — это движение пальца по физической оси X!
      const dx = e.touches[0].clientX - d.x;
      el.scrollTop = d.st + dx;
    }
  };

  const onTouchEnd = () => { dragRef.current = null; };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-2 backdrop-blur-[2px] sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100% - 12px)' }}
        className={cn(
          'panel-ornate fade-in relative flex w-full flex-col overflow-hidden rounded-xl',
          wide ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-900/50 bg-[#14101f]/95 px-3 py-2 sm:px-4">
          {icon}
          <h2 className="font-display flex-1 truncate text-base font-bold tracking-wide text-amber-200 sm:text-xl">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-dark flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div
          ref={scrollRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className="scroll-y min-h-0 flex-1 overflow-y-auto p-3 sm:p-4"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
