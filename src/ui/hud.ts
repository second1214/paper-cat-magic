// HTML の HUD と各画面（はじめに・ごほうび選び・おもちゃの編集・結果）。
// Magicraft の説明欄のように、アイテムは「絵・名前・種類・数値・説明」をいつも同じ形で見せる。
import { ELEMENT_INFO, KIND_LABEL, MOTION_LABEL, SPELLS, spellStats } from "../core/spells";
import { groupSummary, TOYS, toyStats, type ToyDef } from "../core/wand";
import { buyUpgrade, canPick, loadRecord, recordRun, recordText } from "./record";
import { DIFFS, runReward, UPGRADES } from "../core/meta";
import { enemyTexture } from "../render/stickers";
import { ENEMY, type EnemyType } from "../game/world";

const bugUrls = new Map<EnemyType, string>();
/** タイトル用の虫の絵（ゲーム中と同じステッカー）。 */
const bugUrl = (t: EnemyType) => {
  let u = bugUrls.get(t);
  if (!u) { u = (enemyTexture(t).image as HTMLCanvasElement).toDataURL(); bugUrls.set(t, u); }
  return u;
};
import { REWARD_INFO, type Choice, type World } from "../game/world";
import { elementCanvas, gearCanvas, relicCanvas, rewardCanvas, spellCanvas, toyCanvas, urlOf } from "../art/items";
import { bonusRows, GEAR, GEAR_FX, GEAR_IDS, GEAR_SLOTS, gearBonus, RARITY, RELIC_IDS, RELICS, SETS, setCounts, SLOT_NAME, type Gear, type GearItem } from "../core/items";

export const isTouch = () => matchMedia("(pointer: coarse)").matches;

const isMod = (id: string) => SPELLS[id].kind !== "attack";
const spellImg = (id: string) => urlOf(spellCanvas(id, SPELLS[id].projectile?.tech));

/** ママの場面絵とセリフ。 */
const mama = (img: "scared" | "relief" | "pet" | "scream", line: string, small = false) =>
  `<div class="mama ${small ? "small" : ""}"><img src="${import.meta.env.BASE_URL}mama/${img}.png" alt="ママ"><div class="say">${line}</div></div>`;

/** スロット・手持ちの1マス。修飾には「右にかかる」矢印。 */
const cell = (id: string | null, attrs = "", extra = "") => {
  if (!id) return `<button class="cell empty ${extra}" ${attrs}></button>`;
  const s = SPELLS[id], mod = isMod(id);
  return `<button class="cell ${mod ? "mod" : "atk"} ${extra}" style="--c:${s.color}" ${attrs}>
    <img src="${spellImg(id)}" alt=""><span class="badge">${s.modifier?.element ? "属性" : KIND_LABEL[s.kind]}</span>${mod ? '<span class="arrow">▶</span>' : ""}</button>`;
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

/** アイテムの説明カード（Magicraft の魔法説明のような形）。 */
function spellCard(id: string, attrs = "") {
  const s = SPELLS[id], mod = isMod(id);
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${spellImg(id)}" alt=""><div><b>${s.name}</b><span class="tag ${mod ? "mod" : "atk"}">${mod ? (s.modifier?.element ? "属性 ▶右の技につく" : "修飾 ▶右の技にかかる") : `技（${MOTION_LABEL[s.projectile!.motion]}）`}</span></div></div>
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
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${urlOf(toyCanvas(t.id))}" alt=""><div><b>${t.name}</b><span class="tag toy">おもちゃ（装備）</span></div></div>
    ${statsTable(toyStats(t))}<p class="desc">${t.desc}</p></div>`;
}

/** スロット列＋まとまりごとの下線（1回で一緒に出る範囲と、その合計攻撃力）。 */
function slotRow(toy: ToyDef, cellOf: (i: number) => string, next = -1) {
  const groups = groupSummary(toy);
  const lines = groups.map((g) => `<div class="gline ${g.start === next ? "next" : ""}" style="--s:${g.start};--n:${g.end - g.start}"><span>⚔${g.damage} ⚡${g.mana}</span></div>`).join("");
  return `<div class="slotrow" style="--count:${toy.slots.length}"><div class="cells">${toy.slots.map((_, i) => cellOf(i)).join("")}</div><div class="glines">${lines}</div></div>`;
}

/** ずかんの並び（Magicraft の図鑑のように種類ごとに見せる）。 */
const ZUKAN: { title: string; ids: string[]; kind?: "toy" | "relic" | "gear" }[] = [
  { title: "飛ぶ技", ids: ["claw", "bite", "hairball", "hiss", "yarn", "laser"] },
  { title: "近く・置く技", ids: ["swing", "pounce", "punch", "post"] },
  { title: "召喚", ids: ["friend", "roomba"] },
  { title: "買ってきた物の技", ids: ["mizudeppo", "ahiru", "shabon", "kabocha", "korokoro", "hammer", "flash", "danbo"] },
  { title: "修飾", ids: ["matatabi", "kajikaji", "big", "small", "quick", "stare", "bouncy", "pushy", "double", "chain"] },
  { title: "買ってきた物の修飾", ids: ["rame", "suzu", "kenko", "jidori"] },
  { title: "属性", ids: ["static", "water", "tape", "spray"] },
  { title: "おもちゃ", ids: Object.keys(TOYS), kind: "toy" },
  { title: "レリック", ids: RELIC_IDS, kind: "relic" },
  { title: "装備", ids: GEAR_IDS, kind: "gear" },
];

/** タイトルまわりの画面。null ならゲーム中。 */
type Screen = "title" | "howto" | "zukan" | "diff" | "grow" | null;

export class Hud {
  private el = (id: string) => document.getElementById(id)!;
  bagOpen = false;
  /** 一時停止メニューを開いている。 */
  paused = false;
  private screen: Screen = "title";
  private zukanSel = "claw";
  private recorded = new WeakSet<World>();
  /** 今回の冒険でもらったにぼし。 */
  private earned = 0;
  private sel: { where: "slot" | "bag"; i: number } | null = null;
  /** 持ち物画面のタブ（おもちゃの番号、または装備・レリック）と、そこで選んでいるもの。 */
  private tab: number | "gear" = 0;
  private pick: string | null = null;
  private lastKey = "";

  constructor(private world: () => World, private onRestart: () => void, private onTitle: () => void, private onStart: (difficulty: number) => void) {
    this.el("bagBtn").addEventListener("click", () => this.toggleBag());
    this.el("pauseBtn").addEventListener("click", () => this.togglePause());
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
    this.el("room").textContent = w.title;
    const toast = this.el("toast");
    toast.hidden = !w.toast; if (w.toast) toast.textContent = w.toast.text;

    // 記録（やられた・守りきったときに一度だけ）
    if ((w.phase === "dead" || w.phase === "win") && !this.recorded.has(w)) { this.recorded.add(w); this.earned = runReward(w.cleared, w.bosses, w.phase === "win", w.opts.difficulty); recordRun(w.room.act, w.room.index, w.phase === "win", w.opts.difficulty, this.earned); }
    const key = JSON.stringify([w.toys.map((h) => h.def), w.cur, w.relics, w.gear, this.tab, this.pick, w.bag, p.cursor, p.recharging, this.bagOpen, this.paused, this.screen, this.zukanSel, this.sel, w.phase, w.choices, w.doorOpen, w.room.act, w.room.index]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    // 上の帯: おもちゃのスロット（まとまりの下線と合計攻撃力、次に出るまとまりを光らせる）
    // 持っているおもちゃ（タップで持ち替え）。今のものは大きく
    const others = w.toys.map((h, i) => i === w.cur ? "" : `<button class="toySw" data-toy="${i}" title="${h.def.name}"><img src="${urlOf(toyCanvas(h.def.id))}" alt=""><span>${i + 1}</span></button>`).join("");
    this.el("slots").innerHTML = (others ? `<div class="toySws">${others}</div>` : "") + `<img class="toyIcon" src="${urlOf(toyCanvas(toy.id))}" alt="${toy.name}">`
      + slotRow(toy, (i) => cell(toy.slots[i], "tabindex=-1"), p.recharging ? -1 : p.cursor)
      + (p.recharging ? `<span class="rest">休けい中</span>` : "");
    this.el("slots").querySelectorAll<HTMLButtonElement>("[data-toy]").forEach((b) => b.onclick = () => w.switchToy(Number(b.dataset.toy)));

    // 扉の選択肢
    const hint = this.el("hint");
    hint.hidden = !(w.doorOpen && w.phase === "play");
    if (!hint.hidden) hint.innerHTML = `<b>扉を選んで進もう</b>` + w.room.doors.map((d) =>
      `<span class="chip"><img src="${urlOf(rewardCanvas(d.reward))}" alt="">${REWARD_INFO[d.reward].label}</span>`).join("");

    document.body.classList.toggle("titling", w.phase === "intro");
    this.renderTitle(w);
    this.renderPause();
    this.renderBag(w);
    this.renderReward(w);
    this.renderResult(w);
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
      el.innerHTML = `<div class="panel diffPanel"><h2>難易度をえらぶ</h2><div class="diffs">${DIFFS.map((d, i) => {
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
        }).join("")}</div><button class="back">もどる</button></div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-u]").forEach((b) => b.onclick = () => { buyUpgrade(b.dataset.u as keyof typeof rec.meta); this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    if (this.screen === "zukan") {
      el.innerHTML = `<div class="panel zukan">${this.zukanHtml()}</div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-z]").forEach((b) => b.onclick = () => { this.zukanSel = b.dataset.z!; this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    const base = import.meta.env.BASE_URL, rec = loadRecord();
    el.innerHTML = `<div class="title">
      <div class="logo"><small>ママを虫から守れ！</small>My Cat Is <br>So Cute</div>
      <div class="hero"><img class="mom" src="${base}mama/scared.png" alt="ママ"><img class="cat" src="${base}cat/P03_sit_happy.png" alt="猫">
        <img class="bug b1" src="${bugUrl("roach")}" alt=""><img class="bug b2" src="${bugUrl("mosquito")}" alt=""></div>
      <div class="menu">
        <button class="go start">はじめる</button>
        <button class="growBtn">ねこの成長</button>
        <button class="howtoBtn">あそびかた</button>
        <button class="zukanBtn">ずかん</button>
      </div>
      <div class="record">${recordText(rec)}</div>
    </div>`;
    el.querySelector<HTMLButtonElement>(".start")!.onclick = go("diff");
    el.querySelector<HTMLButtonElement>(".growBtn")!.onclick = go("grow");
    el.querySelector<HTMLButtonElement>(".howtoBtn")!.onclick = go("howto");
    el.querySelector<HTMLButtonElement>(".zukanBtn")!.onclick = go("zukan");
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
          <div class="example">${cell("matatabi")}${cell("bite")}<span>修飾の ▶ は<b>右隣の技</b>にかかる<br>＝「またたびで強くなったかみつき」</span></div>
          <p>スロットの下の線が「1回で一緒に出る範囲」。⚔は攻撃力の合計、⚡は使うやる気。</p>
          <p><b>属性</b>（静電気・水のみ皿・ガムテープ・虫よけ）を技の左に置くと効果がつく。<b>ぬれた虫にビリビリ</b>、<b>ねばねばの虫に虫よけ</b>はよく効く。</p>
          <p>部屋を片付けると扉が開く。扉の上の絵が<b>次の部屋のごほうび</b>（♥最大HP／⚡やる気／★技／おもちゃ）。秋から始まり、夏が最後。</p>
        </div>
      </div>`;
  }

  /** ずかん: 左に選んだものの説明、右に種類ごとのアイコン一覧。 */
  private zukanHtml() {
    const sel = this.zukanSel;
    const detail = TOYS[sel] ? toyCard(TOYS[sel]) : RELICS[sel] ? relicCard(sel) : GEAR[sel] ? gearCard({ id: sel, rar: 0, fx: [] }, null) : spellCard(sel);
    const groups = ZUKAN.map((g) => `<div class="zgroup"><div class="ztitle">${g.title}</div><div class="zcells">${g.ids.map((id) => g.kind
      ? itemCell(g.kind, id, `data-z="${id}"`, id === sel ? "sel" : "")
      : cell(id, `data-z="${id}"`, id === sel ? "sel" : "")).join("")}</div></div>`).join("");
    return `<div class="edit"><div class="detail">${detail}</div><div class="board"><div class="boardHead"><b>ずかん</b><span class="muted">タップで説明を見る</span><button class="back">もどる</button></div><div class="zgroups">${groups}</div></div></div>`;
  }

  /** 一時停止メニュー。 */
  private renderPause() {
    const el = this.el("pause");
    el.hidden = !this.paused;
    if (el.hidden) return;
    el.innerHTML = `<div class="panel pausePanel"><h2>ひと休み</h2>
      <div class="menu"><button class="go resume">つづける</button><button class="toTitle">タイトルへ</button></div>
      <p class="muted">タイトルへ戻ると、今の冒険は終わります。</p></div>`;
    el.querySelector<HTMLButtonElement>(".resume")!.onclick = () => this.togglePause();
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
  }

  private renderBag(w: World) {
    const el = this.el("bag");
    el.hidden = !this.bagOpen;
    if (el.hidden) return;
    if (typeof this.tab === "number" && this.tab >= w.toys.length) this.tab = w.cur;
    const tabs = `<div class="tabs">${w.toys.map((h, i) => `<button class="tab ${this.tab === i ? "on" : ""}" data-tab="${i}"><img src="${urlOf(toyCanvas(h.def.id))}" alt="">${h.def.name}${i === w.cur ? "<small>使用中</small>" : ""}</button>`).join("")}
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
    const t = this.tab, slots = w.toys[t].def.slots;
    el.querySelectorAll<HTMLButtonElement>("[data-where]").forEach((b) => b.onclick = () => {
      const here = { where: b.dataset.where as "slot" | "bag", i: Number(b.dataset.i) };
      const hasItem = (here.where === "slot" ? slots[here.i] : w.bag[here.i]) ?? null;
      if (!this.sel) { if (hasItem) this.sel = here; }
      else if (this.sel.where === here.where && this.sel.i === here.i) this.sel = null;
      else { w.move(this.sel, here, t); this.sel = null; }
      this.lastKey = "";
    });
  }

  /** 持ち物: おもちゃのスロットと手持ち。 */
  private toyHtml(w: World, t: number) {
    const toy = w.toys[t].def, sel = this.sel;
    const isSel = (where: string, i: number) => sel?.where === where && sel.i === i;
    const BAG = Math.max(16, Math.ceil((w.bag.length + 1) / 8) * 8);
    const selId = sel ? (sel.where === "slot" ? toy.slots[sel.i] : w.bag[sel.i]) ?? null : null;
    return `<div class="edit">
      <div class="detail">${selId ? spellCard(selId) : toyCard(toy)}</div>
      <div class="board">
        <div class="boardHead"><span class="muted">選んでから、置きたい場所をタップ（入れ替え）。おもちゃどうしは手持ちを通して移す</span></div>
        ${slotRow(toy, (i) => cell(toy.slots[i], `data-where="slot" data-i="${i}"`, isSel("slot", i) ? "sel" : ""))}
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
        <div class="bagTitle">レリック（${w.relics.length}）</div>
        <div class="baggrid">${w.relics.length ? w.relics.map((r) => itemCell("relic", r, `data-pick="${r}"`, pick === r ? "sel" : "")).join("") : `<span class="muted">まだ持っていません（◆の扉・ボスでもらえる）</span>`}</div>
      </div></div>`;
  }

  private renderReward(w: World) {
    const el = this.el("reward");
    el.hidden = w.phase !== "reward";
    if (el.hidden) return;
    const boss = w.room.kind === "boss";
    const title = boss ? `${ENEMY[w.room.waves[0][0]].name}を追い払った！` : `${w.title.split("・")[1].replace(/ \d.*$/, "")}を片付けた！`;
    const card = (c: Choice, i: number) => {
      const a = `data-i="${i}" role="button" tabindex="0"`;
      return c.kind === "toy" ? toyCard(TOYS[c.id], a) : c.kind === "relic" ? relicCard(c.id, a) : c.kind === "gear" ? gearCard(c.gear ?? { id: c.id, rar: 0, fx: [] }, w.gear, a) : spellCard(c.id, a);
    };
    const kind = w.choices[0]?.kind;
    const note = kind === "toy" ? (w.toys.length < 3 ? `おもちゃを1つ増やす（今 ${w.toys.length}/3。持ち替えはスロットの横のアイコン）` : "持てるのは3つまで。今使っているおもちゃと交換（技はそのまま移る）")
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

  private renderResult(w: World) {
    const el = this.el("result");
    el.hidden = !(w.phase === "dead" || w.phase === "win");
    if (el.hidden) return;
    el.innerHTML = `<div class="panel"><h2>${w.phase === "win" ? "1年間、おうちを守りきった！" : "虫にやられた…"}</h2>
      ${w.phase === "win" ? mama("pet", "よくやったね、<br>えらいえらい！") : mama("scream", "いやぁぁぁ！<br>虫がーっ！")}
      <p class="muted">${w.phase === "win" ? "秋から夏まで、ぜんぶの虫を追い払った。" : `${w.title} で力尽きた。`}</p>
      <p class="nibline">にぼし <b>+${this.earned}</b>（${DIFFS[w.opts.difficulty].name}・片付けた部屋 ${w.cleared}）　タイトルの「ねこの成長」で使える</p>
      <div class="menu"><button class="go again">もう一度</button><button class="toTitle">タイトルへ</button></div></div>`;
    el.querySelector<HTMLButtonElement>(".again")!.onclick = () => this.onRestart();
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
  }
}
