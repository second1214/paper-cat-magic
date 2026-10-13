// 技（おもちゃにはめるアイテム）の定義。DOM・three.js 非依存。
//
// 猫がおもちゃを振ると、スロットの技（爪・牙・毛糸玉など）が出る。技ごとに「動き」（飛ぶ・回る・ビーム…）が違い、
// 修飾で強さ・大きさ・属性（おうちのもの属性）を足していく。

export type SpellKind = "attack" | "modifier" | "multicast" | "trigger" | "duet";

/**
 * 修飾がかかる向き（Magicraft の右・左・両側・全体修飾）。
 * right=右の技 / left=左の技 / both=左右の技（2つをいっしょに出す） / all=置いたおもちゃの全部の技（読まれない・やる気の最大が減る）。
 */
export type ModDir = "right" | "left" | "both" | "all";
export const DIR_INFO: Record<ModDir, { arrow: string; label: string }> = {
  right: { arrow: "▶", label: "右の技にかかる" },
  left: { arrow: "◀", label: "左の技にかかる" },
  both: { arrow: "◀▶", label: "左右の技にかかり、いっしょに出す" },
  all: { arrow: "全", label: "このおもちゃの全部の技にかかる" },
};

/** 技のレア度（融合台で使う）。0 ふつう / 1 レア / 2 エピック / 3 伝説。 */
export const SPELL_RAR_NAME = ["ふつう", "レア", "エピック", "伝説"];

/** 技が当たったときに出す絵（描画側で使う）。 */
export type TechFx = "claw" | "bite" | "hairball" | "hiss" | "swing" | "yarn" | "laser" | "pounce" | "punch" | "post" | "friend" | "roomba"
  | "squirt" | "duck" | "hammer" | "bubble" | "flash" | "pumpkin" | "box" | "roller" | "enemy" | "gas";

/** 技の動き。shot=飛ぶ / orbit=猫のまわりを回る / beam=猫から線で届く / ring=足元から広がる輪 / melee=目の前で連打 / trap=床に置く。 */
export type Motion = "shot" | "orbit" | "beam" | "ring" | "melee" | "trap" | "summon";
export const MOTION_LABEL: Record<Motion, string> = { shot: "飛ぶ", orbit: "まわりを回る", beam: "ビーム", ring: "衝撃波", melee: "近くを連打", trap: "床に置く", summon: "召喚" };

/**
 * おうちのもの属性（炎・雷の代わり）。組み合わせると強くなる:
 * びしょぬれの虫にビリビリ＝2倍・たくさん連鎖 / ねばねばの虫に虫よけ＝じわじわ2倍。
 */
export type Element = "none" | "static" | "wet" | "sticky" | "repel";
export const ELEMENT_INFO: Record<Exclude<Element, "none">, { name: string; color: string; desc: string }> = {
  static: { name: "ビリビリ", color: "#f5c400", desc: "毛の静電気。当たると近くの虫2匹へ飛び移る（びしょぬれの虫には2倍＆4匹）" },
  wet: { name: "びしょぬれ", color: "#3fa7ff", desc: "4秒ぬれて遅くなる。ビリビリがよく効く" },
  sticky: { name: "ねばねば", color: "#c9a227", desc: "ガムテープで1.6秒足止め（ボスは少しだけ）。虫よけがよく効く" },
  repel: { name: "虫よけ", color: "#5fbf5a", desc: "3秒間じわじわダメージ（ねばねばの虫には2倍）" },
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
}

/**
 * 召喚（Magicraft と同じ仕様）: 仲間を呼び出し、出ている間ずっと戦わせる。
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
  /** レア度（下の RAR で決める）。 */
  rar?: number;
}

const base = (o: Partial<ProjectileStats> & { color: string; tech: TechFx }): ProjectileStats => ({
  damage: 5, speed: 12, radius: 0.2, life: 1.4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.04,
  motion: "shot", hits: 1, hitEvery: 0.12, reach: 0, element: "none", knock: 0, ...o,
});

/** 種類ごとの表示名（UI の凡例に使う）。 */
export const KIND_LABEL: Record<SpellKind, string> = {
  attack: "技",
  modifier: "修飾",
  multicast: "修飾",
  trigger: "修飾",
  duet: "合体",
};

export const SPELLS: Record<string, SpellDef> = {
  claw: {
    id: "claw", name: "ひっかき", kind: "attack", mana: 4, glyph: "爪", color: "#e85d4a",
    desc: "爪でひっかく。速くて軽い。連発向き",
    projectile: base({ damage: 5, speed: 15, life: 1.0, spread: 0.08, color: "#ff8a70", tech: "claw" }),
  },
  bite: {
    id: "bite", name: "かみつき", kind: "attack", mana: 12, glyph: "牙", color: "#c0392b",
    desc: "ガブッと強い一撃。少し遅い",
    projectile: base({ damage: 14, speed: 10, radius: 0.24, life: 1.5, color: "#ff6b6b", tech: "bite" }),
  },
  hairball: {
    id: "hairball", name: "毛玉", kind: "attack", mana: 18, glyph: "毛", color: "#b07a3c",
    desc: "当たった所で毛玉がはじけ、まわりの虫にも当たる",
    projectile: base({ damage: 9, speed: 8, radius: 0.26, life: 1.8, explode: 1.7, color: "#e0a060", tech: "hairball" }),
  },
  hiss: {
    id: "hiss", name: "シャー", kind: "attack", mana: 8, glyph: "シ", color: "#7c5cbf",
    desc: "威嚇。当たった虫がすくんで遅くなる",
    projectile: base({ damage: 4, speed: 12, life: 1.3, slow: 2.0, color: "#c9a6ff", tech: "hiss" }),
  },
  swing: {
    id: "swing", name: "ぶんぶん", kind: "attack", mana: 14, glyph: "回", color: "#e64980",
    desc: "ねこじゃらしを振り回す。先っぽが猫のまわりを回り、近づく虫を何度もたたく",
    projectile: base({ damage: 6, speed: 7, radius: 0.38, life: 1.4, motion: "orbit", reach: 1.7, hits: 3, hitEvery: 0.35, knock: 3, color: "#ff9ec4", tech: "swing" }),
  },
  yarn: {
    id: "yarn", name: "毛糸玉ころがし", kind: "attack", mana: 16, glyph: "糸", color: "#d6336c",
    desc: "毛糸玉がころがり、のびた糸がビームになって並んだ虫をまとめて何度もこする",
    projectile: base({ damage: 4, speed: 10, radius: 0.3, life: 1.1, motion: "beam", hits: 3, hitEvery: 0.3, spread: 0.02, color: "#f783ac", tech: "yarn" }),
  },
  laser: {
    id: "laser", name: "レーザーポインター", kind: "attack", mana: 10, glyph: "光", color: "#f03e3e",
    desc: "赤い点が一瞬で壁まで走る。線の上の虫ぜんぶに当たる",
    projectile: base({ damage: 7, speed: 0, radius: 0.15, life: 0.22, motion: "beam", reach: 14, spread: 0.01, color: "#ff3b3b", tech: "laser" }),
  },
  pounce: {
    id: "pounce", name: "ねこジャンプ", kind: "attack", mana: 14, glyph: "跳", color: "#f08c00",
    desc: "跳んで着地し、足元から輪の衝撃波。囲まれたときに虫をはじき飛ばす",
    projectile: base({ damage: 10, speed: 0, radius: 0.3, life: 0.4, motion: "ring", reach: 2.6, knock: 7, color: "#ffc078", tech: "pounce" }),
  },
  punch: {
    id: "punch", name: "猫パンチ連打", kind: "attack", mana: 8, glyph: "拳", color: "#e8590c",
    desc: "目の前をぺしぺし連打。近いけれど1匹に何度も当たる",
    projectile: base({ damage: 3, speed: 0, radius: 0.5, life: 0.45, motion: "melee", reach: 1.5, hits: 4, hitEvery: 0.1, knock: 1, color: "#ffa8a8", tech: "punch" }),
  },
  post: {
    id: "post", name: "爪とぎ", kind: "attack", mana: 18, glyph: "置", color: "#a0522d",
    desc: "段ボールの爪とぎを前に置く。上を通る虫を7秒間ガリガリ削る（4つまで）",
    projectile: base({ damage: 4, speed: 0, radius: 0.7, life: 7, motion: "trap", reach: 1.3, hits: 99, hitEvery: 0.6, color: "#d9a066", tech: "post" }),
  },
  friend: {
    id: "friend", name: "友達猫", kind: "attack", mana: 40, glyph: "猫", color: "#868e96", limit: 2,
    desc: "友達の猫を呼ぶ。近くの虫を追いかけてひっかく。修飾・属性は友達猫の攻撃にかかる",
    projectile: base({ damage: 4, speed: 5, radius: 0.34, life: 15, motion: "summon", reach: 0.85, hitEvery: 0.6, spread: 0, color: "#ced4da", tech: "friend" }),
  },
  roomba: {
    id: "roomba", name: "ルンバ", kind: "attack", mana: 35, glyph: "掃", color: "#495057", limit: 1,
    desc: "お掃除ロボを呼ぶ。部屋を走り回って壁ではね返り、ぶつかった虫を吸いこむ",
    projectile: base({ damage: 4, speed: 3.4, radius: 0.55, life: 15, motion: "summon", hits: 99, hitEvery: 0.5, knock: 2, spread: 0.6, color: "#adb5bd", tech: "roomba" }),
  },
  // ---- 飼い主が買ってきた物シリーズ ----
  mizudeppo: {
    id: "mizudeppo", name: "水鉄砲", kind: "attack", mana: 5, glyph: "水", color: "#4dabf7",
    desc: "お風呂用の水鉄砲。弱いけれど速く、当たるとびしょぬれ",
    projectile: base({ damage: 3, speed: 16, life: 0.8, spread: 0.06, element: "wet", color: "#74c0fc", tech: "squirt" }),
  },
  ahiru: {
    id: "ahiru", name: "ゴムのアヒル", kind: "attack", mana: 10, glyph: "鳥", color: "#fab005",
    desc: "プピッと鳴るお風呂のアヒル。壁で4回はね返る",
    projectile: base({ damage: 7, speed: 9, radius: 0.28, life: 3, bounce: 4, knock: 2, color: "#ffd43b", tech: "duck" }),
  },
  hammer: {
    id: "hammer", name: "ピコピコハンマー", kind: "attack", mana: 12, glyph: "槌", color: "#f03e3e",
    desc: "100円ショップのおもちゃ。目の前を1発たたいて、はじき飛ばす",
    projectile: base({ damage: 16, speed: 0, radius: 0.6, life: 0.25, motion: "melee", reach: 1.7, knock: 7, color: "#ff8787", tech: "hammer" }),
  },
  shabon: {
    id: "shabon", name: "シャボン玉", kind: "attack", mana: 9, glyph: "泡", color: "#74c0fc",
    desc: "ふわふわ漂って虫をゆっくり追いかけ、パチンとはじける",
    projectile: base({ damage: 6, speed: 3.5, radius: 0.3, life: 3.5, explode: 1.3, homing: 0.4, color: "#d0ebff", tech: "bubble" }),
  },
  flash: {
    id: "flash", name: "自撮りフラッシュ", kind: "attack", mana: 12, glyph: "光", color: "#fcc419",
    desc: "飼い主の自撮りの光。まわりの虫がまぶしくて2.5秒すくむ",
    projectile: base({ damage: 3, speed: 0, life: 0.35, motion: "ring", reach: 3.4, slow: 2.5, color: "#fff3bf", tech: "flash" }),
  },
  kabocha: {
    id: "kabocha", name: "ハロウィンのかぼちゃ", kind: "attack", mana: 24, glyph: "瓜", color: "#fd7e14",
    desc: "去年のハロウィンの飾り。転がって大きくはじける",
    projectile: base({ damage: 14, speed: 6, radius: 0.36, life: 1.8, explode: 2.2, knock: 4, color: "#ff922b", tech: "pumpkin" }),
  },
  danbo: {
    id: "danbo", name: "通販の段ボール", kind: "attack", mana: 14, glyph: "箱", color: "#c0864a",
    desc: "床に置くと、上を通った虫がはまってねばねば（置くものは合わせて4つまで）",
    projectile: base({ damage: 2, speed: 0, radius: 0.75, life: 8, motion: "trap", reach: 1.3, hits: 99, hitEvery: 0.5, element: "sticky", color: "#d9a066", tech: "box" }),
  },
  korokoro: {
    id: "korokoro", name: "粘着コロコロ", kind: "attack", mana: 15, glyph: "転", color: "#868e96",
    desc: "掃除用のコロコロ。転がった線の上の虫がくっついて止まる",
    projectile: base({ damage: 3, speed: 9, radius: 0.32, life: 1.1, motion: "beam", hits: 2, hitEvery: 0.4, element: "sticky", color: "#dee2e6", tech: "roller" }),
  },
  matatabi: {
    id: "matatabi", name: "またたび", kind: "modifier", mana: 8, glyph: "強", color: "#2f9e44",
    desc: "右の技のダメージ1.5倍＋3", modifier: { damageMul: 1.5, damageAdd: 3 },
  },
  stare: {
    id: "stare", name: "じーっ", kind: "modifier", mana: 8, glyph: "追", color: "#1c7ed6",
    desc: "右の技が虫を追いかける", modifier: { homing: 0.75, speedMul: 0.9 },
  },
  bouncy: {
    id: "bouncy", name: "ぽよん", kind: "modifier", mana: 6, glyph: "跳", color: "#0ca678",
    desc: "右の技が壁で3回はね返る", modifier: { bounce: 3 },
  },
  pushy: {
    id: "pushy", name: "ぐいぐい", kind: "modifier", mana: 8, glyph: "貫", color: "#5c7cfa",
    desc: "右の技が虫を2匹ぶん突き抜ける", modifier: { pierce: 2 },
  },
  kajikaji: {
    id: "kajikaji", name: "かじかじ", kind: "modifier", mana: 8, glyph: "多", color: "#ae3ec9",
    desc: "多段。右の技が同じ虫に＋2回当たる（1回の攻撃力は×0.7）", modifier: { hitsAdd: 2, damageMul: 0.7 },
  },
  big: {
    id: "big", name: "でっかく", kind: "modifier", mana: 10, glyph: "大", color: "#f59f00",
    desc: "右の技が大きくなる（当たり・回る半径・輪が×1.6）。少し遅くなる", modifier: { sizeMul: 1.6, damageMul: 1.2, speedMul: 0.8 },
  },
  small: {
    id: "small", name: "ちっちゃく", kind: "modifier", mana: 6, glyph: "小", color: "#74b816",
    desc: "右の技が豆つぶになる。当てにくいけれど攻撃力×1.8", modifier: { sizeMul: 0.45, damageMul: 1.8 },
  },
  quick: {
    id: "quick", name: "すばやく", kind: "modifier", mana: 6, glyph: "速", color: "#15aabf",
    desc: "右の技が1.8倍速くなる（回る・連打も速く）", modifier: { speedMul: 1.8 },
  },
  static: {
    id: "static", name: "静電気", kind: "modifier", mana: 8, glyph: "電", color: "#f5c400",
    desc: "右の技にビリビリ属性をつける", modifier: { element: "static" },
  },
  water: {
    id: "water", name: "水のみ皿", kind: "modifier", mana: 6, glyph: "水", color: "#3fa7ff",
    desc: "右の技にびしょぬれ属性をつける", modifier: { element: "wet" },
  },
  tape: {
    id: "tape", name: "ガムテープ", kind: "modifier", mana: 8, glyph: "粘", color: "#c9a227",
    desc: "右の技にねばねば属性をつける", modifier: { element: "sticky" },
  },
  spray: {
    id: "spray", name: "虫よけスプレー", kind: "modifier", mana: 8, glyph: "毒", color: "#5fbf5a",
    desc: "右の技に虫よけ属性をつける", modifier: { element: "repel" },
  },
  rame: {
    id: "rame", name: "ラメのシール", kind: "modifier", mana: 6, glyph: "煌", color: "#cc5de8",
    desc: "キラキラ。右の技が少し大きくなり、攻撃力＋2", modifier: { sizeMul: 1.3, damageAdd: 2 },
  },
  suzu: {
    id: "suzu", name: "鈴のリボン", kind: "modifier", mana: 6, glyph: "鈴", color: "#fab005",
    desc: "チリンと鳴る。右の技が当たった虫が1秒すくむ", modifier: { slowAdd: 1 },
  },
  kenko: {
    id: "kenko", name: "よくわからない健康グッズ", kind: "modifier", mana: 14, glyph: "謎", color: "#495057",
    desc: "通販で買った謎の石。なぜか右の技の攻撃力×1.7", modifier: { damageMul: 1.7 },
  },
  jidori: {
    id: "jidori", name: "自撮り棒", kind: "modifier", mana: 6, glyph: "伸", color: "#228be6",
    desc: "右の技が1.5倍遠くまで届く（置く技・仲間は1.5倍長くいる）", modifier: { lifeMul: 1.5 },
  },
  double: {
    id: "double", name: "二刀流", kind: "multicast", mana: 6, glyph: "×2", color: "#e67700", count: 2,
    desc: "右に続く2つの技を同時に出す",
  },
  chain: {
    id: "chain", name: "つづけて", kind: "trigger", mana: 8, glyph: "連", color: "#d6336c",
    desc: "左の技が当たった所から、右の技を出す（例: ひっかき→つづけて→ぶんぶん＝当たった所でぶんぶん）",
  },
  hitoiki: {
    id: "hitoiki", name: "ひと呼吸", kind: "trigger", mana: 6, glyph: "時", color: "#7048e8", timer: 0.45,
    desc: "左の技が飛んで0.45秒たった所から、右の技を出す（当たらなくても出る）",
  },
  issho: {
    id: "issho", name: "いっしょに", kind: "duet", mana: 10, glyph: "合", color: "#e8590c",
    desc: "合体。左の技を右の技に混ぜて1つにする（左の攻撃力・多段・貫通・はね返り・範囲・属性を右の技に足す）",
  },
  // ---- 左・両側・全体の修飾 ----
  okawari: {
    id: "okawari", name: "おかわり", kind: "modifier", dir: "left", mana: 6, glyph: "皿", color: "#f76707",
    desc: "左の技が同じ虫に＋1回当たり、攻撃力×1.15", modifier: { hitsAdd: 1, damageMul: 1.15 },
  },
  oikake: {
    id: "oikake", name: "おいかけっこ", kind: "modifier", dir: "left", mana: 6, glyph: "追", color: "#1971c2",
    desc: "左の技が虫を追いかける", modifier: { homing: 0.7 },
  },
  tsurutsuru: {
    id: "tsurutsuru", name: "つるつるの床", kind: "modifier", dir: "left", mana: 5, glyph: "滑", color: "#0b7285",
    desc: "ワックスがけの床。左の技が壁で2回はね返り、1.3倍遠くまで届く", modifier: { bounce: 2, lifeMul: 1.3 },
  },
  dryer: {
    id: "dryer", name: "ドライヤー", kind: "modifier", dir: "both", mana: 10, glyph: "風", color: "#e64980",
    desc: "左右の技が1.4倍速く・攻撃力＋2になり、2つをいっしょに出す", modifier: { speedMul: 1.4, damageAdd: 2 },
  },
  catnipBag: {
    id: "catnipBag", name: "またたび袋", kind: "modifier", dir: "both", mana: 12, glyph: "袋", color: "#2b8a3e",
    desc: "左右の技の攻撃力×1.3、2つをいっしょに出す", modifier: { damageMul: 1.3 },
  },
  kotatsu: {
    id: "kotatsu", name: "こたつ布団", kind: "modifier", dir: "both", mana: 10, glyph: "炬", color: "#c2255c",
    desc: "左右の技が大きく（×1.3）長くいる（×1.25）。2つをいっしょに出す", modifier: { sizeMul: 1.3, lifeMul: 1.25 },
  },
  maigofuda: {
    id: "maigofuda", name: "迷子札", kind: "modifier", dir: "all", mana: 15, glyph: "札", color: "#868e96",
    desc: "全体修飾。どこに置いても、このおもちゃの全部の技の攻撃力＋2（やる気の最大−15）", modifier: { damageAdd: 2 },
  },
  hidamari: {
    id: "hidamari", name: "ひだまり", kind: "modifier", dir: "all", mana: 10, glyph: "陽", color: "#f59f00",
    desc: "全体修飾。このおもちゃの全部の技が少し大きい（×1.15）（やる気の最大−10）", modifier: { sizeMul: 1.15 },
  },
  sensor: {
    id: "sensor", name: "人感センサーライト", kind: "modifier", dir: "all", mana: 15, glyph: "感", color: "#fcc419",
    desc: "全体修飾。このおもちゃの全部の技が少し虫を追う（やる気の最大−15）", modifier: { homing: 0.25 },
  },
  kezukuroi: {
    id: "kezukuroi", name: "毛づくろい", kind: "modifier", dir: "all", mana: 20, glyph: "繕", color: "#d9480f",
    desc: "全体修飾。このおもちゃの全部の技の攻撃力×1.15（やる気の最大−20）", modifier: { damageMul: 1.15 },
  },
};

/** レア度（書いていないものはふつう）。 */
const RAR: Record<string, number> = {
  hairball: 1, swing: 1, yarn: 1, laser: 1, pounce: 1, hammer: 1, shabon: 1, flash: 1, danbo: 1, korokoro: 1,
  stare: 1, pushy: 1, kajikaji: 1, static: 1, spray: 1, double: 1, chain: 1, okawari: 1, oikake: 1, hitoiki: 1, hidamari: 1,
  post: 2, kabocha: 2, roomba: 2, big: 2, kenko: 2, dryer: 2, catnipBag: 2, kotatsu: 2, maigofuda: 2, sensor: 2,
  friend: 3, issho: 3, kezukuroi: 3,
};
for (const d of Object.values(SPELLS)) d.rar = RAR[d.id] ?? 0;
export const SPELL_IDS = Object.keys(SPELLS);

/** 説明欄に出す数値（ラベル・値）。Magicraft の魔法説明のように、選ぶ判断に使う数字をそろえて見せる。 */
export function spellStats(def: SpellDef): [string, string][] {
  const out: [string, string][] = [];
  if (def.kind === "attack" && def.projectile) {
    const p = def.projectile;
    out.push(["攻撃力", p.hits > 1 && p.hits < 99 ? `${p.damage} ×${p.hits}回` : p.hits >= 99 || p.motion === "summon" ? `${p.damage}（${p.hitEvery}秒ごと）` : `${p.damage}`]);
    out.push(["やる気", `${def.mana}`]);
    out.push(["動き", MOTION_LABEL[p.motion]]);
    if (p.motion === "shot" || (p.motion === "beam" && p.speed > 0)) out.push(["とどく距離", `${Math.round(p.speed * p.life)}マス`]);
    if (p.motion === "beam" && p.speed === 0) out.push(["とどく距離", "壁まで"]);
    if (p.motion === "orbit") out.push(["回る半径", `${p.reach}マス・${p.life}秒`]);
    if (p.motion === "ring") out.push(["輪の広さ", `半径${p.reach}`]);
    if (p.motion === "melee") out.push(["とどく距離", `${p.reach}マス`]);
    if (p.motion === "trap") out.push(["置いておく", `${p.life}秒`]);
    if (p.motion === "summon") { out.push(["出ている時間", `${p.life}秒`]); out.push(["攻撃の間隔", `${p.hitEvery}秒`]); out.push(["呼べる数", `${def.limit ?? 1}（超えると古い子が帰る）`]); }
    if (p.explode) out.push(["範囲", `半径${p.explode}`]);
    if (p.slow) out.push(["すくみ", `${p.slow}秒`]);
    if (p.pierce) out.push(["貫通", `${p.pierce}匹`]);
    if (p.knock >= 3) out.push(["はじき飛ばし", "あり"]);
    if (p.bounce) out.push(["はね返り", `${p.bounce}回`]);
    if (p.element !== "none") out.push(["属性", ELEMENT_INFO[p.element].name]);
    out.push(["レア度", SPELL_RAR_NAME[def.rar ?? 0]]);
    return out;
  }
  out.push(["やる気", `${def.mana}`]);
  const m = def.modifier;
  if (m?.damageMul || m?.damageAdd) out.push(["攻撃力", `×${m.damageMul ?? 1}${m.damageAdd ? ` ＋${m.damageAdd}` : ""}`]);
  if (m?.hitsAdd) out.push(["当たる回数", `＋${m.hitsAdd}回`]);
  if (m?.sizeMul) out.push(["大きさ", `×${m.sizeMul}`]);
  if (m?.element && m.element !== "none") out.push(["属性", ELEMENT_INFO[m.element].name]);
  if (m?.homing) out.push(["追尾", "あり"]);
  if (m?.bounce) out.push(["はね返り", `＋${m.bounce}回`]);
  if (m?.pierce) out.push(["貫通", `＋${m.pierce}匹`]);
  if (m?.speedMul && m.speedMul !== 1) out.push(["速さ", `×${m.speedMul}`]);
  if (m?.slowAdd) out.push(["すくみ", `＋${m.slowAdd}秒`]);
  if (m?.lifeMul) out.push(["とどく距離", `×${m.lifeMul}`]);
  if (def.kind === "multicast") out.push(["同時に出す", `右の${def.count}つ`]);
  if (def.kind === "trigger") out.push(def.timer ? ["出てから", `${def.timer}秒で右の技`] : ["左の技が当たると", "そこから右の技"]);
  if (def.kind === "duet") out.push(["合体", "左の技＋右の技 → 1つ"]);
  if (def.kind === "modifier") out.push(["かかる向き", `${DIR_INFO[def.dir ?? "right"].arrow} ${DIR_INFO[def.dir ?? "right"].label}`]);
  if (def.dir === "all") out[0] = ["やる気の最大", `−${def.mana}`];
  out.push(["レア度", SPELL_RAR_NAME[def.rar ?? 0]]);
  return out;
}

// ---------- 合成（Magicraft の鍛冶: 同じ技3つで★の技に） ----------
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
  d = { ...b, id, name: `${b.name}${"★".repeat(n)}`, desc: `${b.desc}（★合成で強化）` };
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
  if (b.kind !== "attack") d.mana = Math.max(1, Math.round(b.mana * 0.7 ** n));
  starred.set(id, d);
  return d;
}

/** 技のレア度（★はもとの技と同じ）。 */
export const rarOf = (id: string) => SPELLS[baseId(id)]?.rar ?? 0;
