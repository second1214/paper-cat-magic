// HTML の HUD と各画面（はじめに・ごほうび選び・おもちゃの編集・結果）。
// Magicraft の説明欄のように、アイテムは「絵・名前・種類・数値・説明」をいつも同じ形で見せる。
import { ELEMENT_INFO, KIND_LABEL, MOTION_LABEL, SPELLS, spellStats } from "../core/spells";
import { groupSummary, TOYS, toyStats, type ToyDef } from "../core/wand";
import { loadRecord, recordRun, recordText } from "./record";
import { REWARD_INFO, type Choice, type World } from "../game/world";
import { elementCanvas, rewardCanvas, spellCanvas, toyCanvas, urlOf } from "../art/items";

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
const ZUKAN: { title: string; ids: string[]; toy?: boolean }[] = [
  { title: "飛ぶ技", ids: ["claw", "bite", "hairball", "hiss", "yarn", "laser"] },
  { title: "近く・置く技", ids: ["swing", "pounce", "punch", "post"] },
  { title: "召喚", ids: ["friend", "roomba"] },
  { title: "修飾", ids: ["matatabi", "kajikaji", "big", "small", "quick", "stare", "bouncy", "pushy", "double", "chain"] },
  { title: "属性", ids: ["static", "water", "tape", "spray"] },
  { title: "おもちゃ", ids: Object.keys(TOYS), toy: true },
];

/** タイトルまわりの画面。null ならゲーム中。 */
type Screen = "title" | "howto" | "zukan" | null;

export class Hud {
  private el = (id: string) => document.getElementById(id)!;
  bagOpen = false;
  /** 一時停止メニューを開いている。 */
  paused = false;
  private screen: Screen = "title";
  private zukanSel = "claw";
  private recorded = new WeakSet<World>();
  private sel: { where: "slot" | "bag"; i: number } | null = null;
  private lastKey = "";

  constructor(private world: () => World, private onRestart: () => void, private onTitle: () => void) {
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
    this.bagOpen = !this.bagOpen; this.sel = null; this.lastKey = "";
  }

  update() {
    const w = this.world(), p = w.player, toy = w.toy;
    this.el("hearts").innerHTML = Array.from({ length: p.maxHp / 2 }, (_, i) => {
      const v = p.hp - i * 2;
      return `<span class="heart ${v >= 2 ? "full" : v === 1 ? "half" : ""}">♥</span>`;
    }).join("");
    this.el("manaFill").style.width = `${(p.mana / toy.manaMax) * 100}%`;
    this.el("manaNum").textContent = `${Math.floor(p.mana)}/${toy.manaMax}`;
    this.el("room").textContent = w.title;
    const toast = this.el("toast");
    toast.hidden = !w.toast; if (w.toast) toast.textContent = w.toast.text;

    // 記録（やられた・守りきったときに一度だけ）
    if ((w.phase === "dead" || w.phase === "win") && !this.recorded.has(w)) { this.recorded.add(w); recordRun(w.room.act, w.room.index, w.phase === "win"); }
    const key = JSON.stringify([toy, w.bag, p.cursor, p.recharging, this.bagOpen, this.paused, this.screen, this.zukanSel, this.sel, w.phase, w.choices, w.doorOpen, w.room.act, w.room.index]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    // 上の帯: おもちゃのスロット（まとまりの下線と合計攻撃力、次に出るまとまりを光らせる）
    this.el("slots").innerHTML = `<img class="toyIcon" src="${urlOf(toyCanvas(toy.id))}" alt="${toy.name}">`
      + slotRow(toy, (i) => cell(toy.slots[i], "tabindex=-1"), p.recharging ? -1 : p.cursor)
      + (p.recharging ? `<span class="rest">休けい中</span>` : "");

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
    if (this.screen === "zukan") {
      el.innerHTML = `<div class="panel zukan">${this.zukanHtml()}</div>`;
      el.querySelectorAll<HTMLButtonElement>("[data-z]").forEach((b) => b.onclick = () => { this.zukanSel = b.dataset.z!; this.lastKey = ""; });
      el.querySelector<HTMLButtonElement>(".back")!.onclick = go("title");
      return;
    }
    const base = import.meta.env.BASE_URL, rec = loadRecord();
    el.innerHTML = `<div class="title">
      <div class="logo"><small>ママを虫から守れ！</small>ねこのおもちゃ大作戦</div>
      <div class="hero"><img class="cat" src="${base}cat/P03_sit_happy.png" alt="猫"><img class="mom" src="${base}mama/scared.png" alt="ママ"></div>
      <div class="menu">
        <button class="go start">はじめる</button>
        <button class="howtoBtn">あそびかた</button>
        <button class="zukanBtn">ずかん</button>
      </div>
      <div class="record">${recordText(rec)}</div>
    </div>`;
    el.querySelector<HTMLButtonElement>(".start")!.onclick = () => { this.screen = null; w.start(); };
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
    const detail = TOYS[sel] ? toyCard(TOYS[sel]) : spellCard(sel);
    const groups = ZUKAN.map((g) => `<div class="zgroup"><div class="ztitle">${g.title}</div><div class="zcells">${g.ids.map((id) => g.toy
      ? `<button class="cell toy ${id === sel ? "sel" : ""}" data-z="${id}"><img src="${urlOf(toyCanvas(id))}" alt="${TOYS[id].name}"></button>`
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
    const toy = w.toy, sel = this.sel;
    const isSel = (where: string, i: number) => sel?.where === where && sel.i === i;
    const BAG = Math.max(16, Math.ceil((w.bag.length + 1) / 8) * 8);
    const selId = sel ? (sel.where === "slot" ? toy.slots[sel.i] : w.bag[sel.i]) ?? null : null;
    el.innerHTML = `<div class="panel edit">
      <div class="detail">${selId ? spellCard(selId) : toyCard(toy)}</div>
      <div class="board">
        <div class="boardHead"><b>${toy.name}</b><span class="muted">選んでから、置きたい場所をタップ（入れ替え）</span></div>
        ${slotRow(toy, (i) => cell(toy.slots[i], `data-where="slot" data-i="${i}"`, isSel("slot", i) ? "sel" : ""))}
        <div class="bagTitle">手持ち</div>
        <div class="baggrid">${Array.from({ length: BAG }, (_, i) => cell(w.bag[i] ?? null, `data-where="bag" data-i="${i}"`, isSel("bag", i) ? "sel" : "")).join("")}</div>
        <button class="close">閉じる</button>
      </div></div>`;
    el.querySelectorAll<HTMLButtonElement>("[data-where]").forEach((b) => b.onclick = () => {
      const here = { where: b.dataset.where as "slot" | "bag", i: Number(b.dataset.i) };
      const hasItem = (here.where === "slot" ? toy.slots[here.i] : w.bag[here.i]) ?? null;
      if (!this.sel) { if (hasItem) this.sel = here; }
      else if (this.sel.where === here.where && this.sel.i === here.i) this.sel = null;
      else { w.move(this.sel, here); this.sel = null; }
      this.lastKey = "";
    });
    el.querySelector<HTMLButtonElement>(".close")!.onclick = () => this.toggleBag();
  }

  private renderReward(w: World) {
    const el = this.el("reward");
    el.hidden = w.phase !== "reward";
    if (el.hidden) return;
    const boss = w.room.kind === "boss";
    const title = boss ? "スズメバチを追い払った！" : `${w.title.split("・")[1].replace(/ \d.*$/, "")}を片付けた！`;
    const card = (c: Choice, i: number) => c.kind === "toy"
      ? toyCard(TOYS[c.id], `data-i="${i}" role="button" tabindex="0"`)
      : spellCard(c.id, `data-i="${i}" role="button" tabindex="0"`);
    el.innerHTML = `<div class="panel reward">
      <div class="rhead">${mama("relief", boss ? "すごい！ありがとう！" : "ふぅ…ありがとう。", true)}<div><h2>${title}</h2>
        <p class="muted">${w.choices[0]?.kind === "toy" ? "おもちゃを持ち替える？（スロットの技はそのまま移ります）" : "1つ選んで手持ちに加えよう（「おもちゃ」でスロットにはめる）"}</p></div></div>
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
      <div class="menu"><button class="go again">もう一度</button><button class="toTitle">タイトルへ</button></div></div>`;
    el.querySelector<HTMLButtonElement>(".again")!.onclick = () => this.onRestart();
    el.querySelector<HTMLButtonElement>(".toTitle")!.onclick = () => this.toTitle();
  }
}
