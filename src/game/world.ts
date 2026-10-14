// ゲームの状態と1フレームの更新。描画・入力・DOM には依存しない（x,z の2D平面で計算）。
//
// 物語: ママは虫が大の苦手。家に入りこんだ虫を、猫がおもちゃで追い払う。
// 構成: 季節ごとの「章」= 部屋8つ＋ボス。部屋を片付けると出口が2〜3個開き、
// 扉の上のアイコンで「次の部屋をクリアしたときのごほうび」（または特別な部屋）を選んで進む。
import { castAll, MAX_BATT, passiveCost, planCast, starterToy, TOYS, type Shot, type ToyDef } from "../core/wand";
import { MAX_STARS, rarOf, SPELL_IDS, SPELLS, spellDef, starsOf, type Element, type Motion, type ProjectileStats, type TechFx, type TriggerOn } from "../core/spells";
import { CURSE_IDS, CURSES, curseBonus } from "../core/curses";
import { scoreOf } from "../core/score";
import { makeRng, type Rng } from "../core/rng";
import { L, L as tr } from "../i18n"; // tr: 部屋の形を L と呼んでいる関数の中で使う
import { addBonus, GEAR, GEAR_IDS, NO_BONUS, RELIC_IDS, RELICS, rollGear, totalBonus, type Bonus, type Gear, type GearItem, type Rarity } from "../core/items";
import { DEFAULT_RUN, DIFFS, favSlots, metaBonus, type RunOptions } from "../core/meta";
import {
  BOSS_TEMPLATE, buildLayout, Cell, cellAt, cellCenter, cellValue, FINAL_TEMPLATE, OUTDOOR, OUTDOOR_TEMPLATES, SEASON_NAME, SEASONS,
  SHOP_TEMPLATE, TEMPLATES, THEME_NAME, THEMES,
  type Layout, type Season, type Theme,
} from "./stage";

export interface Vec { x: number; z: number }

/**
 * 季節ごとの虫。秋: カメムシ・蚊・クモ／冬: カマドウマ・クモ・ゴキブリ／春: アリ・毛虫・クモ／夏: ゴキブリ・蚊・クモ・アリ。
 * ボスは 秋: カメムシ大王・冬: カマドウマ親分・春: 毛虫の女王・夏: スズメバチ。
 */
export type EnemyType = "roach" | "mosquito" | "spider" | "hornet" | "stinkbug" | "camel" | "ant" | "caterpillar" | "stinkKing" | "camelKing" | "queen" | "mama" | "boy" | "girl" | "shrimp" | "papa";

/** 体力・半径・速さ・飛ぶか・ボスか・名前。 */
export const ENEMY: Record<EnemyType, { hp: number; r: number; speed: number; fly?: boolean; boss?: boolean; kid?: boolean; dummy?: boolean; name: string }> = {
  roach: { hp: 16, r: 0.4, speed: 3.0, name: L("ゴキブリ", "Roach") },
  mosquito: { hp: 9, r: 0.3, speed: 2.8, fly: true, name: L("蚊", "Mosquito") },
  spider: { hp: 14, r: 0.42, speed: 2.2, name: L("クモ", "Spider") },
  stinkbug: { hp: 18, r: 0.42, speed: 1.6, name: L("カメムシ", "Stinkbug") },
  camel: { hp: 14, r: 0.4, speed: 1.0, name: L("カマドウマ", "Cave Cricket") },
  ant: { hp: 6, r: 0.28, speed: 3.4, name: L("アリ", "Ant") },
  caterpillar: { hp: 26, r: 0.45, speed: 1.1, name: L("毛虫", "Caterpillar") },
  hornet: { hp: 380, r: 1.0, speed: 1.2, fly: true, boss: true, name: L("スズメバチ", "Giant Hornet") },
  stinkKing: { hp: 330, r: 1.05, speed: 1.0, boss: true, name: L("カメムシ大王", "Stinkbug King") },
  camelKing: { hp: 340, r: 1.0, speed: 1.0, boss: true, name: L("カマドウマ親分", "Cricket Boss") },
  queen: { hp: 320, r: 1.05, speed: 0.9, boss: true, name: L("毛虫の女王", "Caterpillar Queen") },
  mama: { hp: 1e9, r: 0.7, speed: 1.6, boss: true, name: L("ママ", "Mama") },   // さいご: 倒せない。猫を病院へ連れて行こうと近づいてくる
  // ときどきリビングに来る子どもたち。猫と遊びたくて追いかけてくるが、猫は必死に逃げる。
  // 攻撃は効かない（虫ではない）。つかまると数秒だっこでもみくちゃにされて動けず、♥が減る
  boy: { hp: 1e9, r: 0.5, speed: 2.7, kid: true, name: L("お兄ちゃん（6さい）", "Big Bro (6)") },
  girl: { hp: 1e9, r: 0.45, speed: 1.6, kid: true, name: L("妹（3さい）", "Little Sis (3)") },
  // まれにリビングで寝ころんでいる大好きなパパ（攻撃は当たらない）。お腹でじっとしていると、最大HP・やる気の最大がアップ。たまに猫吸いされて失敗
  papa: { hp: 1e9, r: 0.9, speed: 0, kid: true, name: L("パパ", "Papa") },
  // トレーニング部屋の的。動かず、攻撃もせず、倒れない（受けたダメージを数えるだけ）
  shrimp: { hp: 1e9, r: 0.55, speed: 0, dummy: true, name: L("エビのけりぐるみ", "Shrimp Kicker Toy") },
};
export const isDummy = (t: EnemyType) => !!ENEMY[t].dummy;
export const isKid = (t: EnemyType) => !!ENEMY[t].kid;
/** パパのお腹で寝おわるまでの秒数。 */
export const PAPA_NAP = 2.5;
/** 子どもにだっこされている秒数（お兄ちゃんは短く、妹はなかなか離さない）と、逃げられたあと次に追いかけるまで。 */
const HUG: Partial<Record<EnemyType, number>> = { boy: 2.0, girl: 2.8 };
const REST: Partial<Record<EnemyType, number>> = { boy: 2.5, girl: 3.5 };
/** 子どもの声。 */
const KID_CALL: Partial<Record<EnemyType, string>> = { boy: L("お兄ちゃん「ねこちゃん、あそぼー！」", "Big Bro: \"Kitty, let's play!\""), girl: L("妹「にゃんにゃ、まってー！」", "Little Sis: \"Kitty, wait up!\"") };
const isBoss = (t: EnemyType) => !!ENEMY[t].boss;
const isFly = (t: EnemyType) => !!ENEMY[t].fly;

/** 季節ごとの虫（前ほど序盤から出る）とボス。 */
const SEASON_BUGS: Record<string, { pool: EnemyType[]; boss: EnemyType }> = {
  autumn: { pool: ["stinkbug", "mosquito", "spider"], boss: "stinkKing" },
  winter: { pool: ["camel", "spider", "roach"], boss: "camelKing" },
  spring: { pool: ["ant", "caterpillar", "spider"], boss: "queen" },
  summer: { pool: ["roach", "mosquito", "spider", "ant"], boss: "hornet" },
};

export interface Enemy {
  id: number;
  type: EnemyType;
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  slow: number;
  hurt: number;
  t: number;
  phase: number;
  /** 出現中の残り秒（この間は動かず、当たり判定もない）。 */
  spawn: number;
  /** 属性の残り秒: びしょぬれ・ねばねば・虫よけ。 */
  wet: number;
  sticky: number;
  repel: number;
  repelDps: number;
  repelTick: number;
  /** はじき飛ばされている勢い。 */
  push: Vec;
  /** 強い虫の性質（null はふつうの虫）。 */
  elite: Elite | null;
  /** トレーニングの的・パパ: はじかれても戻ってくる場所。 */
  home?: Vec;
  /** パパ: お腹で寝おわった（1部屋1回）。 */
  napDone?: boolean;
}

/** 強い虫: 体が大きく体力3倍、カリカリをたくさん落とす。性質は1つ。 */
export type Elite = "fast" | "split" | "burst" | "hard";
export const ELITE_INFO: Record<Elite, { name: string; color: string }> = {
  fast: { name: L("すばしこい", "Speedy"), color: "#4dabf7" },
  split: { name: L("分かれる", "Splitting"), color: "#69db7c" },
  burst: { name: L("はじける", "Bursting"), color: "#ff922b" },
  hard: { name: L("かたい", "Tough"), color: "#adb5bd" },
};
const ELITES = Object.keys(ELITE_INFO) as Elite[];

export interface Projectile {
  id: number;
  owner: "player" | "enemy";
  pos: Vec;
  vel: Vec;
  damage: number;
  radius: number;
  life: number;
  pierce: number;
  bounce: number;
  homing: number;
  explode: number;
  slow: number;
  color: string;
  tech: TechFx;
  payload: Shot[];
  motion: Motion;
  hits: number;
  hitEvery: number;
  reach: number;
  element: Element;
  knock: number;
  /** 出てからの秒数と、最初の寿命。 */
  t: number;
  life0: number;
  /** ビーム・衝撃波の起点。 */
  origin: Vec;
  /** 回る技の角度と角速度。 */
  ang: number;
  angVel: number;
  /** 向き（連打・ビームの方向）。 */
  dir: Vec;
  /** 虫ごとの当たった回数と、次に当たれる時刻（多段）。 */
  hitLog: Map<number, { n: number; next: number }>;
  payloadDone: boolean;
  /** 召喚した仲間の次の攻撃までの秒数。 */
  cd: number;
  /** つづけてで出た「回る・連打」の技は、猫ではなく出た場所を中心にする。 */
  anchor: Vec | null;
  /** ひと呼吸: この秒数で payload を出す（0 なら当たったとき）。 */
  payloadAt: number;
  /** payload を出すきっかけと、何度でも の次に出せる時刻。 */
  trig: TriggerOn;
  trigNext: number;
  /** 消えるときに割れる数。 */
  split: number;
}

/** つづけて等で、このあと出す技（off: 扇状・円周にずらす角度、skip: 当たらない虫）。 */
type Spawn = { shot: Shot; pos: Vec; dir: Vec; off?: number; skip?: number[] };

/** 画面を埋め尽くしても重くならないよう、猫の技が同時に出ていられる数。 */
export const MAX_PLAYER_SHOTS = 400;

/** 当たったときの性質（遅れて当たる多段にも使う）。 */
interface HitInfo { slow: number; element: Element; tech: TechFx; color: string; knock: number }

export interface Fx { kind: "hit" | "cast" | "puff" | "tech" | "num" | "zap"; tech?: TechFx; value?: number; pos: Vec; to?: Vec; radius: number; color: string; t: number; life: number }

export interface Player {
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  aim: Vec;
  facing: 1 | -1;
  iframes: number;
  dash: number;
  dashCd: number;
  hurt: number;
  mana: number;
  cursor: number;
  castCd: number;
  recharging: boolean;
  target: number | null;
  /** ねこジャンプの残り秒（見た目用）。 */
  pounce: number;
  /** ダッシュのあと攻撃力が上がっている残り秒。 */
  power: number;
  /** 部屋ごとのバリアの残り回数。 */
  shield: number;
  /** 子どもにだっこされている残り秒と、だっこしている子。 */
  held: number;
  holder: number | null;
  /** 子どもがすぐそばにいて、必死に逃げている。 */
  scared: boolean;
}

/** 持っているおもちゃ。やる気と、次に使うスロットはおもちゃごと（おもちゃを持ち替えても覚えている）。 */
export interface HeldToy { def: ToyDef; mana: number; cursor: number; /** サブスロットのたまり具合 */ charge: number; /** 電池式の次の自動まで */ autoCd: number }
export const MAX_TOYS = 3;
const held = (def: ToyDef, mana: number): HeldToy => ({ def, mana, cursor: 0, charge: 0, autoCd: def.auto ?? 0 });

/** 扉のごほうび。部屋をクリアすると受け取れる。 */
export type RewardKind = "hp" | "mp" | "spell" | "toy" | "relic" | "gear" | "shop" | "boss" | "next"
  | "treasure" | "rest" | "fusion" | "challenge" | "curse";
/** 特別な部屋（虫が出ない部屋と、強い虫の部屋）。 */
export const SPECIAL: RewardKind[] = ["treasure", "rest", "fusion", "challenge", "curse"];
export const REWARD_INFO: Record<RewardKind, { icon: string; label: string; color: string }> = {
  hp: { icon: "♥", label: L("最大HP アップ", "Max HP Up"), color: "#ff5f7e" },
  mp: { icon: "⚡", label: L("やる気 アップ", "Energy Up"), color: "#3fa7ff" },
  spell: { icon: "★", label: L("技・修飾をもらう", "Get a Move/Modifier"), color: "#ffb52e" },
  toy: { icon: "🧸", label: L("おもちゃをもらう", "Get a Toy"), color: "#c77dff" },
  relic: { icon: "◆", label: L("レリックをもらう", "Get a Charm"), color: "#20c997" },
  gear: { icon: "👒", label: L("装備をもらう", "Get Gear"), color: "#f783ac" },
  shop: { icon: "👩", label: L("ママのところ（おねだり・お直し）", "Mama's Repair Corner (beg & fix)"), color: "#fab005" },
  boss: { icon: "☠", label: L("ボス", "Boss"), color: "#e03131" },
  next: { icon: "➜", label: L("次の季節へ", "Next Season"), color: "#2f9e44" },
  treasure: { icon: "🎁", label: L("宝箱の部屋（虫なし）", "Treasure Room (no bugs)"), color: "#f59f00" },
  rest: { icon: "🛋", label: L("ママのおひざ（虫なし・全回復）", "Mama's Lap (no bugs, full heal)"), color: "#ff8787" },
  fusion: { icon: "🐾", label: L("秘密の隠し場所（虫なし）", "Secret Stash (no bugs)"), color: "#7048e8" },
  challenge: { icon: "‼", label: L("強い虫の部屋（ごほうび2倍）", "Elite Bug Room (2x rewards)"), color: "#c92a2a" },
  curse: { icon: "☁", label: L("あやしい箱（呪いと引きかえ）", "Suspicious Box (for a curse)"), color: "#5f3dc4" },
};
/** 特別な部屋の置き物。 */
export type AltarKind = "treasure" | "rest" | "fusion" | "curse" | "kotatsu";
export const ALTAR_NAME: Record<AltarKind, string> = { treasure: L("宝箱", "Treasure Chest"), rest: L("ママのおひざ", "Mama's Lap"), fusion: L("秘密の隠し場所", "Secret Stash"), curse: L("あやしい箱", "Suspicious Box"), kotatsu: L("猫こたつ", "Cat Kotatsu") };

/** 持ち物画面の置き場所。 */
export interface Spot { where: "slot" | "sub" | "bag"; i: number }

export interface Door { slot: number; pos: Vec; dir: "up" | "down" | "left" | "right"; reward: RewardKind }

export interface Room {
  act: number; // 0..3（季節）
  index: number; // 章の中で 0..ROOMS_PER_ACT（最後がボス）
  season: Season;
  theme: Theme;
  kind: "combat" | "boss" | "shop" | "final" | "special";
  layout: Layout;
  w: number; // 半幅（カメラ用）
  d: number;
  waves: EnemyType[][];
  wave: number;
  cleared: boolean;
  /** この部屋をクリアしたときのごほうび（入ってきた扉で決まる）。 */
  reward: RewardKind | null;
  doors: Door[];
  /** 特別な部屋の置き物（近づくと使える）。 */
  altar: { kind: AltarKind; pos: Vec; used: boolean; away: boolean } | null;
  /** 強い虫の部屋。 */
  challenge: boolean;
  /** この部屋に遊びに来る子ども・パパ。 */
  kids: EnemyType[];
  papa: boolean;
}

export type Phase = "intro" | "play" | "reward" | "shop" | "bench" | "train" | "dead" | "win";

/** 落ちているカリカリ（お金）。 */
export interface Pickup { id: number; pos: Vec; value: number; t: number }

/** ママのところの品物（カリカリと交換で技とおやつをもらい、ほかのも見せてもらえる。売れない）。 */
export interface ShopItem { kind: "spell" | "potion"; id: string; price: number; sold: boolean }
export const POTIONS: Record<string, { name: string; desc: string; price: number }> = {
  milk: { name: L("猫用ミルク", "Cat Milk"), desc: L("♥1 回復", "Heal ♥1"), price: 6 },
  churu: { name: L("ちゅ〜る", "Churu Treat"), desc: L("♥ぜんぶ回復", "Heal all ♥"), price: 16 },
  goldNiboshi: { name: L("金のにぼし", "Golden Sardine"), desc: L("持っているカリカリが1.25倍（最低＋3）", "Kibble you hold ×1.25 (min +3)"), price: 6 },
};

export type Choice = { kind: "spell" | "toy" | "relic" | "gear"; id: string; gear?: GearItem }
  | { kind: "pact"; id: string; reward: Choice & { kind: "spell" | "relic" | "gear" }; coins: number };

export interface Input {
  move: Vec;
  /** 狙う方向（null なら一番近い虫を自動で狙う）。 */
  aim: Vec | null;
  fire: boolean;
  dash: boolean;
}

export const ROOMS_PER_ACT = 8; // ＋ボス

/**
 * 途中セーブ（部屋に入るたびに自動）。部屋に入る直前の状態と乱数を覚えておき、再開するとその部屋の入口からやり直す。
 * 部屋の中の虫や弾までは保存しない（同じ乱数で同じ部屋が作り直される）。
 */
export interface SaveData {
  v: 1;
  seed: number;
  rng: number;
  at: { final: true } | { final: false; act: number; index: number; reward: RewardKind | null };
  opts: RunOptions;
  toys: HeldToy[];
  cur: number;
  batt: HeldToy[];
  bag: string[];
  relics: string[];
  gear: Gear;
  curses: string[];
  coins: number;
  hp: number;
  baseMaxHp: number;
  manaUp: { max: number; regen: number };
  usedThemes: Theme[];
  stats: { kills: number; elites: number; specials: number; cleared: number; bosses: number };
  nextId: number;
  time: number;
}
export const ACTS = SEASONS.length;
/** 季節が進むほど強くなる計算に使う上限（エンドレスで何年目になっても、弾が出っぱなし等にならない）。 */
const capAct = (act: number, max: number) => Math.min(act, max);

export class World {
  rng: Rng;
  time = 0;
  phase: Phase = "intro";
  player: Player;
  /** 持っているおもちゃ（最大3つ）と、今使っているもの。 */
  toys: HeldToy[];
  cur = 0;
  /** 電池式のおもちゃ（自動で動く。2つまで）。 */
  batt: HeldToy[] = [];
  /** 受けている呪い。 */
  curses: string[] = [];
  /** この冒険の記録（解放に使う）。 */
  kills = 0;
  elites = 0;
  specials = 0;
  /** まだ解放していないもの。 */
  private locked: Set<string>;
  bag: string[] = [];
  relics: string[] = [];
  gear: Gear = { hat: null, body: null, collar: null };
  /** レリックと装備の効果の合計。 */
  bonus: Bonus = NO_BONUS;
  /** ごほうびで上がった分（新しいおもちゃにも引き継ぐ）。 */
  private manaUp = { max: 0, regen: 0 };
  private baseMaxHp = 6;
  /** 難易度・ねこの成長。 */
  opts: RunOptions;
  /** この冒険で片付けた部屋・倒したボスの数（にぼしの計算）。 */
  cleared = 0;
  bosses = 0;
  enemies: Enemy[] = [];
  /** カリカリ（この冒険のお金）と、落ちているもの。 */
  coins = 0;
  pickups: Pickup[] = [];
  /** お店の品ぞろえ。 */
  shop: { items: ShopItem[]; rerollCost: number; pos: Vec; away: boolean } | null = null;
  /** さいごの部屋の経過秒（ママがだんだん速くなる）。 */
  finalT = 0;
  projectiles: Projectile[] = [];
  fx: Fx[] = [];
  room!: Room;
  choices: Choice[] = [];
  doorOpen = false;
  events: string[] = [];
  /** 一度だけ出す短いお知らせ（「最大HP +1」など）。 */
  toast: { text: string; t: number } | null = null;
  private nextId = 1;
  private usedThemes: Theme[] = [];
  /** 虫が猫へ向かう道順（地面用・飛ぶ虫用）。猫のいるマスが変わったら作り直す。 */
  private flow: { ground: Int16Array; air: Int16Array; key: number } | null = null;

  /** 部屋に入るたびに更新される途中セーブと、その番号（変わったら保存し直す）。 */
  checkpoint: SaveData | null = null;
  saveNo = 0;
  private seed: number;

  constructor(seed = 1, opts: RunOptions = DEFAULT_RUN) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.opts = opts;
    this.locked = new Set(opts.locked ?? []);
    const first = starterToy();
    this.toys = [held(first, first.manaMax)];
    this.bag = ["swing", "water", "static", ...(opts.favorites ?? []).slice(0, favSlots(opts.meta))];   // おきにいりは最初から手持ちに
    this.player = {
      pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, hp: 6, maxHp: 6, radius: 0.32,
      aim: { x: 1, z: 0 }, facing: 1, iframes: 0, dash: 0, dashCd: 0, hurt: 0,
      mana: first.manaMax, cursor: 0, castCd: 0, recharging: false, target: null, pounce: 0, power: 0, shield: 0, held: 0, holder: null, scared: false,
    };
    // 難易度と、ねこの成長（にぼしで買った永続強化）
    this.baseMaxHp = DIFFS[opts.difficulty].startHp;
    if (opts.meta.gift) this.relics.push(this.rng.pick(RELIC_IDS));
    this.recalc();
    this.player.hp = this.player.maxHp; this.player.mana = this.manaMax;
    this.enterRoom(0, 0, null);
  }

  start() { if (this.phase === "intro") this.phase = "play"; }

  /** 部屋に入る直前の状態を途中セーブとして覚える。 */
  private capture(at: SaveData["at"]) {
    const p = this.player;
    this.checkpoint = structuredClone({
      v: 1 as const, seed: this.seed, rng: this.rng.state(), at, opts: this.opts,
      toys: this.toys.map((h, i) => (i === this.cur ? { ...h, mana: p.mana, cursor: p.cursor } : h)), cur: this.cur, batt: this.batt,
      bag: this.bag, relics: this.relics, gear: this.gear, curses: this.curses, coins: this.coins, hp: p.hp,
      baseMaxHp: this.baseMaxHp, manaUp: this.manaUp, usedThemes: this.usedThemes,
      stats: { kills: this.kills, elites: this.elites, specials: this.specials, cleared: this.cleared, bosses: this.bosses },
      nextId: this.nextId, time: this.time,
    });
    this.saveNo++;
  }

  /** 途中セーブから再開する（その部屋の入口から）。 */
  static load(d: SaveData): World {
    const w = new World(d.seed, d.opts);
    w.toys = d.toys; w.cur = Math.min(d.cur, d.toys.length - 1); w.batt = d.batt; w.bag = d.bag; w.relics = d.relics; w.gear = d.gear;
    w.curses = d.curses; w.coins = d.coins; w.baseMaxHp = d.baseMaxHp; w.manaUp = d.manaUp; w.usedThemes = d.usedThemes;
    Object.assign(w, d.stats);
    w.nextId = d.nextId; w.time = d.time;
    w.recalc();
    const p = w.player, h = w.toys[w.cur];
    p.hp = Math.min(d.hp, p.maxHp); p.mana = h.mana; p.cursor = h.cursor;
    w.rng.setState(d.rng);
    if (d.at.final) w.enterFinal(); else w.enterRoom(d.at.act, d.at.index, d.at.reward);
    return w;
  }

  /** 今使っているおもちゃ。 */
  get toy(): ToyDef { return this.toys[this.cur].def; }
  /** やる気の最大（おもちゃ＋レリック・装備）。 */
  manaMaxOf(t: ToyDef) { return Math.max(10, t.manaMax + this.bonus.manaMax - passiveCost(t)); }
  /** 持ち替えのおもちゃと電池式（持ち物画面のタブの順）。 */
  get held(): HeldToy[] { return [...this.toys, ...this.batt]; }
  /** まだ解放していないか。 */
  isLocked(kind: "spell" | "toy" | "relic", id: string) { return this.locked.has(`${kind}:${id}`); }
  get manaMax() { return this.manaMaxOf(this.toy); }

  /** おもちゃを持ち替える（やる気・次のスロットはおもちゃごとに覚えておく）。 */
  switchToy(i: number) {
    if (i === this.cur || i < 0 || i >= this.toys.length || this.phase !== "play") return;
    const p = this.player, now = this.toys[this.cur];
    now.mana = p.mana; now.cursor = p.cursor;
    this.cur = i;
    p.mana = this.toys[i].mana; p.cursor = this.toys[i].cursor;
    p.castCd = Math.max(p.castCd, 0.15); p.recharging = false;
    this.events.push("switch");
  }

  /** レリック・装備を変えたら効果を計算し直す。 */
  private recalc() {
    this.bonus = totalBonus(this.relics, this.gear, metaBonus(this.opts.meta));
    for (const c of curseBonus(this.curses)) this.bonus = addBonus(this.bonus, c);
    const p = this.player, before = p.maxHp;
    p.maxHp = this.baseMaxHp + this.bonus.maxHp;
    p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - before));
    p.mana = Math.min(p.mana, this.manaMax);
  }

  get title() {
    const r = this.room;
    if (r.kind === "final") return L("さいご・ママ", "Final · Mama");
    if (this.opts.training) return L("トレーニング部屋", "Training Room");
    // エンドレスは2年目から「2年目の秋」のように
    const S = L(`${this.opts.endless && r.act >= ACTS ? `${Math.floor(r.act / ACTS) + 1}年目の` : ""}${SEASON_NAME[r.season]}`,
      `${this.opts.endless && r.act >= ACTS ? `Year ${Math.floor(r.act / ACTS) + 1} ` : ""}${SEASON_NAME[r.season]}`);
    if (r.kind === "shop") return L(`${S}・ママのところ`, `${S} · Mama's Repair Corner`);
    if (r.altar) return L(`${S}・${ALTAR_NAME[r.altar.kind]} ${r.index + 1}/${ROOMS_PER_ACT}`, `${S} · ${ALTAR_NAME[r.altar.kind]} ${r.index + 1}/${ROOMS_PER_ACT}`);
    if (r.challenge) return L(`${S}・強い虫の部屋 ${r.index + 1}/${ROOMS_PER_ACT}`, `${S} · Elite Bug Room ${r.index + 1}/${ROOMS_PER_ACT}`);
    return L(`${S}・${r.kind === "boss" ? "ボス" : `${THEME_NAME[r.theme]} ${r.index + 1}/${ROOMS_PER_ACT}`}`,
      `${S} · ${r.kind === "boss" ? "Boss" : `${THEME_NAME[r.theme]} ${r.index + 1}/${ROOMS_PER_ACT}`}`);
  }

  /** エンドレスモードのポイント。 */
  /** 広告を見て1回だけ復活できるか（公開先が広告に対応しているときだけ外から true にする）。 */
  reviveOk = false;
  /** 冒険がほんとうに終わった（守りきった、またはやられて復活もしない）。 */
  get over() { return this.phase === "win" || (this.phase === "dead" && !this.reviveOk); }
  /** 復活: HP満タン・少し無敵・まわりの虫をはじき、虫の弾を消す。 */
  revive() {
    if (this.phase !== "dead" || !this.reviveOk) return;
    const p = this.player;
    this.reviveOk = false; p.hp = p.maxHp; p.iframes = 2.5; p.held = 0; p.holder = null; p.vel = { x: 0, z: 0 };
    for (const e of this.enemies) {
      const d = dist(e.pos, p.pos);
      if (d < 3.5 && !isKid(e.type) && !isDummy(e.type)) { const k = norm({ x: e.pos.x - p.pos.x, z: e.pos.z - p.pos.z }), f = isBoss(e.type) ? 2 : 8; e.push.x += k.x * f; e.push.z += k.z * f; }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.owner !== "enemy");
    this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 3.5, color: "#ffd43b", t: 0, life: 0.5 });
    this.phase = "play"; this.notify(L("復活！もうひとがんばり", "Revived! One more try!"));
  }
  get score() { return scoreOf({ rooms: this.cleared, bosses: this.bosses, elites: this.elites, kills: this.kills }); }

  // ---------- 部屋 ----------
  enterRoom(act: number, index: number, reward: RewardKind | null) {
    this.capture({ final: false, act, index, reward });
    const boss = index === ROOMS_PER_ACT;
    const season = SEASONS[act % ACTS];   // エンドレスは季節がめぐる
    if (index === 0) this.usedThemes = [];
    const shop = reward === "shop";
    const altar: AltarKind | null = reward === "treasure" || reward === "rest" || reward === "fusion" || reward === "curse" ? reward : null;
    const challenge = reward === "challenge";
    if (altar || challenge) this.specials++;
    let theme: Theme;
    if (boss) theme = "garden";
    else if (shop) theme = "living";   // ママはリビングにいる
    else {
      // 毎章どこかでお庭（外）を通る。それ以外は家の中も外もまぜて、同じ部屋は続けない
      const pool = index === 2 || index === 5 ? OUTDOOR : THEMES;
      const left = pool.filter((t) => !this.usedThemes.includes(t));
      theme = this.rng.pick(left.length ? left : pool);
      this.usedThemes.push(theme);
    }
    // 出口の数: 2〜3（ボス直前は1つ＝ボス）
    const slots = [1, 2, 3].sort(() => this.rng.next() - 0.5);
    const doorSlots = boss ? [1] : index === ROOMS_PER_ACT - 1 ? [slots[0]] : slots.slice(0, this.rng.next() < 0.5 ? 2 : 3);
    const quiet = shop || !!altar;   // 虫の出ない部屋
    const outside = OUTDOOR.includes(theme) && !boss && !quiet && this.rng.next() < 0.6;
    const tplSet = outside ? OUTDOOR_TEMPLATES : TEMPLATES;
    const tpl = quiet ? SHOP_TEMPLATE : boss ? BOSS_TEMPLATE : tplSet[this.rng.pick(Object.keys(tplSet))];
    const layout = buildLayout(tpl, theme, this.rng, { flipX: false, flipY: !boss && !quiet && this.rng.next() < 0.5, doors: doorSlots });

    // 敵の組み合わせ（章が進むほど多く・強く）
    const bugs = SEASON_BUGS[season], D = DIFFS[this.opts.difficulty];
    const pool = bugs.pool.slice(0, index === 0 ? (act === 0 ? 1 : 2) : index === 1 ? 2 : bugs.pool.length);
    const waveCount = quiet ? 0 : boss ? 1 : index < 2 && act === 0 ? 1 : 2;
    const per = Math.max(2, 3 + Math.floor(index * 0.5) + act + D.extra + (this.curses.includes("mure") ? 1 : 0) - (challenge ? 2 : 0));
    const waves: EnemyType[][] = boss
      ? [[bugs.boss]]
      : Array.from({ length: waveCount }, () => {
        const w: EnemyType[] = Array.from({ length: per }, () => this.rng.pick(pool));
        return w.flatMap((t) => (t === "ant" ? [t, t] : [t]));   // アリは群れで来る
      });
    // 虫の大群: 季節が進むと、弱い虫が20匹以上で押し寄せる波がまざる（連鎖で一掃する気持ちよさ）
    if (!boss && !quiet && waves.length && (act >= 1 || index >= 4) && index >= 2 && this.rng.next() < Math.min(0.6, 0.3 + act * 0.08)) {
      const weak = bugs.pool.reduce((a, b) => (ENEMY[a].hp <= ENEMY[b].hp ? a : b));
      const n = Math.min(30, Math.round((90 + capAct(act, 6) * 40) / ENEMY[weak].hp));
      waves[waves.length - 1] = Array.from({ length: Math.max(14, n) }, () => weak);
    }

    // 次の扉のごほうび（重ならないように）。ときどき特別な部屋、章の真ん中では必ずお店を1つ
    const kinds: RewardKind[] = quiet ? ["hp", "mp", "spell", "toy", "relic", "gear"] : ["hp", "mp", "spell", "spell", "toy", "relic", "gear", "shop"];
    const used = new Set<RewardKind>();
    const doors: Door[] = layout.exits.map((e, n) => {
      let k: RewardKind;
      if (boss) k = "next";
      else if (index === ROOMS_PER_ACT - 1) k = "boss";
      else if (n === 0 && index === 3 && !shop) k = "shop";
      else if (n === 1 && index >= 1 && this.rng.next() < 0.55) k = this.rng.pick(SPECIAL.filter((x) => x !== reward));
      else { do k = this.rng.pick(kinds); while (used.has(k) && used.size < 4); }
      used.add(k);
      return { slot: e.slot, pos: cellCenter(layout, e.c, e.r), dir: e.dir, reward: k };
    });

    const mid = cellCenter(layout, layout.cols >> 1, layout.rows >> 1);
    this.room = {
      act, index, season, theme, kind: boss ? "boss" : altar ? "special" : "combat", layout,
      w: layout.cols / 2, d: layout.rows / 2, waves, wave: 0, cleared: false, reward: quiet ? null : challenge ? "relic" : reward, doors,
      altar: altar ? { kind: altar, pos: mid, used: false, away: true } : null, challenge,
      // まれにリビングへ子どもが来る（2人いっしょが多い）
      kids: theme === "living" && !boss && !quiet && this.rng.next() < 0.3 ? (this.rng.next() < 0.6 ? ["boy", "girl"] : [this.rng.pick<EnemyType>(["boy", "girl"])]) : [],
      papa: theme === "living" && !boss && !quiet && this.rng.next() < 0.18,   // まれにパパが寝ころんでいる
    };
    if (shop) {
      this.room.kind = "shop";
      this.shop = { items: this.stock(), rerollCost: 3, pos: mid, away: true };
    } else this.shop = null;
    this.pickups = [];
    this.enemies = []; this.projectiles = []; this.doorOpen = false; this.flow = null;
    this.player.pos = cellCenter(layout, layout.entry.c, layout.entry.r);
    this.player.shield = this.bonus.shield;
    this.player.vel = { x: 0, z: 0 }; this.player.held = 0; this.player.holder = null;
    this.toast = null;
    this.spawnWave();
    for (const [k, t] of this.room.kids.entries()) {   // 子どもは入口から遠い所で遊んでいる
      const e = makeEnemy(this.nextId++, t, cellCenter(layout, layout.cols - 4 - k * 2, (layout.rows >> 1) + (k ? 2 : -2)), 0, 1);
      e.spawn = 1.2; e.phase = 2.5; this.enemies.push(e);
    }
    if (this.room.papa) {
      const pos = openFloor(layout, cellCenter(layout, layout.cols >> 1, (layout.rows >> 1) + 2));
      const e = makeEnemy(this.nextId++, "papa", pos, 0, 1); e.home = { ...pos }; this.enemies.push(e);
    }
    if (this.room.papa && !this.room.kids.length) this.notify(L("パパがリビングで寝ころんでいる！お腹の上でじっとしてみよう", "Papa is lying in the living room! Try sitting still on his belly"));
    if (this.room.kids.length) this.notify(this.room.kids.length > 1 ? L("子どもたちが猫と遊びたがっている！にげて！", "The kids want to play with the cat! Run!") : L(`${KID_CALL[this.room.kids[0]]} にげて！`, `${KID_CALL[this.room.kids[0]]} Run!`));
  }

  // ---------- トレーニング部屋 ----------
  /** 的が受けたダメージの記録（DPS の計算）と、やる気むげん。 */
  trainLog: { t: number; d: number }[] = [];
  trainInfMana = false;
  trainMulti = false;

  /** トレーニング部屋に入る（multi: けりぐるみをたくさん並べる）。猫こたつで技を編集できる。 */
  enterTraining(multi: boolean) {
    this.trainMulti = multi;
    const layout = buildLayout(SHOP_TEMPLATE, "living", this.rng, { doors: [] });
    const mid = cellCenter(layout, layout.cols >> 1, layout.rows >> 1);
    this.room = {
      act: 0, index: 0, season: "autumn", theme: "living", kind: "special", layout,
      w: layout.cols / 2, d: layout.rows / 2, waves: [], wave: 0, cleared: true, reward: null, doors: [],
      altar: { kind: "kotatsu", pos: openFloor(layout, cellCenter(layout, layout.entry.c + 3, (layout.rows >> 1) + 3)), used: false, away: true }, challenge: false, kids: [], papa: false,
    };
    this.shop = null; this.pickups = []; this.projectiles = []; this.doorOpen = false; this.flow = null; this.toast = null;
    this.enemies = [];
    const spots = multi ? [[4, 0], [6, -2], [6, 2], [8, 0], [8, -3.5], [8, 3.5], [10, -1.5], [10, 1.5]] : [[6, 0]];
    for (const [dx, dz] of spots) {
      const pos = openFloor(layout, { x: mid.x + dx - 3, z: mid.z + dz });   // 家具の上には置かない
      const e = makeEnemy(this.nextId++, "shrimp", pos, 0, 1); e.home = { ...pos }; this.enemies.push(e);
    }
    this.player.pos = cellCenter(layout, layout.entry.c, layout.entry.r); this.player.vel = { x: 0, z: 0 };
    this.trainLog = [];
  }

  /** DPS（直近5秒）・合計・いちばん大きい1回。 */
  get trainStats() {
    const now = this.time, recent = this.trainLog.filter((h) => now - h.t <= 5);
    const span = recent.length ? Math.max(1, Math.min(5, now - recent[0].t)) : 1;
    return { dps: recent.reduce((a, h) => a + h.d, 0) / span, total: this.trainLog.reduce((a, h) => a + h.d, 0), max: this.trainLog.reduce((a, h) => Math.max(a, h.d), 0) };
  }

  /** トレーニング: 持つおもちゃを選ぶ（電池式は電池の枠に）。最初から入っている技はそのまま。 */
  trainToy(id: string) {
    const t = structuredClone(TOYS[id]);
    if (t.auto) { this.batt = [held(t, t.manaMax)]; return; }
    this.toys = [held(t, t.manaMax)]; this.cur = 0;
    this.player.mana = t.manaMax; this.player.cursor = 0; this.player.castCd = 0.2;
  }

  /** トレーニング: スロットに技を置く（null で外す）。h は held の番号。 */
  trainSet(h: number, where: "slot" | "sub", i: number, id: string | null) {
    const def = this.held[h]?.def, arr = where === "slot" ? def?.slots : def?.sub?.slots;
    if (!arr || i >= arr.length) return;
    arr[i] = id; this.held[h].cursor = 0; if (h === this.cur) this.player.cursor = 0;
    this.player.mana = Math.min(this.player.mana, this.manaMax);
  }

  /** 強い虫になる確率（季節・部屋が進むほど、呪いで上がる）。 */
  private eliteChance() {
    const r = this.room;
    if (r.kind === "boss" || (r.act === 0 && r.index < 2)) return 0;
    return Math.min(0.6, 0.08 + r.act * 0.06 + r.index * 0.01 + (this.curses.includes("tsuyoi") ? 0.25 : 0));
  }

  private spawnWave() {
    const r = this.room, L = r.layout;
    if (!r.waves[r.wave]) return;
    const floors: Vec[] = [];
    for (let rr = 1; rr < L.rows - 1; rr++) for (let c = 1; c < L.cols - 1; c++) if (cellValue(L, c, rr) === Cell.Floor) floors.push(cellCenter(L, c, rr));
    const far = floors.filter((p) => dist(p, this.player.pos) > 7);
    // 強い虫: 強い虫の部屋は半分、ふつうの部屋はときどき1匹
    const wave = r.waves[r.wave];
    if (wave.length >= 14) this.notify(tr(`${ENEMY[wave[0]].name}の大群だ！`, `A swarm of ${ENEMY[wave[0]].name}!`));
    const elite = new Set<number>();
    if (r.challenge) wave.forEach((_, k) => { if (k % 2 === 0) elite.add(k); });
    else if (this.rng.next() < this.eliteChance()) elite.add(Math.floor(this.rng.next() * wave.length));
    wave.forEach((type, k) => {
      const pos = isBoss(type) ? cellCenter(L, L.cols - 5, L.rows >> 1) : this.rng.pick(far.length ? far : floors);
      const e = this.makeEnemy(type, pos, elite.has(k) && type !== "ant" ? this.rng.pick(ELITES) : null);
      e.spawn = 1.0 + k * 0.25;
      this.enemies.push(e);
    });
  }

  /** 虫を作る（難易度・季節・呪い・強い虫）。 */
  private makeEnemy(type: EnemyType, pos: Vec, elite: Elite | null = null): Enemy {
    const e = makeEnemy(this.nextId++, type, pos, this.room?.act ?? 0, this.opts.difficulty);
    if (this.curses.includes("katai")) { e.hp = e.maxHp = Math.round(e.maxHp * 1.25); }
    if (this.curses.includes("sekkachi")) e.speed *= 1.12;
    if (elite) {
      e.elite = elite;
      e.hp = e.maxHp = Math.round(e.maxHp * (elite === "hard" ? 4.5 : 3));
      e.radius *= 1.3;
      if (elite === "fast") e.speed *= 1.5;
    }
    return e;
  }

  // ---------- 1フレーム ----------
  update(dt: number, input: Input) {
    this.events = [];
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.phase !== "play") { this.updateFx(dt); return; }
    this.time += dt;
    this.updatePlayer(dt, input);
    this.updateFlow();
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.updatePickups(dt);
    if (this.opts.training && this.trainInfMana) { this.player.mana = this.manaMax; for (const h of this.batt) h.mana = this.manaMaxOf(h.def); }
    if (this.room.kind === "final") this.finalT += dt;
    // ママのところ: ママに近づくとお店が開く（離れてからまた近づくと再び開く）
    const sh = this.shop;
    if (sh && this.phase === "play") {
      const d = dist(this.player.pos, sh.pos);
      if (d < 1.4 && sh.away) { sh.away = false; this.phase = "shop"; this.events.push("shop"); }
      else if (d > 2.2) sh.away = true;
    }
    const al = this.room.altar;
    if (al && this.phase === "play") {
      const d = dist(this.player.pos, al.pos);
      if (d < 1.3 && al.away) { al.away = false; this.useAltar(); }
      else if (d > 2.2) al.away = true;
    }
    this.checkRoom();
  }

  /** カリカリ: 近くにあると猫に吸い寄せられる。 */
  private updatePickups(dt: number) {
    const p = this.player;
    this.pickups = this.pickups.filter((c) => {
      c.t += dt;
      const d = dist(c.pos, p.pos);
      if (d < 0.5) { this.coins += c.value; this.events.push("coin"); return false; }
      if (d < 2.8 && c.t > 0.3) { const k = Math.min(1, (9 * dt) / d); c.pos.x += (p.pos.x - c.pos.x) * k; c.pos.z += (p.pos.z - c.pos.z) * k; }
      return true;
    });
  }

  /** 一番近い（出現済みの）虫。 */
  nearestEnemy(pos: Vec, maxD = Infinity) {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) { if (e.spawn > 0 || isKid(e.type)) continue; const d = dist(e.pos, pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  private updatePlayer(dt: number, input: Input) {
    const p = this.player, toy = this.toy;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.pounce = Math.max(0, p.pounce - dt);
    p.power = Math.max(0, p.power - dt);
    const B = this.bonus, still = Math.hypot(input.move.x, input.move.z) < 0.1 ? 1 + B.stillRegen : 1;
    const moving = Math.hypot(input.move.x, input.move.z) >= 0.1 ? B.moveMana : 0;
    p.mana = Math.min(this.manaMax, p.mana + (toy.manaRegen * B.regenMul * still + moving) * dt);
    // 持っているだけのおもちゃも、やる気は戻る
    this.toys.forEach((h, i) => { if (i !== this.cur) h.mana = Math.min(this.manaMaxOf(h.def), h.mana + h.def.manaRegen * B.regenMul * dt); });
    if (Math.hypot(input.move.x, input.move.z) < 0.1 && p.dash <= 0) this.chargeSub("still", dt);
    this.updateBattery(dt);

    // 子どもにだっこされている間は動けない（ダッシュを押すとじたばたして早く抜け出せる）
    if (p.held > 0) {
      const k = this.enemies.find((e) => e.id === p.holder);
      p.held -= dt * (input.dash ? 2.5 : 1);
      if (k) p.pos = { x: k.pos.x, z: k.pos.z + 0.1 };   // 子どもの腕の中（手前）
      p.vel = { x: 0, z: 0 };
      if (p.held <= 0 || !k) {
        p.held = 0; p.holder = null; p.iframes = Math.max(p.iframes, 1.2);
        if (k && k.type === "papa") { p.pos = { x: k.pos.x + 1.4, z: k.pos.z }; }   // パパはやさしくおろしてくれる
        else if (k) { k.phase = REST[k.type] ?? 3; p.pos = { ...k.pos }; p.vel = { x: p.facing * 7, z: 0 }; this.notify(L("にげた！", "Escaped!")); }
      }
      return;
    }

    let mv = input.move;
    const len = Math.hypot(mv.x, mv.z);
    if (len > 1) mv = { x: mv.x / len, z: mv.z / len };
    if (input.dash && p.dashCd <= 0) {
      const dir = len > 0.1 ? norm(mv) : { x: p.facing, z: 0 };
      p.dash = 0.18; p.dashCd = 0.7 * B.dashCdMul; p.iframes = Math.max(p.iframes, 0.3);
      if (B.dashPower) p.power = B.dashPower;
      p.vel = { x: dir.x * 13, z: dir.z * 13 };
      this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 0.5, color: "#ffffff", t: 0, life: 0.35 });
      this.chargeSub("dash", 1);
    }
    // 子どもがそばに来ると、必死に逃げる（少し速くなる）
    p.scared = this.enemies.some((e) => isKid(e.type) && e.type !== "papa" && e.spawn <= 0 && e.phase <= 0 && dist(e.pos, p.pos) < 3.2);
    const speed = p.dash > 0 ? 13 : 5.2 * B.speedMul * (p.scared ? 1.15 : 1);
    p.dash = Math.max(0, p.dash - dt);
    if (p.dash <= 0) {
      const k = Math.min(1, dt * 14);
      p.vel.x += (mv.x * speed - p.vel.x) * k; p.vel.z += (mv.z * speed - p.vel.z) * k;
    }
    this.moveCircle(p.pos, p.vel, p.radius, dt, false, true);

    // 狙い: 指定があればその方向、なければ一番近い虫
    const t = this.nearestEnemy(p.pos, 16);
    p.target = input.aim ? null : t?.id ?? null;
    if (input.aim && Math.hypot(input.aim.x, input.aim.z) > 0.01) p.aim = norm(input.aim);
    else if (t) p.aim = norm({ x: t.pos.x - p.pos.x, z: t.pos.z - p.pos.z });
    else if (len > 0.1) p.aim = norm(mv);
    // 向き: 攻撃中は狙う方向、それ以外は歩く方向（小さな揺れで反転しないよう、はっきり横向きのときだけ）
    const look = input.fire ? p.aim.x : mv.x;
    if (Math.abs(look) > 0.35) p.facing = look > 0 ? 1 : -1;

    // おもちゃを振る
    p.castCd -= dt;
    if (p.castCd <= 0 && p.recharging) p.recharging = false;
    if (this.room.kind === "final") {   // さいごは肉球ペシペシだけ
      if (input.fire && p.castCd <= 0) { this.fire({ stats: { ...SPELLS.punch.projectile!, damage: 0 }, payload: [] }, p.pos, p.aim, "player"); p.castCd = 0.3; this.events.push("cast"); }
    } else if (input.fire && p.castCd <= 0) {
      // 鈴入りボールは全部いっぺんに出す
      const budget = p.mana / B.manaCostMul;   // 自動給餌器: 消費が少ない
      const res = toy.castAll ? { ...castAll(toy, budget), nextCursor: 0, wrapped: true, fizzled: false } : planCast(toy, p.cursor, budget);
      if (res.shots.length) {
        p.mana = Math.min(this.manaMax, p.mana - res.manaUsed * B.manaCostMul);   // ちゅ〜る休憩は戻る
        const extra = B.extraShot > 0 && this.rng.next() < B.extraShot;
        this.fireShots(extra ? [...res.shots, ...res.shots] : res.shots, p.aim);   // もう1発（少しずらして）
        p.cursor = res.nextCursor;
        // 振る間隔・休けい（まっしぐら・キャットウォークで短く）
        p.castCd = res.wrapped ? Math.max(0.08, (toy.recharge + res.rechargeAdd) * B.castMul) : Math.max(0.05, (toy.castDelay + res.delayAdd) * B.castMul);
        p.recharging = res.wrapped;
        this.events.push("cast");
      } else if (res.fizzled) {
        p.castCd = 0.1;
      } else {
        p.cursor = 0; p.castCd = toy.recharge; p.recharging = true;
      }
    }

    // 開いた扉に入ったら次の部屋へ
    if (this.doorOpen) for (const d of this.room.doors) if (dist(p.pos, d.pos) < 0.7) { this.goThrough(d); break; }
  }

  // ---------- ママのところ（おねだり・お直し） ----------
  /** 技の値段（修飾は少し安い。★は高い）。 */
  static price(id: string) { const d = spellDef(id); return Math.round((d.kind === "attack" ? 8 : d.kind === "modifier" ? 6 : 10) * (1 + starsOf(id) * 1.5) * (1 + rarOf(id) * 0.35)); }
  /** 値上げの呪いをふくめた値段。 */
  private cost(n: number) { return Math.round(n * (this.curses.includes("neage") ? 1.5 : 1)); }

  private stock(): ShopItem[] {
    const spells = this.pickSpells(4).map((id): ShopItem => ({ kind: "spell", id, price: this.cost(World.price(id)), sold: false }));
    const pots = pickN(this.rng, Object.keys(POTIONS), 2).map((id): ShopItem => ({ kind: "potion", id, price: this.cost(POTIONS[id].price), sold: false }));
    return [...spells, ...pots];
  }

  /** 品物を買う（カリカリが足りなければ false）。 */
  buy(i: number): boolean {
    const it = this.shop?.items[i];
    if (!it || it.sold || this.coins < it.price) return false;
    this.coins -= it.price; it.sold = true;
    const p = this.player;
    if (it.kind === "spell") this.bag.push(it.id);
    else if (it.id === "milk") p.hp = Math.min(p.maxHp, p.hp + 2);
    else if (it.id === "churu") p.hp = p.maxHp;
    else if (it.id === "goldNiboshi") this.coins = Math.max(this.coins + 3, Math.floor(this.coins * 1.25));
    this.events.push("buy");
    return true;
  }

  /** 技の品ぞろえを入れ替える（だんだん高くなる）。 */
  reroll(): boolean {
    const sh = this.shop;
    if (!sh || this.coins < sh.rerollCost) return false;
    this.coins -= sh.rerollCost; sh.rerollCost += this.cost(2);
    const pots = sh.items.filter((x) => x.kind === "potion");
    sh.items = [...this.stock().filter((x) => x.kind === "spell"), ...pots];
    this.events.push("buy");
    return true;
  }

  /** 合成できる技（手持ちに同じものが3つ以上・★2まで）。 */
  forgeable(): string[] {
    const n = new Map<string, number>();
    for (const id of this.bag) n.set(id, (n.get(id) ?? 0) + 1);
    return [...n].filter(([id, k]) => k >= 3 && starsOf(id) < MAX_STARS).map(([id]) => id);
  }

  /** ママのお直し: 同じ物3つを縫い合わせて、★1つ上の物1つにしてもらう。 */
  forge(id: string): boolean {
    if (!this.forgeable().includes(id)) return false;
    let left = 3;
    this.bag = this.bag.filter((x) => !(x === id && left-- > 0));
    this.bag.push(id + "+");
    this.events.push("forge");
    return true;
  }

  closeShop() { if (this.phase === "shop" || this.phase === "bench" || this.phase === "train") this.phase = "play"; }

  /** 特別な部屋の置き物を使う。宝箱・ママのおひざ・あやしい箱は1回だけ、秘密の隠し場所は何回でも。 */
  private useAltar() {
    const al = this.room.altar!, p = this.player;
    if (al.kind === "fusion") { this.phase = "bench"; this.events.push("shop"); return; }
    if (al.kind === "kotatsu") { this.phase = "train"; this.events.push("shop"); return; }   // トレーニング: 技の編集
    if (al.used) return;
    if (al.kind === "rest") {
      al.used = true; p.hp = p.maxHp; this.events.push("clear");
      this.notify(L("ママのおひざで ひと休み（♥ぜんぶ回復）", "A nap on Mama's lap (all ♥ healed)")); return;
    }
    if (al.kind === "treasure") { al.used = true; this.events.push("clear"); this.offerTreasure(); return; }
    al.used = true; this.offerPacts();
  }

  // ---------- 秘密の隠し場所 ----------
  // ソファの下の、猫だけが知っている隠し場所。同じレア度の物を4つ押しこむと、奥から前に失くした1つ上のレア度の物が出てくる。
  /** 隠し場所で交換できるレア度（手持ちに同じレア度の技が4つ以上）。 */
  fusable(): number[] {
    const n = [0, 0, 0, 0];
    for (const id of this.bag) n[rarOf(id)]++;
    return n.map((k, r) => (k >= 4 ? r : -1)).filter((r) => r >= 0);
  }

  /** 手持ちから選んだ4つ（同じレア度）を隠し場所に入れて、1つ上のレア度の技を1つ得る（伝説は伝説）。 */
  fuse(picks: number[]): string | null {
    const ids = picks.map((i) => this.bag[i]);
    if (new Set(picks).size !== 4 || ids.some((x) => !x)) return null;
    const r = rarOf(ids[0]);
    if (ids.some((x) => rarOf(x) !== r)) return null;
    const pool = this.spellPool().filter((id) => SPELLS[id].rar === Math.min(3, r + 1) && !ids.includes(id));
    const got = this.rng.pick(pool.length ? pool : this.spellPool().filter((id) => SPELLS[id].rar === Math.min(3, r + 1)));
    this.bag = this.bag.filter((_, i) => !picks.includes(i));
    this.bag.push(got);
    this.events.push("forge");
    this.notify(L(`隠し場所の奥から ${spellDef(got).name} が出てきた`, `Found ${spellDef(got).name} deep in the stash`));
    return got;
  }

  /** 今持っている技すべて（手持ち・おもちゃのスロット・サブスロット・電池式）。おきにいり選びに使う。 */
  ownedSpells(): string[] {
    return [...this.bag, ...this.held.flatMap((h) => [...h.def.slots, ...(h.def.sub?.slots ?? [])])].filter((x): x is string => !!x && !!SPELLS[x.replace(/\+*$/, "")]);
  }

  /** 解放ずみの技。 */
  private spellPool() { return SPELL_IDS.filter((id) => !this.isLocked("spell", id)); }
  /** レア度で重みをつけて技を選ぶ（季節が進むとレアが出やすい）。 */
  private pickSpells(n: number, minRar = 0): string[] {
    const act = capAct(this.room?.act ?? 0, 6), W = [6, 3 + act * 0.4, 1.2 + act * 0.4, 0.4 + act * 0.25];
    const left = this.spellPool().filter((id) => (SPELLS[id].rar ?? 0) >= minRar), out: string[] = [];
    while (out.length < n && left.length) {
      const total = left.reduce((a, id) => a + W[SPELLS[id].rar ?? 0], 0);
      let t = this.rng.next() * total, k = 0;
      for (; k < left.length - 1; k++) { t -= W[SPELLS[left[k]].rar ?? 0]; if (t <= 0) break; }
      out.push(left.splice(k, 1)[0]);
    }
    return out;
  }

  /** サブスロットを出す（やる気は使わない）。 */
  private fireSub(h: HeldToy) {
    const sub = h.def.sub;
    if (!sub || !sub.slots.some(Boolean)) { h.charge = sub?.need ?? 0; return; }
    h.charge = 0;
    const p = this.player, r = castAll(h.def, Infinity, sub.slots);
    this.fireShots(r.shots, p.aim);
    this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 0.9, color: "#ffd43b", t: 0, life: 0.4 });
    this.events.push("sub");
  }

  /** サブスロットをためる（今持っているおもちゃだけ）。 */
  private chargeSub(kind: "still" | "hit" | "dash" | "kill" | "hurt", n: number) {
    const h = this.toys[this.cur], sub = h?.def.sub;
    if (!sub || sub.charge !== kind || this.room.kind === "final") return;
    h.charge += n;
    if (h.charge >= sub.need) this.fireSub(h);
  }

  /** 電池式のおもちゃ: それぞれのやる気で、一番近い虫へ自動で振る。 */
  private updateBattery(dt: number) {
    const p = this.player, t = this.nearestEnemy(p.pos, 11);
    for (const h of this.batt) {
      h.mana = Math.min(this.manaMaxOf(h.def), h.mana + h.def.manaRegen * this.bonus.regenMul * dt);
      h.autoCd -= dt;
      if (h.autoCd > 0 || !t || this.room.kind === "final") continue;
      const res = planCast(h.def, h.cursor, h.mana / this.bonus.manaCostMul);
      if (!res.shots.length) { h.autoCd = 0.3; if (!res.fizzled) h.cursor = 0; continue; }
      h.mana = Math.min(this.manaMaxOf(h.def), h.mana - res.manaUsed * this.bonus.manaCostMul); h.cursor = res.nextCursor;
      h.autoCd = (h.def.auto ?? 2) + (res.wrapped ? h.def.recharge : 0);
      this.fireShots(res.shots, norm({ x: t.pos.x - p.pos.x, z: t.pos.z - p.pos.z }));
      this.events.push("cast");
    }
  }

  /** 猫の位置から技をまとめて出す（扇状・回る技は等間隔）。 */
  private fireShots(list: Shot[], aim: Vec) {
    const p = this.player, L = this.room.layout;
    const front = { x: p.pos.x + aim.x * 0.5, z: p.pos.z + aim.z * 0.5 }, fc = cellAt(L, front.x, front.z);
    const muzzle = cellValue(L, fc.c, fc.r) === Cell.Floor ? front : { ...p.pos }; // 家具にくっついていても撃てる
    list.forEach((s, n) => {
      const k = list.length;
      // 回る技は円周に等間隔、ほかは扇状に少しずらす
      const off = s.stats.motion === "orbit" ? (n / k) * Math.PI * 2 : (n - (k - 1) / 2) * 0.16;
      this.fire(s, s.stats.motion === "shot" ? muzzle : p.pos, aim, "player", off);
      if (s.stats.motion === "shot") this.projectiles[this.projectiles.length - 1].origin = { ...p.pos };   // 最初の当たり判定は猫の位置から（すぐ横の小さい虫も外さない）
      if (s.stats.motion === "ring") p.pounce = 0.4;
    });
    if (list.length) this.fx.push({ kind: "cast", pos: muzzle, radius: 0.35, color: list[0].stats.color, t: 0, life: 0.15 });
  }

  /** さいごの部屋: ママが猫を病院へ連れて行こうと近づいてくる。猫は肉球ペシペシしかできない。つかまったらクリア。 */
  private enterFinal() {
    this.capture({ final: true });
    const layout = buildLayout(FINAL_TEMPLATE, "living", this.rng, { doors: [] });
    this.room = {
      act: ACTS - 1, index: ROOMS_PER_ACT + 1, season: "summer", theme: "living", kind: "final", layout,
      w: layout.cols / 2, d: layout.rows / 2, waves: [["mama"]], wave: 0, cleared: false, reward: null, doors: [], altar: null, challenge: false, kids: [], papa: false,
    };
    this.enemies = []; this.projectiles = []; this.pickups = []; this.shop = null; this.doorOpen = false; this.flow = null; this.finalT = 0;
    this.player.pos = cellCenter(layout, layout.entry.c, layout.entry.r); this.player.vel = { x: 0, z: 0 };
    this.spawnWave();
    this.notify(L("ママ「病院いこうね〜♪」", "Mama: \"Time for the vet~♪\""));
    this.events.push("final");
  }

  private goThrough(d: Door) {
    const r = this.room;
    if (r.kind === "boss") {
      if (r.act + 1 >= ACTS && !this.opts.endless) { this.enterFinal(); return; }
      this.enterRoom(r.act + 1, 0, null);
    } else this.enterRoom(r.act, r.index + 1, d.reward === "boss" ? null : d.reward);
  }

  fire(shot: Shot, from: Vec, dir: Vec, owner: "player" | "enemy", angleOffset = 0, anchored = false) {
    const L = this.room.layout;
    if (owner === "player" && shot.stats.motion !== "summon" && this.projectiles.length >= MAX_PLAYER_SHOTS) return;   // 出すぎたら新しい分は出さない
    let s = shot.stats;
    if (owner === "player") {
      // レリック・装備: 攻撃力・とどく距離
      const B = this.bonus, moving = s.motion === "shot" || (s.motion === "beam" && s.speed > 0);
      s = { ...s, damage: s.damage * B.dmgMul * (this.player.power > 0 ? 1.5 : 1), life: moving ? s.life * B.rangeMul : s.life };
    }
    const a = Math.atan2(dir.z, dir.x) + (s.motion === "orbit" ? 0 : angleOffset) + (this.rng.next() - 0.5) * 2 * s.spread;
    const d = { x: Math.cos(a), z: Math.sin(a) };
    const pr: Projectile = {
      id: this.nextId++, owner, pos: { ...from }, vel: { x: d.x * s.speed, z: d.z * s.speed },
      damage: s.damage, radius: s.radius, life: s.life, pierce: s.pierce, bounce: s.bounce, homing: s.homing,
      explode: s.explode, slow: s.slow, color: s.color, tech: s.tech, payload: shot.payload,
      motion: s.motion, hits: s.hits, hitEvery: s.hitEvery, reach: s.reach, element: s.element, knock: s.knock,
      t: 0, life0: s.life, origin: { ...from }, ang: a + angleOffset, angVel: s.speed, dir: d, hitLog: new Map(), payloadDone: false, cd: 0,
      anchor: anchored ? { ...from } : null, payloadAt: shot.timer ?? 0, trig: shot.on ?? "hit", trigNext: 0, split: s.split ?? 0,
    };
    if (s.motion === "orbit") { pr.vel = { x: 0, z: 0 }; pr.pos = { x: from.x + Math.cos(pr.ang) * s.reach, z: from.z + Math.sin(pr.ang) * s.reach }; }
    if (s.motion === "ring" || s.motion === "melee") pr.vel = { x: 0, z: 0 };
    if (s.motion === "beam" && s.speed === 0) {
      // 一瞬で届くビーム: 壁・家具に当たるところまで
      pr.vel = { x: 0, z: 0 };
      let t = 0;
      while (t < s.reach) { const c = cellAt(L, from.x + d.x * (t + 0.1), from.z + d.z * (t + 0.1)); if (cellValue(L, c.c, c.r) !== Cell.Floor) break; t += 0.1; }
      pr.pos = { x: from.x + d.x * t, z: from.z + d.z * t };
    }
    if (s.motion === "summon") {
      // 仲間は猫の少し前に出てくる。ルンバは狙った向きへ走り出す
      const ahead = { x: from.x + d.x * 0.6, z: from.z + d.z * 0.6 }, c = cellAt(L, ahead.x, ahead.z);
      pr.pos = cellValue(L, c.c, c.r) === Cell.Floor ? ahead : { ...from };
      if (s.tech !== "roomba") pr.vel = { x: 0, z: 0 };
      // 上限で呼ぶと一番古い仲間が帰る（召喚の上限）
      const mine = this.projectiles.filter((q) => q.motion === "summon" && q.tech === s.tech);
      // 呼べる数は種類ごと（札を何枚つけても同じ）。★で＋1ずつ、レリック「ねずみのおもちゃ」で＋1
      const limit = (s.limit ?? 1) + this.bonus.summonAdd;
      if (mine.length >= limit) {
        const old = mine[0];
        this.fx.push({ kind: "puff", pos: { ...old.pos }, radius: 0.6, color: "#ffffff", t: 0, life: 0.4 });
        this.projectiles = this.projectiles.filter((q) => q !== old);
      }
    }
    if (s.motion === "trap") {
      pr.vel = { x: 0, z: 0 };
      const ahead = anchored ? { ...from } : { x: from.x + d.x * s.reach, z: from.z + d.z * s.reach }, c = cellAt(L, ahead.x, ahead.z);   // つづけてなら着弾地点に置く
      pr.pos = cellValue(L, c.c, c.r) === Cell.Floor ? ahead : { ...from };
      const traps = this.projectiles.filter((q) => q.motion === "trap");
      if (traps.length >= 4) this.projectiles = this.projectiles.filter((q) => q !== traps[0]);
    }
    this.projectiles.push(pr);
  }

  // ---------- 虫 ----------
  private updateFlow() {
    const L = this.room.layout, pc = cellAt(L, this.player.pos.x, this.player.pos.z), key = pc.r * L.cols + pc.c;
    if (this.flow?.key === key) return;
    const bfs = (pass: (v: Cell) => boolean) => {
      const d = new Int16Array(L.cols * L.rows).fill(-1), q = [key]; d[key] = 0;
      for (let i = 0; i < q.length; i++) {
        const k = q[i], c = k % L.cols, r = (k / L.cols) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = (r + dr) * L.cols + c + dc;
          if (d[nk] >= 0 || !pass(cellValue(L, c + dc, r + dr))) continue;
          d[nk] = d[k] + 1; q.push(nk);
        }
      }
      return d;
    };
    this.flow = { key, ground: bfs((v) => v === Cell.Floor), air: bfs((v) => v === Cell.Floor || v === Cell.Prop) };
  }

  /** 道順に沿って猫へ向かう方向（近ければ直進）。 */
  private chase(e: Enemy, flying: boolean): Vec {
    const p = this.player.pos, L = this.room.layout;
    const direct = norm({ x: p.x - e.pos.x, z: p.z - e.pos.z });
    if (!this.flow || dist(e.pos, p) < 1.6) return direct;
    const field = flying ? this.flow.air : this.flow.ground;
    const ec = cellAt(L, e.pos.x, e.pos.z);
    const here = field[ec.r * L.cols + ec.c];
    let best: Vec | null = null, bd = here < 0 ? 1e9 : here;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const c = ec.c + dc, r = ec.r + dr;
      if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) continue;
      const v = field[r * L.cols + c];
      if (v < 0) continue;
      if (dc && dr && (field[ec.r * L.cols + c] < 0 || field[r * L.cols + ec.c] < 0)) continue; // 角は切らない
      if (v < bd) { bd = v; const t = cellCenter(L, c, r); best = { x: t.x - e.pos.x, z: t.z - e.pos.z }; }
    }
    return best ? norm(best) : direct;
  }

  private updateEnemies(dt: number) {
    const p = this.player, spawnLater: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.spawn > 0) { e.spawn = Math.max(0, e.spawn - dt); continue; }
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.wet = Math.max(0, e.wet - dt);
      e.sticky = Math.max(0, e.sticky - dt);
      if (e.repel > 0) {
        e.repel -= dt; e.repelTick -= dt;
        if (e.repelTick <= 0) { e.repelTick = 0.5; this.damageEnemy(e, e.repelDps * 0.5 * (e.sticky > 0 ? 2 : 1), 0, "#7bd96a"); }
      }
      const sp = e.speed * (e.slow > 0 ? 0.45 : 1) * (e.wet > 0 ? 0.7 : 1) * (e.sticky > 0 ? (isBoss(e.type) ? 0.35 : 0) : 1);
      const flying = isFly(e.type);
      const to = this.chase(e, flying);
      const direct = norm({ x: p.pos.x - e.pos.x, z: p.pos.z - e.pos.z });
      if (e.type === "papa") this.updatePapa(e, dt);
      else if (isKid(e.type)) this.updateKid(e, dt, to);
      else if (e.type === "roach") {
        const run = (e.t % 1.4) < 0.6;
        e.vel = run ? { x: to.x * sp, z: to.z * sp } : { x: e.vel.x * 0.8, z: e.vel.z * 0.8 };
      } else if (e.type === "mosquito") {
        const side = { x: -to.z, z: to.x }, w = Math.sin(e.t * 4 + e.id) * 0.9;
        e.vel = { x: (to.x + side.x * w) * sp, z: (to.z + side.z * w) * sp };
      } else if (e.type === "spider") {
        const d = dist(e.pos, p.pos), want = d > 6 ? 1 : d < 4 ? -1 : 0;
        const side = { x: -direct.z, z: direct.x };
        const mv = want > 0 ? to : { x: direct.x * want, z: direct.z * want };
        e.vel = { x: (mv.x + side.x * 0.4) * sp, z: (mv.z + side.z * 0.4) * sp };
        if (e.t > 2.0) { e.t = 0; this.fire({ stats: enemyShot("#d8d8e8", 5.5), payload: [] }, e.pos, direct, "enemy"); }
      } else if (e.type === "stinkbug") {   // ゆっくり歩き、ときどきくさいガスを出す
        e.vel = { x: to.x * sp, z: to.z * sp };
        if (e.t > 3.5) { e.t = 0; this.gas(e.pos, 0.8); }
      } else if (e.type === "camel") {   // じっとしてから、猫めがけて跳ぶ
        if (e.phase > 0) { e.phase -= dt; if (e.phase <= 0) e.vel = { x: 0, z: 0 }; }
        else { e.vel = { x: e.vel.x * 0.85, z: e.vel.z * 0.85 }; if (e.t > 1.6) { e.t = 0; e.phase = 0.35; e.vel = { x: direct.x * sp * 8, z: direct.z * sp * 8 }; } }
      } else if (e.type === "ant") {   // 速く、まっすぐ
        e.vel = { x: to.x * sp, z: to.z * sp };
      } else if (e.type === "caterpillar") {   // のろのろ進み、近づくと毛を飛ばす
        e.vel = { x: to.x * sp, z: to.z * sp };
        if (e.t > 2.6 && dist(e.pos, p.pos) < 6) { e.t = 0; for (let k = -2; k <= 2; k++) this.fire({ stats: { ...enemyShot("#c0eb75", 5), life: 0.9 }, payload: [] }, e.pos, direct, "enemy", k * 0.25); }
      } else if (e.type === "stinkKing") {   // ガスを置きながら、輪の弾
        e.vel = { x: to.x * sp, z: to.z * sp };
        const fast = e.hp / e.maxHp < 0.5;
        if (e.t > (fast ? 1.6 : 2.2)) {
          e.t = 0; e.phase++;
          if (e.phase % 2) for (let k = 0; k < 3; k++) this.gas({ x: p.pos.x + (this.rng.next() - 0.5) * 5, z: p.pos.z + (this.rng.next() - 0.5) * 4 }, 1.0);
          else { const n = 8 + capAct(this.room.act, 5) * 2; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; this.fire({ stats: enemyShot("#94d82d", 3.6), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy"); } }
        }
      } else if (e.type === "camelKing") {   // 大ジャンプして、着地で輪の弾
        if (e.phase > 0) {
          e.phase -= dt;
          if (e.phase <= 0) {
            e.vel = { x: 0, z: 0 }; this.events.push("land");
            const n = (e.hp / e.maxHp < 0.5 ? 14 : 10) + capAct(this.room.act, 5) * 2;
            for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; this.fire({ stats: enemyShot("#c58a4a", 4.5), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy"); }
          }
        } else if (e.t > 2.2) { e.t = 0; e.phase = 0.6; const d = Math.min(7, dist(e.pos, p.pos)); e.vel = { x: direct.x * d / 0.6, z: direct.z * d / 0.6 }; }
        else e.vel = { x: 0, z: 0 };
      } else if (e.type === "queen") {   // 子分（アリ・毛虫）を呼び、毛を扇に飛ばす
        e.vel = { x: to.x * sp, z: to.z * sp };
        if (e.t > 2.8) {
          e.t = 0; e.phase++;
          if (e.phase % 2 && this.enemies.length < 9) for (const t of ["ant", "ant", "caterpillar"] as EnemyType[]) {
            const m = this.makeEnemy(t, { x: e.pos.x + (this.rng.next() - 0.5) * 2, z: e.pos.z + (this.rng.next() - 0.5) * 2 });
            m.spawn = 0.6; spawnLater.push(m);
          } else for (let k = -3; k <= 3; k++) this.fire({ stats: enemyShot("#a9e34b", 5.5), payload: [] }, e.pos, direct, "enemy", k * 0.18);
        }
      } else if (e.type === "mama") {   // ニコニコしながら近づいてくる。肉球でたたくと少し止まる。だんだん速くなる
        const v = e.slow > 0 ? 0 : Math.min(4.6, 1.6 + this.finalT * 0.07);
        e.vel = { x: to.x * v, z: to.z * v };
        if (dist(e.pos, p.pos) < e.radius + p.radius) { this.phase = "win"; this.events.push("caught"); this.events.push("win"); }
      } else if (e.type === "hornet") {
        e.vel = { x: to.x * sp, z: to.z * sp };
        const hpRate = e.hp / e.maxHp, period = (hpRate < 0.5 ? 1.5 : 2.1) - capAct(this.room.act, 4) * 0.12;
        if (e.t > period) {
          e.t = 0; e.phase++;
          if (e.phase % 2) {
            const n = (hpRate < 0.5 ? 14 : 10) + capAct(this.room.act, 5) * 2, off = this.rng.next() * Math.PI;
            for (let k = 0; k < n; k++) {
              const a = off + (k / n) * Math.PI * 2;
              this.fire({ stats: enemyShot("#ffcf33", 4.2), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy");
            }
          } else {
            for (let k = -1; k <= 1; k++) this.fire({ stats: enemyShot("#ff7a3d", 6.5), payload: [] }, e.pos, direct, "enemy", k * 0.22);
          }
        }
      }
      const k = Math.exp(-7 * dt);
      this.moveCircle(e.pos, { x: e.vel.x + e.push.x, z: e.vel.z + e.push.z }, e.radius, dt, flying, false);
      e.push.x *= k; e.push.z *= k;
      if (e.home) { const k2 = Math.min(1, dt * 3); e.pos.x += (e.home.x - e.pos.x) * k2; e.pos.z += (e.home.z - e.pos.z) * k2; }   // 的は元の場所へ戻る
      if (e.type !== "mama" && !isKid(e.type) && !isDummy(e.type) && p.held <= 0 && dist(e.pos, p.pos) < e.radius + p.radius) this.hurtPlayer(1, e.pos);
    }
    this.enemies.push(...spawnLater);
    for (let a = 0; a < this.enemies.length; a++) for (let b = a + 1; b < this.enemies.length; b++) {
      const A = this.enemies[a], B = this.enemies[b];
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz), m = A.radius + B.radius;
      if (d > 0 && d < m) {
        const k = (m - d) / d / 2; A.pos.x -= dx * k; A.pos.z -= dz * k; B.pos.x += dx * k; B.pos.z += dz * k;
        for (const E of [A, B]) this.moveCircle(E.pos, ZERO, E.radius, 0, isFly(E.type), false);
      }
    }
  }

  /**
   * 子ども: 猫と遊びたくて、部屋のどこにいても追いかけてくる（お兄ちゃんは走ってはひと息、妹はとことこ）。
   * つかまると数秒だっこでもみくちゃにされて動けず、♥が減る。逃げられると少しだけ息をととのえて、また追いかけてくる。
   */
  private updateKid(e: Enemy, dt: number, to: Vec) {
    const p = this.player;
    e.phase = Math.max(0, e.phase - dt);
    if (p.holder === e.id) { e.vel = { x: 0, z: 0 }; return; }
    const d = dist(e.pos, p.pos);
    if (e.phase <= 0 && p.held <= 0) {
      const go = e.type === "girl" || (e.t % 1.5) < 1.0;
      e.vel = go ? { x: to.x * e.speed, z: to.z * e.speed } : { x: e.vel.x * 0.85, z: e.vel.z * 0.85 };
    } else {   // ひと息ついて、うろうろ
      const a = Math.floor(e.t / 1.6) * 2.3 + e.id;
      e.vel = { x: Math.cos(a) * e.speed * 0.35, z: Math.sin(a) * e.speed * 0.35 };
    }
    if (e.phase <= 0 && p.held <= 0 && p.iframes <= 0 && d < e.radius + p.radius + 0.1) {
      this.hurtPlayer(1, e.pos);
      p.held = HUG[e.type] ?? 2; p.holder = e.id; p.vel = { x: 0, z: 0 }; p.hurt = 0;
      this.events.push("hug");
      this.notify(L(`${ENEMY[e.type].name}につかまった！ダッシュでじたばた！`, `Caught by ${ENEMY[e.type].name}! Dash to wriggle free!`));
    }
  }

  /**
   * パパ: 寝ころんで動かない。猫がお腹の上で 2.5 秒じっとしていると寝おわり、
   * 最大HP＋♥1・やる気の最大＋15（全部のおもちゃ）。ただし 3 回に1回くらい、強制猫吸いされて失敗（しばらく動けない）。
   */
  private updatePapa(e: Enemy, dt: number) {
    const p = this.player;
    e.vel = { x: 0, z: 0 };
    if (e.napDone) return;
    const on = p.held <= 0 && dist(e.pos, p.pos) < e.radius + 0.25 && Math.hypot(p.vel.x, p.vel.z) < 0.6;
    e.phase = on ? e.phase + dt : Math.max(0, e.phase - dt * 2);
    if (e.phase < PAPA_NAP) return;
    e.napDone = true; e.phase = 0;
    if (this.rng.next() < 0.3) {   // 強制猫吸い
      p.held = 2.2; p.holder = e.id; p.vel = { x: 0, z: 0 };
      this.events.push("hug");
      this.notify(L("パパに強制猫吸いされた！すーはーすーはー…（上限アップ失敗）", "Papa snuffled your fur! Sniff sniff... (no max-up)"));
      return;
    }
    this.baseMaxHp += 2; p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2);
    this.manaUp.max += 15;
    for (const h of this.held) { h.def.manaMax += 15; }
    this.events.push("clear");
    this.notify(L("パパのお腹でぐっすり…最大HP ＋♥1・やる気の最大 ＋15", "Snoozed on Papa's belly... Max HP +♥1, Max Energy +15"));
  }

  private hurtPlayer(n: number, from: Vec) {
    const p = this.player;
    if (p.iframes > 0) return;
    if (p.shield > 0) {   // バリア（部屋ごと）
      p.shield--; p.iframes = 0.6; this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 0.8, color: "#a5d8ff", t: 0, life: 0.4 });
      this.notify(L("バリア！", "Barrier!")); return;
    }
    if (this.bonus.guard && this.rng.next() < this.bonus.guard) {   // 騎士猫: 当たりを防ぐ
      p.iframes = 0.5; this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 0.6, color: "#dee2e6", t: 0, life: 0.35 });
      this.notify(L("ふせいだ！", "Blocked!")); return;
    }
    p.hp -= n * DIFFS[this.opts.difficulty].dmg; p.iframes = 1.0 + this.bonus.iframes; p.hurt = 0.45;
    this.chargeSub("hurt", 1);
    if (this.bonus.thorns) {   // 反撃: まわりの虫にダメージ
      this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 1.6, color: "#ffd43b", t: 0, life: 0.35 });
      for (const e of this.enemies) if (e.spawn <= 0 && dist(e.pos, p.pos) < 2.4 + e.radius) this.damageEnemy(e, this.bonus.thorns * this.bonus.dmgMul, 0, "#ffd43b");
    }
    const away = norm({ x: p.pos.x - from.x, z: p.pos.z - from.z });
    p.vel = { x: away.x * 9, z: away.z * 9 };
    this.events.push("hurt");
    if (p.hp <= 0) { p.hp = 0; this.phase = "dead"; this.events.push("dead"); }
  }

  // ---------- 弾 ----------
  /** 多段で遅れて当たる分。 */
  private later: { t: number; eid: number; dmg: number; info: HitInfo; dir: Vec; kill?: Shot[] }[] = [];

  private updateProjectiles(dt: number) {
    const keep: Projectile[] = [];
    const spawned: Spawn[] = [];
    const L = this.room.layout, p = this.player;
    const blocks = (x: number, z: number) => { const c = cellAt(L, x, z), v = cellValue(L, c.c, c.r); return v !== Cell.Floor; };

    this.later = this.later.filter((h) => {
      h.t -= dt; if (h.t > 0) return true;
      const e = this.enemies.find((q) => q.id === h.eid);
      if (e && e.hp > 0) {
        this.hitEnemy(e, h.dmg, h.info, h.dir);
        if (h.kill && e.hp <= 0) this.payload(spawned, h.kill, e.pos, h.dir, e.id);   // かじかじの続きでとどめ
      }
      return false;
    });

    for (const pr of this.projectiles) {
      const first = pr.t === 0 && pr.motion === "shot" && pr.owner === "player";
      pr.life -= dt; pr.t += dt;
      const ox = first ? pr.origin.x : pr.pos.x, oz = first ? pr.origin.z : pr.pos.z;
      // 動き
      const center = pr.anchor ?? p.pos;   // つづけてで出たものは出た場所が中心
      if (pr.motion === "orbit") {
        pr.ang += pr.angVel * dt;
        pr.pos = { x: center.x + Math.cos(pr.ang) * pr.reach, z: center.z + Math.sin(pr.ang) * pr.reach };
      } else if (pr.motion === "melee") {
        pr.pos = { x: center.x + pr.dir.x * pr.reach * 0.55, z: center.z + pr.dir.z * pr.reach * 0.55 };
      } else if (pr.motion === "summon") {
        this.updateSummon(pr, dt, spawned);
      } else if (pr.motion === "shot" || pr.motion === "beam") {
        if (pr.homing > 0 && pr.owner === "player" && pr.motion === "shot") {
          const t = this.nearestEnemy(pr.pos, 7);
          if (t) {
            const want = norm({ x: t.pos.x - pr.pos.x, z: t.pos.z - pr.pos.z }), sp = Math.hypot(pr.vel.x, pr.vel.z);
            const k = Math.min(1, pr.homing * dt * 6), cur = norm(pr.vel);
            const nd = norm({ x: cur.x + (want.x - cur.x) * k, z: cur.z + (want.z - cur.z) * k });
            pr.vel = { x: nd.x * sp, z: nd.z * sp };
          }
        }
        pr.pos.x += pr.vel.x * dt; pr.pos.z += pr.vel.z * dt;
      }
      let dead = pr.life <= 0;
      // ひと呼吸: 時間が来たら、その場所から右の技
      if (pr.payloadAt > 0 && !pr.payloadDone && (pr.t >= pr.payloadAt || dead)) {
        pr.payloadDone = true;
        this.payload(spawned, pr.payload, pr.pos, pr.motion === "shot" ? norm(pr.vel) : pr.dir);
      }

      if (!dead && pr.owner === "enemy") {
        if (dist(p.pos, pr.pos) < p.radius + pr.radius * 0.8) { this.hurtPlayer(1, pr.pos); dead = true; }
      } else if (!dead) {
        const info: HitInfo = { slow: pr.slow, element: pr.element, tech: pr.tech, color: pr.color, knock: pr.knock };
        const R = pr.motion === "ring" ? pr.reach * Math.min(1, pr.t / (pr.life0 * 0.75)) : 0;
        for (const e of this.enemies) {
          if (e.spawn > 0 || e.hp <= 0 || isKid(e.type) || (pr.motion === "summon" && pr.tech !== "roomba")) continue; // 友達猫は自分で狙ってひっかく。子どもには当たらない
          const rec = pr.hitLog.get(e.id);
          if (rec && (rec.n >= pr.hits || pr.t < rec.next || pr.motion === "shot")) continue;
          let touch = false, push: Vec = pr.dir;
          switch (pr.motion) {
            case "shot": touch = segDist(e.pos, ox, oz, pr.pos) <= e.radius + pr.radius; push = norm(pr.vel); break; // 速い弾が通り抜けないよう線分で判定
            case "orbit": touch = segDist(e.pos, ox, oz, pr.pos) <= e.radius + pr.radius; push = norm({ x: e.pos.x - center.x, z: e.pos.z - center.z }); break;
            case "beam": touch = segDist(e.pos, pr.origin.x, pr.origin.z, pr.pos) <= e.radius + pr.radius; break;
            case "ring": { const d = dist(e.pos, pr.origin); touch = d <= R + e.radius && d >= R - e.radius - 0.6; push = norm({ x: e.pos.x - pr.origin.x, z: e.pos.z - pr.origin.z }); break; }
            case "melee": touch = dist(e.pos, pr.pos) <= pr.reach * 0.55 + e.radius; break;
            case "trap": touch = dist(e.pos, pr.pos) <= pr.radius + e.radius; push = { x: 0, z: 0 }; break;
            case "summon": touch = dist(e.pos, pr.pos) <= pr.radius + e.radius; push = norm({ x: e.pos.x - pr.pos.x, z: e.pos.z - pr.pos.z }); break;
          }
          if (!touch) continue;
          pr.hitLog.set(e.id, { n: (rec?.n ?? 0) + (pr.motion === "shot" ? pr.hits : 1), next: pr.t + pr.hitEvery });
          if (pr.explode <= 0) this.hitEnemy(e, pr.damage, info, push);
          const out = pr.motion === "shot" ? norm(pr.vel) : pr.dir;
          const emit = () => this.payload(spawned, pr.payload, e.pos, out, e.id);   // 着弾地点（その虫の場所）から
          // つづけて系: 当たったら（1回）／当たるたびに／倒したら
          if (pr.payload.length && !pr.payloadAt) {
            if (pr.trig === "kill") { if (e.hp <= 0) emit(); }
            else if (pr.trig === "every") { if (pr.motion === "shot" || pr.t >= pr.trigNext) { pr.trigNext = pr.t + 0.15; emit(); } }   // 飛ぶ技は貫通した虫ごと、ほかは0.15秒おき
            else if (pr.trig === "hit" && (pr.motion === "shot" || pr.motion === "summon" || !pr.payloadDone)) { pr.payloadDone = true; emit(); }
          }
          if (pr.motion === "shot") {
            for (let k = 1; k < pr.hits; k++) this.later.push({ t: k * pr.hitEvery, eid: e.id, dmg: pr.damage, info, dir: push, kill: pr.trig === "kill" && !pr.payloadAt ? pr.payload : undefined }); // かじかじ: 食い込んで削る
            if (pr.pierce > 0) pr.pierce--; else { dead = true; break; }
          }
        }
      }
      // 壁・家具（虫に当たる判定のあと。壁ぎわの虫にも当たるように）
      if (!dead && (pr.motion === "shot" || pr.motion === "beam") && (pr.vel.x || pr.vel.z) && blocks(pr.pos.x, pr.pos.z)) {
        if (pr.motion === "beam") { pr.pos.x = ox; pr.pos.z = oz; pr.vel = { x: 0, z: 0 }; }   // 毛糸玉は壁で止まる（糸は残る）
        else if (pr.bounce > 0) {
          pr.bounce--;
          const hx = blocks(pr.pos.x, oz), hz = blocks(ox, pr.pos.z);
          if (hx || !hz) pr.vel.x *= -1;
          if (hz || !hx) pr.vel.z *= -1;
          pr.pos.x = ox; pr.pos.z = oz;
          if (pr.trig === "bounce" && pr.owner === "player") this.payload(spawned, pr.payload, { x: ox, z: oz }, norm(pr.vel));   // ぴょんぴょん: はね返った所から
        } else dead = true;
      }
      if (dead) {
        if (pr.owner === "player" && pr.explode > 0) this.explode(pr, spawned);
        if (pr.owner === "player" && pr.payload.length && pr.hitLog.size === 0 && pr.motion === "shot" && !pr.payloadAt && pr.trig === "hit")
          this.payload(spawned, pr.payload, { x: ox, z: oz }, norm(pr.vel));   // 当たらずに消えたら、消えた所から
        if (pr.owner === "player" && pr.payloadAt > 0 && !pr.payloadDone && pr.payload.length) {   // ひと呼吸: 時間の前に当たって消えても出す
          pr.payloadDone = true; this.payload(spawned, pr.payload, pr.pos, pr.motion === "shot" ? norm(pr.vel) : pr.dir);
        }
        if (pr.owner === "player" && pr.split > 0 && pr.motion === "shot") this.splitShot(pr, { x: ox, z: oz }, spawned, pr.hitLog.size === 0);
        continue;
      }
      keep.push(pr);
    }
    this.projectiles = keep;
    for (const s of spawned) {
      const n = this.projectiles.length;
      this.fire(s.shot, s.pos, s.dir, "player", s.off ?? 0, true);
      if (s.skip && this.projectiles.length > n) for (const id of s.skip) this.projectiles[n].hitLog.set(id, { n: 99, next: 1e9 });   // 割れた元の虫には当たらない
    }
    const before = this.enemies.length, dead: Enemy[] = [];
    this.enemies = this.enemies.filter((e) => {
      if (e.hp > 0) return true;
      this.fx.push({ kind: "puff", pos: { ...e.pos }, radius: e.radius * 2, color: "#ffffff", t: 0, life: 0.5 });
      dead.push(e);
      return false;
    });
    for (const e of dead) {
      this.kills++;
      // カリカリを落とす（ボス・強い虫はたくさん）
      const n = isBoss(e.type) ? 8 : e.elite ? 4 : e.type === "ant" ? (this.rng.next() < 0.5 ? 1 : 0) : 1 + (this.rng.next() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) this.pickups.push({ id: this.nextId++, pos: { x: e.pos.x + (this.rng.next() - 0.5) * 1.2, z: e.pos.z + (this.rng.next() - 0.5) * 1.2 }, value: isBoss(e.type) || e.elite ? 2 : 1, t: 0 });
      if (e.elite) {
        this.elites++;
        if (e.elite === "split") for (const s of [-1, 1]) {   // 分かれる: ふつうの虫2匹に
          const m = this.makeEnemy(e.type, { x: e.pos.x + s * 0.5, z: e.pos.z }); m.spawn = 0.3; this.enemies.push(m);
        }
        if (e.elite === "burst") for (let k = 0; k < 10; k++) {   // はじける: 輪の弾
          const a = (k / 10) * Math.PI * 2; this.fire({ stats: enemyShot("#ff922b", 4), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy");
        }
      }
      if (e.type === "stinkbug") this.gas(e.pos, 0.9);   // カメムシは倒すとくさい
      if (this.bonus.killHeal && this.rng.next() < this.bonus.killHeal) this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      if (this.bonus.killBoom) {   // 倒した虫がはじける
        this.fx.push({ kind: "tech", tech: "hairball", pos: { ...e.pos }, radius: 1.4, color: "#ffa94d", t: 0, life: 0.35 });
        for (const q of this.enemies) if (q.spawn <= 0 && dist(q.pos, e.pos) < 1.6 + q.radius) this.damageEnemy(q, this.bonus.killBoom * this.bonus.dmgMul, 0, "#ffa94d");
      }
    }
    if (dead.length) this.chargeSub("kill", dead.length);
    if (this.enemies.length < before) {
      this.events.push("kill");
      if (this.bonus.killMana) this.player.mana = Math.min(this.manaMax, this.player.mana + this.bonus.killMana * (before - this.enemies.length));
    }
  }

  /** 召喚した仲間の動き。ルンバは壁ではね返りながら走る。友達猫は近くの虫を追ってひっかく（いなければ猫のそばへ）。 */
  private updateSummon(pr: Projectile, dt: number, spawned: Spawn[]) {
    const before = { ...pr.pos };
    if (pr.tech === "roomba") {
      this.moveCircle(pr.pos, pr.vel, pr.radius, dt, false, false);
      if (Math.abs(pr.pos.x - before.x) < Math.abs(pr.vel.x * dt) * 0.5) pr.vel.x *= -1;
      if (Math.abs(pr.pos.z - before.z) < Math.abs(pr.vel.z * dt) * 0.5) pr.vel.z *= -1;
      return;
    }
    pr.cd -= dt;
    const t = this.nearestEnemy(pr.pos, 14), goal = t ? t.pos : this.player.pos;
    const d = dist(pr.pos, goal), dir = norm({ x: goal.x - pr.pos.x, z: goal.z - pr.pos.z });
    const stop = t ? pr.reach * 0.6 + t.radius : 1.3;
    const sp = d > stop ? pr.angVel : 0;
    pr.vel = { x: dir.x * sp, z: dir.z * sp };
    this.moveCircle(pr.pos, pr.vel, pr.radius, dt, false, false);
    if (!t || pr.cd > 0 || d > pr.reach + t.radius) return;
    pr.cd = pr.hitEvery;
    pr.dir = dir;
    const info: HitInfo = { slow: pr.slow, element: pr.element, tech: "claw", color: pr.color, knock: pr.knock };
    this.hitEnemy(t, pr.damage, info, dir);
    for (let k = 1; k < pr.hits; k++) this.later.push({ t: k * 0.12, eid: t.id, dmg: pr.damage, info, dir });
    this.payload(spawned, pr.payload, pr.pos, dir, t.id);
  }

  /** カメムシのくさいガス（その場にしばらく残り、猫が触れるとダメージ）。 */
  private gas(pos: Vec, r: number) {
    this.fire({ stats: { ...enemyShot("#a9e34b", 0), radius: r, life: 2.6, tech: "gas" as TechFx }, payload: [] }, pos, { x: 1, z: 0 }, "enemy");
  }

  /**
   * つづけて等で出す技を並べる。2つ以上なら扇状（回る技は円周）にずらす。
   * 飛ぶ技・ビームは、きっかけになった虫（skip）には当たらず、その先の虫へ向かう。
   */
  private payload(spawned: Spawn[], list: Shot[], pos: Vec, dir: Vec, skip?: number) {
    const k = list.length;
    list.forEach((s, n) => spawned.push({
      shot: s, pos: { ...pos }, dir,
      off: k > 1 ? (s.stats.motion === "orbit" ? (n / k) * Math.PI * 2 : (n - (k - 1) / 2) * 0.16) : 0,
      skip: skip !== undefined && (s.stats.motion === "shot" || s.stats.motion === "beam") ? [skip] : undefined,
    }));
  }

  /** 毛糸のほつれ: 消えた弾が、まわりへ割れて飛び散る（割れた弾はもう割れない）。 */
  private splitShot(pr: Projectile, at: Vec, spawned: Spawn[], wall: boolean) {
    // 虫に当たったら全方向へ（その虫には当たらない）、壁なら跳ね返る向きへ扇状に
    const n = pr.split, back = Math.atan2(-pr.vel.z, -pr.vel.x), skip = [...pr.hitLog.keys()];
    const stats: ProjectileStats = {
      damage: (pr.damage * 0.5) / this.bonus.dmgMul, speed: Math.max(8, Math.hypot(pr.vel.x, pr.vel.z)), radius: pr.radius * 0.8, life: 0.55,
      pierce: 0, bounce: 0, homing: pr.homing, explode: pr.explode * 0.6, slow: pr.slow, spread: 0, color: pr.color, tech: pr.tech,
      motion: "shot", hits: 1, hitEvery: pr.hitEvery, reach: 0, element: pr.element, knock: pr.knock * 0.5, split: 0,
    };
    for (let k = 0; k < n; k++) {
      const a = wall ? back + (n > 1 ? (k / (n - 1) - 0.5) * 2.1 : 0) : back + Math.PI + ((k + 0.5) / n) * Math.PI * 2;
      spawned.push({ shot: { stats, payload: [] }, pos: { ...at }, dir: { x: Math.cos(a), z: Math.sin(a) }, skip });
    }
  }

  private explode(pr: Projectile, spawned: Spawn[] = []) {
    this.fx.push({ kind: "tech", tech: pr.tech, pos: { ...pr.pos }, radius: pr.explode, color: pr.color, t: 0, life: 0.45 });
    const info: HitInfo = { slow: pr.slow, element: pr.element, tech: pr.tech, color: pr.color, knock: pr.knock };
    for (const e of this.enemies) {
      if (e.spawn > 0 || e.hp <= 0 || isKid(e.type)) continue;
      const d = dist(e.pos, pr.pos);
      if (d < pr.explode + e.radius) {
        this.hitEnemy(e, pr.damage * (1 - 0.4 * Math.min(1, d / pr.explode)), info, norm({ x: e.pos.x - pr.pos.x, z: e.pos.z - pr.pos.z }), false);
        if (pr.trig === "kill" && e.hp <= 0) this.payload(spawned, pr.payload, e.pos, pr.dir, e.id);   // とどめ
      }
    }
  }

  /** 技が虫に当たった: ダメージ・属性・はじき飛ばし。 */
  private hitEnemy(e: Enemy, dmg: number, h: HitInfo, dir: Vec, mark = true) {
    if (isKid(e.type)) return;
    if (e.type === "mama") {   // ペシッ。ママは「あらあら」と少し止まるだけ
      e.slow = Math.max(e.slow, 0.45); e.hurt = 0.2; e.push.x += dir.x * 2; e.push.z += dir.z * 2;
      if (mark) this.fx.push({ kind: "tech", tech: "punch", pos: { ...e.pos }, radius: 0.6, color: "#ffa8a8", t: 0, life: 0.3 });
      this.events.push("pesi");
      return;
    }
    this.chargeSub("hit", 1);
    if (h.element === "static" && e.wet > 0) dmg *= 2;
    const crit = this.bonus.crit > 0 && this.rng.next() < this.bonus.crit;
    if (crit) dmg *= 2;
    this.damageEnemy(e, dmg, h.slow, crit ? "#ffd43b" : "#ffffff");
    if (mark && this.fx.length < 260) this.fx.push({ kind: "tech", tech: h.tech, pos: { ...e.pos }, radius: 0.55, color: h.color, t: 0, life: 0.3 });
    if (h.knock) { const k = h.knock * (isBoss(e.type) ? 0.15 : 1); e.push.x += dir.x * k; e.push.z += dir.z * k; }
    switch (h.element) {
      case "wet": e.wet = 4 * this.bonus.elemMul; break;
      case "sticky": e.sticky = (isBoss(e.type) ? 0.6 : 1.6) * this.bonus.elemMul; break;
      case "repel": e.repelDps = Math.max(e.repel > 0 ? e.repelDps : 0, 2 + dmg * 0.4); e.repel = 3 * this.bonus.elemMul; break;
      case "static": {
        // 近くの虫へ飛び移る（びしょぬれなら2倍・4匹）
        const n = (e.wet > 0 ? 4 : 2) + this.bonus.zapAdd;
        const near = this.enemies.filter((q) => q !== e && q.spawn <= 0 && q.hp > 0 && dist(q.pos, e.pos) < 3.5)
          .sort((a, b) => dist(a.pos, e.pos) - dist(b.pos, e.pos)).slice(0, n);
        for (const q of near) {
          this.damageEnemy(q, dmg * 0.45 * (q.wet > 0 ? 2 : 1), 0, "#ffe066");
          this.fx.push({ kind: "zap", pos: { ...e.pos }, to: { ...q.pos }, radius: 0.1, color: "#ffe066", t: 0, life: 0.25 });
        }
        break;
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number, slow: number, color = "#ffffff") {
    if (isKid(e.type)) return;
    if (isDummy(e.type)) this.trainLog.push({ t: this.time, d: dmg }); else e.hp -= dmg;   // 的は倒れず、ダメージを数える
    e.hurt = 0.15;
    if (slow > 0) e.slow = Math.max(e.slow, slow);
    if (this.fx.length < 260) this.fx.push({ kind: "num", value: Math.max(1, Math.round(dmg)), pos: { x: e.pos.x, z: e.pos.z }, radius: 0.5, color, t: 0, life: 0.7 });
  }

  private updateFx(dt: number) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  // ---------- クリアとごほうび ----------
  private checkRoom() {
    const r = this.room;
    if (r.kind === "final") return;   // ママは倒せない
    if (r.kind === "shop" || r.kind === "special") { if (!r.cleared) { r.cleared = true; this.doorOpen = true; } return; }
    if (r.cleared || this.enemies.some((e) => !isKid(e.type))) return;
    if (r.wave + 1 < r.waves.length) { r.wave++; this.spawnWave(); return; }
    r.cleared = true;
    this.projectiles = this.projectiles.filter((p) => p.owner === "player");
    // 子どもは部屋を片付けたあとも残って追いかけてくる（扉まで逃げきる）
    this.events.push("clear");
    const p = this.player;
    this.cleared++; if (r.kind === "boss") this.bosses++;
    if (this.bonus.clearHeal) p.hp = Math.min(p.maxHp, p.hp + this.bonus.clearHeal);
    if (r.kind === "boss") { p.hp = p.maxHp; this.offer("relic"); return; }
    if (r.challenge) {   // 強い虫の部屋: カリカリの山＋レリック
      for (let k = 0; k < 8; k++) this.pickups.push({ id: this.nextId++, pos: { x: p.pos.x + (this.rng.next() - 0.5) * 3, z: p.pos.z + (this.rng.next() - 0.5) * 3 }, value: 2, t: 0 });
    }
    const reward = r.reward;
    if (reward === "hp") { this.baseMaxHp += 2; p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); this.notify(L("最大HP ＋1♥", "Max HP +1♥")); }
    else if (reward === "mp") {
      this.manaUp.max += 20; this.manaUp.regen += 4;
      for (const h of this.toys) { h.def.manaMax += 20; h.def.manaRegen += 4; h.mana = this.manaMaxOf(h.def); }
      p.mana = this.manaMax; this.notify(L("やる気 最大＋20・回復＋4（全部のおもちゃ）", "Energy max +20, regen +4 (all toys)"));
    }
    else if (reward === "spell" || reward === "toy" || reward === "relic" || reward === "gear") { this.offer(reward); return; }
    this.doorOpen = true;
  }

  private relicPool() { return RELIC_IDS.filter((r) => !this.relics.includes(r) && !this.isLocked("relic", r)); }

  /** 今の選択肢の出し方（広告で1回だけ引き直せる。呪いの箱は引き直せない）。 */
  private lastOffer: "spell" | "toy" | "relic" | "gear" | "treasure" | null = null;
  rerolled = false;
  get canReroll() { return this.phase === "reward" && !!this.lastOffer && !this.rerolled; }
  /** 選択肢を同じ種類で引き直す（1画面1回）。 */
  rerollChoices() {
    if (!this.canReroll) return;
    const k = this.lastOffer!;
    if (k === "treasure") this.offerTreasure(); else this.offer(k);
    this.rerolled = true;
  }

  private offer(kind: "spell" | "toy" | "relic" | "gear") {
    const n = 3 + this.bonus.choiceAdd;
    this.lastOffer = kind; this.rerolled = false;
    if (kind === "toy") {
      const have = new Set(this.held.map((h) => h.def.id));
      const left = Object.keys(TOYS).filter((t) => !have.has(t) && !this.isLocked("toy", t));
      this.choices = pickN(this.rng, left.length ? left : Object.keys(TOYS).filter((t) => !this.isLocked("toy", t)), n).map((id): Choice => ({ kind: "toy", id }));
    } else if (kind === "relic") {
      const left = this.relicPool();
      if (!left.length) { this.offer("spell"); return; }
      this.choices = pickN(this.rng, left, n).map((id): Choice => ({ kind: "relic", id }));
    } else if (kind === "gear") {
      this.choices = pickN(this.rng, GEAR_IDS, n).map((id): Choice => ({ kind: "gear", id, gear: rollGear(id, () => this.rng.next(), this.bonus.luck, this.room.act) }));
    } else this.choices = this.pickSpells(n).map((id): Choice => ({ kind: "spell", id }));
    this.phase = "reward";
  }

  /** 宝箱: レリック・いい装備・レアな技から1つ。 */
  private offerTreasure() {
    this.lastOffer = "treasure"; this.rerolled = false;
    const relic = this.relicPool(), out: Choice[] = [];
    if (relic.length) out.push({ kind: "relic", id: this.rng.pick(relic) });
    const g = this.rng.pick(GEAR_IDS), item = rollGear(g, () => this.rng.next(), this.bonus.luck + 1, this.room.act);
    out.push({ kind: "gear", id: g, gear: { ...item, rar: Math.max(item.rar, 1) as Rarity } });
    out.push(...this.pickSpells(3 - out.length, 2).map((id): Choice => ({ kind: "spell", id })));
    this.choices = out; this.phase = "reward";
  }

  /** あやしい箱: 呪いと引きかえの、強いごほうび（3つから1つ。いらないも選べる）。 */
  private offerPacts() {
    this.lastOffer = null;
    const curses = pickN(this.rng, CURSE_IDS.filter((c) => !this.curses.includes(c)), 3);
    if (!curses.length) { this.notify(L("箱は空っぽだった", "The box was empty")); return; }
    const relic = this.relicPool();
    this.choices = curses.map((id, k): Choice => {
      let reward: Choice & { kind: "spell" | "relic" | "gear" };
      if (k === 0 && relic.length) reward = { kind: "relic", id: this.rng.pick(relic) };
      else if (k === 1 || !relic.length) { const g = this.rng.pick(GEAR_IDS); reward = { kind: "gear", id: g, gear: { ...rollGear(g, () => this.rng.next(), 9, this.room.act), rar: 3 } }; }
      else reward = { kind: "spell", id: this.pickSpells(1, 3)[0] ?? "kenko" };
      return { kind: "pact", id, reward, coins: 10 + this.room.act * 5 };
    });
    this.phase = "reward";
  }

  private notify(text: string) { this.toast = { text, t: 2.2 }; }

  /** ごほうびを受け取る。null なら受け取らない。 */
  takeReward(c: Choice | null) {
    if (this.phase !== "reward") return;
    if (c?.kind === "pact") {   // 呪いを受けて、ごほうびとカリカリ
      this.curses.push(c.id); this.coins += c.coins; this.recalc();
      this.events.push("curse");
      this.phase = "reward"; this.takeReward(c.reward);
      this.notify(L(`呪い「${CURSES[c.id].name}」を受けた`, `Cursed: "${CURSES[c.id].name}"`));
      return;
    }
    if (c?.kind === "spell") this.bag.push(c.id);
    if (c?.kind === "toy") this.addToy(c.id);
    if (c?.kind === "relic") { this.relics.push(c.id); this.recalc(); this.notify(L(`${RELICS[c.id].name} を手に入れた`, `Got ${RELICS[c.id].name}`)); }
    if (c?.kind === "gear") {
      const g = c.gear ?? { id: c.id, rar: 0, fx: [] };
      this.gear[GEAR[g.id].slot] = g; this.recalc(); this.notify(L(`${GEAR[g.id].name} を装備した`, `Equipped ${GEAR[g.id].name}`));
    }
    this.choices = [];
    this.phase = "play";
    this.doorOpen = true;
  }

  /**
   * 新しいおもちゃ。最初から入っている技はそのまま。
   * 持ち替えのおもちゃは3つまで、いっぱいなら今のおもちゃと交換（はめていた技は移し、あふれた分は手持ちへ）。電池式は2つまで、いっぱいなら古い方と交換。
   */
  addToy(id: string) {
    const t = structuredClone(TOYS[id]);
    t.manaMax += this.manaUp.max; t.manaRegen += this.manaUp.regen;
    const spellsOf = (d: ToyDef) => [...d.slots, ...(d.sub?.slots ?? [])].filter((x): x is string => !!x);
    if (t.auto) {
      if (this.batt.length >= MAX_BATT) { const old = this.batt.shift()!; this.bag.push(...spellsOf(old.def)); }
      this.batt.push(held(t, this.manaMaxOf(t)));
      this.notify(L(`${t.name} を置いた（電池式・自動で動く）`, `Placed ${t.name} (battery toy, runs itself)`));
      return;
    }
    if (this.toys.length < MAX_TOYS) {
      this.toys.push(held(t, this.manaMaxOf(t)));
      this.notify(L(`${t.name} を持った（${this.toys.length}つ目）`, `Picked up ${t.name} (toy #${this.toys.length})`));
      return;
    }
    // はめていた技は新しいおもちゃの空きスロットへ左から詰め、あふれた分は手持ちへ
    const old = spellsOf(this.toy);
    t.slots = t.slots.map((x) => x ?? old.shift() ?? null);
    this.bag.push(...old);
    this.toys[this.cur] = held(t, Math.min(this.player.mana, this.manaMaxOf(t)));
    this.player.cursor = 0;
    this.player.mana = this.toys[this.cur].mana;
    this.notify(L(`${t.name} と交換した`, `Swapped for ${t.name}`));
  }

  /** 置き場所どうしで入れ替える（スロット・サブスロット・手持ち）。toy は持ち物画面のタブ（held の番号）。 */
  move(from: Spot, to: Spot, toy = this.cur) {
    const h = this.held[toy], slots = h.def.slots, sub = h.def.sub?.slots ?? [];
    const arr = (p: Spot) => (p.where === "slot" ? slots : p.where === "sub" ? sub : null);
    const get = (p: Spot) => (arr(p)?.[p.i] ?? this.bag[p.i]) ?? null;
    const set = (p: Spot, v: string | null) => { const a = arr(p); if (a) a[p.i] = v; else this.bag[p.i] = v as string; };
    if ((from.where !== "bag" && from.i >= arr(from)!.length) || (to.where !== "bag" && to.i >= arr(to)!.length)) return;
    const a = get(from), b = get(to);
    set(from, b); set(to, a);
    this.bag = this.bag.filter(Boolean);
    h.cursor = 0;
    if (toy === this.cur) this.player.cursor = 0;
    this.player.mana = Math.min(this.player.mana, this.manaMax);
  }

  // ---------- 当たり判定 ----------
  /** 円を動かし、壁・家具（飛ぶ虫は家具を越える）・閉じた扉で止める。 */
  private moveCircle(pos: Vec, vel: Vec, r: number, dt: number, flying: boolean, player: boolean) {
    const L = this.room.layout;
    const solid = (c: number, rr: number) => {
      const v = cellValue(L, c, rr);
      if (v === Cell.Wall) return true;
      if (v === Cell.Prop) return !flying;
      if (v === Cell.Door) return !(player && this.doorOpen);
      return false;
    };
    for (const axis of ["x", "z"] as const) {
      pos[axis] += vel[axis] * dt;
      const c0 = Math.floor(pos.x - r + L.cols / 2), c1 = Math.floor(pos.x + r + L.cols / 2);
      const r0 = Math.floor(pos.z - r + L.rows / 2), r1 = Math.floor(pos.z + r + L.rows / 2);
      for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) {
        if (!solid(c, rr)) continue;
        const cx = c - L.cols / 2, cz = rr - L.rows / 2;  // マスの左上
        const nx = Math.max(cx, Math.min(pos.x, cx + 1)), nz = Math.max(cz, Math.min(pos.z, cz + 1));
        const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 0) { pos.x += (dx / d) * (r - d); pos.z += (dz / d) * (r - d); continue; }
        // 中心がマスの中に入り込んだ（押し合いなど）: 一番近い辺から外へ出す
        const out = [pos.x - cx, cx + 1 - pos.x, pos.z - cz, cz + 1 - pos.z];
        const k = out.indexOf(Math.min(...out));
        if (k === 0) pos.x = cx - r; else if (k === 1) pos.x = cx + 1 + r; else if (k === 2) pos.z = cz - r; else pos.z = cz + 1 + r;
      }
    }
  }
}

const ZERO: Vec = { x: 0, z: 0 };

/** p に一番近い、まわり（上下左右）も床のマスの中心。家具や壁の上に物を置かないため。 */
function openFloor(L: Layout, p: Vec): Vec {
  const at = cellAt(L, p.x, p.z), free = (c: number, r: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dc, dr]) => cellValue(L, c + dc, r + dr) === Cell.Floor);
  for (let rad = 0; rad < 12; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
    if (free(at.c + dc, at.r + dr)) return cellCenter(L, at.c + dc, at.r + dr);
  }
  return p;
}

/** 点 q と線分 (ax,az)-b の距離。 */
function segDist(q: Vec, ax: number, az: number, b: Vec) {
  const vx = b.x - ax, vz = b.z - az, l2 = vx * vx + vz * vz;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - ax) * vx + (q.z - az) * vz) / l2)) : 0;
  return Math.hypot(q.x - (ax + vx * t), q.z - (az + vz * t));
}

function makeEnemy(id: number, type: EnemyType, pos: Vec, act: number, difficulty = 1): Enemy {
  const d = ENEMY[type], D = DIFFS[difficulty];
  const hp = Math.round(d.hp * (1 + act * (d.boss ? 0.8 : 0.6)) * D.hp);
  return { id, type, pos: { ...pos }, vel: { x: 0, z: 0 }, hp, maxHp: hp, radius: d.r, speed: d.speed * (1 + capAct(act, 6) * 0.06) * D.speed, slow: 0, hurt: 0, t: (id * 0.37) % 1, phase: 0, spawn: 0,
    wet: 0, sticky: 0, repel: 0, repelDps: 0, repelTick: 0, push: { x: 0, z: 0 }, elite: null };
}

const enemyShot = (color: string, speed: number) => ({
  damage: 1, speed, radius: 0.16, life: 4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.03, color, tech: "enemy" as TechFx,
  motion: "shot" as Motion, hits: 1, hitEvery: 0.1, reach: 0, element: "none" as Element, knock: 0, split: 0,
});

function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const a = [...arr], out: T[] = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng.next() * a.length), 1)[0]);
  return out;
}
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
