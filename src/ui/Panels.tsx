import { useState } from 'react';
import { Coins, Crown, FlaskConical, Gem, Home, KeyRound, Play, RotateCcw, Skull, Sparkles, Store, Swords, Volume2, VolumeX } from 'lucide-react';
import type { Game } from '../game/engine';
import type { HudState, RunSummary } from '../game/types';
import { ATTRS, MAX_POTIONS, RARITY, SKILLS, WEAPONS, fmtStat, type AttrKey, type StatKey, type WeaponDef } from '../game/data';
import { META_UPGRADES, upgradeCost, type Meta } from '../game/meta';
import { cn } from '../utils/cn';
import { Modal, WeaponIcon, fmtTime } from './common';
import { Icon } from './icons';

const ATTR_ICON: Record<AttrKey, string> = { dmg: 'swords', atk: 'zap', hp: 'heart', move: 'footprints', crit: 'crosshair', cdr: 'hourglass' };

function WeaponCard({ w, hud, mode, onAct }: { w: WeaponDef; hud: HudState; mode: 'shop' | 'inv'; onAct: () => void }) {
  const owned = hud.owned.includes(w.id);
  const equipped = hud.weapon === w.id;
  const lvl = hud.wLevels[w.id] || 0;
  const afford = hud.gold >= w.cost;
  return (
    <div className={cn('flex gap-3 rounded-lg border p-2.5', equipped ? 'border-amber-400/80 bg-amber-950/30' : 'border-zinc-700/60 bg-black/30')}>
      <div className="h-[68px] w-[68px] shrink-0 rounded-lg border bg-black/50" style={{ borderColor: w.c.glow + '88' }}>
        <WeaponIcon w={w} size={66} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold text-amber-100 sm:text-base">{w.name}</span>
          {lvl > 0 && <span className="rounded bg-amber-500/90 px-1 text-[10px] font-black text-black">+{lvl}</span>}
        </div>
        <div className="text-xs font-bold" style={{ color: w.c.glow }}>{w.effectName}</div>
        <div className="text-[11px] leading-snug text-zinc-400">{w.desc}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-300">
          <span>Урон ×{w.dmg.toFixed(2)}</span>
          <span>Скорость ×{w.spd.toFixed(2)}</span>
          <span>Радиус {w.range}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        {equipped ? (
          <span className="rounded-lg border border-amber-500/60 px-2 py-1.5 text-xs font-bold text-amber-300">Надето</span>
        ) : owned ? (
          <button onClick={onAct} className="btn-dark rounded-lg px-3 py-2 text-xs font-bold">Надеть</button>
        ) : mode === 'shop' ? (
          <button onClick={onAct} disabled={!afford} className="btn-gold flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold">
            <Coins size={13} /> {w.cost}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-zinc-500"><Coins size={12} />{w.cost}</span>
        )}
      </div>
    </div>
  );
}

export type HeroTab = 'attrs' | 'loot' | 'weapons';

export function HeroPanel({ game, hud, tab, setTab, onClose }: { game: Game; hud: HudState; tab: HeroTab; setTab: (t: HeroTab) => void; onClose: () => void }) {
  const s = hud.stats;
  const rows: [string, string][] = [
    ['Урон', s.dmg.toFixed(1)], ['Скорость атаки', s.atkSpd.toFixed(2) + '/с'], ['Здоровье', String(Math.round(s.maxHp))],
    ['Скорость бега', String(Math.round(s.moveSpd))], ['Шанс крита', Math.round(s.crit * 100) + '%'], ['Крит. урон', '×' + s.critDmg.toFixed(2)],
    ['Вампиризм', Math.round(s.life * 100) + '%'], ['Уклонение', Math.round(s.dodge * 100) + '%'], ['Броня', Math.round(s.armor * 100) + '%'],
    ['Откат навыков', '−' + Math.round(s.cdr * 100) + '%'], ['Регенерация', s.regen.toFixed(1) + '/с'], ['Бонус золота', '+' + Math.round(s.gold * 100) + '%'],
    ['Бонус опыта', '+' + Math.round(s.xp * 100) + '%'], ['Радиус подбора', String(Math.round(s.magnet))],
  ];
  const totals: Partial<Record<StatKey, number>> = {};
  for (const a of hud.artifacts) totals[a.stat] = (totals[a.stat] || 0) + a.value;
  const tabBtn = (id: HeroTab, label: string) => (
    <button onClick={() => setTab(id)} className={cn('flex-1 rounded-lg px-2 py-2 text-xs font-bold sm:text-sm', tab === id ? 'btn-gold' : 'btn-dark')}>{label}</button>
  );
  return (
    <Modal title={`Ассасин · Уровень ${hud.level}`} onClose={onClose} wide icon={<Crown className="text-amber-400" size={20} />}>
      <div className="mb-3 flex gap-2">
        {tabBtn('attrs', `Атрибуты${hud.points ? ` (${hud.points})` : ''}`)}
        {tabBtn('loot', `Артефакты (${hud.artifacts.length})`)}
        {tabBtn('weapons', 'Клинки')}
      </div>
      {tab === 'attrs' && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className={cn('rounded-lg border px-3 py-2 text-center text-sm font-bold', hud.points > 0 ? 'pulse-glow border-amber-400 bg-amber-900/30 text-amber-200' : 'border-zinc-700 text-zinc-400')}>
              Свободных очков: {hud.points}
            </div>
            {ATTRS.map((a) => (
              <div key={a.key} className="flex items-center gap-3 rounded-lg border border-zinc-700/60 bg-black/30 p-2">
                <div className="flex w-8 justify-center text-amber-300"><Icon name={ATTR_ICON[a.key]} size={24} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-amber-100">{a.name} <span className="text-zinc-400">· {hud.attrs[a.key]}</span></div>
                  <div className="text-xs text-zinc-400">{a.desc}</div>
                </div>
                <button disabled={hud.points <= 0} onClick={() => game.spendPoint(a.key)} className="btn-gold h-10 w-10 shrink-0 rounded-lg text-xl font-bold">+</button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="rounded-lg border border-zinc-700/60 bg-black/30 p-2">
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Характеристики</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-zinc-800/80 py-0.5">
                    <span className="text-zinc-400">{k}</span><span className="font-semibold text-amber-100">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-700/60 bg-black/30 p-2">
              <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Навыки</div>
              {SKILLS.map((k) => (
                <div key={k.id} className={cn('flex gap-2 py-1 text-xs', hud.level < k.unlock && 'opacity-45')}>
                  <span className="w-5 shrink-0 rounded bg-zinc-800 text-center font-bold text-amber-300">{k.key}</span>
                  <span><b className="text-amber-100">{k.name}</b> <span className="text-zinc-500">· {k.cd}с{hud.level < k.unlock ? ` · с ${k.unlock} ур.` : ''}</span><br /><span className="text-zinc-400">{k.desc}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab === 'loot' && (
        <div>
          {hud.artifacts.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">
              <Gem className="mx-auto mb-2 text-zinc-600" size={36} />
              Артефактов пока нет. Они падают с врагов (особенно элитных), из сундуков и с алтарей — и применяются автоматически.
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(Object.keys(totals) as StatKey[]).map((k) => (
                  <span key={k} className="rounded-full border border-amber-700/50 bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                    {fmtStat(k, totals[k] || 0)}
                  </span>
                ))}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {hud.artifacts.map((a) => {
                  const c = RARITY[a.rarity].color;
                  return (
                    <div key={a.uid} className="flex items-center gap-2 rounded-md border bg-black/30 p-1.5" style={{ borderColor: c + '77' }}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl" style={{ background: c + '22', border: `1px solid ${c}`, color: c }}><Icon name={a.icon} size={20} /></div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold" style={{ color: c }}>{a.name} <span className="text-[10px] opacity-70">{RARITY[a.rarity].label}</span></div>
                        <div className="text-xs text-zinc-300">{fmtStat(a.stat, a.value)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {tab === 'weapons' && (
        <div className="space-y-2">
          {WEAPONS.map((w) => <WeaponCard key={w.id} w={w} hud={hud} mode="inv" onAct={() => game.buyWeapon(w.id)} />)}
          <div className="pt-1 text-center text-xs text-zinc-500">Новые клинки покупаются у странствующих торговцев (зелёные точки на карте).</div>
        </div>
      )}
    </Modal>
  );
}

export function ShopPanel({ game, hud, onClose }: { game: Game; hud: HudState; onClose: () => void }) {
  const w = WEAPONS.find((x) => x.id === hud.weapon) || WEAPONS[0];
  const lvl = hud.wLevels[w.id] || 0;
  const cost = game.sharpenCost();
  return (
    <Modal title="Странствующий торговец" onClose={onClose} wide icon={<Store className="text-amber-400" size={20} />}>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-800/50 bg-black/40 px-3 py-2">
        <span className="text-sm italic text-zinc-400">«Золото — единственный язык, понятный во тьме…»</span>
        <span className="flex items-center gap-1.5 text-base font-bold text-amber-300"><Coins size={16} />{hud.gold}</span>
      </div>
      <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-500">Клинки</div>
      <div className="space-y-2">
        {WEAPONS.map((x) => <WeaponCard key={x.id} w={x} hud={hud} mode="shop" onAct={() => game.buyWeapon(x.id)} />)}
      </div>
      <div className="mb-1 mt-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Припасы и ковка</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-700/60 bg-black/30 p-2.5">
          <div className="flex items-center gap-2 font-semibold text-rose-200"><FlaskConical size={18} /> Зелье здоровья</div>
          <div className="text-xs text-zinc-400">Восстанавливает 45% здоровья. У вас: {hud.potions}/{MAX_POTIONS}</div>
          <button disabled={hud.gold < 45 || hud.potions >= MAX_POTIONS} onClick={() => game.buyPotion()} className="btn-gold mt-auto flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold"><Coins size={14} />45</button>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-700/60 bg-black/30 p-2.5">
          <div className="flex items-center gap-2 font-semibold text-yellow-200"><KeyRound size={18} /> Ключ хранилища</div>
          <div className="text-xs text-zinc-400">Открывает запертые хранилища с лучшей добычей. У вас: {hud.keys}</div>
          <button disabled={hud.gold < 120} onClick={() => game.buyKey()} className="btn-gold mt-auto flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold"><Coins size={14} />120</button>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-700/60 bg-black/30 p-2.5">
          <div className="flex items-center gap-2 font-semibold text-orange-200"><Sparkles size={18} /> Заточка клинков</div>
          <div className="text-xs text-zinc-400">{w.name}: +{lvl}/5. Каждый уровень даёт +12% урона.</div>
          <button disabled={lvl >= 5 || hud.gold < cost} onClick={() => game.sharpen()} className="btn-gold mt-auto flex items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold">
            {lvl >= 5 ? 'Максимум' : (<><Coins size={14} />{cost}</>)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function PausePanel({ muted, onResume, onHelp, onMute, onQuit }: { muted: boolean; onResume: () => void; onHelp: () => void; onMute: () => void; onQuit: () => void }) {
  return (
    <Modal title="Пауза" onClose={onResume}>
      <div className="mx-auto flex max-w-xs flex-col gap-2.5">
        <button onClick={onResume} className="btn-gold flex items-center justify-center gap-2 rounded-lg py-3 font-bold"><Play size={18} />Продолжить</button>
        <button onClick={onHelp} className="btn-dark flex items-center justify-center gap-2 rounded-lg py-3 font-semibold">Управление и советы</button>
        <button onClick={onMute} className="btn-dark flex items-center justify-center gap-2 rounded-lg py-3 font-semibold">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}{muted ? 'Включить звук' : 'Выключить звук'}</button>
        <button onClick={onQuit} className="btn-dark flex items-center justify-center gap-2 rounded-lg py-3 font-semibold text-red-300"><Home size={18} />Покинуть забег</button>
      </div>
    </Modal>
  );
}

export function EndPanel({ kind, summary, onRestart, onMenu, onContinue }: { kind: 'dead' | 'victory'; summary: RunSummary; onRestart: () => void; onMenu: () => void; onContinue?: () => void }) {
  const win = kind === 'victory';
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="panel-ornate fade-in w-full max-w-md rounded-xl p-5 text-center">
        {win ? <Crown className="mx-auto mb-1 text-amber-400" size={42} /> : <Skull className="mx-auto mb-1 text-red-500" size={42} />}
        <h2 className={cn('font-display text-3xl font-black tracking-wider', win ? 'gold-text' : 'text-red-500')}>{win ? 'ПОБЕДА' : 'ВЫ ПАЛИ'}</h2>
        <p className="mt-1 text-sm text-zinc-400">{win ? 'Малгрот, Костяной Король, повержен. Тьма отступает… пока.' : 'Тени сомкнулись над вами. Но душа ассасина не угасла.'}</p>
        <div className="my-4 grid grid-cols-2 gap-2 text-sm">
          {[['Убито врагов', summary.kills], ['Уровень', summary.level], ['Время', fmtTime(summary.time)], ['Золота собрано', summary.gold]].map(([k, v]) => (
            <div key={String(k)} className="rounded-lg border border-zinc-700/60 bg-black/40 px-2 py-1.5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{k}</div>
              <div className="text-lg font-bold text-amber-200">{v}</div>
            </div>
          ))}
        </div>
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-violet-700/50 bg-violet-950/40 py-2 text-violet-200">
          <Skull size={16} /> Получено душ: <b className="text-lg">+{summary.souls}</b>
        </div>
        <div className="flex flex-col gap-2">
          {win && onContinue && <button onClick={onContinue} className="btn-dark flex items-center justify-center gap-2 rounded-lg py-3 font-semibold"><Play size={18} />Продолжить исследование</button>}
          <button onClick={onRestart} className="btn-gold flex items-center justify-center gap-2 rounded-lg py-3 font-bold"><RotateCcw size={18} />Новый забег</button>
          <button onClick={onMenu} className="btn-dark flex items-center justify-center gap-2 rounded-lg py-3 font-semibold"><Home size={18} />В главное меню</button>
        </div>
      </div>
    </div>
  );
}

export function MetaPanel({ meta, onBuy, onClose }: { meta: Meta; onBuy: (k: keyof Meta["up"]) => void; onClose: () => void }) {
  return (
    <Modal title="Святилище душ" onClose={onClose} icon={<Skull className="text-violet-400" size={20} />}>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-violet-800/50 bg-violet-950/30 px-3 py-2">
        <span className="text-sm text-zinc-300">Души павших врагов дают постоянные улучшения</span>
        <span className="flex items-center gap-1.5 text-lg font-bold text-violet-200"><Skull size={16} />{meta.souls}</span>
      </div>
      <div className="space-y-2">
        {META_UPGRADES.map((u) => {
          const lvl = meta.up[u.key];
          const cost = upgradeCost(u, lvl);
          const maxed = lvl >= u.max;
          return (
            <div key={u.key} className="flex items-center gap-3 rounded-lg border border-zinc-700/60 bg-black/30 p-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-amber-100">{u.name}</div>
                <div className="text-xs text-zinc-400">{u.desc}</div>
                <div className="mt-1 flex gap-0.5">
                  {Array.from({ length: u.max }).map((_, i) => <span key={i} className={cn('h-1.5 w-4 rounded-sm', i < lvl ? 'bg-violet-400' : 'bg-zinc-700')} />)}
                </div>
              </div>
              <button disabled={maxed || meta.souls < cost} onClick={() => onBuy(u.key)} className="btn-gold flex min-w-20 items-center justify-center gap-1 rounded-lg py-2 text-sm font-bold">
                {maxed ? 'Макс.' : (<><Skull size={13} />{cost}</>)}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center text-xs text-zinc-500">Рекорд: {meta.bestKills} убийств · {meta.bestLevel} ур. · побед: {meta.wins}</div>
    </Modal>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'pc' | 'mobile' | 'tips'>('pc');
  const kb = (k: string) => <kbd className="rounded border border-amber-700 bg-amber-950/60 px-1.5 py-0.5 text-xs font-bold text-amber-200">{k}</kbd>;
  return (
    <Modal title="Управление и советы" onClose={onClose} icon={<Swords className="text-amber-400" size={20} />}>
      <div className="mb-3 flex gap-2">
        {([['pc', 'ПК'], ['mobile', 'Телефон'], ['tips', 'Советы']] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('flex-1 rounded-lg py-2 text-sm font-bold', tab === id ? 'btn-gold' : 'btn-dark')}>{l}</button>
        ))}
      </div>
      {tab === 'pc' && (
        <ul className="space-y-1.5 text-sm text-zinc-300">
          <li>{kb('W')} {kb('A')} {kb('S')} {kb('D')} / стрелки — движение</li>
          <li>{kb('ЛКМ')} или {kb('J')} — атака (можно удерживать), клинки бьют в сторону курсора</li>
          <li>{kb('Пробел')} / {kb('Shift')} / {kb('ПКМ')} — рывок (неуязвимость на миг)</li>
          <li>{kb('1')} {kb('2')} {kb('3')} — навыки (вихрь, теневой шаг, танец смерти)</li>
          <li>{kb('Q')} — выпить зелье · {kb('E')} — действие (сундук, алтарь, торговец)</li>
          <li>{kb('I')} / {kb('Tab')} — герой и артефакты · {kb('U')} — очки атрибутов · {kb('M')} — карта · {kb('Esc')} — пауза</li>
        </ul>
      )}
      {tab === 'mobile' && (
        <ul className="space-y-1.5 text-sm text-zinc-300">
          <li>Левый палец — джойстик: коснитесь левой половины экрана и ведите. База появляется под пальцем и не «убегает».</li>
          <li>Большая кнопка справа — атака (удерживайте). Клинки сами нацеливаются на ближайшего врага и поворачивают героя.</li>
          <li>Рядом с сундуком, алтарём, саркофагом или торговцем большая кнопка сама становится золотой кнопкой «Действие» с иконкой объекта.</li>
          <li>Если рядом враги, атака остаётся, а для объекта появляется отдельная золотая кнопка слева от неё.</li>
          <li>Три навыка расположены дугой слева от атаки; рывок и зелье справа над ней. Иконки под миникартой: карта, герой, звук, пауза.</li>
        </ul>
      )}
      {tab === 'tips' && (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-300">
          <li>Бейте бочки и ящики — из них падает золото. Красные бочки с черепом взрываются: заманивайте к ним врагов!</li>
          <li>Элитные враги (с аурой и пометкой) роняют артефакты и ключи. Ключ открывает хранилище с эпической добычей.</li>
          <li>Некоторые сундуки — Мимики. Они кусаются, но дают много опыта и золота.</li>
          <li>Алтари: кровь, сила, жизнь, удача и проклятие — у каждого свой риск и награда.</li>
          <li>Костры в лагерях лечат. Торговцы продают клинки с эффектами: яд, кровь, огонь, лёд, тень и свет.</li>
          <li>Ловушки-шипы и взрывы ранят и вас, и врагов. Паутина замедляет.</li>
          <li>Найдите и победите трёх хранителей печатей. Их фиолетовые метки видны на полной карте, даже если комнаты ещё не исследованы.</li>
          <li>Трон Костяного Короля запечатан до победы над хранителями. Он отмечен красным на полной карте.</li>
        </ul>
      )}
    </Modal>
  );
}
