// HTML の HUD と各画面（はじめに・ごほうび選び・おもちゃの編集・結果）。
// アイテムは「絵・名前・種類・数値・説明」をいつも同じ形で見せる。
import { baseId, DIR_INFO, ELEMENT_INFO, KIND_LABEL, MOTION_LABEL, rarOf, SPELL_RAR_NAME, SPELLS, spellDef, spellStats, starsOf, type SpellDef } from "../core/spells";
import { groupSummary, SUB_LABEL, TOYS, toyStats, type ToyDef } from "../core/wand";
import { CURSES } from "../core/curses";
import { findUnlock, isOpen, UNLOCKS, unlockText, type Unlock, type UnlockKind } from "../core/unlock";
import { addNiboshi, buyUpgrade, canPick, loadRecord, nameEndless, recordEndless, recordRun, recordText, setFavorites } from "./record";
import { fetchBoard, saveName, savedName, submitScore, type Board } from "./ranking";
import { cleanName, POINTS } from "../core/score";
import { loadRun, runLabel } from "./save";
import { adsAvailable, rewardedAd } from "../platform";
import { DIFFS, favSlots, runReward, UPGRADES } from "../core/meta";
import { enemyTexture } from "../render/stickers";
import { ENEMY, POTIONS, type EnemyType } from "../game/world";

const bugUrls = new Map<EnemyType, string>();
/** タイトル用の虫の絵（ゲーム中と同じステッカー）。 */
const bugUrl = (t: EnemyType) => {
  let u = bugUrls.get(t);
  if (!u) { u = (enemyTexture(t).image as HTMLCanvasElement).toDataURL(); bugUrls.set(t, u); }
  return u;
};
import { isJa, L, setLang } from "../i18n";
import { ALTAR_NAME, REWARD_INFO, type Choice, type HeldToy, type Spot, type World } from "../game/world";
import { elementCanvas, gearCanvas, kibbleCanvas, relicCanvas, rewardCanvas, spellCanvas, toyCanvas, urlOf } from "../art/items";
import { bonusRows, GEAR, GEAR_FX, GEAR_IDS, GEAR_SLOTS, gearBonus, RARITY, RELIC_IDS, RELICS, SETS, setCounts, SLOT_NAME, type Gear, type GearItem } from "../core/items";

/** 名前などを HTML に入れるときの文字の置きかえ。 */
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const isTouch = () => matchMedia("(pointer: coarse)").matches;

const isMod = (id: string) => spellDef(id).kind !== "attack";
const spellImg = (id: string) => urlOf(spellCanvas(baseId(id), spellDef(id).projectile?.tech));

/** ママの場面絵とセリフ。 */
const mama = (img: "scared" | "relief" | "pet" | "scream", line: string, small = false) =>
  `<div class="mama ${small ? "small" : ""}"><img src="${import.meta.env.BASE_URL}mama/${img}.png" alt="${L("ママ", "Mama")}"><div class="say">${line}</div></div>`;

/** 修飾のかかる向きの矢印（▶右・◀左・◀▶両側・全 全体・つづけて/ふたつ持ちは左右をつなぐ）。 */
const arrowOf = (s: SpellDef) => s.kind === "attack" ? "" : s.kind === "modifier" ? DIR_INFO[s.dir ?? "right"].arrow : s.kind === "multicast" ? "▶" : "◀▶";
/** 修飾の説明の札（カード用）。 */
const TRIG_TAG = { hit: L("当たると", "hits"), every: L("当たるたびに", "hits (each)"), bounce: L("はね返るたびに", "bounces (each)"), kill: L("虫を倒すと", "kills a bug") } as const;
const modTag = (s: SpellDef) => s.kind === "trigger" ? (s.timer ? L("つづけて ◀左の技から時間で右の技", "Then ◀left move, right move on a timer") : L(`つづけて ◀左の技が${TRIG_TAG[s.on ?? "hit"]}右の技▶`, `Then when ◀left move ${TRIG_TAG[s.on ?? "hit"]}, right move▶`))
  : s.kind === "duet" ? L("ふたつ持ち ◀左と右のおもちゃを同時に扱い、1つの技に▶", "Two Paws ◀merge left & right into one move▶") : s.kind === "multicast" ? L("修飾 ▶右の技を同時に", "Modifier ▶right moves at once")
  : `${s.modifier?.element ? L("属性", "Element") : s.dir === "all" ? L("全体修飾", "Global modifier") : L("修飾", "Modifier")} ${DIR_INFO[s.dir ?? "right"].arrow}${DIR_INFO[s.dir ?? "right"].label}`;

/** スロット・手持ちの1マス。修飾にはかかる向きの矢印、レア度は下の帯。 */
const cell = (id: string | null, attrs = "", extra = "") => {
  if (!id) return `<button class="cell empty ${extra}" ${attrs}></button>`;
  const s = spellDef(id), mod = isMod(id), dir = s.kind === "modifier" ? s.dir ?? "right" : s.kind === "attack" ? "" : "both";
  return `<button class="cell ${mod ? "mod" : "atk"} dir-${dir} rar${rarOf(id)} ${extra}" style="--c:${s.color}" ${attrs}>
    <img src="${spellImg(id)}" alt="">${starsOf(id) ? `<span class="stars">${"★".repeat(starsOf(id))}</span>` : ""}<span class="badge">${s.modifier?.element ? L("属性", "Elem") : s.dir === "all" ? L("全体", "All") : KIND_LABEL[s.kind]}</span>${mod ? `<span class="arrow">${arrowOf(s)}</span>` : ""}</button>`;
};

/** おもちゃ・レリック・装備のマス。 */
const itemCell = (kind: "toy" | "relic" | "gear", id: string | null, attrs = "", extra = "", rar = 0) => {
  if (!id) return `<button class="cell empty ${extra}" ${attrs}></button>`;
  const url = urlOf(kind === "toy" ? toyCanvas(id) : kind === "relic" ? relicCanvas(id) : gearCanvas(id));
  const color = kind === "gear" ? RARITY[rar].color : "";
  return `<button class="cell ${kind} ${extra}" style="${color ? `--c:${color}` : ""}" ${attrs}><img src="${url}" alt=""></button>`;
};

const statsTable = (rows: [string, string][]) =>
  `<table class="stats">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;

/** アイテムの説明カード（絵・名前・種類・数値・説明）。 */
function spellCard(id: string, attrs = "") {
  const s = spellDef(id), mod = isMod(id);
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${spellImg(id)}" alt=""><div><b>${s.name}</b><span class="tag ${mod ? "mod" : "atk"}">${mod ? modTag(s) : L(`技（${MOTION_LABEL[s.projectile!.motion]}）`, `Move (${MOTION_LABEL[s.projectile!.motion]})`)}</span></div></div>
    ${statsTable(spellStats(s))}<p class="desc">${s.desc}</p>${elementNote(s.modifier?.element)}</div>`;
}

/** 属性の説明（しるしの絵つき）。 */
function elementNote(el?: string) {
  if (!el || el === "none") return "";
  const info = ELEMENT_INFO[el as keyof typeof ELEMENT_INFO];
  return `<p class="elem" style="--c:${info.color}"><img src="${urlOf(elementCanvas(el as keyof typeof ELEMENT_INFO))}" alt=""><span><b>${info.name}</b> ${info.desc}</span></p>`;
}
/** レリックの説明カード。 */
function relicCard(id: string, attrs = "") {
  const r = RELICS[id];
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${urlOf(relicCanvas(id))}" alt=""><div><b>${r.name}</b><span class="tag relic">${L("レリック", "Charm")}</span></div></div>
    ${statsTable(bonusRows(r.bonus))}<p class="desc">${r.desc}</p></div>`;
}

/** 装備の説明カード。レアリティ・特殊効果・セットのボーナスと、今そろっている数も見せる。 */
function gearCard(item: GearItem, gear: Gear | null, attrs = "") {
  const g = GEAR[item.id], set = SETS[g.set], R = RARITY[item.rar];
  const worn = gear?.[g.slot];
  const have = gear ? (setCounts(gear)[g.set] ?? 0) + (worn && GEAR[worn.id].set === g.set ? 0 : 1) : 0;   // これを着けたときの数
  const line = (n: number, b: Parameters<typeof bonusRows>[0]) =>
    `<div class="setline ${gear && have >= n ? "on" : ""}"><b>${L(`${n}つ`, `${n} pcs `)}</b>${bonusRows(b).map(([k, v]) => `${k} ${v}`).join("・")}</div>`;
  const fx = item.fx.length ? `<div class="fxline">${L("特殊効果: ", "Special: ")}${item.fx.map((f) => GEAR_FX[f].name).join("・")}</div>` : "";
  return `<div class="card rar${item.rar}" style="--r:${R.color}" ${attrs}>
    <div class="head"><img src="${urlOf(gearCanvas(item.id))}" alt=""><div><b>${g.name}</b><span class="tag" style="background:${R.color}">${R.name}</span><span class="tag gear" style="background:${set.color}">${SLOT_NAME[g.slot]}</span></div></div>
    ${statsTable(bonusRows(gearBonus(item)))}${fx}<p class="desc">${g.desc}</p>
    <div class="setbox" style="--c:${set.color}"><div class="setname">${set.name}${gear ? L(`（着けると ${have}/3）`, ` (if worn ${have}/3)`) : ""}</div>${line(2, set.two)}${line(3, set.three)}</div></div>`;
}

function toyCard(t: ToyDef, attrs = "") {
  const d = TOYS[t.id] ?? t, pre = [...d.slots, ...(d.sub?.slots ?? [])].filter((x): x is string => !!x);   // 売り物としての最初の中身
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${urlOf(toyCanvas(t.id))}" alt=""><div><b>${t.name}</b><span class="tag toy">${t.auto ? L("電池式のおもちゃ（自動）", "Battery toy (auto)") : L("おもちゃ（装備）", "Toy (equip)")}</span></div></div>
    ${statsTable(toyStats(t))}${pre.length ? `<div class="pre">${L("最初から入っている: ", "Comes with: ")}${pre.map((id) => spellDef(id).name).join("・")}</div>` : ""}<p class="desc">${t.desc}</p></div>`;
}

/** 解放していないもののカード（条件を見せる）。 */
function lockedCard(u: Unlock) {
  return `<div class="card locked"><div class="head"><div class="qmark">？</div><div><b>${L("まだ解放していない", "Locked")}</b><span class="tag">${u.kind === "toy" ? L("おもちゃ", "Toy") : u.kind === "relic" ? L("レリック", "Charm") : L("技・修飾", "Move / Modifier")}</span></div></div>
    <p class="desc">${L("解放の条件: ", "To unlock: ")}<b>${unlockText(u)}</b><br>${L("負けても記録は積み上がる。条件を満たすと、次の冒険から出てくる。", "Progress counts even if you lose. Once met, it shows up from your next run.")}</p></div>`;
}

/** サブスロットの列（たまり具合のメーターつき）。 */
function subRow(h: HeldToy, cellOf: (i: number) => string) {
  const sub = h.def.sub;
  if (!sub) return "";
  return `<div class="subrow"><span class="sublabel">${L("サブ", "Sub")}<small>${L(`${SUB_LABEL[sub.charge](sub.need)}で発動`, `Fires: ${SUB_LABEL[sub.charge](sub.need)}`)}</small></span><div class="cells">${sub.slots.map((_, i) => cellOf(i)).join("")}</div>
    <div class="meter"><i style="width:${Math.min(100, (h.charge / sub.need) * 100)}%"></i></div></div>`;
}

/** スロット列＋まとまりごとの下線（1回で一緒に出る範囲と、その合計攻撃力）。 */
function slotRow(toy: ToyDef, cellOf: (i: number) => string, next = -1) {
  const groups = groupSummary(toy);
  const lines = groups.map((g) => `<div class="gline ${g.start === next ? "next" : ""}" style="--s:${g.start};--n:${g.end - g.start}"><span>⚔${g.damage} ⚡${g.mana}</span></div>`).join("");
  return `<div class="slotrow ${toy.slots.length > 10 ? "many" : ""}" style="--count:${toy.slots.length}"><div class="cells">${toy.slots.map((_, i) => cellOf(i)).join("")}</div><div class="glines">${lines}</div></div>`;
}

/** ずかんの並び（種類ごとに見せる）。 */
const ZUKAN: { title: string; ids: string[]; kind?: "toy" | "relic" | "gear" }[] = [
  { title: L("飛ぶ技", "Flying moves"), ids: ["claw", "bite", "hairball", "hiss", "yarn", "laser"] },
  { title: L("近く・置く技", "Close & placed moves"), ids: ["swing", "pounce", "punch", "post"] },
  { title: L("召喚", "Summons"), ids: ["friend", "roomba"] },
  { title: L("買ってきた物の技", "Store-bought moves"), ids: ["mizudeppo", "ahiru", "shabon", "kabocha", "korokoro", "hammer", "flash", "danbo"] },
  { title: L("弾を増やす（重ねると掛け算）", "More shots (stacks multiply)"), ids: ["double", "nekodango", "tatougai", "butimake", "hotsure"] },
  { title: L("▶修飾（右の技に）", "▶Modifiers (right move)"), ids: ["matatabi", "kajikaji", "big", "small", "quick", "stare", "bouncy", "pushy", "rame", "suzu", "kenko", "jidori"] },
  { title: L("速さ・やる気", "Speed & Energy"), ids: ["massigura", "churu"] },
  { title: L("◀修飾（左の技に）・◀▶修飾（左右の技に）", "◀Modifiers (left) · ◀▶Modifiers (both)"), ids: ["okawari", "oikake", "tsurutsuru", "dryer", "catnipBag", "kotatsu"] },
  { title: L("全体修飾（どこに置いても）", "Global modifiers (anywhere)"), ids: ["maigofuda", "hidamari", "sensor", "kezukuroi"] },
  { title: L("つづけて・ふたつ持ち", "Then & Two Paws"), ids: ["chain", "nandodemo", "pyonpyon", "todome", "hitoiki", "issho"] },
  { title: L("属性", "Elements"), ids: ["static", "water", "tape", "spray"] },
  { title: L("おもちゃ", "Toys"), ids: Object.keys(TOYS).filter((t) => !TOYS[t].auto), kind: "toy" },
  { title: L("電池式のおもちゃ（自動で動く）", "Battery toys (auto)"), ids: Object.keys(TOYS).filter((t) => TOYS[t].auto), kind: "toy" },
  { title: L("レリック", "Charms"), ids: RELIC_IDS, kind: "relic" },
  { title: L("装備", "Gear"), ids: GEAR_IDS, kind: "gear" },
];

/** タイトルまわりの画面。null ならゲーム中。 */
type Screen = "title" | "howto" | "zukan" | "diff" | "grow" | "endless" | "rank" | null;

/** スクロールできる枠の位置を覚え、書きかえた後に同じ枠（同じ場所・同じクラス）へ戻す関数を返す。 */
function keepScroll(): () => void {
  const sel = ".panel, .zgroups, .fuseBag";
  const keyOf = (e: Element, i: number) => `${e.closest("[id]")?.id ?? ""}|${e.className}|${i}`;
  const keys = (f: (e: HTMLElement, k: string) => void) => { const n = new Map<string, number>(); document.querySelectorAll<HTMLElement>(sel).forEach((e) => { const b = keyOf(e, 0), i = n.get(b) ?? 0; n.set(b, i + 1); f(e, keyOf(e, i)); }); };
  const saved = new Map<string, number>();
  keys((e, k) => { if (e.scrollTop) saved.set(k, e.scrollTop); });
  return () => keys((e, k) => { const t = saved.get(k); if (t && e.scrollTop !== t) e.scrollTop = t; });
}

export class Hud {
  private el = (id: string) => document.getElementById(id)!;
  bagOpen = false;
  /** 一時停止メニューを開いている。 */
  paused = false;
  /** 音のオン・オフ（main から渡す）。 */
  onMute: () => boolean = () => false;
  /** 広告が流れている間は true（音を止めて、ゲームを止める）。 */
  onAd: (playing: boolean) => void = () => {};
  private adBusy = false;
  private doubled = false;
  muted: () => boolean = () => false;
  private screen: Screen = "title";
  private zukanSel = "claw";
  private recorded = new WeakSet<World>();
  /** 今回の冒険でもらったにぼし。 */
  private earned = 0;
  private sel: Spot | null = null;
  /** 秘密の隠し場所に入れようと選んでいる手持ちの番号。 */
  private fusePick: number[] = [];
  /** 今回の冒険で新しく解放されたもの。 */
  private opened: Unlock[] = [];
  /** ランキング: 見ているタブ・読みこんだみんなの記録・エンドレスの結果（じぶんの順位・送った結果）。 */
  private rankTab: "all" | "mine" = "all";
  private board: Board | null | "loading" | "error" = null;
  private localRank = 0;
  private endedAt = 0;
  /** クリアしたときのおきにいり選び（持っている技の番号）と、決めたかどうか。 */
  private favPick: number[] = [];
  private favSaved = false;
  /** トレーニング: パレットで選んでいる技と、★の数。 */
  private trainPick: string | null = null;
  private trainStars = 0;
  private sent: null | "sending" | { rank: number } | { error: string } = null;
  /** 持ち物画面のタブ（おもちゃの番号、または装備・レリック）と、そこで選んでいるもの。 */
  private tab: number | "gear" = 0;
  private pick: string | null = null;
  private lastKey = "";

  constructor(private world: () => World, private onRestart: () => void, private onTitle: () => void, private onStart: (difficulty: number, endless?: boolean) => void, private onContinue: () => void, private onTraining: () => void) {
    this.el("bagBtn").addEventListener("click", () => this.toggleBag());
    this.el("pauseBtn").addEventListener("click", () => this.togglePause());
    this.el("muteBtn").addEventListener("click", () => { this.onMute(); this.lastKey = ""; });
    document.body.classList.toggle("touch", isTouch());
  }

  /** タイトルへ戻る（新しいゲームを用意してタイトル画面）。 */
  toTitle() { this.paused = false; this.bagOpen = false; this.screen = "title"; this.lastKey = ""; this.onTitle(); }

  togglePause() {
    if (this.world().phase !== "play" || this.bagOpen) return;
    this.paused = !this.paused; this.lastKey = "";
  }

  toggleBag() {
    if (this.world().phase !== "play" || this.paused) return;
    this.bagOpen = !this.bagOpen; this.sel = null; this.pick = null; this.tab = this.world().cur; this.lastKey = "";
  }

  update() {
    const w = this.world(), p = w.player, toy = w.toy;
    this.el("hearts").innerHTML = Array.from({ length: p.maxHp / 2 }, (_, i) => {
      const v = p.hp - i * 2;
      return `<span class="heart ${v >= 2 ? "full" : v === 1 ? "half" : ""}">♥</span>`;
    }).join("");
    this.el("manaFill").style.width = `${(p.mana / w.manaMax) * 100}%`;
    this.el("manaNum").textContent = `${Math.floor(p.mana)}/${w.manaMax}`;
    this.el("coins").innerHTML = `<img src="${urlOf(kibbleCanvas())}" alt="">${w.coins}${w.opts.endless ? `<span class="pts">★${w.score}</span>` : ""}`;
    document.body.classList.toggle("final", w.room.kind === "final" && w.phase === "play");
    this.el("muteBtn").textContent = this.muted() ? "♪×" : "♪";
    this.el("room").textContent = w.title;
    const toast = this.el("toast");
    toast.hidden = !w.toast; if (w.toast) toast.textContent = w.toast.text;

    // 記録（やられた・守りきったときに一度だけ）
    if (w.over && !this.recorded.has(w)) {
      this.recorded.add(w);
      this.earned = runReward(w.cleared, w.bosses, w.phase === "win", w.opts.difficulty, w.curses.length);
      this.opened = recordRun(w.room.act, w.room.index, w.phase === "win", w.opts.difficulty, this.earned,
        { kills: w.kills, elites: w.elites, bosses: w.bosses, rooms: w.cleared, specials: w.specials, curses: w.curses.length }, !!w.opts.endless);
      this.sent = null; this.favPick = []; this.favSaved = false; this.doubled = false;
      this.endedAt = Date.now();
      this.localRank = w.opts.endless && w.cleared > 0 ? recordEndless({ name: savedName(), score: w.score, rooms: w.cleared, bosses: w.bosses, elites: w.elites, kills: w.kills, at: this.endedAt, act: w.room.act }) : 0;
    }
    this.meters(w);
    const key = JSON.stringify([w.coins, w.shop?.items, w.shop?.rerollCost, w.room.kind, w.held.map((h) => h.def), w.cur, w.relics, w.gear, w.curses, this.tab, this.pick, this.fusePick, w.bag, p.cursor, p.recharging, this.bagOpen, this.paused, this.screen, this.zukanSel, this.sel, w.phase, w.choices, w.doorOpen, w.room.act, w.room.index, w.room.altar?.used, this.rankTab, this.board, this.sent, this.localRank, this.favPick, this.favSaved, this.trainPick, this.trainStars, w.trainInfMana, w.trainMulti]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    // 上の帯: おもちゃのスロット（まとまりの下線と合計攻撃力、次に出るまとまりを光らせる）
    // 持っているおもちゃ（タップで持ち替え）。今のものは大きく
    const others = w.toys.map((h, i) => i === w.cur ? "" : `<button class="toySw" data-toy="${i}" title="${h.def.name}"><img src="${urlOf(toyCanvas(h.def.id))}" alt=""><span>${i + 1}</span></button>`).join("");
    const sub = toy.sub ? `<div class="subTop"><span>${L("サブ", "Sub")}</span>${toy.sub.slots.map((id) => cell(id, "tabindex=-1", "mini")).join("")}<div class="meter"><i data-meter="sub"></i></div></div>` : "";
    const batts = w.batt.length ? `<div class="batts">${w.batt.map((h, i) => `<div class="batt" title="${h.def.name}"><img src="${urlOf(toyCanvas(h.def.id))}" alt=""><div class="meter"><i data-meter="batt${i}"></i></div></div>`).join("")}</div>` : "";
    this.el("slots").innerHTML = (others ? `<div class="toySws">${others}</div>` : "") + `<img class="toyIcon" src="${urlOf(toyCanvas(toy.id))}" alt="${toy.name}">`
      + `<div>${slotRow(toy, (i) => cell(toy.slots[i], "tabindex=-1"), p.recharging ? -1 : p.cursor)}${sub}</div>`
      + (p.recharging ? `<span class="rest">${L("休けい中", "Resting")}</span>` : "") + batts;
    this.meters(w);
    this.el("slots").querySelectorAll<HTMLButtonElement>("[data-toy]").forEach((b) => b.onclick = () => w.switchToy(Number(b.dataset.toy)));

    // 扉の選択肢
    const hint = this.el("hint");
    hint.hidden = !(w.doorOpen && w.phase === "play");
    const al = w.room.altar;
    const altarHint = al?.kind === "kotatsu" ? `<b>${L("猫こたつに近づくと、おもちゃと技を自由に選べる", "Go to the Cat Kotatsu to pick any toys and moves")}</b>`
      : al && (!al.used || al.kind === "fusion") ? `<b>${L(`真ん中の${ALTAR_NAME[al.kind]}に近づこう`, `Go to the ${ALTAR_NAME[al.kind]} in the middle`)}</b>` : "";
    if (!hint.hidden) hint.innerHTML = (altarHint || `<b>${L("扉を選んで進もう", "Pick a door to move on")}</b>`) + w.room.doors.map((d) =>
      `<span class="chip"><img src="${urlOf(rewardCanvas(d.reward))}" alt="">${REWARD_INFO[d.reward].label}</span>`).join("");

    document.body.classList.toggle("titling", w.phase === "intro");
    const scroll = keepScroll();   // 書きかえても、スクロール位置は同じ画面なら保つ（タップのたびに上へ戻らない）
    this.renderTitle(w);
    this.renderPause();
    this.renderBag(w);
    this.renderReward(w);
    this.renderShop(w);
    this.renderBench(w);
    this.renderTrain(w);
    this.renderResult(w);
    scroll();
  }

  /** 毎フレーム変わるメーター（サブスロット・電池式の次の自動まで）だけを書きかえる。 */
  private meters(w: World) {
    const h = w.toys[w.cur], set = (k: string, v: number) => { const e = document.querySelector<HTMLElement>(`[data-meter="${k}"]`); if (e) e.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`; };
    if (h.def.sub) set("sub", h.charge / h.def.sub.need);
    w.batt.forEach((b, i) => set(`batt${i}`, 1 - b.autoCd / (b.def.auto ?? 1)));
    // トレーニング: DPS（直近5秒）・合計・いちばん大きい1回
    const tb = this.el("trainBox");
    tb.hidden = !(w.opts.training && w.phase === "play");
    if (!tb.hidden) {
      if (!tb.firstChild) {
        tb.innerHTML = `<span>DPS <b data-t="dps">0</b></span><span>${L("合計", "Total")} <span data-t="total">0</span></span><span>${L("最大", "Max")} <span data-t="max">0</span></span><button class="trainReset">${L("リセット", "Reset")}</button>`;
        tb.querySelector<HTMLButtonElement>(".trainReset")!.onclick = () => { this.world().trainLog = []; };
      }
      const st = w.trainStats, put = (k: string, v: number) => { const e = tb.querySelector(`[data-t="${k}"]`); if (e) e.textContent = v >= 100 ? `${Math.round(v)}` : v.toFixed(1); };
      put("dps", st.dps); put("total", st.total); put("max", st.max);
    }
  }

  /** タイトル・あそびかた・ずかん（ゲーム開始前）。 */
  private renderTitle(w: World) {
    const el = this.el("intro");
    el.hidden = w.phase !== "intro";
    if (el.hidden) return;
    if (this.screen === null) this.screen = "title";
    const go = (sc: Screen) => () => { this.screen = sc; this.lastKey = ""; };
    if (this.screen === "howto") {
      el.innerHTML = `<div class="panel intro">${this.howtoHtml()}<button class="back">${L("もどる", "Back")}</button></div>`;
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "diff") {   // 難易度を選んではじめる
      const rec = loadRecord();
      const saved = loadRun();
      el.innerHTML = `<div class="panel diffPanel"><h2>${L("難易度をえらぶ", "Choose Difficulty")}</h2>${saved ? `<p class="muted warn">${L(`はじめると、前の冒険のつづき（${runLabel(saved)}）は消えます`, `Starting will erase your saved run (${runLabel(saved)})`)}</p>` : ""}<div class="diffs">${DIFFS.map((d, i) => {
        const ok = canPick(rec, i);
        return `<button class="diff ${i === 1 ? "go" : ""}" data-d="${i}" ${ok ? "" : "disabled"}><b>${d.name}${rec.cleared.includes(i) ? " ★" : ""}</b><small>${ok ? d.desc : L("むずかしいを守りきると選べる", "Clear Hard to unlock")}</small><small>${L("にぼし", "Sardines")} ×${d.reward}</small></button>`;
      }).join("")}</div><button class="back">${L("もどる", "Back")}</button></div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-d]").forEach((b) => b.onclick = () => { this.screen = null; this.lastKey = ""; this.onStart(Number(b.dataset.d)); });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "grow") {   // ねこの成長（周回で強くなる）
      const rec = loadRecord();
      el.innerHTML = `<div class="panel growPanel"><h2>${L("ねこの成長", "Cat Growth")}</h2><p class="muted">${L("冒険でもらった にぼし で、ずっと強くなる。今のにぼし: ", "Spend sardines from runs to grow stronger for good. Sardines: ")}<b class="nib">${rec.niboshi}</b></p>
        <div class="grows">${UPGRADES.map((u) => {
          const lv = rec.meta[u.id], max = lv >= u.max, cost = u.cost(lv);
          return `<div class="grow"><div><b>${u.name}</b><span class="lv">${"●".repeat(lv)}${"○".repeat(u.max - lv)}</span><small>${u.desc}</small></div>
            <button data-u="${u.id}" ${max || rec.niboshi < cost ? "disabled" : ""}>${max ? L("最大", "MAX") : L(`にぼし ${cost}`, `${cost} sardines`)}</button></div>`;
        }).join("")}</div>
        <div class="favNow"><b>${L(`おきにいり（${favSlots(rec.meta)}枠）`, `Favorites (${favSlots(rec.meta)} slots)`)}</b>${rec.favorites.length ? `<div class="zcells">${rec.favorites.map((id) => cell(id, "tabindex=-1")).join("")}</div><small>${L("冒険のはじめから手持ちに入る", "In your bag from the start of each run")}</small>` : `<small>${L("まだありません。クリアしたときに、持っている技から選べる", "None yet. Pick from your moves when you clear a run")}</small>`}</div>
        <button class="back">${L("もどる", "Back")}</button></div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-u]").forEach((b) => b.onclick = () => { buyUpgrade(b.dataset.u as keyof typeof rec.meta); this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "endless") {   // エンドレスの説明とはじめる
      const saved = loadRun();
      el.innerHTML = `<div class="panel diffPanel"><h2>${L("エンドレス", "Endless")}</h2>
        <p>${L("夏のあとも季節がめぐり続け、虫はどんどん強くなる。どこまで守れるか、ポイントで競おう。難易度は「ふつう」。", "After summer the seasons keep cycling and bugs keep getting stronger. How long can you protect Mama? Compete for points. Difficulty: Normal.")}</p>
        <p class="muted">${L(`ポイント: 片付けた部屋 ×${POINTS.rooms}・ボス ×${POINTS.bosses}・強い虫 ×${POINTS.elites}・倒した虫 ×${POINTS.kills}`, `Points: rooms cleared ×${POINTS.rooms}・bosses ×${POINTS.bosses}・elite bugs ×${POINTS.elites}・bugs defeated ×${POINTS.kills}`)}</p>
        ${saved ? `<p class="muted warn">${L(`はじめると、前の冒険のつづき（${runLabel(saved)}）は消えます`, `Starting will erase your saved run (${runLabel(saved)})`)}</p>` : ""}
        <div class="menu center"><button class="go startEndless">${L("はじめる", "Start")}</button><button class="back">${L("もどる", "Back")}</button></div></div>`;
      el.querySelector<HTMLButtonElement>(".startEndless")!.onclick = () => { this.screen = null; this.lastKey = ""; this.onStart(1, true); };
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "rank") {
      el.innerHTML = `<div class="panel rankPanel"><h2>${L("エンドレスのランキング", "Endless Ranking")}</h2>
        <div class="tabs"><button class="tab ${this.rankTab === "all" ? "on" : ""}" data-rt="all">${L("みんな", "Everyone")}</button><button class="tab ${this.rankTab === "mine" ? "on" : ""}" data-rt="mine">${L("じぶん", "Mine")}</button></div>
        ${this.rankHtml()}<button class="back">${L("もどる", "Back")}</button></div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-rt]").forEach((b) => b.onclick = () => { this.rankTab = b.dataset.rt as "all" | "mine"; this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "zukan") {
      el.innerHTML = `<div class="panel zukan">${this.zukanHtml()}</div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-z]").forEach((b) => b.onclick = () => { this.zukanSel = b.dataset.z!; this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    const base = import.meta.env.BASE_URL, rec = loadRecord(), saved = loadRun();
    el.innerHTML = `<div class="title">
      <div class="logo"><small>${L("ママを虫から守れ！", "Protect Mama from bugs!")}</small>My Cat Is <br>So Cute</div>
      <div class="hero"><img class="mom" src="${base}mama/scared.png" alt="${L("ママ", "Mama")}"><img class="cat" src="${base}cat/P03_sit_happy.png" alt="${L("猫", "Cat")}">
        <img class="bug b1" src="${bugUrl("roach")}" alt=""><img class="bug b2" src="${bugUrl("mosquito")}" alt=""></div>
      <div class="menu">
        ${saved ? `<button class="go cont">${L("つづきから", "Continue")}<small>${runLabel(saved)}</small></button>` : ""}
        <button class="${saved ? "" : "go "}start">${L("はじめる", "Start")}</button>
        <button class="endlessBtn">${L("エンドレス", "Endless")}</button>
        <button class="rankBtn">${L("ランキング", "Ranking")}</button>
        <button class="trainBtn">${L("トレーニング", "Training")}</button>
        <button class="growBtn">${L("ねこの成長", "Cat Growth")}</button>
        <button class="howtoBtn">${L("あそびかた", "How to Play")}</button>
        <button class="zukanBtn">${L("ずかん", "Collection")}</button>
        <button class="langBtn">${isJa ? "English" : "日本語"}</button>
      </div>
      <div class="record">${recordText(rec)}<br>${L("解放: ", "Unlocked: ")}<b>${UNLOCKS.filter((u) => isOpen(u, rec.stats)).length}/${UNLOCKS.length}</b>${L(`（倒した虫 ${rec.stats.kills}・片付けた部屋 ${rec.stats.rooms}）`, ` (bugs ${rec.stats.kills}・rooms ${rec.stats.rooms})`)}</div>
    </div>`;
    el.querySelector<HTMLButtonElement>(".start")!.onclick = go("diff");
    const cont = el.querySelector<HTMLButtonElement>(".cont");
    if (cont) cont.onclick = () => { this.screen = null; this.lastKey = ""; this.onContinue(); };
    el.querySelector<HTMLButtonElement>(".growBtn")!.onclick = go("grow");
    el.querySelector<HTMLButtonElement>(".endlessBtn")!.onclick = go("endless");
    el.querySelector<HTMLButtonElement>(".trainBtn")!.onclick = () => { this.screen = null; this.lastKey = ""; this.onTraining(); };
    el.querySelector<HTMLButtonElement>(".rankBtn")!.onclick = () => { this.screen = "rank"; this.lastKey = ""; this.loadBoard(); };
    el.querySelector<HTMLButtonElement>(".howtoBtn")!.onclick = go("howto");
    el.querySelector<HTMLButtonElement>(".zukanBtn")!.onclick = go("zukan");
    el.querySelector<HTMLButtonElement>(".langBtn")!.onclick = () => setLang(isJa ? "en" : "ja");
  }

  /** みんなのランキングを読みこむ（終わったら描き直す）。 */
  private loadBoard() {
    this.board = "loading";
    void fetchBoard().then((b) => { this.board = b ?? "error"; this.lastKey = ""; });
  }

  private rankHtml() {
    const row = (i: number, name: string, score: number, rooms: number, mark = false) =>
      `<tr class="${mark ? "me" : ""}"><td>${i + 1}</td><td class="nm">${esc(name || L("ななしの猫", "Nameless Cat"))}</td><td>★${score}</td><td>${L(`${rooms}部屋`, `${rooms} rooms`)}</td></tr>`;
    if (this.rankTab === "mine") {
      const mine = loadRecord().endless;
      return mine.length ? `<table class="rank"><tr><th>${L("順位", "Rank")}</th><th>${L("名前", "Name")}</th><th>${L("ポイント", "Points")}</th><th>${L("部屋", "Rooms")}</th></tr>${mine.map((e, i) => row(i, e.name, e.score, e.rooms)).join("")}</table>`
        : `<p class="muted">${L("まだ記録がありません。エンドレスで遊ぶとここに残ります。", "No records yet. Play Endless to see them here.")}</p>`;
    }
    if (this.board === "loading" || this.board === null) return `<p class="muted">${L("読みこみ中…", "Loading…")}</p>`;
    if (this.board === "error") return `<p class="muted">${L("みんなのランキングは準備中です（つながりません）。", "The global ranking isn't available yet (can't connect).")}</p>`;
    return this.board.top.length ? `<table class="rank"><tr><th>${L("順位", "Rank")}</th><th>${L("名前", "Name")}</th><th>${L("ポイント", "Points")}</th><th>${L("部屋", "Rooms")}</th></tr>${this.board.top.map((e, i) => row(i, e.name, e.score, e.rooms)).join("")}</table>`
      : `<p class="muted">${L("まだだれも記録を送っていません。一番乗りのチャンス！", "No one has sent a score yet. Be the first!")}</p>`;
  }

  /** クリアしたとき: 持っている技から「おきにいり」を選ぶ（次からの冒険で最初から手持ちに入る）。 */
  private favHtml(w: World) {
    const owned = w.ownedSpells(), n = favSlots(loadRecord().meta);
    return `<div class="favBox"><b>${L("おきにいりを選ぶ", "Pick Favorites")}</b>${L(`（${this.favPick.length}/${n}）`, ` (${this.favPick.length}/${n})`)}<small>${L("選んだ技は、次からの冒険で最初から手持ちに入る。枠は「ねこの成長」で増やせる", "Picked moves start in your bag on future runs. Get more slots in Cat Growth")}</small>
      <div class="fuseBag">${owned.map((id, i) => cell(id, `data-fav="${i}"`, this.favPick.includes(i) ? "sel" : "")).join("")}</div>
      <button class="favGo go" ${this.favPick.length ? "" : "disabled"}>${this.favSaved ? L("おきにいりにした！", "Saved!") : L("おきにいりにする", "Save Favorites")}</button></div>`;
  }

  /** エンドレスの結果: ポイント・じぶんの順位・名前を入れてみんなのランキングへ送る。 */
  private endlessResult(w: World) {
    const s = this.sent;
    const status = s === null ? "" : s === "sending" ? L("送っています…", "Sending…") : "rank" in s ? L(`みんなのランキングで <b>${s.rank}位</b>！`, `Global rank: <b>#${s.rank}</b>!`) : s.error;
    return `<div class="endlessBox"><div class="bigScore">★ ${w.score} ${L("ポイント", "pts")}</div>
      <p class="muted">${L(`片付けた部屋 ${w.cleared}×${POINTS.rooms}・ボス ${w.bosses}×${POINTS.bosses}・強い虫 ${w.elites}×${POINTS.elites}・倒した虫 ${w.kills}×${POINTS.kills}`, `Rooms ${w.cleared}×${POINTS.rooms}・Bosses ${w.bosses}×${POINTS.bosses}・Elite bugs ${w.elites}×${POINTS.elites}・Bugs ${w.kills}×${POINTS.kills}`)}</p>
      ${this.localRank ? `<p>${L(`じぶんの記録で <b>${this.localRank}位</b>`, `Your records: <b>#${this.localRank}</b>`)}</p>` : ""}
      ${w.cleared > 0 ? `<div class="sendRow"><input class="nameIn" maxlength="12" placeholder="${L("名前（本名は入れないでね）", "Name (no real names!)")}" value="${esc(savedName())}">
        <button class="sendBtn" ${s === "sending" || (s !== null && typeof s === "object" && "rank" in s) ? "disabled" : ""}>${L("ランキングに送る", "Submit Score")}</button></div><p class="sendMsg">${status}</p>` : ""}</div>`;
  }

  private howtoHtml() {
    const touch = isTouch();
    return `<div class="cols">
        <div>${mama("scared", L("きゃー！虫！<br>ねこちゃん、たすけてー！", "Eek! Bugs!<br>Kitty, help me!"))}
          <div class="howto">
            <div><b>${L("移動", "Walk")}</b>${touch ? L("画面をドラッグ", "Drag the screen") : L("WASD / 矢印キー", "WASD / Arrow keys")}</div>
            <div><b>${L("攻撃", "Attack")}</b>${touch ? L("<span class='k'>攻撃</span>を押しっぱなし（近くの虫を自動で狙う）", "Hold <span class='k'>Attack</span> (auto-aims at nearby bugs)") : L("クリック長押し（マウスの方向）／ J（自動で狙う）", "Hold click (aim with mouse) / J (auto-aim)")}</div>
            <div><b>${L("よける", "Dodge")}</b>${touch ? L("<span class='k'>ダッシュ</span>", "<span class='k'>Dash</span>") : "Space"}${L("（一瞬むてき）", " (brief invincibility)")}</div>
            <div><b>${L("持ち替え", "Switch")}</b>${touch ? L("スロットの左の小さなおもちゃ", "Small toys left of the slots") : L("Q ／ 1〜3 ／ ホイール", "Q / 1-3 / Wheel")}</div>
            <div><b>${L("止める", "Pause")}</b>${touch ? L("右上の <span class='k'>Ⅱ</span>", "<span class='k'>Ⅱ</span> at top right") : L("Esc ／ 右上の Ⅱ", "Esc / Ⅱ at top right")}</div>
          </div></div>
        <div class="rules">
          <h3>${L("おもちゃのしくみ", "How Toys Work")}</h3>
          <p>${L("おもちゃを振ると、スロットに入れた<b>技（爪・牙など）が出る</b>。スロットは<b>左から順に</b>使われる。", "Swing a toy to unleash the <b>moves (claws, fangs, etc.)</b> in its slots. Slots fire <b>left to right</b>.")}</p>
          <div class="example">${cell("matatabi")}${cell("bite")}<span>${L("修飾の ▶ は<b>右の技</b>、◀ は<b>左の技</b>、◀▶ は<b>左右の技</b>にかかる。<b>全</b>はどこに置いても全部の技に", "A modifier's ▶ affects the <b>right move</b>, ◀ the <b>left move</b>, ◀▶ <b>both sides</b>. <b>All</b> affects every move, placed anywhere")}</span></div>
          <div class="example">${cell("claw")}${cell("chain")}${cell("swing")}<span>${L("<b>つづけて</b>: ひっかきが当たった所で、ぶんぶんが回る。<b>ふたつ持ち</b>は左右の技を同時に扱って1つの技に", "<b>Then</b>: where Scratch hits, Swish whirls. <b>Two Paws</b> merges the left and right moves into one")}</span></div>
          <p>${L("スロットの下の線が「1回で一緒に出る範囲」。⚔は攻撃力の合計、⚡は使うやる気。サブスロットのあるおもちゃは、条件がたまると全部いっぺんに出る。電池式のおもちゃは持っているだけで自動で動く。", "The line under the slots shows what fires together. ⚔ is total damage, ⚡ is Energy used. Toys with sub slots fire them all at once when charged. Battery toys work on their own just by having them.")}</p>
          <p>${L("<b>属性</b>（静電気・水のみ皿・ガムテープ・虫よけ）を技の左に置くと効果がつく。<b>ぬれた虫にビリビリ</b>、<b>ねばねばの虫に虫よけ</b>はよく効く。", "Put an <b>element</b> (Static, Water Bowl, Duct Tape, Bug Spray) left of a move to add its effect. <b>Zap on Soaked bugs</b> and <b>Bug Spray on Sticky bugs</b> work great.")}</p>
          <p>${L("部屋を片付けると扉が開く。扉の上の絵が<b>次の部屋のごほうび</b>（♥最大HP／⚡やる気／★技／おもちゃ）や<b>特別な部屋</b>（宝箱・ママのおひざ・秘密の隠し場所・強い虫・あやしい箱）。季節ごとに8部屋＋ボス、秋から始まり夏が最後。", "Clear a room to open the doors. The picture over each door shows the <b>next room's reward</b> (♥ max HP / ⚡ Energy / ★ move / toy) or a <b>special room</b> (treasure chest, Mama's lap, Secret Stash, elite bug, suspicious box). Each season has 8 rooms + a boss, from autumn to summer.")}</p>
          <p>${L("負けても、倒した虫や片付けた部屋の数で<b>新しいおもちゃや技が解放</b>される。", "Even if you lose, bugs defeated and rooms cleared <b>unlock new toys and moves</b>.")}</p>
        </div>
      </div>`;
  }

  /** ずかん: 左に選んだものの説明、右に種類ごとのアイコン一覧。 */
  private zukanHtml() {
    const sel = this.zukanSel, stats = loadRecord().stats;
    const lock = (kind: UnlockKind, id: string) => { const u = findUnlock(kind, id); return u && !isOpen(u, stats) ? u : null; };
    const kindOf = (id: string): UnlockKind => (TOYS[id] ? "toy" : RELICS[id] ? "relic" : "spell");
    const lk = lock(kindOf(sel), sel);
    const detail = lk ? lockedCard(lk) : TOYS[sel] ? toyCard(TOYS[sel]) : RELICS[sel] ? relicCard(sel) : GEAR[sel] ? gearCard({ id: sel, rar: 0, fx: [] }, null) : spellCard(sel);
    const groups = ZUKAN.map((g) => `<div class="zgroup"><div class="ztitle">${g.title}</div><div class="zcells">${g.ids.map((id) => {
      const x = `${id === sel ? "sel" : ""} ${lock(kindOf(id), id) ? "lockedCell" : ""}`;
      return g.kind ? itemCell(g.kind, id, `data-z="${id}"`, x) : cell(id, `data-z="${id}"`, x);
    }).join("")}</div></div>`).join("");
    return `<div class="edit"><div class="detail">${detail}</div><div class="board"><div class="boardHead"><b>${L("ずかん", "Collection")}</b><span class="muted">${L("タップで説明を見る", "Tap for details")}</span><button class="back">${L("もどる", "Back")}</button></div><div class="zgroups">${groups}</div></div></div>`;
  }

  /** 一時停止メニュー。 */
  private renderPause() {
    const el = this.el("pause");
    el.hidden = !this.paused;
    if (el.hidden) return;
    el.innerHTML = `<div class="panel pausePanel"><h2>${L("ひと休み", "Paused")}</h2>
      <div class="menu"><button class="go resume">${L("つづける", "Resume")}</button><button class="toTitle">${L("タイトルへ", "Title")}</button></div>
      <p class="muted">${L("冒険は部屋に入るたびに自動でセーブされています。タイトルの「つづきから」で、この部屋の入口から再開できます。", "Your run saves each time you enter a room. Pick \"Continue\" on the title to restart from this room's entrance.")}</p></div>`;
    el.querySelector<HTMLButtonElement>(".resume")!.onclick = () => this.togglePause();
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
  }

  private renderBag(w: World) {
    const el = this.el("bag");
    el.hidden = !this.bagOpen;
    if (el.hidden) return;
    if (typeof this.tab === "number" && this.tab >= w.held.length) this.tab = w.cur;
    const tabs = `<div class="tabs">${w.held.map((h, i) => `<button class="tab ${this.tab === i ? "on" : ""}" data-tab="${i}"><img src="${urlOf(toyCanvas(h.def.id))}" alt="">${h.def.name}${i === w.cur ? `<small>${L("使用中", "In use")}</small>` : h.def.auto ? `<small>${L("電池", "Battery")}</small>` : ""}</button>`).join("")}
      <button class="tab ${this.tab === "gear" ? "on" : ""}" data-tab="gear"><img src="${urlOf(rewardCanvas("relic"))}" alt="">${L("装備・レリック", "Gear & Charms")}</button>
      <button class="close">${L("閉じる", "Close")}</button></div>`;
    el.innerHTML = `<div class="panel edit2">${tabs}${this.tab === "gear" ? this.gearHtml(w) : this.toyHtml(w, this.tab)}</div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.onclick = () => {
      this.tab = b.dataset.tab === "gear" ? "gear" : Number(b.dataset.tab); this.sel = null; this.pick = null; this.lastKey = "";
    });
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => this.toggleBag();
    if (this.tab === "gear") {
      el.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((b) => b.onclick = () => { this.pick = b.dataset.pick || null; this.lastKey = ""; });
      return;
    }
    const t = this.tab, def = w.held[t].def;
    el.querySelectorAll<HTMLButtonElement>("[data-where]").forEach((b) => b.onclick = () => {
      const here: Spot = { where: b.dataset.where as Spot["where"], i: Number(b.dataset.i) };
      const hasItem = (here.where === "slot" ? def.slots[here.i] : here.where === "sub" ? def.sub?.slots[here.i] : w.bag[here.i]) ?? null;
      if (!this.sel) { if (hasItem) this.sel = here; }
      else if (this.sel.where === here.where && this.sel.i === here.i) this.sel = null;
      else { w.move(this.sel, here, t); this.sel = null; }
      this.lastKey = "";
    });
  }

  /** 持ち物: おもちゃのスロットと手持ち。 */
  private toyHtml(w: World, t: number) {
    const h = w.held[t], toy = h.def, sel = this.sel;
    const isSel = (where: string, i: number) => sel?.where === where && sel.i === i;
    const BAG = Math.max(16, Math.ceil((w.bag.length + 1) / 8) * 8);
    const selId = sel ? (sel.where === "slot" ? toy.slots[sel.i] : sel.where === "sub" ? toy.sub?.slots[sel.i] : w.bag[sel.i]) ?? null : null;
    return `<div class="edit">
      <div class="detail">${selId ? spellCard(selId) : toyCard(toy)}</div>
      <div class="board">
        <div class="boardHead"><span class="muted">${L("選んでから、置きたい場所をタップ（入れ替え）。おもちゃどうしは手持ちを通して移す", "Pick one, then tap where it goes (swaps). Move between toys via your inventory")}</span></div>
        ${slotRow(toy, (i) => cell(toy.slots[i], `data-where="slot" data-i="${i}"`, isSel("slot", i) ? "sel" : ""))}
        ${subRow(h, (i) => cell(toy.sub!.slots[i], `data-where="sub" data-i="${i}"`, isSel("sub", i) ? "sel" : ""))}
        <div class="bagTitle">${L("手持ち", "Inventory")}</div>
        <div class="baggrid">${Array.from({ length: BAG }, (_, i) => cell(w.bag[i] ?? null, `data-where="bag" data-i="${i}"`, isSel("bag", i) ? "sel" : "")).join("")}</div>
      </div></div>`;
  }

  /** 持ち物: 装備（帽子・服・首輪とセットの状態）とレリック。 */
  private gearHtml(w: World) {
    const pick = this.pick;
    const worn = GEAR_SLOTS.map((sl) => w.gear[sl]).find((g) => g && g.id === pick);
    const detail = worn ? gearCard(worn, w.gear) : pick && RELICS[pick] ? relicCard(pick)
      : `<div class="card"><b>${L("装備・レリック", "Gear & Charms")}</b><p class="desc">${L("装備は帽子・服・首輪の3か所。同じセットを2つ・3つそろえるとボーナス。レリックは持っているだけで効く。", "Gear goes in 3 spots: hat, clothes, collar. Match 2 or 3 of a set for a bonus. Charms work just by having them.")}</p></div>`;
    const counts = setCounts(w.gear);
    const sets = Object.values(SETS).map((st) => {
      const n = counts[st.id] ?? 0;
      return `<div class="setline ${n >= 2 ? "on" : ""}" style="--c:${st.color}"><b>${st.name} ${n}/3</b>${n >= 2 ? bonusRows(st.two).map(([k, v]) => `${k} ${v}`).join("・") : ""}${n >= 3 ? "・" + bonusRows(st.three).map(([k, v]) => `${k} ${v}`).join("・") : ""}</div>`;
    }).join("");
    return `<div class="edit">
      <div class="detail">${detail}</div>
      <div class="board">
        <div class="bagTitle">${L("装備", "Gear")}</div>
        <div class="gearRow">${GEAR_SLOTS.map((sl) => `<div class="gslot">${itemCell("gear", w.gear[sl]?.id ?? null, `data-pick="${w.gear[sl]?.id ?? ""}"`, pick && pick === w.gear[sl]?.id ? "sel" : "", w.gear[sl]?.rar ?? 0)}<span>${SLOT_NAME[sl]}</span></div>`).join("")}<div class="sets">${sets}</div></div>
        ${w.curses.length ? `<div class="bagTitle">${L(`呪い（${w.curses.length}）`, `Curses (${w.curses.length})`)}</div><div class="curses">${w.curses.map((c) => `<span class="curse"><b>${CURSES[c].name}</b>${CURSES[c].desc}</span>`).join("")}</div>` : ""}
        <div class="bagTitle">${L(`レリック（${w.relics.length}）`, `Charms (${w.relics.length})`)}</div>
        <div class="baggrid">${w.relics.length ? w.relics.map((r) => itemCell("relic", r, `data-pick="${r}"`, pick === r ? "sel" : "")).join("") : `<span class="muted">${L("まだ持っていません（◆の扉・ボスでもらえる）", "None yet (from ◆ doors and bosses)")}</span>`}</div>
      </div></div>`;
  }

  private renderReward(w: World) {
    const el = this.el("reward");
    el.hidden = w.phase !== "reward";
    if (el.hidden) return;
    const boss = w.room.kind === "boss", al = w.room.altar;
    const title = boss ? L(`${ENEMY[w.room.waves[0][0]].name}を追い払った！`, `Drove off the ${ENEMY[w.room.waves[0][0]].name}!`) : al?.kind === "treasure" ? L("宝箱を開けた！", "Opened the chest!") : al?.kind === "curse" ? L("あやしい箱を開けた…", "Opened the suspicious box…")
      : L(`${(w.title.split(/・| · /)[1] ?? "").replace(/ \d.*$/, "")}を片付けた！`, `Cleared the ${(w.title.split(/・| · /)[1] ?? "").replace(/ \d.*$/, "")}!`);
    const one = (c: Choice, a = "") => c.kind === "pact" ? "" : c.kind === "toy" ? toyCard(TOYS[c.id], a) : c.kind === "relic" ? relicCard(c.id, a) : c.kind === "gear" ? gearCard(c.gear ?? { id: c.id, rar: 0, fx: [] }, w.gear, a) : spellCard(c.id, a);
    const card = (c: Choice, i: number) => {
      const a = `data-i="${i}" role="button" tabindex="0"`;
      if (c.kind !== "pact") return one(c, a);
      const k = CURSES[c.id];
      return `<div class="card pact" ${a}><div class="cursebox"><b>${L("呪い: ", "Curse: ")}${k.name}</b><small>${k.desc}${L("（この冒険のあいだずっと）", " (for the whole run)")}</small></div>
        <div class="pactget">${L(`もらえる: カリカリ ${c.coins} ＋`, `Get: ${c.coins} kibble +`)}</div>${one(c.reward)}</div>`;
    };
    const kind = w.choices[0]?.kind;
    const batt = w.choices.some((c) => c.kind === "toy" && TOYS[c.id].auto);
    const note = kind === "pact" ? L("呪いを1つ受けると、強いごほうびがもらえる（呪い1つにつき、にぼし＋15%）。いらないなら何も受けない", "Take 1 curse for a strong reward (+15% sardines per curse). Or take none")
      : kind === "toy" ? (w.toys.length < 3 ? L(`おもちゃを1つ増やす（今 ${w.toys.length}/3。持ち替えはスロットの横のアイコン）`, `Add a toy (now ${w.toys.length}/3; switch via the icons by the slots)`) : L("持てるのは3つまで。今使っているおもちゃと交換（技はそのまま移る）", "Max 3 toys. Swaps with your current toy (moves carry over)")) + (batt ? L(`。電池式は別に${2}つまで（今 ${w.batt.length}/2・自動で動く）`, `. Plus up to ${2} battery toys (now ${w.batt.length}/2, auto)`) : "")
      : kind === "relic" ? L("レリックを1つ選ぼう（持っているだけで効く）", "Pick 1 charm (works just by having it)")
      : kind === "gear" ? L("装備を1つ選ぼう（同じ場所の装備とは交換。セットをそろえるとボーナス）", "Pick 1 gear (swaps with the same spot; match sets for bonuses)")
      : L("1つ選んで手持ちに加えよう（「持ち物」でスロットにはめる）", "Pick 1 for your inventory (slot it in via Bag)");
    el.innerHTML = `<div class="panel reward">
      <div class="rhead">${mama("relief", boss ? L("すごい！ありがとう！", "Amazing! Thank you!") : L("ふぅ…ありがとう。", "Phew… thank you."), true)}<div><h2>${title}</h2>
        <p class="muted">${note}</p></div></div>
      <div class="choices">${w.choices.map(card).join("")}</div>
      <div class="rbtns">${adsAvailable() && w.canReroll ? `<button class="go rerollAd" ${this.adBusy ? "disabled" : ""}>${L("▶ 広告を見て選びなおす", "▶ Watch ad to reroll")}</button>` : ""}<button class="skip">${L("いらない", "Skip")}</button></div></div>`;
    const rr = el.querySelector<HTMLButtonElement>(".rerollAd");
    if (rr) rr.onclick = () => this.watchAd(() => w.rerollChoices());
    el.querySelectorAll<HTMLElement>("[data-i]").forEach((b) => b.onclick = () => w.takeReward(w.choices[Number(b.dataset.i)]));
    el.querySelector<HTMLButtonElement>(".skip")!.onclick = () => w.takeReward(null);
  }

  /** ママのところ（カリカリと交換でおねだり・ほかのを見せてもらう・お直し。売ることはできない）。 */
  private renderShop(w: World) {
    const el = this.el("shopPanel");
    el.hidden = w.phase !== "shop" || !w.shop;
    if (el.hidden || !w.shop) return;
    const sh = w.shop;
    const items = sh.items.map((it, i) => {
      const can = !it.sold && w.coins >= it.price;
      const icon = it.kind === "spell" ? cell(it.id, "tabindex=-1") : `<div class="potion">${it.id === "milk" ? "🥛" : it.id === "churu" ? "🍬" : "🐟"}</div>`;
      const name = it.kind === "spell" ? spellDef(it.id).name : POTIONS[it.id].name;
      const desc = it.kind === "spell" ? spellDef(it.id).desc : POTIONS[it.id].desc;
      return `<div class="sitem ${it.sold ? "sold" : ""}" ${it.kind === "spell" ? `data-info="${it.id}"` : ""}>${icon}<div class="sname"><b>${name}</b><small>${desc}</small></div>
        <button data-buy="${i}" ${can ? "" : "disabled"}>${it.sold ? L("売り切れ", "Sold out") : `<img src="${urlOf(kibbleCanvas())}" alt="">${it.price}`}</button></div>`;
    }).join("");
    const forge = w.forgeable();
    el.innerHTML = `<div class="panel shopPanel">
      <div class="shead"><h2>${L("ママのところ", "Mama's Repair Corner")}</h2><span class="wallet"><img src="${urlOf(kibbleCanvas())}" alt="">${w.coins}</span>
        <button class="reroll" ${w.coins >= sh.rerollCost ? "" : "disabled"}>${L("ほかのも見せて", "Show others")} <img src="${urlOf(kibbleCanvas())}" alt="">${sh.rerollCost}</button><button class="close">${L("閉じる", "Close")}</button></div>
      <p class="muted mamaLine">${L("ママ「拾ってきたカリカリと交換ね♪ こわれたおもちゃも直してあげる」", "Mama: \"Trade me the kibble you found♪ I'll fix broken toys too.\"")}</p>
      <div class="sitems">${items}</div>
      <div class="forge"><b>${L("ママのお直し", "Mama's Repairs")}</b><span class="muted">${L("同じ物3つを、ママが縫い合わせて丈夫な★の物1つに直してくれる", "Mama sews 3 of the same item into 1 sturdier ★ item")}</span>
        <div class="fcells">${forge.length ? forge.map((id) => `<div class="fbtn" role="button" tabindex="0" data-forge="${id}">${cell(id, "tabindex=-1")}<span>×3 → ${spellDef(id + "+").name}</span></div>`).join("") : `<span class="muted">${L("直せる物はまだない（同じ物を3つ集めよう）", "Nothing to fix yet (collect 3 of the same)")}</span>`}</div></div>
      ${this.fusionHtml(w, L("ソファの下（秘密の隠し場所）", "Under the Sofa (Secret Stash)"))}
    </div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => b.onclick = () => { w.buy(Number(b.dataset.buy)); this.lastKey = ""; });
    el.querySelectorAll<HTMLElement>("[data-forge]").forEach((b) => b.onclick = () => { w.forge(b.dataset.forge!); this.fusePick = []; this.lastKey = ""; });
    this.bindFusion(el, w);
    el.querySelector<HTMLButtonElement>(".reroll")!.onclick = () => { w.reroll(); this.lastKey = ""; };
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => { w.closeShop(); this.fusePick = []; this.lastKey = ""; };
  }

  /** 秘密の隠し場所（ソファの下）: 同じレア度の物を4つ隠す → 奥から1つ上のレア度の物が1つ出てくる。 */
  private fusionHtml(w: World, title = L("秘密の隠し場所", "Secret Stash")) {
    const pick = this.fusePick.filter((i) => i < w.bag.length), r = pick.length ? rarOf(w.bag[pick[0]]) : -1;
    const ok = w.fusable();
    const cells = w.bag.map((id, i) => {
      const on = pick.includes(i), can = ok.includes(rarOf(id)) && (r < 0 || rarOf(id) === r);
      return cell(id, `data-fuse="${i}" ${can || on ? "" : "disabled"}`, `${on ? "sel" : ""} ${can || on ? "" : "dim"}`);
    }).join("");
    return `<div class="forge fusion"><b>${title}</b><span class="muted">${L("ソファの下の、猫だけの隠し場所。同じレア度の物を4つ押しこむと、奥から前に失くした物（1つ上のレア度）が1つ出てくる", "A cats-only hideout under the sofa. Stuff in 4 items of the same rarity and a long-lost item (1 rarity higher) pops out")}</span>
      <div class="fuseBag">${w.bag.length ? cells : `<span class="muted">${L("手持ちが空っぽ", "Inventory is empty")}</span>`}</div>
      <button class="fuseGo go" ${pick.length === 4 ? "" : "disabled"}>${pick.length === 4 ? L(`4つ隠す（${SPELL_RAR_NAME[Math.min(3, r + 1)]}の物が出てくる）`, `Hide 4 (get a ${SPELL_RAR_NAME[Math.min(3, r + 1)]} item)`) : L(`${pick.length}/4 選んだ`, `${pick.length}/4 picked`)}</button></div>`;
  }
  private bindFusion(el: HTMLElement, w: World) {
    el.querySelectorAll<HTMLButtonElement>("[data-fuse]").forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.fuse);
      this.fusePick = this.fusePick.includes(i) ? this.fusePick.filter((x) => x !== i) : this.fusePick.length < 4 ? [...this.fusePick, i] : this.fusePick;
      this.lastKey = "";
    });
    const go = el.querySelector<HTMLButtonElement>(".fuseGo");
    if (go) go.onclick = () => { w.fuse(this.fusePick); this.fusePick = []; this.lastKey = ""; };
  }

  /** トレーニング: 猫こたつで、おもちゃ・技（★も）を自由に選んで試す。 */
  private renderTrain(w: World) {
    const el = this.el("shopPanel");
    if (w.phase !== "train") return;
    el.hidden = false;
    const main = w.toys[w.cur].def, batt = w.batt[0]?.def, pick = this.trainPick;
    const toyIcons = Object.keys(TOYS).map((id) => itemCell("toy", id, `data-tt="${id}" title="${TOYS[id].name}"`, id === main.id || id === batt?.id ? "sel" : "")).join("");
    const slots = (h: number, def: ToyDef) => slotRow(def, (i) => cell(def.slots[i], `data-th="${h}" data-tw="slot" data-ti="${i}"`))
      + (def.sub ? `<div class="subrow"><span class="sublabel">${L("サブ", "Sub")}</span><div class="cells">${def.sub.slots.map((id, i) => cell(id, `data-th="${h}" data-tw="sub" data-ti="${i}"`)).join("")}</div></div>` : "");
    const star = (id: string) => id + "+".repeat(this.trainStars);
    const palette = ZUKAN.filter((g) => !g.kind).map((g) => `<div class="zgroup"><div class="ztitle">${g.title}</div><div class="zcells">${g.ids.map((id) => cell(star(id), `data-pal="${star(id)}"`, pick === star(id) ? "sel" : "")).join("")}</div></div>`).join("");
    el.innerHTML = `<div class="panel trainPanel">
      <div class="shead"><h2>${L("猫こたつ（トレーニング）", "Cat Kotatsu (Training)")}</h2><button class="close">${L("閉じる", "Close")}</button><button class="toTitle">${L("タイトルへ", "Title")}</button></div>
      <p class="muted">${L("下の技をタップで選び、スロットをタップして置く（何回でも置ける）。何も選ばずにスロットをタップすると外す。", "Tap a move below, then tap a slot to place it (as many as you like). Tap a slot with nothing picked to remove.")}</p>
      <div class="trainOpts">
        <button data-multi="0" class="${w.trainMulti ? "" : "on"}">${L("けりぐるみ 1個", "1 shrimp kicker")}</button><button data-multi="1" class="${w.trainMulti ? "on" : ""}">${L("けりぐるみ たくさん", "Many kickers")}</button>
        <button class="infMana ${w.trainInfMana ? "on" : ""}">${L("やる気むげん", "∞ Energy")}</button>
        ${[0, 1, 2].map((n) => `<button data-star="${n}" class="${this.trainStars === n ? "on" : ""}">${n ? "★".repeat(n) : L("★なし", "No ★")}</button>`).join("")}
      </div>
      <div class="detail">${pick ? spellCard(pick) : toyCard(main)}</div>
      <h3>${L("おもちゃ（電池式は電池の枠へ）", "Toys (battery toys go to the battery slot)")}</h3><div class="trainRow">${toyIcons}</div>
      <h3>${main.name}</h3>${slots(w.cur, main)}
      ${batt ? `<h3>${batt.name}${L("（電池式）", " (battery)")}<button class="noBatt">${L("外す", "Remove")}</button></h3>${slots(w.toys.length, batt)}` : ""}
      <h3>${L("技・修飾", "Moves & Modifiers")}</h3><div class="palette"><div class="zgroups">${palette}</div></div>
    </div>`;
    el.querySelectorAll<HTMLElement>("[data-tt]").forEach((b) => b.onclick = () => { w.trainToy(b.dataset.tt!); this.lastKey = ""; });
    el.querySelectorAll<HTMLElement>("[data-pal]").forEach((b) => b.onclick = () => { this.trainPick = this.trainPick === b.dataset.pal ? null : b.dataset.pal!; this.lastKey = ""; });
    el.querySelectorAll<HTMLElement>("[data-th]").forEach((b) => b.onclick = () => {
      w.trainSet(Number(b.dataset.th), b.dataset.tw as "slot" | "sub", Number(b.dataset.ti), this.trainPick); this.lastKey = "";
    });
    el.querySelectorAll<HTMLElement>("[data-multi]").forEach((b) => b.onclick = () => { w.enterTraining(b.dataset.multi === "1"); w.phase = "train"; this.lastKey = ""; });
    el.querySelectorAll<HTMLElement>("[data-star]").forEach((b) => b.onclick = () => { this.trainStars = Number(b.dataset.star); this.trainPick = null; this.lastKey = ""; });
    el.querySelector<HTMLButtonElement>(".infMana")!.onclick = () => { w.trainInfMana = !w.trainInfMana; this.lastKey = ""; };
    const nb = el.querySelector<HTMLButtonElement>(".noBatt"); if (nb) nb.onclick = () => { w.batt = []; this.lastKey = ""; };
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => { w.closeShop(); this.trainPick = null; this.lastKey = ""; };
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
  }

  /** 秘密の隠し場所の部屋。 */
  private renderBench(w: World) {
    const el = this.el("shopPanel");
    if (w.phase !== "bench") return;
    el.hidden = false;
    el.innerHTML = `<div class="panel shopPanel bench"><div class="shead"><h2>${L("秘密の隠し場所", "Secret Stash")}</h2><button class="close">${L("閉じる", "Close")}</button></div>${this.fusionHtml(w)}</div>`;
    this.bindFusion(el, w);
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => { w.closeShop(); this.fusePick = []; this.lastKey = ""; };
  }

  /** ごほうび広告を流し、最後まで見たらごほうびを渡す。流れている間はゲームと音を止める。 */
  private watchAd(reward: () => void) {
    if (this.adBusy) return;
    this.adBusy = true; this.lastKey = "";
    void rewardedAd(() => this.onAd(true), () => this.onAd(false)).then((ok) => { this.adBusy = false; if (ok) reward(); this.lastKey = ""; });
  }

  private renderResult(w: World) {
    const el = this.el("result");
    el.hidden = !(w.phase === "dead" || w.phase === "win");
    if (el.hidden) return;
    if (!w.over) {   // やられた: 広告を見て1回だけ復活できる
      el.innerHTML = `<div class="panel"><h2>${L("虫にやられた…", "The bugs got you…")}</h2>${mama("scream", L("いやぁぁぁ！<br>虫がーっ！", "Eeeek!<br>Buuugs!"))}
        <p class="muted">${L("広告を見ると、その場で1回だけ復活できる（HP満タン）", "Watch an ad to revive once, right here (full HP)")}</p>
        <div class="menu"><button class="go reviveAd" ${this.adBusy ? "disabled" : ""}>${L("▶ 広告を見て復活", "▶ Watch ad to revive")}</button><button class="giveUp">${L("あきらめる", "Give up")}</button></div></div>`;
      el.querySelector<HTMLButtonElement>(".reviveAd")!.onclick = () => this.watchAd(() => w.revive());
      el.querySelector<HTMLButtonElement>(".giveUp")!.onclick = () => { w.reviveOk = false; this.lastKey = ""; };
      return;
    }
    el.innerHTML = `<div class="panel"><h2>${w.phase === "win" ? L("ママにつかまった！", "Caught by Mama!") : L("虫にやられた…", "The bugs got you…")}</h2>${w.opts.endless ? this.endlessResult(w) : ""}${w.phase === "win" ? this.favHtml(w) : ""}
      ${w.phase === "win" ? mama("pet", L("つかまえた〜♪<br>病院でワクチン打とうね。<br>1年間ありがとう！", "Gotcha~♪<br>Time for your shots at the vet.<br>Thanks for this year!")) : mama("scream", L("いやぁぁぁ！<br>虫がーっ！", "Eeeek!<br>Buuugs!"))}
      <p class="muted">${w.phase === "win" ? L("秋から夏まで、ぜんぶの虫を追い払った。さいごは病院へ…（おしまい）", "You chased off every bug from autumn to summer. Last stop: the vet… (The End)") : L(`${w.title} で力尽きた。`, `Fell in ${w.title}.`)}</p>
      <p class="nibline">${L("にぼし", "Sardines")} <b>+${this.earned}</b>${L(`（${DIFFS[w.opts.difficulty].name}・片付けた部屋 ${w.cleared}・倒した虫 ${w.kills}`, ` (${DIFFS[w.opts.difficulty].name}・rooms ${w.cleared}・bugs ${w.kills}`)}${w.curses.length ? L(`・呪い ${w.curses.length}`, `・curses ${w.curses.length}`) : ""}${L("）　タイトルの「ねこの成長」で使える", ")  Spend them in Cat Growth on the title")}</p>
      ${this.opened.length ? `<div class="opened"><b>${L("新しく解放！", "New unlocks!")}</b>${L("（次の冒険から出てくる）", " (from your next run)")}<div class="zcells">${this.opened.map((u) => u.kind === "spell" ? cell(u.id, "tabindex=-1") : itemCell(u.kind, u.id, "tabindex=-1")).join("")}</div>
        <small>${this.opened.map((u) => (u.kind === "spell" ? SPELLS[u.id].name : u.kind === "toy" ? TOYS[u.id].name : RELICS[u.id].name)).join("・")}</small></div>` : ""}
      ${adsAvailable() && this.earned > 0 ? this.doubled ? `<p class="nibline">${L(`にぼし2倍！ <b>+${this.earned}</b> もらった`, `Sardines x2! Got <b>+${this.earned}</b>`)}</p>` : `<div class="menu"><button class="go nibAd" ${this.adBusy ? "disabled" : ""}>${L(`▶ 広告を見て にぼし2倍（+${this.earned}）`, `▶ Watch ad: 2x sardines (+${this.earned})`)}</button></div>` : ""}
      <div class="menu"><button class="go again">${L("もう一度", "Retry")}</button><button class="toTitle">${L("タイトルへ", "Title")}</button></div></div>`;
    const nibAd = el.querySelector<HTMLButtonElement>(".nibAd");
    if (nibAd) nibAd.onclick = () => this.watchAd(() => { if (!this.doubled) { addNiboshi(this.earned); this.doubled = true; } });
    el.querySelector<HTMLButtonElement>(".again")!.onclick = () => this.onRestart();
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
    el.querySelectorAll<HTMLButtonElement>("[data-fav]").forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.fav), n = favSlots(loadRecord().meta);
      this.favPick = this.favPick.includes(i) ? this.favPick.filter((x) => x !== i) : this.favPick.length < n ? [...this.favPick, i] : this.favPick;
      this.favSaved = false; this.lastKey = "";
    });
    const favGo = el.querySelector<HTMLButtonElement>(".favGo");
    if (favGo) favGo.onclick = () => { const owned = w.ownedSpells(); setFavorites(this.favPick.map((i) => owned[i])); this.favSaved = true; this.lastKey = ""; };
    const send = el.querySelector<HTMLButtonElement>(".sendBtn");
    if (send) send.onclick = () => {
      const name = cleanName(el.querySelector<HTMLInputElement>(".nameIn")!.value);
      if (!name) { this.sent = { error: L("その名前は使えません（12文字まで・連絡先や長い数字はだめ）", "Can't use that name (max 12 chars, no contact info or long numbers)") }; this.lastKey = ""; return; }
      saveName(name); nameEndless(this.endedAt, name); this.sent = "sending"; this.lastKey = "";
      void submitScore({ name, score: w.score, rooms: w.cleared, bosses: w.bosses, elites: w.elites, kills: w.kills }).then((r) => { this.sent = r; this.lastKey = ""; });
    };
  }
}
