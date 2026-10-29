import type { CSSProperties } from 'react';
import {
  BookOpen, Clover, Coins, Crosshair, Dices, Droplets, Eye, Flame, FlaskConical, Footprints, Gem, Ghost, Heart, Hourglass,
  KeyRound, Magnet, ShieldHalf, Skull, Sparkles, Swords, Zap, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  flame: Flame, zap: Zap, heart: Heart, footprints: Footprints, eye: Eye, droplets: Droplets, ghost: Ghost, hourglass: Hourglass,
  crosshair: Crosshair, gem: Gem, coins: Coins, book: BookOpen, magnet: Magnet, shield: ShieldHalf, sparkles: Sparkles, skull: Skull,
  clover: Clover, dices: Dices, key: KeyRound, flask: FlaskConical, swords: Swords,
};

export function Icon({ name, size = 16, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const C = MAP[name] || Gem;
  return <C size={size} className={className} style={style} />;
}
