// 技（おもちゃにはめるアイテム）の定義。DOM・three.js 非依存。
//
// 猫がおもちゃを振ると、スロットの技（爪・牙・毛糸玉など）が出る。技ごとに「動き」（飛ぶ・回る・ビーム…）が違い、
// 修飾で強さ・大きさ・属性（おうちのもの属性）を足していく。

import { L } from "../i18n";

export type SpellKind = "attack" | "modifier" | "multicast" | "trigger" | "duet";
export type TriggerOn = "hit" | "every" | "bounce" | "kill";

/**
 * 修飾がかかる向き（右・左・両側・全体）。
 * right=右の技 / left=左の技 / both=左右の技（2つをいっしょに出す） / all=置いたおもちゃの全部の技（読まれない・やる気の最大が減る）。
 */
export type ModDir = "right" | "left" | "both" | "all";
export const DIR_INFO: Record<ModDir, { arrow: string; label: string }> = {
  right: { arrow: "▶", label: L("右の技にかかる", "Affects the right move") },
  left: { arrow: "◀", label: L("左の技にかかる", "Affects the left move") },
  both: { arrow: "◀▶", label: L("左右の技にかかり、いっしょに出す", "Affects left & right moves; casts both together") },
  all: { arrow: L("全", "All"), label: L("このおもちゃの全部の技にかかる", "Affects every move in this toy") },
};

/** 技のレア度（秘密の隠し場所で使う）。0 ふつう / 1 レア / 2 エピック / 3 伝説。 */
export const SPELL_RAR_NAME = [L("ふつう", "Common"), L("レア", "Rare"), L("エピック", "Epic"), L("伝説", "Legendary")];

/** 技が当たったときに出す絵（描画側で使う）。 */
export type TechFx = "claw" | "bite" | "hairball" | "hiss" | "swing" | "yarn" | "laser" | "pounce" | "punch" | "post" | "friend" | "roomba"
  | "squirt" | "duck" | "hammer" | "bubble" | "flash" | "pumpkin" | "box" | "roller" | "enemy" | "gas";

/** 技の動き。shot=飛ぶ / orbit=猫のまわりを回る / beam=猫から線で届く / ring=足元から広がる輪 / melee=目の前で連打 / trap=床に置く。 */
export type Motion = "shot" | "orbit" | "beam" | "ring" | "melee" | "trap" | "summon";
export const MOTION_LABEL: Record<Motion, string> = { shot: L("飛ぶ", "Flies"), orbit: L("まわりを回る", "Orbits"), beam: L("ビーム", "Beam"), ring: L("衝撃波", "Shockwave"), melee: L("近くを連打", "Rapid jabs"), trap: L("床に置く", "Placed"), summon: L("召喚", "Summon") };

/**
 * おうちのもの属性（炎・雷の代わり）。組み合わせると強くなる:
 * びしょぬれの虫にビリビリ＝2倍・たくさん連鎖 / ねばねばの虫に虫よけ＝じわじわ2倍。
 */
export type Element = "none" | "static" | "wet" | "sticky" | "repel";
export const ELEMENT_INFO: Record<Exclude<Element, "none">, { name: string; color: string; desc: string }> = {
  static: { name: L("ビリビリ", "Zap"), color: "#f5c400", desc: L("毛の静電気。当たると近くの虫2匹へ飛び移る（びしょぬれの虫には2倍＆4匹）", "Static fur. Jumps to 2 nearby bugs (×2 & 4 bugs if Soaked)") },
  wet: { name: L("びしょぬれ", "Soaked"), color: "#3fa7ff", desc: L("4秒ぬれて遅くなる。ビリビリがよく効く", "Wet and slowed for 4s. Weak to Zap") },
  sticky: { name: L("ねばねば", "Sticky"), color: "#c9a227", desc: L("ガムテープで1.6秒足止め（ボスは少しだけ）。虫よけがよく効く", "Taped in place for 1.6s (bosses briefly). Weak to Bug Spray") },
  repel: { name: L("虫よけ", "Bug Spray"), color: "#5fbf5a", desc: L("3秒間じわじわダメージ（ねばねばの虫には2倍）", "Damage over 3s (×2 vs Sticky bugs)") },
};

/** 飛んでいく弾の性能。修飾で上書き・加算される。 */
export interface ProjectileStats {
  damage: number;
  speed: number; // マス/秒
  radius: number;
  life: number; // 秒
  pierce: number; // 貫通できる虫の数
  bounce: number; // 壁で跳ね返る回数
  homing: number; // 0..1 追尾の強さ
  explode: number; // 範囲半径（0 で範囲なし）
  slow: number; // 命中時の鈍足秒数
  spread: number; // ばらつき（ラジアン）
  color: string;
  tech: TechFx;
  motion: Motion;
  /** 同じ虫に当たる最大回数（多段）。 */
  hits: number;
  /** 多段の間隔（秒）。 */
  hitEvery: number;
  /** 回る半径・ビームの長さ・輪の広がり・連打の届く距離。 */
  reach: number;
  element: Element;
  /** 当たった虫を押し出す強さ。 */
  knock: number;
  /** 消えるとき（当たる・壁・時間切れ）に、この数に割れて飛び散る。 */
  split: number;
  /** 召喚: 同時に出せる数（★で＋1ずつ）。 */
  limit?: number;
}

/**
 * 召喚: 仲間を呼び出し、出ている間ずっと戦わせる。
 * 召喚ごとに呼べる数の上限があり、上限で呼ぶと一番古い仲間が帰って新しい仲間に入れ替わる。
 * 左に置いた修飾・属性は、仲間の攻撃にそのままかかる（攻撃力・多段・属性・大きさ・速さ）。
 */
/** 技へ足し込む修飾（向きは SpellDef.dir）。 */
export interface Modifier {
  damageMul?: number;
  damageAdd?: number;
  speedMul?: number;
  homing?: number;
  bounce?: number;
  pierce?: number;
  explodeAdd?: number;
  spread?: number;
  hitsAdd?: number;
  /** 大きさ（当たり判定・回る半径・輪・爆発）の倍率。 */
  sizeMul?: number;
  element?: Element;
  slowAdd?: number; // 当たった虫がすくむ秒数を足す
  lifeMul?: number; // とどく距離（出ている時間）
  /** 1発をこの数に増やして扇状に出す（重ねると掛け算）。 */
  copies?: number;
  /** 消えるときに割れる数を足す。 */
  split?: number;
  /** この修飾を読んだ回の振る間隔・休けいを足す（マイナスで速く）。 */
  castDelayAdd?: number;
  rechargeAdd?: number;
}

export interface SpellDef {
  id: string;
  name: string;
  kind: SpellKind;
  mana: number; // やる気の消費
  desc: string;
  glyph: string;
  color: string;
  projectile?: ProjectileStats;
  modifier?: Modifier;
  count?: number; // multicast: 右に続く技を何個同時に出すか
  limit?: number; // 召喚: 同時に出せる数
  /** 修飾の向き（なければ右）。 */
  dir?: ModDir;
  /** つづけて系: 当たったときではなく、出てからこの秒数で右の技を出す。 */
  timer?: number;
  /** つづけて系の発動: hit=当たったら（1回）/ every=当たるたびに / bounce=はね返るたびに / kill=虫を倒したら。 */
  on?: TriggerOn;
  /** レア度（下の RAR で決める）。 */
  rar?: number;
}

const base = (o: Partial<ProjectileStats> & { color: string; tech: TechFx }): ProjectileStats => ({
  damage: 5, speed: 12, radius: 0.2, life: 1.4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.04,
  motion: "shot", hits: 1, hitEvery: 0.12, reach: 0, element: "none", knock: 0, split: 0, ...o,
});

/** 種類ごとの表示名（UI の凡例に使う）。 */
export const KIND_LABEL: Record<SpellKind, string> = {
  attack: L("技", "Move"),
  modifier: L("修飾", "Modifier"),
  multicast: L("修飾", "Modifier"),
  trigger: L("修飾", "Modifier"),
  duet: L("2つ持ち", "Two Paws"),
};

export const SPELLS: Record<string, SpellDef> = {
  claw: {
    id: "claw", name: L("ひっかき", "Scratch"), kind: "attack", mana: 4, glyph: "爪", color: "#e85d4a",
    desc: L("爪でひっかく。速くて軽い。連発向き", "Claw swipe. Fast and light. Good for spamming"),
    projectile: base({ damage: 5, speed: 15, life: 1.0, spread: 0.08, color: "#ff8a70", tech: "claw" }),
  },
  bite: {
    id: "bite", name: L("かみつき", "Bite"), kind: "attack", mana: 12, glyph: "牙", color: "#c0392b",
    desc: L("ガブッと強い一撃。少し遅い", "A big chomp. A bit slow"),
    projectile: base({ damage: 14, speed: 10, radius: 0.24, life: 1.5, color: "#ff6b6b", tech: "bite" }),
  },
  hairball: {
    id: "hairball", name: L("毛玉", "Hairball"), kind: "attack", mana: 18, glyph: "毛", color: "#b07a3c",
    desc: L("当たった所で毛玉がはじけ、まわりの虫にも当たる", "Bursts on hit, also hitting bugs nearby"),
    projectile: base({ damage: 9, speed: 8, radius: 0.26, life: 1.8, explode: 1.7, color: "#e0a060", tech: "hairball" }),
  },
  hiss: {
    id: "hiss", name: L("シャー", "Hiss"), kind: "attack", mana: 8, glyph: "シ", color: "#7c5cbf",
    desc: L("威嚇。当たった虫がすくんで遅くなる", "A threat. Bugs hit flinch and slow down"),
    projectile: base({ damage: 4, speed: 12, life: 1.3, slow: 2.0, color: "#c9a6ff", tech: "hiss" }),
  },
  swing: {
    id: "swing", name: L("ぶんぶん", "Swish"), kind: "attack", mana: 14, glyph: "回", color: "#e64980",
    desc: L("ねこじゃらしを振り回す。先っぽが猫のまわりを回り、近づく虫を何度もたたく", "Swing a cat teaser. The tip orbits Kitty, whacking nearby bugs again and again"),
    projectile: base({ damage: 6, speed: 7, radius: 0.38, life: 1.4, motion: "orbit", reach: 1.7, hits: 3, hitEvery: 0.35, knock: 3, color: "#ff9ec4", tech: "swing" }),
  },
  yarn: {
    id: "yarn", name: L("毛糸玉ころがし", "Yarn Roll"), kind: "attack", mana: 16, glyph: "糸", color: "#d6336c",
    desc: L("毛糸玉がころがり、のびた糸がビームになって並んだ虫をまとめて何度もこする", "Yarn rolls out; the string becomes a beam rubbing bugs in a line repeatedly"),
    projectile: base({ damage: 4, speed: 10, radius: 0.3, life: 1.1, motion: "beam", hits: 3, hitEvery: 0.3, spread: 0.02, color: "#f783ac", tech: "yarn" }),
  },
  laser: {
    id: "laser", name: L("レーザーポインター", "Laser Pointer"), kind: "attack", mana: 10, glyph: "光", color: "#f03e3e",
    desc: L("赤い点が一瞬で壁まで走る。線の上の虫ぜんぶに当たる", "A red dot zips to the wall instantly, hitting every bug on the line"),
    projectile: base({ damage: 7, speed: 0, radius: 0.15, life: 0.22, motion: "beam", reach: 14, spread: 0.01, color: "#ff3b3b", tech: "laser" }),
  },
  pounce: {
    id: "pounce", name: L("ねこジャンプ", "Pounce"), kind: "attack", mana: 14, glyph: "跳", color: "#f08c00",
    desc: L("跳んで着地し、足元から輪の衝撃波。囲まれたときに虫をはじき飛ばす", "Leap and land with a shockwave ring. Knocks bugs back when surrounded"),
    projectile: base({ damage: 10, speed: 0, radius: 0.3, life: 0.4, motion: "ring", reach: 2.6, knock: 7, color: "#ffc078", tech: "pounce" }),
  },
  punch: {
    id: "punch", name: L("猫パンチ連打", "Paw Flurry"), kind: "attack", mana: 8, glyph: "拳", color: "#e8590c",
    desc: L("目の前をぺしぺし連打。近いけれど1匹に何度も当たる", "Rapid pats up front. Short range, but hits one bug many times"),
    projectile: base({ damage: 3, speed: 0, radius: 0.5, life: 0.45, motion: "melee", reach: 1.5, hits: 4, hitEvery: 0.1, knock: 1, color: "#ffa8a8", tech: "punch" }),
  },
  post: {
    id: "post", name: L("爪とぎ", "Scratch Pad"), kind: "attack", mana: 18, glyph: "置", color: "#a0522d",
    desc: L("段ボールの爪とぎを前に置く。上を通る虫を7秒間ガリガリ削る（4つまで）", "Places a cardboard scratcher. Grinds bugs on it for 7s (up to 4)"),
    projectile: base({ damage: 4, speed: 0, radius: 0.7, life: 7, motion: "trap", reach: 1.3, hits: 99, hitEvery: 0.6, color: "#d9a066", tech: "post" }),
  },
  friend: {
    id: "friend", name: L("友達猫", "Cat Buddy"), kind: "attack", mana: 40, glyph: "猫", color: "#868e96", limit: 2,
    desc: L("友達の猫を呼ぶ。近くの虫を追いかけてひっかく。修飾・属性は友達猫の攻撃にかかる", "Calls a cat buddy to chase and scratch nearby bugs. Modifiers and elements apply to its attacks"),
    projectile: base({ limit: 2, damage: 4, speed: 5, radius: 0.34, life: 15, motion: "summon", reach: 0.85, hitEvery: 0.6, spread: 0, color: "#ced4da", tech: "friend" }),
  },
  roomba: {
    id: "roomba", name: L("ルンバ", "Robo Vac"), kind: "attack", mana: 35, glyph: "掃", color: "#495057", limit: 1,
    desc: L("お掃除ロボを呼ぶ。部屋を走り回って壁ではね返り、ぶつかった虫を吸いこむ", "Calls a cleaning robot. Roams the room, bounces off walls, and sucks up bugs"),
    projectile: base({ limit: 1, damage: 4, speed: 3.4, radius: 0.55, life: 15, motion: "summon", hits: 99, hitEvery: 0.5, knock: 2, spread: 0.6, color: "#adb5bd", tech: "roomba" }),
  },
  // ---- 飼い主が買ってきた物シリーズ ----
  mizudeppo: {
    id: "mizudeppo", name: L("水鉄砲", "Water Gun"), kind: "attack", mana: 5, glyph: "水", color: "#4dabf7",
    desc: L("お風呂用の水鉄砲。弱いけれど速く、当たるとびしょぬれ", "A bath water gun. Weak but fast; Soaks on hit"),
    projectile: base({ damage: 3, speed: 16, life: 0.8, spread: 0.06, element: "wet", color: "#74c0fc", tech: "squirt" }),
  },
  ahiru: {
    id: "ahiru", name: L("ゴムのアヒル", "Rubber Duck"), kind: "attack", mana: 10, glyph: "鳥", color: "#fab005",
    desc: L("プピッと鳴るお風呂のアヒル。壁で4回はね返る", "A squeaky bath duck. Bounces off walls 4 times"),
    projectile: base({ damage: 7, speed: 9, radius: 0.28, life: 3, bounce: 4, knock: 2, color: "#ffd43b", tech: "duck" }),
  },
  hammer: {
    id: "hammer", name: L("ピコピコハンマー", "Squeaky Hammer"), kind: "attack", mana: 12, glyph: "槌", color: "#f03e3e",
    desc: L("100円ショップのおもちゃ。目の前を1発たたいて、はじき飛ばす", "A dollar-store toy. One bonk up front that knocks bugs back"),
    projectile: base({ damage: 16, speed: 0, radius: 0.6, life: 0.25, motion: "melee", reach: 1.7, knock: 7, color: "#ff8787", tech: "hammer" }),
  },
  shabon: {
    id: "shabon", name: L("シャボン玉", "Bubbles"), kind: "attack", mana: 9, glyph: "泡", color: "#74c0fc",
    desc: L("ふわふわ漂って虫をゆっくり追いかけ、パチンとはじける", "Floats along, slowly chasing bugs, then pops"),
    projectile: base({ damage: 6, speed: 3.5, radius: 0.3, life: 3.5, explode: 1.3, homing: 0.4, color: "#d0ebff", tech: "bubble" }),
  },
  flash: {
    id: "flash", name: L("自撮りフラッシュ", "Selfie Flash"), kind: "attack", mana: 12, glyph: "光", color: "#fcc419",
    desc: L("飼い主の自撮りの光。まわりの虫がまぶしくて2.5秒すくむ", "Mama's selfie light. Dazzled bugs nearby flinch for 2.5s"),
    projectile: base({ damage: 3, speed: 0, life: 0.35, motion: "ring", reach: 3.4, slow: 2.5, color: "#fff3bf", tech: "flash" }),
  },
  kabocha: {
    id: "kabocha", name: L("ハロウィンのかぼちゃ", "Halloween Pumpkin"), kind: "attack", mana: 24, glyph: "瓜", color: "#fd7e14",
    desc: L("去年のハロウィンの飾り。転がって大きくはじける", "Last year's Halloween decor. Rolls and bursts big"),
    projectile: base({ damage: 14, speed: 6, radius: 0.36, life: 1.8, explode: 2.2, knock: 4, color: "#ff922b", tech: "pumpkin" }),
  },
  danbo: {
    id: "danbo", name: L("通販の段ボール", "Delivery Box"), kind: "attack", mana: 14, glyph: "箱", color: "#c0864a",
    desc: L("床に置くと、上を通った虫がはまってねばねば（置くものは合わせて4つまで）", "Place on the floor; bugs that step in get stuck and Sticky (4 placed items max)"),
    projectile: base({ damage: 2, speed: 0, radius: 0.75, life: 8, motion: "trap", reach: 1.3, hits: 99, hitEvery: 0.5, element: "sticky", color: "#d9a066", tech: "box" }),
  },
  korokoro: {
    id: "korokoro", name: L("粘着コロコロ", "Lint Roller"), kind: "attack", mana: 15, glyph: "転", color: "#868e96",
    desc: L("掃除用のコロコロ。転がった線の上の虫がくっついて止まる", "A sticky lint roller. Bugs on its path stick and stop"),
    projectile: base({ damage: 3, speed: 9, radius: 0.32, life: 1.1, motion: "beam", hits: 2, hitEvery: 0.4, element: "sticky", color: "#dee2e6", tech: "roller" }),
  },
  matatabi: {
    id: "matatabi", name: L("またたび", "Catnip"), kind: "modifier", mana: 8, glyph: "強", color: "#2f9e44",
    desc: L("右の技のダメージ1.5倍＋3", "Right move damage ×1.5 +3"), modifier: { damageMul: 1.5, damageAdd: 3 },
  },
  stare: {
    id: "stare", name: L("じーっ", "Stare"), kind: "modifier", mana: 8, glyph: "追", color: "#1c7ed6",
    desc: L("右の技が虫を追いかける", "Right move chases bugs"), modifier: { homing: 0.75, speedMul: 0.9 },
  },
  bouncy: {
    id: "bouncy", name: L("ぽよん", "Bouncy"), kind: "modifier", mana: 6, glyph: "跳", color: "#0ca678",
    desc: L("右の技が壁で3回はね返る", "Right move bounces off walls 3 times"), modifier: { bounce: 3 },
  },
  pushy: {
    id: "pushy", name: L("ぐいぐい", "Pushy"), kind: "modifier", mana: 8, glyph: "貫", color: "#5c7cfa",
    desc: L("右の技が虫を2匹ぶん突き抜ける", "Right move pierces 2 bugs"), modifier: { pierce: 2 },
  },
  kajikaji: {
    id: "kajikaji", name: L("かじかじ", "Nibble"), kind: "modifier", mana: 8, glyph: "多", color: "#ae3ec9",
    desc: L("多段。右の技が同じ虫に＋2回当たる（1回の攻撃力は×0.7）", "Multi-hit. Right move hits the same bug +2 times (×0.7 damage each)"), modifier: { hitsAdd: 2, damageMul: 0.7 },
  },
  big: {
    id: "big", name: L("でっかく", "Big"), kind: "modifier", mana: 10, glyph: "大", color: "#f59f00",
    desc: L("右の技が大きくなる（当たり・回る半径・輪が×1.6）。少し遅くなる", "Right move grows (hitbox, orbit, ring ×1.6). A bit slower"), modifier: { sizeMul: 1.6, damageMul: 1.2, speedMul: 0.8 },
  },
  small: {
    id: "small", name: L("ちっちゃく", "Tiny"), kind: "modifier", mana: 6, glyph: "小", color: "#74b816",
    desc: L("右の技が豆つぶになる。当てにくいけれど攻撃力×1.8", "Right move shrinks to a pea. Hard to land, but ×1.8 damage"), modifier: { sizeMul: 0.45, damageMul: 1.8 },
  },
  quick: {
    id: "quick", name: L("すばやく", "Quick"), kind: "modifier", mana: 6, glyph: "速", color: "#15aabf",
    desc: L("右の技が1.8倍速くなる（回る・連打も速く）", "Right move ×1.8 faster (orbits and jabs too)"), modifier: { speedMul: 1.8 },
  },
  static: {
    id: "static", name: L("静電気", "Static"), kind: "modifier", mana: 8, glyph: "電", color: "#f5c400",
    desc: L("右の技にビリビリ属性をつける", "Gives the right move Zap"), modifier: { element: "static" },
  },
  water: {
    id: "water", name: L("水のみ皿", "Water Bowl"), kind: "modifier", mana: 6, glyph: "水", color: "#3fa7ff",
    desc: L("右の技にびしょぬれ属性をつける", "Gives the right move Soaked"), modifier: { element: "wet" },
  },
  tape: {
    id: "tape", name: L("ガムテープ", "Duct Tape"), kind: "modifier", mana: 8, glyph: "粘", color: "#c9a227",
    desc: L("右の技にねばねば属性をつける", "Gives the right move Sticky"), modifier: { element: "sticky" },
  },
  spray: {
    id: "spray", name: L("虫よけスプレー", "Bug Spray"), kind: "modifier", mana: 8, glyph: "毒", color: "#5fbf5a",
    desc: L("右の技に虫よけ属性をつける", "Gives the right move Bug Spray"), modifier: { element: "repel" },
  },
  rame: {
    id: "rame", name: L("ラメのシール", "Glitter Sticker"), kind: "modifier", mana: 6, glyph: "煌", color: "#cc5de8",
    desc: L("キラキラ。右の技が少し大きくなり、攻撃力＋2", "Sparkly. Right move grows a bit, +2 damage"), modifier: { sizeMul: 1.3, damageAdd: 2 },
  },
  suzu: {
    id: "suzu", name: L("鈴のリボン", "Bell Ribbon"), kind: "modifier", mana: 6, glyph: "鈴", color: "#fab005",
    desc: L("チリンと鳴る。右の技が当たった虫が1秒すくむ", "Jingle! Bugs hit by the right move flinch for 1s"), modifier: { slowAdd: 1 },
  },
  kenko: {
    id: "kenko", name: L("よくわからない健康グッズ", "Mystery Health Gadget"), kind: "modifier", mana: 14, glyph: "謎", color: "#495057",
    desc: L("通販で買った謎の石。なぜか右の技の攻撃力×1.7", "A mystery stone bought online. Somehow right move damage ×1.7"), modifier: { damageMul: 1.7 },
  },
  jidori: {
    id: "jidori", name: L("自撮り棒", "Selfie Stick"), kind: "modifier", mana: 6, glyph: "伸", color: "#228be6",
    desc: L("右の技が1.5倍遠くまで届く（置く技・仲間は1.5倍長くいる）", "Right move reaches ×1.5 farther (placed moves and buddies last ×1.5 longer)"), modifier: { lifeMul: 1.5 },
  },
  nekodango: {
    id: "nekodango", name: L("ねこ団子", "Cat Pile"), kind: "multicast", mana: 10, glyph: "×3", color: "#d9480f", count: 3,
    desc: L("猫が3匹かたまって遊ぶ。右に続く3つの技を同時に出す", "3 cats playing in a heap. Casts the 3 moves to the right at once"),
  },
  tatougai: {
    id: "tatougai", name: L("多頭飼い", "Cat Crowd"), kind: "multicast", mana: 14, glyph: "×4", color: "#a61e4d", count: 4,
    desc: L("おうちに猫がたくさん。右に続く4つの技を同時に出す", "A house full of cats. Casts the 4 moves to the right at once"),
  },
  butimake: {
    id: "butimake", name: L("カリカリぶちまけ", "Kibble Spill"), kind: "modifier", mana: 8, glyph: "散", color: "#c8873a",
    desc: L("袋をひっくり返したみたいに、右の技が扇状に5つに分かれて飛ぶ（1つの攻撃力×0.55）。重ねると掛け算", "Like a tipped-over bag, the right move fans out into 5 (×0.55 damage each). Stacks multiply"), modifier: { copies: 5, damageMul: 0.55 },
  },
  hotsure: {
    id: "hotsure", name: L("毛糸のほつれ", "Frayed Yarn"), kind: "modifier", mana: 8, glyph: "割", color: "#e64980",
    desc: L("右の技が消えるとき（当たる・壁・時間切れ）、3つにほどけて飛び散る（攻撃力×0.5）", "When the right move ends (hit, wall, timeout), it unravels into 3 (×0.5 damage)"), modifier: { split: 3 },
  },
  massigura: {
    id: "massigura", name: L("まっしぐら", "Beeline"), kind: "modifier", mana: 4, glyph: "急", color: "#1098ad",
    desc: L("ごはんにまっしぐら。この技を出す回は、振る間隔−0.08秒・休けい−0.25秒", "Dinner dash! When cast: swing gap −0.08s, Resting −0.25s"), modifier: { castDelayAdd: -0.08, rechargeAdd: -0.25 },
  },
  churu: {
    id: "churu", name: L("ちゅ〜る休憩", "Treat Break"), kind: "modifier", mana: -15, glyph: "回", color: "#f783ac",
    desc: L("ひとなめして元気回復。読むとやる気が15戻る（★で19・24。ほかの技のやる気を肩代わり）", "One lick to perk up. Restores 15 Energy when read (19 / 24 with ★; pays for other moves)"), modifier: {},
  },
  double: {
    id: "double", name: L("二刀流", "Dual Wield"), kind: "multicast", mana: 6, glyph: "×2", color: "#e67700", count: 2,
    desc: L("右に続く2つの技を同時に出す", "Casts the 2 moves to the right at once"),
  },
  chain: {
    id: "chain", name: L("つづけて", "Then"), kind: "trigger", mana: 8, glyph: "連", color: "#d6336c",
    desc: L("左の技が当たった所から、右の技を出す（例: ひっかき→つづけて→ぶんぶん＝当たった所でぶんぶん）。右が飛ぶ技なら、当たった虫を通りこして先の虫へ", "Casts the right move where the left move hits (e.g. Scratch→Then→Swish = Swish at the hit). A flying right move skips past the hit bug"),
  },
  nandodemo: {
    id: "nandodemo", name: L("何度でも", "Every Hit"), kind: "trigger", on: "every", mana: 12, glyph: "毎", color: "#c2255c",
    desc: L("左の技が当たるたびに、その場所から右の技を出す（回る・置く・多段の技と組むと何度も出る）", "Casts the right move each time the left move hits (fires often with orbit, placed, multi-hit moves)"),
  },
  pyonpyon: {
    id: "pyonpyon", name: L("ぴょんぴょん", "Boing"), kind: "trigger", on: "bounce", mana: 8, glyph: "跳", color: "#0ca678",
    desc: L("左の技が壁ではね返るたびに、そこから右の技を出す", "Casts the right move each time the left move bounces off a wall"),
  },
  todome: {
    id: "todome", name: L("とどめ", "Finisher"), kind: "trigger", on: "kill", mana: 8, glyph: "止", color: "#862e9c",
    desc: L("左の技で虫を倒したら、その場所から右の技を出す（群れの中で次々つながる）", "Casts the right move where the left move kills a bug (chains through crowds)"),
  },
  hitoiki: {
    id: "hitoiki", name: L("ひと呼吸", "Pause"), kind: "trigger", mana: 6, glyph: "時", color: "#7048e8", timer: 0.45,
    desc: L("左の技が飛んで0.45秒たった所から、右の技を出す（当たらなくても出る）", "Casts the right move 0.45s after the left move flies (even without a hit)"),
  },
  issho: {
    id: "issho", name: L("ふたつ持ち", "Two Paws"), kind: "duet", mana: 10, glyph: "両", color: "#e8590c",
    desc: L("前足でおもちゃを2つ同時に扱う。左の技と右の技を1つの技にまとめて出す（左の攻撃力・多段・貫通・はね返り・範囲・属性を右の技に足す）", "Two toys, two front paws. Merges the left and right moves into one (adds left's damage, hits, pierce, bounce, area, element to right)"),
  },
  // ---- 左・両側・全体の修飾 ----
  okawari: {
    id: "okawari", name: L("おかわり", "Seconds"), kind: "modifier", dir: "left", mana: 6, glyph: "皿", color: "#f76707",
    desc: L("左の技が同じ虫に＋1回当たり、攻撃力×1.15", "Left move hits the same bug +1 time, ×1.15 damage"), modifier: { hitsAdd: 1, damageMul: 1.15 },
  },
  oikake: {
    id: "oikake", name: L("おいかけっこ", "Chase Game"), kind: "modifier", dir: "left", mana: 6, glyph: "追", color: "#1971c2",
    desc: L("左の技が虫を追いかける", "Left move chases bugs"), modifier: { homing: 0.7 },
  },
  tsurutsuru: {
    id: "tsurutsuru", name: L("つるつるの床", "Slippery Floor"), kind: "modifier", dir: "left", mana: 5, glyph: "滑", color: "#0b7285",
    desc: L("ワックスがけの床。左の技が壁で2回はね返り、1.3倍遠くまで届く", "Freshly waxed. Left move bounces off walls 2 times, reaches ×1.3 farther"), modifier: { bounce: 2, lifeMul: 1.3 },
  },
  dryer: {
    id: "dryer", name: L("ドライヤー", "Hair Dryer"), kind: "modifier", dir: "both", mana: 10, glyph: "風", color: "#e64980",
    desc: L("左右の技が1.4倍速く・攻撃力＋2になり、2つをいっしょに出す", "Left & right moves ×1.4 faster, +2 damage; cast together"), modifier: { speedMul: 1.4, damageAdd: 2 },
  },
  catnipBag: {
    id: "catnipBag", name: L("またたび袋", "Catnip Bag"), kind: "modifier", dir: "both", mana: 12, glyph: "袋", color: "#2b8a3e",
    desc: L("左右の技の攻撃力×1.3、2つをいっしょに出す", "Left & right moves ×1.3 damage; cast together"), modifier: { damageMul: 1.3 },
  },
  kotatsu: {
    id: "kotatsu", name: L("こたつ布団", "Kotatsu Quilt"), kind: "modifier", dir: "both", mana: 10, glyph: "炬", color: "#c2255c",
    desc: L("左右の技が大きく（×1.3）長くいる（×1.25）。2つをいっしょに出す", "Left & right moves bigger (×1.3), last longer (×1.25). Cast together"), modifier: { sizeMul: 1.3, lifeMul: 1.25 },
  },
  maigofuda: {
    id: "maigofuda", name: L("迷子札", "Name Tag"), kind: "modifier", dir: "all", mana: 15, glyph: "札", color: "#868e96",
    desc: L("全体修飾。どこに置いても、このおもちゃの全部の技の攻撃力＋2（やる気の最大−15）", "Global modifier. Anywhere: all moves in this toy +2 damage (max Energy −15)"), modifier: { damageAdd: 2 },
  },
  hidamari: {
    id: "hidamari", name: L("ひだまり", "Sunny Spot"), kind: "modifier", dir: "all", mana: 10, glyph: "陽", color: "#f59f00",
    desc: L("全体修飾。このおもちゃの全部の技が少し大きい（×1.15）（やる気の最大−10）", "Global modifier. All moves in this toy a bit bigger (×1.15) (max Energy −10)"), modifier: { sizeMul: 1.15 },
  },
  sensor: {
    id: "sensor", name: L("人感センサーライト", "Motion Light"), kind: "modifier", dir: "all", mana: 15, glyph: "感", color: "#fcc419",
    desc: L("全体修飾。このおもちゃの全部の技が少し虫を追う（やる気の最大−15）", "Global modifier. All moves in this toy slightly chase bugs (max Energy −15)"), modifier: { homing: 0.25 },
  },
  kezukuroi: {
    id: "kezukuroi", name: L("毛づくろい", "Grooming"), kind: "modifier", dir: "all", mana: 20, glyph: "繕", color: "#d9480f",
    desc: L("全体修飾。このおもちゃの全部の技の攻撃力×1.15（やる気の最大−20）", "Global modifier. All moves in this toy ×1.15 damage (max Energy −20)"), modifier: { damageMul: 1.15 },
  },
};

/** レア度（書いていないものはふつう）。 */
const RAR: Record<string, number> = {
  hairball: 1, swing: 1, yarn: 1, laser: 1, pounce: 1, hammer: 1, shabon: 1, flash: 1, danbo: 1, korokoro: 1,
  stare: 1, pushy: 1, kajikaji: 1, static: 1, spray: 1, double: 1, chain: 1, okawari: 1, oikake: 1, hitoiki: 1, hidamari: 1,
  butimake: 1, hotsure: 1, pyonpyon: 1, todome: 1, massigura: 1, churu: 1,
  post: 2, kabocha: 2, roomba: 2, big: 2, kenko: 2, dryer: 2, catnipBag: 2, kotatsu: 2, maigofuda: 2, sensor: 2, nekodango: 2, nandodemo: 2,
  friend: 3, issho: 3, kezukuroi: 3, tatougai: 3,
};
for (const d of Object.values(SPELLS)) d.rar = RAR[d.id] ?? 0;
export const SPELL_IDS = Object.keys(SPELLS);
const TRIGGER_TEXT: Record<TriggerOn, string> = { hit: L("左の技が当たると", "When left move hits"), every: L("左の技が当たるたびに", "Each left move hit"), bounce: L("左の技がはね返るたびに", "Each left move bounce"), kill: L("左の技で虫を倒すと", "When left move kills") };

/** 説明欄に出す数値（ラベル・値）。選ぶ判断に使う数字をそろえて見せる。 */
export function spellStats(def: SpellDef): [string, string][] {
  const out: [string, string][] = [];
  if (def.kind === "attack" && def.projectile) {
    const p = def.projectile;
    out.push([L("攻撃力", "Damage"), p.hits > 1 && p.hits < 99 ? L(`${p.damage} ×${p.hits}回`, `${p.damage} ×${p.hits}`) : p.hits >= 99 || p.motion === "summon" ? L(`${p.damage}（${p.hitEvery}秒ごと）`, `${p.damage} (every ${p.hitEvery}s)`) : `${p.damage}`]);
    out.push([L("やる気", "Energy"), `${def.mana}`]);
    out.push([L("動き", "Motion"), MOTION_LABEL[p.motion]]);
    if (p.motion === "shot" || (p.motion === "beam" && p.speed > 0)) out.push([L("とどく距離", "Range"), L(`${Math.round(p.speed * p.life)}マス`, `${Math.round(p.speed * p.life)} tiles`)]);
    if (p.motion === "beam" && p.speed === 0) out.push([L("とどく距離", "Range"), L("壁まで", "To wall")]);
    if (p.motion === "orbit") out.push([L("回る半径", "Orbit"), L(`${p.reach}マス・${p.life}秒`, `${p.reach} tiles · ${p.life}s`)]);
    if (p.motion === "ring") out.push([L("輪の広さ", "Ring size"), L(`半径${p.reach}`, `Radius ${p.reach}`)]);
    if (p.motion === "melee") out.push([L("とどく距離", "Range"), L(`${p.reach}マス`, `${p.reach} tiles`)]);
    if (p.motion === "trap") out.push([L("置いておく", "Lasts"), L(`${p.life}秒`, `${p.life}s`)]);
    if (p.motion === "summon") { out.push([L("出ている時間", "Duration"), L(`${p.life}秒`, `${p.life}s`)]); out.push([L("攻撃の間隔", "Attack gap"), L(`${p.hitEvery}秒`, `${p.hitEvery}s`)]); out.push([L("呼べる数", "Max out"), L(`${def.limit ?? 1}（★で＋1。超えると古い子が帰る）`, `${def.limit ?? 1} (+1 per ★; oldest leaves if over)`)]); }
    if (p.explode) out.push([L("範囲", "Area"), L(`半径${p.explode}`, `Radius ${p.explode}`)]);
    if (p.slow) out.push([L("すくみ", "Flinch"), L(`${p.slow}秒`, `${p.slow}s`)]);
    if (p.pierce) out.push([L("貫通", "Pierce"), L(`${p.pierce}匹`, `${p.pierce} bugs`)]);
    if (p.knock >= 3) out.push([L("はじき飛ばし", "Knockback"), L("あり", "Yes")]);
    if (p.bounce) out.push([L("はね返り", "Bounce"), L(`${p.bounce}回`, `${p.bounce} times`)]);
    if (p.element !== "none") out.push([L("属性", "Element"), ELEMENT_INFO[p.element].name]);
    out.push([L("レア度", "Rarity"), SPELL_RAR_NAME[def.rar ?? 0]]);
    return out;
  }
  out.push([L("やる気", "Energy"), `${def.mana}`]);
  const m = def.modifier;
  if (m?.damageMul || m?.damageAdd) out.push([L("攻撃力", "Damage"), L(`×${m.damageMul ?? 1}${m.damageAdd ? ` ＋${m.damageAdd}` : ""}`, `×${m.damageMul ?? 1}${m.damageAdd ? ` +${m.damageAdd}` : ""}`)]);
  if (m?.hitsAdd) out.push([L("当たる回数", "Hits"), L(`＋${m.hitsAdd}回`, `+${m.hitsAdd}`)]);
  if (m?.sizeMul) out.push([L("大きさ", "Size"), `×${m.sizeMul}`]);
  if (m?.element && m.element !== "none") out.push([L("属性", "Element"), ELEMENT_INFO[m.element].name]);
  if (m?.homing) out.push([L("追尾", "Homing"), L("あり", "Yes")]);
  if (m?.bounce) out.push([L("はね返り", "Bounce"), L(`＋${m.bounce}回`, `+${m.bounce} times`)]);
  if (m?.pierce) out.push([L("貫通", "Pierce"), L(`＋${m.pierce}匹`, `+${m.pierce} bugs`)]);
  if (m?.speedMul && m.speedMul !== 1) out.push([L("速さ", "Speed"), `×${m.speedMul}`]);
  if (m?.slowAdd) out.push([L("すくみ", "Flinch"), L(`＋${m.slowAdd}秒`, `+${m.slowAdd}s`)]);
  if (m?.lifeMul) out.push([L("とどく距離", "Range"), `×${m.lifeMul}`]);
  if (m?.copies) out.push([L("弾の数", "Shots"), L(`×${m.copies}（扇状）`, `×${m.copies} (fan)`)]);
  if (m?.split) out.push([L("消えるとき", "On end"), L(`${m.split}つに割れる`, `Splits into ${m.split}`)]);
  if (m?.castDelayAdd) out.push([L("振る間隔", "Swing gap"), L(`${m.castDelayAdd}秒`, `${m.castDelayAdd}s`)]);
  if (m?.rechargeAdd) out.push([L("休けい", "Resting"), L(`${m.rechargeAdd}秒`, `${m.rechargeAdd}s`)]);
  if (def.mana < 0) out[0] = [L("やる気", "Energy"), L(`＋${-def.mana}（戻る）`, `+${-def.mana} (restore)`)];
  if (def.kind === "multicast") out.push([L("同時に出す", "Casts at once"), L(`右の${def.count}つ`, `${def.count} to the right`)]);
  if (def.kind === "trigger") out.push(def.timer ? [L("出てから", "After"), L(`${def.timer}秒で右の技`, `${def.timer}s: right move`)] : [TRIGGER_TEXT[def.on ?? "hit"], L("そこから右の技", "Right move there")]);
  if (def.kind === "duet") out.push([L("ふたつ持ち", "Two Paws"), L("左の技＋右の技を同時に → 1つの技", "Left + right move → one move")]);
  if (def.kind === "modifier") out.push([L("かかる向き", "Applies to"), `${DIR_INFO[def.dir ?? "right"].arrow} ${DIR_INFO[def.dir ?? "right"].label}`]);
  if (def.dir === "all") out[0] = [L("やる気の最大", "Max Energy"), `−${def.mana}`];
  out.push([L("レア度", "Rarity"), SPELL_RAR_NAME[def.rar ?? 0]]);
  return out;
}

// ---------- ママのお直し（同じ物3つで★の物に） ----------
/** id の末尾の「+」の数が★の数（"claw+" = ひっかき★）。 */
export const baseId = (id: string) => id.replace(/\+*$/, "");
export const starsOf = (id: string) => id.length - baseId(id).length;
export const MAX_STARS = 2;
const starred = new Map<string, SpellDef>();

/** 技の定義（★なら強くしたもの）。 */
export function spellDef(id: string): SpellDef {
  const n = starsOf(id);
  if (!n) return SPELLS[id];
  let d = starred.get(id);
  if (d) return d;
  const b = SPELLS[baseId(id)], k = 1 + 0.5 * n;
  d = { ...b, id, name: `${b.name}${"★".repeat(n)}`, desc: L(`${b.desc}（★合成で強化）`, `${b.desc} (★ upgraded)`) };
  if (b.projectile) d.projectile = { ...b.projectile, damage: +(b.projectile.damage * 1.6 ** n).toFixed(1) };
  if (b.modifier) {
    const m = { ...b.modifier };
    if (m.damageMul) m.damageMul = 1 + (m.damageMul - 1) * k;
    if (m.damageAdd) m.damageAdd *= k;
    if (m.sizeMul) m.sizeMul = 1 + (m.sizeMul - 1) * k;
    if (m.speedMul) m.speedMul = 1 + (m.speedMul - 1) * k;
    if (m.lifeMul) m.lifeMul = 1 + (m.lifeMul - 1) * k;
    if (m.slowAdd) m.slowAdd *= k;
    if (m.homing) m.homing = Math.min(1, m.homing * k);
    if (m.hitsAdd) m.hitsAdd += n;
    if (m.bounce) m.bounce += n;
    if (m.pierce) m.pierce += n;
    d.modifier = m;
  }
  // 修飾は鍛えるほど消費が軽く、やる気が戻るもの（ちゅ〜る休憩）は戻る量が増える
  if (b.kind !== "attack") d.mana = b.mana < 0 ? Math.round(b.mana * (1 + n * 0.3)) : Math.max(1, Math.round(b.mana * 0.7 ** n));
  if (b.limit) { d.limit = b.limit + n; d.projectile = { ...d.projectile!, limit: d.limit }; }   // 召喚は鍛えるほど呼べる数が増える
  starred.set(id, d);
  return d;
}

/** 技のレア度（★はもとの技と同じ）。 */
export const rarOf = (id: string) => SPELLS[baseId(id)]?.rar ?? 0;
