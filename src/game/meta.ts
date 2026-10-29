// Мета-прогрессия между забегами (хранится в localStorage)
export interface MetaUpgrade { key: 'hp' | 'dmg' | 'gold' | 'potion'; name: string; desc: string; max: number; base: number }
export const META_UPGRADES: MetaUpgrade[] = [
  { key: 'hp', name: 'Закалка', desc: '+12 к максимальному здоровью', max: 8, base: 30 },
  { key: 'dmg', name: 'Остриё теней', desc: '+4% к урону', max: 8, base: 40 },
  { key: 'gold', name: 'Тайный кошель', desc: '+40 стартового золота', max: 5, base: 25 },
  { key: 'potion', name: 'Запас зелий', desc: '+1 стартовое зелье', max: 3, base: 60 },
];

export interface Meta {
  souls: number;
  up: Record<MetaUpgrade['key'], number>;
  bestKills: number;
  bestLevel: number;
  wins: number;
  runs: number;
}

const KEY = 'noctis_meta_v1';

export function defaultMeta(): Meta {
  return { souls: 0, up: { hp: 0, dmg: 0, gold: 0, potion: 0 }, bestKills: 0, bestLevel: 0, wins: 0, runs: 0 };
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    const m = JSON.parse(raw) as Partial<Meta>;
    const d = defaultMeta();
    return { ...d, ...m, up: { ...d.up, ...(m.up || {}) } };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(m: Meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function upgradeCost(u: MetaUpgrade, lvl: number): number {
  return Math.round(u.base * Math.pow(1.6, lvl));
}
