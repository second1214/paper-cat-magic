// おもちゃ（装備）と発射計画。スロットを左から読み、1回で出す技の一覧を決める（純粋関数）。
import { spellDef, type Modifier, type ProjectileStats, type SpellDef, type TriggerOn } from "./spells";
import { L } from "../i18n";

/** サブスロットがたまる条件。 */
export type SubCharge = "still" | "hit" | "dash" | "kill" | "hurt";
export const SUB_LABEL: Record<SubCharge, (n: number) => string> = {
  still: (n) => L(`${n}秒じっとする`, `Stay still ${n}s`),
  hit: (n) => L(`技を${n}回当てる`, `Land ${n} hits`),
  dash: (n) => L(`${n}回ダッシュする`, `Dash ${n} time${n > 1 ? "s" : ""}`),
  kill: (n) => L(`虫を${n}匹たおす`, `Defeat ${n} bug${n > 1 ? "s" : ""}`),
  hurt: (n) => n > 1 ? L(`${n}回ダメージを受ける`, `Take damage ${n} times`) : L("ダメージを受ける", "Take damage"),
};

export interface ToyDef {
  id: string;
  name: string;
  desc: string;
  slots: (string | null)[];
  manaMax: number; // やる気の最大
  manaRegen: number; // 毎秒
  castDelay: number; // 振る間隔（秒）
  recharge: number; // 最後のスロットまで使った後の休み（秒）
  /** このおもちゃで出す技すべてにかかる性質。 */
  baseMod?: Modifier;
  /** サブスロット: 条件がたまると、やる気を使わずに全部いっぺんに出る。 */
  sub?: { slots: (string | null)[]; charge: SubCharge; need: number };
  /** 全部のスロットを1回でいっぺんに出す。 */
  castAll?: boolean;
  /** 電池式: 持っているだけで、この秒数ごとに一番近い虫へ自動で振る。 */
  auto?: number;
}

/** 実際に飛ばす1発。payload は「つづけて」（命中地点から出す技）、timer があれば出てからその秒数で出す。 */
export interface Shot {
  stats: ProjectileStats;
  payload: Shot[];
  timer?: number;
  /** payload を出すきっかけ（なければ「当たったら」）。 */
  on?: TriggerOn;
}

export interface CastResult {
  shots: Shot[];
  /** やる気が足りずに出せなかったとき、このまとまりに要るやる気。 */
  need?: number;
  manaUsed: number;
  nextCursor: number;
  /** 今回読んだスロットの範囲 [start, end)。 */
  start: number;
  end: number;
  /** 最後のスロットまで読み切った（休みに入る）。 */
  wrapped: boolean;
  /** やる気不足で途中で止まった。 */
  fizzled: boolean;
  /** 今回読んだ修飾で変わる、振る間隔・休けい（秒）。 */
  delayAdd: number;
  rechargeAdd: number;
}

function applyMods(p: ProjectileStats, mods: Modifier[]): ProjectileStats {
  const s = { ...p };
  for (const m of mods) {
    if (m.damageMul) s.damage *= m.damageMul;
    if (m.damageAdd) s.damage += m.damageAdd;
    if (m.speedMul) s.speed *= m.speedMul;
    if (m.homing) s.homing = Math.min(1, s.homing + m.homing);
    if (m.bounce) s.bounce += m.bounce;
    if (m.pierce) s.pierce += m.pierce;
    if (m.explodeAdd) s.explode += m.explodeAdd;
    if (m.spread) s.spread += m.spread;
    if (m.hitsAdd && s.hits < 99) s.hits += m.hitsAdd;
    if (m.sizeMul) { s.radius *= m.sizeMul; s.reach *= Math.max(0.7, m.sizeMul); s.explode *= m.sizeMul; }
    if (m.speedMul) s.hitEvery /= m.speedMul;
    if (m.element) s.element = m.element;
    if (m.slowAdd) s.slow += m.slowAdd;
    if (m.split) s.split += m.split;
    if (m.lifeMul && s.motion !== "melee" && s.motion !== "ring" && !(s.motion === "beam" && s.speed === 0)) s.life *= m.lifeMul;
  }
  return s;
}

const isPassive = (d: SpellDef | undefined) => !!d && d.kind === "modifier" && d.dir === "all";

/** 全体修飾（どこに置いても全部の技にかかる）。 */
export function passiveMods(t: ToyDef): Modifier[] {
  return t.slots.map((id) => (id ? spellDef(id) : undefined)).filter(isPassive).map((d) => d!.modifier!);
}
/** 全体修飾で減るやる気の最大。 */
export const passiveCost = (t: ToyDef) => t.slots.reduce((a, id) => a + (id && isPassive(spellDef(id)) ? spellDef(id).mana : 0), 0);

/** ふたつ持ち: 2つのおもちゃを同時に扱い、左の技 a を右の技 b にまとめる。動き・見た目は b。 */
function fuse(a: ProjectileStats, b: ProjectileStats): ProjectileStats {
  return {
    ...b, damage: a.damage + b.damage, hits: Math.max(a.hits, b.hits), pierce: a.pierce + b.pierce, bounce: a.bounce + b.bounce,
    explode: Math.max(a.explode, b.explode), slow: a.slow + b.slow, homing: Math.max(a.homing, b.homing), knock: Math.max(a.knock, b.knock),
    radius: Math.max(b.radius, a.radius), element: b.element !== "none" ? b.element : a.element,
  };
}

/**
 * cursor の位置から1回ぶん出す。
 * - ▶修飾は右の技に溜まる。◀修飾は左の技にかかる。◀▶修飾は左右の技にかかり、右の技もいっしょに出す。全体修飾は読まない。
 * - 二刀流は、続く技を count 個ぶん追加で引く。
 * - [A][つづけて][B]: A が当たった所から B を出す（B は A の payload）。
 * - [A][ふたつ持ち][B]: A と B を同時に扱い、1発にまとめる。
 * - スロットの端に達したら打ち切って wrapped を立てる。
 */
export function planCast(toy: ToyDef, cursor: number, mana: number, slots: (string | null)[] = toy.slots, whole = true): CastResult {
  const start = cursor;
  let i = cursor;
  let used = 0;
  let wrapped = false;
  let fizzled = false;
  let delayAdd = 0, rechargeAdd = 0;
  const toyMods = [...(toy.baseMod ? [toy.baseMod] : []), ...passiveMods(toy)];

  const nextIndex = () => { let j = i; while (j < slots.length && (!slots[j] || isPassive(spellDef(slots[j]!)))) j++; return j; };
  const peek = () => { const j = nextIndex(); return j < slots.length ? spellDef(slots[j]!) : null; };
  const take = () => {
    i = nextIndex();
    if (i >= slots.length) { wrapped = true; return null; }
    const def = spellDef(slots[i]!);
    if (!def) { i++; return null; }
    if (used + def.mana > mana) { fizzled = true; return null; }
    used += def.mana;
    i++;
    delayAdd += def.modifier?.castDelayAdd ?? 0; rechargeAdd += def.modifier?.rechargeAdd ?? 0;
    return def;
  };

  /** 技の右にあるもの（◀・◀▶・つづけて・ふたつ持ち）を読んで、out[0]（今の技）に効かせる。 */
  const after = (out: Shot[]) => {
    for (;;) {
      const nx = peek();
      if (!nx || wrapped || fizzled) return;
      const left = nx.kind === "modifier" && (nx.dir === "left" || nx.dir === "both");
      if (!left && nx.kind !== "trigger" && nx.kind !== "duet") return;
      if (!take()) return;
      if (nx.kind === "modifier") {
        out[0].stats = applyMods(out[0].stats, [nx.modifier!]);
        if (nx.dir === "both") { const more = drawOne([nx.modifier!]); if (more) out.push(...more); return; }
        continue;
      }
      const right = drawOne([]);
      if (!right?.length) return;
      if (nx.kind === "trigger") { out[0].payload.push(...right); if (nx.timer) out[0].timer = nx.timer; if (nx.on) out[0].on = nx.on; return; }
      // ふたつ持ち: 左の技は右の技といっしょに1発に
      right[0].stats = fuse(out[0].stats, right[0].stats);
      right[0].payload.unshift(...out[0].payload);
      out.splice(0, 1, ...right);
      return;
    }
  };

  function drawOne(mods: Modifier[]): Shot[] | null {
    let pendingMulti = 0;
    for (;;) {
      if (wrapped || fizzled) return null;
      const def = take();
      if (!def) return null;
      if (def.kind === "modifier" && def.modifier) { if (def.dir !== "left") mods = [...mods, def.modifier]; continue; }   // 左に技がない◀は空振り
      if (def.kind === "multicast") { pendingMulti += def.count ?? 2; continue; }
      if (def.kind === "trigger" || def.kind === "duet") continue;   // 左に技がないので空振り
      if (def.kind === "attack" && def.projectile) {
        const out: Shot[] = [{ stats: applyMods(def.projectile, [...toyMods, ...mods]), payload: [] }];
        after(out);
        // ぶちまけ: 1発を何発にも（重ねると掛け算）。扇状に並ぶ
        const copies = mods.reduce((k, m) => k * (m.copies ?? 1), 1);
        if (copies > 1) out.splice(0, 1, ...Array.from({ length: copies }, () => structuredClone(out[0])));
        for (let k = 1; k < pendingMulti; k++) {
          const more = drawOne([]);
          if (!more) break;
          out.push(...more);
        }
        return out;
      }
    }
  }

  const shots = drawOne([]) ?? [];
  // やる気が足りないときは、まとまりの途中で切らない（つづけての右だけが後で単体で出る、などを防ぐ）。たまるまで待つ
  if (whole && fizzled) {
    const need = planCast(toy, cursor, Infinity, slots, false).manaUsed;
    return { shots: [], manaUsed: 0, nextCursor: cursor, start, end: cursor, wrapped: false, fizzled: true, delayAdd: 0, rechargeAdd: 0, need };
  }
  if (nextIndex() >= slots.length) wrapped = true;
  return { shots, manaUsed: used, nextCursor: wrapped ? 0 : i, start, end: i, wrapped, fizzled, delayAdd, rechargeAdd };
}

/** 全部のスロットを左から最後まで、いっぺんに出す（サブスロット・鈴入りボール）。 */
export function castAll(toy: ToyDef, mana: number, slots: (string | null)[] = toy.slots): { shots: Shot[]; manaUsed: number; delayAdd: number; rechargeAdd: number } {
  const shots: Shot[] = [];
  let cursor = 0, used = 0, delayAdd = 0, rechargeAdd = 0;
  for (let guard = 0; guard < slots.length + 1; guard++) {
    const r = planCast(toy, cursor, mana - used, slots);
    shots.push(...r.shots); used += r.manaUsed; delayAdd += r.delayAdd; rechargeAdd += r.rechargeAdd;
    if (r.wrapped || r.fizzled || r.end <= r.start) break;
    cursor = r.nextCursor;
  }
  return { shots, manaUsed: used, delayAdd, rechargeAdd };
}

/**
 * 1周ぶん左から読んだときの「ひとまとまり」（1回で一緒に出るスロット）を返す。
 * UI で「この修飾はどの技にかかるか」を括って見せるのに使う。
 */
export function castGroups(toy: ToyDef): [number, number][] {
  const groups: [number, number][] = [];
  let cursor = 0;
  for (let guard = 0; guard < toy.slots.length + 1; guard++) {
    const r = planCast(toy, cursor, Infinity);
    if (r.end > r.start) groups.push([r.start, r.end]);
    if (r.wrapped) break;
    cursor = r.nextCursor;
  }
  return groups;
}

const empty = (n: number) => Array.from({ length: n }, (): string | null => null);

/** おもちゃ。どれも本当に売っていそうな、ふつうの猫のおもちゃ。 */
export const TOYS: Record<string, ToyDef> = {
  jarashi: {
    id: "jarashi", name: L("ねこじゃらし", "Cat Teaser"), desc: L("ふつうの使いやすさ。8スロット", "Easy to use. 8 slots"),
    slots: empty(8), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
  },
  tombo: {
    id: "tombo", name: L("トンボじゃらし", "Dragonfly Teaser"), desc: L("トンボが少し虫を追いかける。6スロットで休みが短い", "The dragonfly chases bugs a little. 6 slots, short Resting"),
    slots: empty(6), manaMax: 70, manaRegen: 34, castDelay: 0.16, recharge: 0.35,
    baseMod: { homing: 0.35 },
  },
  tissue: {
    id: "tissue", name: L("ティッシュボール", "Tissue Ball"), desc: L("丸めたティッシュが壁で1回はね返る。12スロット、休みが長い", "Balled-up tissue bounces off walls once. 12 slots, long Resting"),
    slots: empty(12), manaMax: 110, manaRegen: 28, castDelay: 0.22, recharge: 0.9,
    baseMod: { bounce: 1 },
  },
  keri: {
    id: "keri", name: L("けりぐるみ", "Kicker Toy"), desc: L("抱えてけりけりする細長いぬいぐるみ。技の攻撃力×1.35。5スロットで振るのが遅い", "A long plush to hug and kick. Move damage ×1.35. 5 slots, slow casting"),
    slots: empty(5), manaMax: 90, manaRegen: 30, castDelay: 0.32, recharge: 0.6,
    baseMod: { damageMul: 1.35 },
  },
  pingpong: {
    id: "pingpong", name: L("ピンポン玉", "Ping-Pong Ball"), desc: L("軽くてよく弾む。技が速くなり、壁で2回はね返る。7スロット", "Light and bouncy. Faster moves that bounce off walls twice. 7 slots"),
    slots: empty(7), manaMax: 70, manaRegen: 32, castDelay: 0.18, recharge: 0.5,
    baseMod: { bounce: 2, speedMul: 1.25 },
  },
  himo: {
    id: "himo", name: L("ただのひも", "Just a String"), desc: L("高いおもちゃより夢中になる。14スロットあるが休みが長い", "More fun than pricey toys. 14 slots, but long Resting"),
    slots: empty(14), manaMax: 100, manaRegen: 26, castDelay: 0.13, recharge: 1.3,
  },
  cap: {
    id: "cap", name: L("ペットボトルのキャップ", "Bottle Cap"), desc: L("床をカシャカシャ滑る。5スロットだけど、やる気の回復がとても速く休みも短い", "Clatters across the floor. Only 5 slots, but very fast Energy regen and short Resting"),
    slots: empty(5), manaMax: 60, manaRegen: 46, castDelay: 0.1, recharge: 0.25,
  },
  longrod: {
    id: "longrod", name: L("ロングじゃらし", "Long Teaser"), desc: L("釣りざおみたいに長い。技が1.4倍遠くまで届き、少し大きい。9スロット", "Long like a fishing rod. Moves reach 1.4x farther and are a bit bigger. 9 slots"),
    slots: empty(9), manaMax: 85, manaRegen: 30, castDelay: 0.22, recharge: 0.7,
    baseMod: { lifeMul: 1.4, sizeMul: 1.1 },
  },
  suzuball: {
    id: "suzuball", name: L("鈴入りボール", "Bell Ball"), desc: L("転がすと鳴りっぱなし。全部のスロットを1回でいっぺんに出す（休みが長い）", "Jingles nonstop when rolled. Casts all slots at once (long Resting)"),
    slots: empty(6), manaMax: 120, manaRegen: 32, castDelay: 0.2, recharge: 1.4, castAll: true,
  },
  kamibukuro: {
    id: "kamibukuro", name: L("紙袋", "Paper Bag"), desc: L("中でじっとしてから飛び出す。止まっているとサブスロットがたまり、いっぺんに出る", "Sit inside, then pounce out. Standing still charges sub slots, which fire all at once"),
    slots: empty(6), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
    sub: { slots: empty(2), charge: "still", need: 1.5 },
  },
  tunnel: {
    id: "tunnel", name: L("猫トンネル", "Cat Tunnel"), desc: L("シャカシャカ鳴るトンネル。ダッシュでくぐるとサブスロットがたまる", "A crinkly tunnel. Dashing through charges sub slots"),
    slots: empty(7), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.6,
    sub: { slots: empty(2), charge: "dash", need: 2 },
  },
  nezumiPlush: {
    id: "nezumiPlush", name: L("ねずみのぬいぐるみ", "Mouse Plush"), desc: L("かじられてボロボロ。技を当てるとサブスロットがたまる。かみつき入り", "Chewed to tatters. Landing hits charges sub slots. Comes with Bite"),
    slots: ["bite", null, null, null, null, null], manaMax: 80, manaRegen: 30, castDelay: 0.22, recharge: 0.6,
    sub: { slots: empty(3), charge: "hit", need: 14 },
  },
  matatabiStick: {
    id: "matatabiStick", name: L("またたびの木", "Silvervine Stick"), desc: L("かじるとごきげん。虫をたおすとサブスロットがたまる", "Chewing it feels great. Defeating bugs charges sub slots"),
    slots: empty(7), manaMax: 85, manaRegen: 30, castDelay: 0.2, recharge: 0.6,
    sub: { slots: empty(2), charge: "kill", need: 4 },
  },
  chiiku: {
    id: "chiiku", name: L("知育ボール", "Treat Puzzle Ball"), desc: L("転がすとおやつが出る。ダメージを受けるとサブスロットがすぐ出て反撃", "Roll it for treats. Taking damage fires sub slots right away to strike back"),
    slots: empty(6), manaMax: 80, manaRegen: 30, castDelay: 0.2, recharge: 0.55,
    sub: { slots: empty(3), charge: "hurt", need: 1 },
  },
  fukubukuro: {
    id: "fukubukuro", name: L("ねこじゃらし福袋", "Cat Teaser Lucky Bag"), desc: L("お正月の福袋にねこじゃらしが10本。16スロット、やる気がたっぷりで休みが長い", "A New Year lucky bag with 10 cat teasers. 16 slots, lots of Energy, long Resting"),
    slots: empty(16), manaMax: 170, manaRegen: 40, castDelay: 0.18, recharge: 1.6,
  },
  // ---- 電池式（持っているだけで自動で動く。持ち替えの3つとは別に2つまで） ----
  denmouse: {
    id: "denmouse", name: L("電動ねずみ", "Robo Mouse"), desc: L("電池で走り回るねずみ。1.4秒ごとに自動で一番近い虫へ。ひっかき入り", "A battery mouse that zooms around. Auto-targets the nearest bug every 1.4s. Comes with Scratch"),
    slots: ["claw", null], manaMax: 50, manaRegen: 20, castDelay: 0.2, recharge: 0.4, auto: 1.4,
  },
  autolaser: {
    id: "autolaser", name: L("自動レーザー", "Auto Laser"), desc: L("置いておくと赤い点がくるくる動く。2.4秒ごとに自動。レーザーポインター入り", "Set it down and the red dot spins around. Auto every 2.4s. Comes with Laser Pointer"),
    slots: ["laser", null], manaMax: 60, manaRegen: 22, castDelay: 0.2, recharge: 0.4, auto: 2.4,
  },
  pichifish: {
    id: "pichifish", name: L("ぴちぴち魚", "Flippy Fish"), desc: L("USBで充電する、ぴちぴち動く魚のぬいぐるみ。1.8秒ごとに自動。猫パンチ入り", "A USB-charged flopping fish plush. Auto every 1.8s. Comes with Paw Flurry"),
    slots: ["punch", null, null], manaMax: 55, manaRegen: 24, castDelay: 0.2, recharge: 0.4, auto: 1.8,
  },
  kurukuru: {
    id: "kurukuru", name: L("電動くるくるじゃらし", "Spinning Teaser"), desc: L("台の上で羽根がくるくる回る。3秒ごとに自動。ぶんぶん入り", "Feathers spin on a stand. Auto every 3s. Comes with Swish"),
    slots: ["swing", null, null], manaMax: 70, manaRegen: 22, castDelay: 0.2, recharge: 0.4, auto: 3,
  },
};

/** 電池式は2つまで（持ち替えのおもちゃとは別）。 */
export const MAX_BATT = 2;

export function starterToy(): ToyDef {
  const t = structuredClone(TOYS.jarashi);
  t.slots = ["claw", "claw", "matatabi", "bite", null, null, null, null];
  return t;
}

/** まとまり（1回で一緒に出る範囲）ごとの合計攻撃力と、使うやる気。 */
export function groupSummary(toy: ToyDef): { start: number; end: number; damage: number; mana: number }[] {
  // 多段は「1匹に当たりきったとき」の合計（置く技は5回ぶんで数える）
  const sum = (shots: Shot[]): number => shots.reduce((a, s) => a + s.stats.damage * Math.min(5, s.stats.hits) + sum(s.payload), 0);
  if (toy.castAll) {
    const r = castAll(toy, Infinity);
    return r.shots.length ? [{ start: 0, end: toy.slots.length, damage: Math.round(sum(r.shots)), mana: r.manaUsed }] : [];
  }
  return castGroups(toy).map(([start, end]) => {
    const r = planCast(toy, start, Infinity);
    return { start, end, damage: Math.round(sum(r.shots)), mana: r.manaUsed };
  });
}

/** おもちゃの説明欄の数値。 */
export function toyStats(t: ToyDef): [string, string][] {
  const out: [string, string][] = [
    [L("スロット", "Slots"), `${t.slots.length}`],
    [L("やる気 最大", "Max Energy"), `${t.manaMax}`],
    [L("やる気 回復", "Energy Regen"), L(`${t.manaRegen}/秒`, `${t.manaRegen}/s`)],
    [L("振る間隔", "Cast Delay"), L(`${t.castDelay}秒`, `${t.castDelay}s`)],
    [L("休けい", "Resting"), L(`${t.recharge}秒`, `${t.recharge}s`)],
  ];
  if (t.baseMod?.homing) out.push([L("性質", "Trait"), L("技が少し追尾", "Moves home in a little")]);
  if (t.baseMod?.bounce) out.push([L("性質", "Trait"), L(`技が${t.baseMod.bounce}回はね返る`, `Moves bounce ${t.baseMod.bounce}x`)]);
  if (t.baseMod?.damageMul) out.push([L("性質", "Trait"), L(`攻撃力×${t.baseMod.damageMul}`, `Damage ×${t.baseMod.damageMul}`)]);
  if (t.baseMod?.lifeMul) out.push([L("性質", "Trait"), L(`とどく距離×${t.baseMod.lifeMul}`, `Range ×${t.baseMod.lifeMul}`)]);
  if (t.castAll) out.push([L("性質", "Trait"), L("全部いっぺんに出す", "Casts everything at once")]);
  if (t.sub) out.push([L("サブスロット", "Sub Slots"), L(`${t.sub.slots.length}つ（${SUB_LABEL[t.sub.charge](t.sub.need)}と発動）`, `${t.sub.slots.length} (fires after: ${SUB_LABEL[t.sub.charge](t.sub.need)})`)]);
  if (t.auto) out.push([L("電池式", "Battery Toy"), L(`${t.auto}秒ごとに自動`, `Auto every ${t.auto}s`)]);
  return out;
}
