// HTML の HUD と各画面（はじめに・ごほうび選び・おもちゃの編集・結果）。
// アイテムは「絵・名前・種類・数値・説明」をいつも同じ形で見せる。
import { baseId, DIR_INFO, ELEMENT_INFO, KIND_LABEL, MOTION_LABEL, rarOf, SPELL_RAR_NAME, SPELLS, spellDef, spellStats, starsOf, type SpellDef } from "../core/spells";
import { groupSummary, SUB_LABEL, TOYS, toyStats, type ToyDef } from "../core/wand";
import { CURSES } from "../core/curses";
import { findUnlock, isOpen, UNLOCKS, unlockText, type Unlock, type UnlockKind } from "../core/unlock";
import { buyUpgrade, canPick, loadRecord, nameEndless, recordEndless, recordRun, recordText, setFavorites } from "./record";
import { fetchBoard, saveName, savedName, submitScore, type Board } from "./ranking";
import { cleanName, POINTS } from "../core/score";
import { loadRun, runLabel } from "./save";
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
  `<div class="mama ${small ? "small" : ""}"><img src="${import.meta.env.BASE_URL}mama/${img}.png" alt="ママ"><div class="say">${line}</div></div>`;

/** 修飾のかかる向きの矢印（▶右・◀左・◀▶両側・全 全体・つづけて/ふたつ持ちは左右をつなぐ）。 */
const arrowOf = (s: SpellDef) => s.kind === "attack" ? "" : s.kind === "modifier" ? DIR_INFO[s.dir ?? "right"].arrow : s.kind === "multicast" ? "▶" : "◀▶";
/** 修飾の説明の札（カード用）。 */
const TRIG_TAG = { hit: "当たると", every: "当たるたびに", bounce: "はね返るたびに", kill: "虫を倒すと" } as const;
const modTag = (s: SpellDef) => s.kind === "trigger" ? (s.timer ? "つづけて ◀左の技から時間で右の技" : `つづけて ◀左の技が${TRIG_TAG[s.on ?? "hit"]}右の技▶`)
  : s.kind === "duet" ? "ふたつ持ち ◀左と右のおもちゃを同時に扱い、1つの技に▶" : s.kind === "multicast" ? "修飾 ▶右の技を同時に"
  : `${s.modifier?.element ? "属性" : s.dir === "all" ? "全体修飾" : "修飾"} ${DIR_INFO[s.dir ?? "right"].arrow}${DIR_INFO[s.dir ?? "right"].label}`;

/** スロット・手持ちの1マス。修飾にはかかる向きの矢印、レア度は下の帯。 */
const cell = (id: string | null, attrs = "", extra = "") => {
  if (!id) return `<button class="cell empty ${extra}" ${attrs}></button>`;
  const s = spellDef(id), mod = isMod(id), dir = s.kind === "modifier" ? s.dir ?? "right" : s.kind === "attack" ? "" : "both";
  return `<button class="cell ${mod ? "mod" : "atk"} dir-${dir} rar${rarOf(id)} ${extra}" style="--c:${s.color}" ${attrs}>
    <img src="${spellImg(id)}" alt="">${starsOf(id) ? `<span class="stars">${"★".repeat(starsOf(id))}</span>` : ""}<span class="badge">${s.modifier?.element ? "属性" : s.dir === "all" ? "全体" : KIND_LABEL[s.kind]}</span>${mod ? `<span class="arrow">${arrowOf(s)}</span>` : ""}</button>`;
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
    <div class="head"><img src="${spellImg(id)}" alt=""><div><b>${s.name}</b><span class="tag ${mod ? "mod" : "atk"}">${mod ? modTag(s) : `技（${MOTION_LABEL[s.projectile!.motion]}）`}</span></div></div>
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
    <div class="head"><img src="${urlOf(relicCanvas(id))}" alt=""><div><b>${r.name}</b><span class="tag relic">レリック</span></div></div>
    ${statsTable(bonusRows(r.bonus))}<p class="desc">${r.desc}</p></div>`;
}

/** 装備の説明カード。レアリティ・特殊効果・セットのボーナスと、今そろっている数も見せる。 */
function gearCard(item: GearItem, gear: Gear | null, attrs = "") {
  const g = GEAR[item.id], set = SETS[g.set], R = RARITY[item.rar];
  const worn = gear?.[g.slot];
  const have = gear ? (setCounts(gear)[g.set] ?? 0) + (worn && GEAR[worn.id].set === g.set ? 0 : 1) : 0;   // これを着けたときの数
  const line = (n: number, b: Parameters<typeof bonusRows>[0]) =>
    `<div class="setline ${gear && have >= n ? "on" : ""}"><b>${n}つ</b>${bonusRows(b).map(([k, v]) => `${k} ${v}`).join("・")}</div>`;
  const fx = item.fx.length ? `<div class="fxline">特殊効果: ${item.fx.map((f) => GEAR_FX[f].name).join("・")}</div>` : "";
  return `<div class="card rar${item.rar}" style="--r:${R.color}" ${attrs}>
    <div class="head"><img src="${urlOf(gearCanvas(item.id))}" alt=""><div><b>${g.name}</b><span class="tag" style="background:${R.color}">${R.name}</span><span class="tag gear" style="background:${set.color}">${SLOT_NAME[g.slot]}</span></div></div>
    ${statsTable(bonusRows(gearBonus(item)))}${fx}<p class="desc">${g.desc}</p>
    <div class="setbox" style="--c:${set.color}"><div class="setname">${set.name}${gear ? `（着けると ${have}/3）` : ""}</div>${line(2, set.two)}${line(3, set.three)}</div></div>`;
}

function toyCard(t: ToyDef, attrs = "") {
  const d = TOYS[t.id] ?? t, pre = [...d.slots, ...(d.sub?.slots ?? [])].filter((x): x is string => !!x);   // 売り物としての最初の中身
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${urlOf(toyCanvas(t.id))}" alt=""><div><b>${t.name}</b><span class="tag toy">${t.auto ? "電池式のおもちゃ（自動）" : "おもちゃ（装備）"}</span></div></div>
    ${statsTable(toyStats(t))}${pre.length ? `<div class="pre">最初から入っている: ${pre.map((id) => spellDef(id).name).join("・")}</div>` : ""}<p class="desc">${t.desc}</p></div>`;
}

/** 解放していないもののカード（条件を見せる）。 */
function lockedCard(u: Unlock) {
  return `<div class="card locked"><div class="head"><div class="qmark">？</div><div><b>まだ解放していない</b><span class="tag">${u.kind === "toy" ? "おもちゃ" : u.kind === "relic" ? "レリック" : "技・修飾"}</span></div></div>
    <p class="desc">解放の条件: <b>${unlockText(u)}</b><br>負けても記録は積み上がる。条件を満たすと、次の冒険から出てくる。</p></div>`;
}

/** サブスロットの列（たまり具合のメーターつき）。 */
function subRow(h: HeldToy, cellOf: (i: number) => string) {
  const sub = h.def.sub;
  if (!sub) return "";
  return `<div class="subrow"><span class="sublabel">サブ<small>${SUB_LABEL[sub.charge](sub.need)}で発動</small></span><div class="cells">${sub.slots.map((_, i) => cellOf(i)).join("")}</div>
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
  { title: "飛ぶ技", ids: ["claw", "bite", "hairball", "hiss", "yarn", "laser"] },
  { title: "近く・置く技", ids: ["swing", "pounce", "punch", "post"] },
  { title: "召喚", ids: ["friend", "roomba"] },
  { title: "買ってきた物の技", ids: ["mizudeppo", "ahiru", "shabon", "kabocha", "korokoro", "hammer", "flash", "danbo"] },
  { title: "弾を増やす（重ねると掛け算）", ids: ["double", "nekodango", "tatougai", "butimake", "hotsure"] },
  { title: "▶修飾（右の技に）", ids: ["matatabi", "kajikaji", "big", "small", "quick", "stare", "bouncy", "pushy", "rame", "suzu", "kenko", "jidori"] },
  { title: "速さ・やる気", ids: ["massigura", "churu"] },
  { title: "◀修飾（左の技に）・◀▶修飾（左右の技に）", ids: ["okawari", "oikake", "tsurutsuru", "dryer", "catnipBag", "kotatsu"] },
  { title: "全体修飾（どこに置いても）", ids: ["maigofuda", "hidamari", "sensor", "kezukuroi"] },
  { title: "つづけて・ふたつ持ち", ids: ["chain", "nandodemo", "pyonpyon", "todome", "hitoiki", "issho"] },
  { title: "属性", ids: ["static", "water", "tape", "spray"] },
  { title: "おもちゃ", ids: Object.keys(TOYS).filter((t) => !TOYS[t].auto), kind: "toy" },
  { title: "電池式のおもちゃ（自動で動く）", ids: Object.keys(TOYS).filter((t) => TOYS[t].auto), kind: "toy" },
  { title: "レリック", ids: RELIC_IDS, kind: "relic" },
  { title: "装備", ids: GEAR_IDS, kind: "gear" },
];

/** タイトルまわりの画面。null ならゲーム中。 */
type Screen = "title" | "howto" | "zukan" | "diff" | "grow" | "endless" | "rank" | null;

export class Hud {
  private el = (id: string) => document.getElementById(id)!;
  bagOpen = false;
  /** 一時停止メニューを開いている。 */
  paused = false;
  /** 音のオン・オフ（main から渡す）。 */
  onMute: () => boolean = () => false;
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
    if ((w.phase === "dead" || w.phase === "win") && !this.recorded.has(w)) {
      this.recorded.add(w);
      this.earned = runReward(w.cleared, w.bosses, w.phase === "win", w.opts.difficulty, w.curses.length);
      this.opened = recordRun(w.room.act, w.room.index, w.phase === "win", w.opts.difficulty, this.earned,
        { kills: w.kills, elites: w.elites, bosses: w.bosses, rooms: w.cleared, specials: w.specials, curses: w.curses.length }, !!w.opts.endless);
      this.sent = null; this.favPick = []; this.favSaved = false;
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
    const sub = toy.sub ? `<div class="subTop"><span>サブ</span>${toy.sub.slots.map((id) => cell(id, "tabindex=-1", "mini")).join("")}<div class="meter"><i data-meter="sub"></i></div></div>` : "";
    const batts = w.batt.length ? `<div class="batts">${w.batt.map((h, i) => `<div class="batt" title="${h.def.name}"><img src="${urlOf(toyCanvas(h.def.id))}" alt=""><div class="meter"><i data-meter="batt${i}"></i></div></div>`).join("")}</div>` : "";
    this.el("slots").innerHTML = (others ? `<div class="toySws">${others}</div>` : "") + `<img class="toyIcon" src="${urlOf(toyCanvas(toy.id))}" alt="${toy.name}">`
      + `<div>${slotRow(toy, (i) => cell(toy.slots[i], "tabindex=-1"), p.recharging ? -1 : p.cursor)}${sub}</div>`
      + (p.recharging ? `<span class="rest">休けい中</span>` : "") + batts;
    this.meters(w);
    this.el("slots").querySelectorAll<HTMLButtonElement>("[data-toy]").forEach((b) => b.onclick = () => w.switchToy(Number(b.dataset.toy)));

    // 扉の選択肢
    const hint = this.el("hint");
    hint.hidden = !(w.doorOpen && w.phase === "play");
    const al = w.room.altar;
    const altarHint = al?.kind === "kotatsu" ? `<b>猫こたつに近づくと、おもちゃと技を自由に選べる</b>`
      : al && (!al.used || al.kind === "fusion") ? `<b>真ん中の${ALTAR_NAME[al.kind]}に近づこう</b>` : "";
    if (!hint.hidden) hint.innerHTML = (altarHint || `<b>扉を選んで進もう</b>`) + w.room.doors.map((d) =>
      `<span class="chip"><img src="${urlOf(rewardCanvas(d.reward))}" alt="">${REWARD_INFO[d.reward].label}</span>`).join("");

    document.body.classList.toggle("titling", w.phase === "intro");
    this.renderTitle(w);
    this.renderPause();
    this.renderBag(w);
    this.renderReward(w);
    this.renderShop(w);
    this.renderBench(w);
    this.renderTrain(w);
    this.renderResult(w);
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
        tb.innerHTML = `<span>DPS <b data-t="dps">0</b></span><span>合計 <span data-t="total">0</span></span><span>最大 <span data-t="max">0</span></span><button class="trainReset">リセット</button>`;
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
      el.innerHTML = `<div class="panel intro">${this.howtoHtml()}<button class="back">もどる</button></div>`;
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "diff") {   // 難易度を選んではじめる
      const rec = loadRecord();
      const saved = loadRun();
      el.innerHTML = `<div class="panel diffPanel"><h2>難易度をえらぶ</h2>${saved ? `<p class="muted warn">はじめると、前の冒険のつづき（${runLabel(saved)}）は消えます</p>` : ""}<div class="diffs">${DIFFS.map((d, i) => {
        const ok = canPick(rec, i);
        return `<button class="diff ${i === 1 ? "go" : ""}" data-d="${i}" ${ok ? "" : "disabled"}><b>${d.name}${rec.cleared.includes(i) ? " ★" : ""}</b><small>${ok ? d.desc : "むずかしいを守りきると選べる"}</small><small>にぼし ×${d.reward}</small></button>`;
      }).join("")}</div><button class="back">もどる</button></div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-d]").forEach((b) => b.onclick = () => { this.screen = null; this.lastKey = ""; this.onStart(Number(b.dataset.d)); });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "grow") {   // ねこの成長（周回で強くなる）
      const rec = loadRecord();
      el.innerHTML = `<div class="panel growPanel"><h2>ねこの成長</h2><p class="muted">冒険でもらった にぼし で、ずっと強くなる。今のにぼし: <b class="nib">${rec.niboshi}</b></p>
        <div class="grows">${UPGRADES.map((u) => {
          const lv = rec.meta[u.id], max = lv >= u.max, cost = u.cost(lv);
          return `<div class="grow"><div><b>${u.name}</b><span class="lv">${"●".repeat(lv)}${"○".repeat(u.max - lv)}</span><small>${u.desc}</small></div>
            <button data-u="${u.id}" ${max || rec.niboshi < cost ? "disabled" : ""}>${max ? "最大" : `にぼし ${cost}`}</button></div>`;
        }).join("")}</div>
        <div class="favNow"><b>おきにいり（${favSlots(rec.meta)}枠）</b>${rec.favorites.length ? `<div class="zcells">${rec.favorites.map((id) => cell(id, "tabindex=-1")).join("")}</div><small>冒険のはじめから手持ちに入る</small>` : `<small>まだありません。クリアしたときに、持っている技から選べる</small>`}</div>
        <button class="back">もどる</button></div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-u]").forEach((b) => b.onclick = () => { buyUpgrade(b.dataset.u as keyof typeof rec.meta); this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "endless") {   // エンドレスの説明とはじめる
      const saved = loadRun();
      el.innerHTML = `<div class="panel diffPanel"><h2>エンドレス</h2>
        <p>夏のあとも季節がめぐり続け、虫はどんどん強くなる。どこまで守れるか、ポイントで競おう。難易度は「ふつう」。</p>
        <p class="muted">ポイント: 片付けた部屋 ×${POINTS.rooms}・ボス ×${POINTS.bosses}・強い虫 ×${POINTS.elites}・倒した虫 ×${POINTS.kills}</p>
        ${saved ? `<p class="muted warn">はじめると、前の冒険のつづき（${runLabel(saved)}）は消えます</p>` : ""}
        <div class="menu center"><button class="go startEndless">はじめる</button><button class="back">もどる</button></div></div>`;
      el.querySelector<HTMLButtonElement>(".startEndless")!.onclick = () => { this.screen = null; this.lastKey = ""; this.onStart(1, true); };
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "rank") {
      el.innerHTML = `<div class="panel rankPanel"><h2>エンドレスのランキング</h2>
        <div class="tabs"><button class="tab ${this.rankTab === "all" ? "on" : ""}" data-rt="all">みんな</button><button class="tab ${this.rankTab === "mine" ? "on" : ""}" data-rt="mine">じぶん</button></div>
        ${this.rankHtml()}<button class="back">もどる</button></div>`;
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
      <div class="logo"><small>ママを虫から守れ！</small>My Cat Is <br>So Cute</div>
      <div class="hero"><img class="mom" src="${base}mama/scared.png" alt="ママ"><img class="cat" src="${base}cat/P03_sit_happy.png" alt="猫">
        <img class="bug b1" src="${bugUrl("roach")}" alt=""><img class="bug b2" src="${bugUrl("mosquito")}" alt=""></div>
      <div class="menu">
        ${saved ? `<button class="go cont">つづきから<small>${runLabel(saved)}</small></button>` : ""}
        <button class="${saved ? "" : "go "}start">はじめる</button>
        <button class="endlessBtn">エンドレス</button>
        <button class="rankBtn">ランキング</button>
        <button class="trainBtn">トレーニング</button>
        <button class="growBtn">ねこの成長</button>
        <button class="howtoBtn">あそびかた</button>
        <button class="zukanBtn">ずかん</button>
      </div>
      <div class="record">${recordText(rec)}<br>解放: <b>${UNLOCKS.filter((u) => isOpen(u, rec.stats)).length}/${UNLOCKS.length}</b>（倒した虫 ${rec.stats.kills}・片付けた部屋 ${rec.stats.rooms}）</div>
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
  }

  /** みんなのランキングを読みこむ（終わったら描き直す）。 */
  private loadBoard() {
    this.board = "loading";
    void fetchBoard().then((b) => { this.board = b ?? "error"; this.lastKey = ""; });
  }

  private rankHtml() {
    const row = (i: number, name: string, score: number, rooms: number, mark = false) =>
      `<tr class="${mark ? "me" : ""}"><td>${i + 1}</td><td class="nm">${esc(name || "ななしの猫")}</td><td>★${score}</td><td>${rooms}部屋</td></tr>`;
    if (this.rankTab === "mine") {
      const mine = loadRecord().endless;
      return mine.length ? `<table class="rank"><tr><th>順位</th><th>名前</th><th>ポイント</th><th>部屋</th></tr>${mine.map((e, i) => row(i, e.name, e.score, e.rooms)).join("")}</table>`
        : `<p class="muted">まだ記録がありません。エンドレスで遊ぶとここに残ります。</p>`;
    }
    if (this.board === "loading" || this.board === null) return `<p class="muted">読みこみ中…</p>`;
    if (this.board === "error") return `<p class="muted">みんなのランキングは準備中です（つながりません）。</p>`;
    return this.board.top.length ? `<table class="rank"><tr><th>順位</th><th>名前</th><th>ポイント</th><th>部屋</th></tr>${this.board.top.map((e, i) => row(i, e.name, e.score, e.rooms)).join("")}</table>`
      : `<p class="muted">まだだれも記録を送っていません。一番乗りのチャンス！</p>`;
  }

  /** クリアしたとき: 持っている技から「おきにいり」を選ぶ（次からの冒険で最初から手持ちに入る）。 */
  private favHtml(w: World) {
    const owned = w.ownedSpells(), n = favSlots(loadRecord().meta);
    return `<div class="favBox"><b>おきにいりを選ぶ</b>（${this.favPick.length}/${n}）<small>選んだ技は、次からの冒険で最初から手持ちに入る。枠は「ねこの成長」で増やせる</small>
      <div class="fuseBag">${owned.map((id, i) => cell(id, `data-fav="${i}"`, this.favPick.includes(i) ? "sel" : "")).join("")}</div>
      <button class="favGo go" ${this.favPick.length ? "" : "disabled"}>${this.favSaved ? "おきにいりにした！" : "おきにいりにする"}</button></div>`;
  }

  /** エンドレスの結果: ポイント・じぶんの順位・名前を入れてみんなのランキングへ送る。 */
  private endlessResult(w: World) {
    const s = this.sent;
    const status = s === null ? "" : s === "sending" ? "送っています…" : "rank" in s ? `みんなのランキングで <b>${s.rank}位</b>！` : s.error;
    return `<div class="endlessBox"><div class="bigScore">★ ${w.score} ポイント</div>
      <p class="muted">片付けた部屋 ${w.cleared}×${POINTS.rooms}・ボス ${w.bosses}×${POINTS.bosses}・強い虫 ${w.elites}×${POINTS.elites}・倒した虫 ${w.kills}×${POINTS.kills}</p>
      ${this.localRank ? `<p>じぶんの記録で <b>${this.localRank}位</b></p>` : ""}
      ${w.cleared > 0 ? `<div class="sendRow"><input class="nameIn" maxlength="12" placeholder="名前（本名は入れないでね）" value="${esc(savedName())}">
        <button class="sendBtn" ${s === "sending" || (s !== null && typeof s === "object" && "rank" in s) ? "disabled" : ""}>ランキングに送る</button></div><p class="sendMsg">${status}</p>` : ""}</div>`;
  }

  private howtoHtml() {
    const touch = isTouch();
    return `<div class="cols">
        <div>${mama("scared", "きゃー！虫！<br>ねこちゃん、たすけてー！")}
          <div class="howto">
            <div><b>移動</b>${touch ? "画面をドラッグ" : "WASD / 矢印キー"}</div>
            <div><b>攻撃</b>${touch ? "<span class='k'>攻撃</span>を押しっぱなし（近くの虫を自動で狙う）" : "クリック長押し（マウスの方向）／ J（自動で狙う）"}</div>
            <div><b>よける</b>${touch ? "<span class='k'>ダッシュ</span>" : "Space"}（一瞬むてき）</div>
            <div><b>持ち替え</b>${touch ? "スロットの左の小さなおもちゃ" : "Q ／ 1〜3 ／ ホイール"}</div>
            <div><b>止める</b>${touch ? "右上の <span class='k'>Ⅱ</span>" : "Esc ／ 右上の Ⅱ"}</div>
          </div></div>
        <div class="rules">
          <h3>おもちゃのしくみ</h3>
          <p>おもちゃを振ると、スロットに入れた<b>技（爪・牙など）が出る</b>。スロットは<b>左から順に</b>使われる。</p>
          <div class="example">${cell("matatabi")}${cell("bite")}<span>修飾の ▶ は<b>右の技</b>、◀ は<b>左の技</b>、◀▶ は<b>左右の技</b>にかかる。<b>全</b>はどこに置いても全部の技に</span></div>
          <div class="example">${cell("claw")}${cell("chain")}${cell("swing")}<span><b>つづけて</b>: ひっかきが当たった所で、ぶんぶんが回る。<b>ふたつ持ち</b>は左右の技を同時に扱って1つの技に</span></div>
          <p>スロットの下の線が「1回で一緒に出る範囲」。⚔は攻撃力の合計、⚡は使うやる気。サブスロットのあるおもちゃは、条件がたまると全部いっぺんに出る。電池式のおもちゃは持っているだけで自動で動く。</p>
          <p><b>属性</b>（静電気・水のみ皿・ガムテープ・虫よけ）を技の左に置くと効果がつく。<b>ぬれた虫にビリビリ</b>、<b>ねばねばの虫に虫よけ</b>はよく効く。</p>
          <p>部屋を片付けると扉が開く。扉の上の絵が<b>次の部屋のごほうび</b>（♥最大HP／⚡やる気／★技／おもちゃ）や<b>特別な部屋</b>（宝箱・ママのおひざ・秘密の隠し場所・強い虫・あやしい箱）。季節ごとに8部屋＋ボス、秋から始まり夏が最後。</p>
          <p>負けても、倒した虫や片付けた部屋の数で<b>新しいおもちゃや技が解放</b>される。</p>
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
    return `<div class="edit"><div class="detail">${detail}</div><div class="board"><div class="boardHead"><b>ずかん</b><span class="muted">タップで説明を見る</span><button class="back">もどる</button></div><div class="zgroups">${groups}</div></div></div>`;
  }

  /** 一時停止メニュー。 */
  private renderPause() {
    const el = this.el("pause");
    el.hidden = !this.paused;
    if (el.hidden) return;
    el.innerHTML = `<div class="panel pausePanel"><h2>ひと休み</h2>
      <div class="menu"><button class="go resume">つづける</button><button class="toTitle">タイトルへ</button></div>
      <p class="muted">冒険は部屋に入るたびに自動でセーブされています。タイトルの「つづきから」で、この部屋の入口から再開できます。</p></div>`;
    el.querySelector<HTMLButtonElement>(".resume")!.onclick = () => this.togglePause();
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
  }

  private renderBag(w: World) {
    const el = this.el("bag");
    el.hidden = !this.bagOpen;
    if (el.hidden) return;
    if (typeof this.tab === "number" && this.tab >= w.held.length) this.tab = w.cur;
    const tabs = `<div class="tabs">${w.held.map((h, i) => `<button class="tab ${this.tab === i ? "on" : ""}" data-tab="${i}"><img src="${urlOf(toyCanvas(h.def.id))}" alt="">${h.def.name}${i === w.cur ? "<small>使用中</small>" : h.def.auto ? "<small>電池</small>" : ""}</button>`).join("")}
      <button class="tab ${this.tab === "gear" ? "on" : ""}" data-tab="gear"><img src="${urlOf(rewardCanvas("relic"))}" alt="">装備・レリック</button>
      <button class="close">閉じる</button></div>`;
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
        <div class="boardHead"><span class="muted">選んでから、置きたい場所をタップ（入れ替え）。おもちゃどうしは手持ちを通して移す</span></div>
        ${slotRow(toy, (i) => cell(toy.slots[i], `data-where="slot" data-i="${i}"`, isSel("slot", i) ? "sel" : ""))}
        ${subRow(h, (i) => cell(toy.sub!.slots[i], `data-where="sub" data-i="${i}"`, isSel("sub", i) ? "sel" : ""))}
        <div class="bagTitle">手持ち</div>
        <div class="baggrid">${Array.from({ length: BAG }, (_, i) => cell(w.bag[i] ?? null, `data-where="bag" data-i="${i}"`, isSel("bag", i) ? "sel" : "")).join("")}</div>
      </div></div>`;
  }

  /** 持ち物: 装備（帽子・服・首輪とセットの状態）とレリック。 */
  private gearHtml(w: World) {
    const pick = this.pick;
    const worn = GEAR_SLOTS.map((sl) => w.gear[sl]).find((g) => g && g.id === pick);
    const detail = worn ? gearCard(worn, w.gear) : pick && RELICS[pick] ? relicCard(pick)
      : `<div class="card"><b>装備・レリック</b><p class="desc">装備は帽子・服・首輪の3か所。同じセットを2つ・3つそろえるとボーナス。レリックは持っているだけで効く。</p></div>`;
    const counts = setCounts(w.gear);
    const sets = Object.values(SETS).map((st) => {
      const n = counts[st.id] ?? 0;
      return `<div class="setline ${n >= 2 ? "on" : ""}" style="--c:${st.color}"><b>${st.name} ${n}/3</b>${n >= 2 ? bonusRows(st.two).map(([k, v]) => `${k} ${v}`).join("・") : ""}${n >= 3 ? "・" + bonusRows(st.three).map(([k, v]) => `${k} ${v}`).join("・") : ""}</div>`;
    }).join("");
    return `<div class="edit">
      <div class="detail">${detail}</div>
      <div class="board">
        <div class="bagTitle">装備</div>
        <div class="gearRow">${GEAR_SLOTS.map((sl) => `<div class="gslot">${itemCell("gear", w.gear[sl]?.id ?? null, `data-pick="${w.gear[sl]?.id ?? ""}"`, pick && pick === w.gear[sl]?.id ? "sel" : "", w.gear[sl]?.rar ?? 0)}<span>${SLOT_NAME[sl]}</span></div>`).join("")}<div class="sets">${sets}</div></div>
        ${w.curses.length ? `<div class="bagTitle">呪い（${w.curses.length}）</div><div class="curses">${w.curses.map((c) => `<span class="curse"><b>${CURSES[c].name}</b>${CURSES[c].desc}</span>`).join("")}</div>` : ""}
        <div class="bagTitle">レリック（${w.relics.length}）</div>
        <div class="baggrid">${w.relics.length ? w.relics.map((r) => itemCell("relic", r, `data-pick="${r}"`, pick === r ? "sel" : "")).join("") : `<span class="muted">まだ持っていません（◆の扉・ボスでもらえる）</span>`}</div>
      </div></div>`;
  }

  private renderReward(w: World) {
    const el = this.el("reward");
    el.hidden = w.phase !== "reward";
    if (el.hidden) return;
    const boss = w.room.kind === "boss", al = w.room.altar;
    const title = boss ? `${ENEMY[w.room.waves[0][0]].name}を追い払った！` : al?.kind === "treasure" ? "宝箱を開けた！" : al?.kind === "curse" ? "あやしい箱を開けた…"
      : `${w.title.split("・")[1].replace(/ \d.*$/, "")}を片付けた！`;
    const one = (c: Choice, a = "") => c.kind === "pact" ? "" : c.kind === "toy" ? toyCard(TOYS[c.id], a) : c.kind === "relic" ? relicCard(c.id, a) : c.kind === "gear" ? gearCard(c.gear ?? { id: c.id, rar: 0, fx: [] }, w.gear, a) : spellCard(c.id, a);
    const card = (c: Choice, i: number) => {
      const a = `data-i="${i}" role="button" tabindex="0"`;
      if (c.kind !== "pact") return one(c, a);
      const k = CURSES[c.id];
      return `<div class="card pact" ${a}><div class="cursebox"><b>呪い: ${k.name}</b><small>${k.desc}（この冒険のあいだずっと）</small></div>
        <div class="pactget">もらえる: カリカリ ${c.coins} ＋</div>${one(c.reward)}</div>`;
    };
    const kind = w.choices[0]?.kind;
    const batt = w.choices.some((c) => c.kind === "toy" && TOYS[c.id].auto);
    const note = kind === "pact" ? "呪いを1つ受けると、強いごほうびがもらえる（呪い1つにつき、にぼし＋15%）。いらないなら何も受けない"
      : kind === "toy" ? (w.toys.length < 3 ? `おもちゃを1つ増やす（今 ${w.toys.length}/3。持ち替えはスロットの横のアイコン）` : "持てるのは3つまで。今使っているおもちゃと交換（技はそのまま移る）") + (batt ? `。電池式は別に${2}つまで（今 ${w.batt.length}/2・自動で動く）` : "")
      : kind === "relic" ? "レリックを1つ選ぼう（持っているだけで効く）"
      : kind === "gear" ? "装備を1つ選ぼう（同じ場所の装備とは交換。セットをそろえるとボーナス）"
      : "1つ選んで手持ちに加えよう（「持ち物」でスロットにはめる）";
    el.innerHTML = `<div class="panel reward">
      <div class="rhead">${mama("relief", boss ? "すごい！ありがとう！" : "ふぅ…ありがとう。", true)}<div><h2>${title}</h2>
        <p class="muted">${note}</p></div></div>
      <div class="choices">${w.choices.map(card).join("")}</div>
      <button class="skip">いらない</button></div>`;
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
        <button data-buy="${i}" ${can ? "" : "disabled"}>${it.sold ? "売り切れ" : `<img src="${urlOf(kibbleCanvas())}" alt="">${it.price}`}</button></div>`;
    }).join("");
    const forge = w.forgeable();
    el.innerHTML = `<div class="panel shopPanel">
      <div class="shead"><h2>ママのところ</h2><span class="wallet"><img src="${urlOf(kibbleCanvas())}" alt="">${w.coins}</span>
        <button class="reroll" ${w.coins >= sh.rerollCost ? "" : "disabled"}>ほかのも見せて <img src="${urlOf(kibbleCanvas())}" alt="">${sh.rerollCost}</button><button class="close">閉じる</button></div>
      <p class="muted mamaLine">ママ「拾ってきたカリカリと交換ね♪ こわれたおもちゃも直してあげる」</p>
      <div class="sitems">${items}</div>
      <div class="forge"><b>ママのお直し</b><span class="muted">同じ物3つを、ママが縫い合わせて丈夫な★の物1つに直してくれる</span>
        <div class="fcells">${forge.length ? forge.map((id) => `<div class="fbtn" role="button" tabindex="0" data-forge="${id}">${cell(id, "tabindex=-1")}<span>×3 → ${spellDef(id + "+").name}</span></div>`).join("") : `<span class="muted">直せる物はまだない（同じ物を3つ集めよう）</span>`}</div></div>
      ${this.fusionHtml(w, "ソファの下（秘密の隠し場所）")}
    </div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) => b.onclick = () => { w.buy(Number(b.dataset.buy)); this.lastKey = ""; });
    el.querySelectorAll<HTMLElement>("[data-forge]").forEach((b) => b.onclick = () => { w.forge(b.dataset.forge!); this.fusePick = []; this.lastKey = ""; });
    this.bindFusion(el, w);
    el.querySelector<HTMLButtonElement>(".reroll")!.onclick = () => { w.reroll(); this.lastKey = ""; };
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => { w.closeShop(); this.fusePick = []; this.lastKey = ""; };
  }

  /** 秘密の隠し場所（ソファの下）: 同じレア度の物を4つ隠す → 奥から1つ上のレア度の物が1つ出てくる。 */
  private fusionHtml(w: World, title = "秘密の隠し場所") {
    const pick = this.fusePick.filter((i) => i < w.bag.length), r = pick.length ? rarOf(w.bag[pick[0]]) : -1;
    const ok = w.fusable();
    const cells = w.bag.map((id, i) => {
      const on = pick.includes(i), can = ok.includes(rarOf(id)) && (r < 0 || rarOf(id) === r);
      return cell(id, `data-fuse="${i}" ${can || on ? "" : "disabled"}`, `${on ? "sel" : ""} ${can || on ? "" : "dim"}`);
    }).join("");
    return `<div class="forge fusion"><b>${title}</b><span class="muted">ソファの下の、猫だけの隠し場所。同じレア度の物を4つ押しこむと、奥から前に失くした物（1つ上のレア度）が1つ出てくる</span>
      <div class="fuseBag">${w.bag.length ? cells : `<span class="muted">手持ちが空っぽ</span>`}</div>
      <button class="fuseGo go" ${pick.length === 4 ? "" : "disabled"}>${pick.length === 4 ? `4つ隠す（${SPELL_RAR_NAME[Math.min(3, r + 1)]}の物が出てくる）` : `${pick.length}/4 選んだ`}</button></div>`;
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
      + (def.sub ? `<div class="subrow"><span class="sublabel">サブ</span><div class="cells">${def.sub.slots.map((id, i) => cell(id, `data-th="${h}" data-tw="sub" data-ti="${i}"`)).join("")}</div></div>` : "");
    const star = (id: string) => id + "+".repeat(this.trainStars);
    const palette = ZUKAN.filter((g) => !g.kind).map((g) => `<div class="zgroup"><div class="ztitle">${g.title}</div><div class="zcells">${g.ids.map((id) => cell(star(id), `data-pal="${star(id)}"`, pick === star(id) ? "sel" : "")).join("")}</div></div>`).join("");
    el.innerHTML = `<div class="panel trainPanel">
      <div class="shead"><h2>猫こたつ（トレーニング）</h2><button class="close">閉じる</button><button class="toTitle">タイトルへ</button></div>
      <p class="muted">下の技をタップで選び、スロットをタップして置く（何回でも置ける）。何も選ばずにスロットをタップすると外す。</p>
      <div class="trainOpts">
        <button data-multi="0" class="${w.trainMulti ? "" : "on"}">けりぐるみ 1個</button><button data-multi="1" class="${w.trainMulti ? "on" : ""}">けりぐるみ たくさん</button>
        <button class="infMana ${w.trainInfMana ? "on" : ""}">やる気むげん</button>
        ${[0, 1, 2].map((n) => `<button data-star="${n}" class="${this.trainStars === n ? "on" : ""}">${n ? "★".repeat(n) : "★なし"}</button>`).join("")}
      </div>
      <div class="detail">${pick ? spellCard(pick) : toyCard(main)}</div>
      <h3>おもちゃ（電池式は電池の枠へ）</h3><div class="trainRow">${toyIcons}</div>
      <h3>${main.name}</h3>${slots(w.cur, main)}
      ${batt ? `<h3>${batt.name}（電池式）<button class="noBatt">外す</button></h3>${slots(w.toys.length, batt)}` : ""}
      <h3>技・修飾</h3><div class="palette"><div class="zgroups">${palette}</div></div>
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
    el.innerHTML = `<div class="panel shopPanel bench"><div class="shead"><h2>秘密の隠し場所</h2><button class="close">閉じる</button></div>${this.fusionHtml(w)}</div>`;
    this.bindFusion(el, w);
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => { w.closeShop(); this.fusePick = []; this.lastKey = ""; };
  }

  private renderResult(w: World) {
    const el = this.el("result");
    el.hidden = !(w.phase === "dead" || w.phase === "win");
    if (el.hidden) return;
    el.innerHTML = `<div class="panel"><h2>${w.phase === "win" ? "ママにつかまった！" : "虫にやられた…"}</h2>${w.opts.endless ? this.endlessResult(w) : ""}${w.phase === "win" ? this.favHtml(w) : ""}
      ${w.phase === "win" ? mama("pet", "つかまえた〜♪<br>病院でワクチン打とうね。<br>1年間ありがとう！") : mama("scream", "いやぁぁぁ！<br>虫がーっ！")}
      <p class="muted">${w.phase === "win" ? "秋から夏まで、ぜんぶの虫を追い払った。さいごは病院へ…（おしまい）" : `${w.title} で力尽きた。`}</p>
      <p class="nibline">にぼし <b>+${this.earned}</b>（${DIFFS[w.opts.difficulty].name}・片付けた部屋 ${w.cleared}・倒した虫 ${w.kills}${w.curses.length ? `・呪い ${w.curses.length}` : ""}）　タイトルの「ねこの成長」で使える</p>
      ${this.opened.length ? `<div class="opened"><b>新しく解放！</b>（次の冒険から出てくる）<div class="zcells">${this.opened.map((u) => u.kind === "spell" ? cell(u.id, "tabindex=-1") : itemCell(u.kind, u.id, "tabindex=-1")).join("")}</div>
        <small>${this.opened.map((u) => (u.kind === "spell" ? SPELLS[u.id].name : u.kind === "toy" ? TOYS[u.id].name : RELICS[u.id].name)).join("・")}</small></div>` : ""}
      <div class="menu"><button class="go again">もう一度</button><button class="toTitle">タイトルへ</button></div></div>`;
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
      if (!name) { this.sent = { error: "その名前は使えません（12文字まで・連絡先や長い数字はだめ）" }; this.lastKey = ""; return; }
      saveName(name); nameEndless(this.endedAt, name); this.sent = "sending"; this.lastKey = "";
      void submitScore({ name, score: w.score, rooms: w.cleared, bosses: w.bosses, elites: w.elites, kills: w.kills }).then((r) => { this.sent = r; this.lastKey = ""; });
    };
  }
}
