import type { ArtifactInst, AttrKey, EffectKind, EnemyDef, EnemyKind, ProjKind } from './data';

export interface Status {
  poison: number; poisonT: number;
  bleed: number; bleedT: number;
  burnT: number;
  chill: number; chillT: number;
  freezeT: number;
}

export type EliteMod = '' | 'fast' | 'armored' | 'explosive';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  name: string;
  x: number; y: number;
  kx: number; ky: number;
  hp: number; maxHp: number; dmg: number; speed: number; r: number; sc: number;
  elite: EliteMod;
  state: 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'roar';
  t: number; cd: number;
  face: 1 | -1;
  aim: number;
  hx: number; hy: number;
  los: boolean; losT: number;
  flash: number; anim: number; mv: number; wind: number; swing: number;
  st: Status;
  dotT: number; dotAcc: number; dotCol: string;
  ownerId: number; minion: boolean; boss: boolean; phase: number;
  act: number; a: number; b: number; c: number;
  strafe: 1 | -1;
  dead: boolean; room: number; diff: number; spawnT: number; invuln: number;
  shrine: number; seal: number;
}

export type PropKind =
  | 'barrel' | 'crate' | 'bomb' | 'chest' | 'ironchest' | 'vault' | 'mimic' | 'shrine' | 'sarcophagus'
  | 'brazier' | 'campfire' | 'merchant' | 'spikes' | 'web' | 'bones' | 'candles' | 'cocoon' | 'orcfire';

export interface Prop {
  id: number;
  kind: PropKind;
  x: number; y: number;
  r: number;
  hp: number;
  solid: boolean;
  state: number;
  t: number;
  hit: number;
  seed: number;
  sub: string;
  diff: number;
  light: number;
  lightCol: string;
  dead: boolean;
}

export interface Pickup {
  id: number;
  kind: 'gold' | 'xp' | 'potion' | 'artifact' | 'key';
  x: number; y: number; vx: number; vy: number; z: number; vz: number;
  value: number;
  art?: ArtifactInst;
  t: number;
  dead: boolean;
}

export interface Proj {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number;
  from: 'p' | 'e';
  kind: ProjKind;
  pierce: number;
  hit: number[];
  col: string;
  effect: EffectKind;
  crit: boolean;
  poison: boolean;
  slow: boolean;
  dead: boolean;
  src: number;
}

export interface Zone {
  kind: 'circle' | 'cone' | 'line';
  x: number; y: number; r: number; ang: number; arc: number; len: number; w: number;
  t: number; dur: number; after: number;
  dmg: number;
  from: 'e' | 'p' | 'x';
  col: string;
  src: number;
  done: boolean; dead: boolean;
  poison: boolean;
  style: 'hit' | 'fire' | 'holy' | 'boom' | 'slam';
  crit: boolean;
}

export interface Fx {
  kind: 'slash' | 'ring' | 'pillar' | 'beam' | 'flash';
  x: number; y: number; x2: number; y2: number; a: number; r: number; arc: number; side: number;
  t: number; dur: number; col: string; big: boolean;
}

export interface Part {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: string;
  grav: number; kind: 0 | 1 | 2 | 3 | 4; drag: number; spin?: number; rot?: number;
}

export interface TextPop { x: number; y: number; vy: number; t: number; max: number; text: string; col: string; size: number }

export interface Critter { x: number; y: number; vx: number; vy: number; t: number; face: 1 | -1; flee: number }

export interface Decal { kind: 'blood' | 'bones' | 'crack' | 'rune' | 'moss' | 'rug' | 'scorch' | 'ichor'; x: number; y: number; r: number; rot: number; seed: number; col: string }

export interface Ghost { x: number; y: number; face: number; t: number; col: string }

export interface PlayerState {
  x: number; y: number; kx: number; ky: number;
  face: 1 | -1; lastDir: number;
  hp: number; level: number; xp: number; gold: number; keys: number; potions: number; points: number;
  attrs: Record<AttrKey, number>;
  artifacts: ArtifactInst[];
  owned: string[];
  weapon: string;
  wLevels: Record<string, number>;
  atkCd: number; combo: number; swing: number; swingDur: number; swingSide: 1 | -1; swingAim: number;
  dashT: number; dashCd: number; dashDir: number; ghostT: number;
  iframes: number; potionCd: number;
  skillCd: number[];
  whirlT: number; whirlTick: number; danceT: number; danceFx: number;
  critCharges: number;
  power: number;
  poisonT: number; slowT: number;
  anim: number; moving: boolean;
  hurt: number;
  stepT: number;
  casting: number;
  fade: number;
}

export interface Stats {
  dmg: number; atkSpd: number; maxHp: number; moveSpd: number; crit: number; critDmg: number;
  life: number; dodge: number; cdr: number; regen: number; gold: number; xp: number; magnet: number; armor: number;
}

export interface SkillHud { cd: number; max: number; unlocked: boolean; active: boolean }

export interface HudState {
  hp: number; maxHp: number; xp: number; xpNeed: number; level: number; gold: number; keys: number; potions: number; points: number;
  dashCd: number; dashMax: number; potionCd: number;
  skills: SkillHud[];
  weapon: string; owned: string[]; wLevels: Record<string, number>;
  attrs: Record<AttrKey, number>;
  stats: Stats;
  artifacts: ArtifactInst[];
  boss: { name: string; hp: number; max: number } | null;
  seals: number; sealsTotal: number;
  prompt: string | null;
  promptKind: string | null;
  danger: boolean;
  kills: number; time: number;
  buffs: { name: string; t: number; color: string }[];
  room: string;
  bossDone: boolean;
}

export interface RunSummary { kills: number; level: number; time: number; gold: number; boss: boolean; souls: number }
