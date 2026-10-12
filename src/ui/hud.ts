// HTML の HUD と各画面（はじめに・ごほうび選び・おもちゃの編集・結果）。
// Magicraft の説明欄のように、アイテムは「絵・名前・種類・数値・説明」をいつも同じ形で見せる。
import { KIND_LABEL, SPELLS, spellStats } from "../core/spells";
import { groupSummary, TOYS, toyStats, type ToyDef } from "../core/wand";
import { REWARD_INFO, type Choice, type World } from "../game/world";
import { rewardCanvas, spellCanvas, toyCanvas, urlOf } from "../art/items";

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
    <img src="${spellImg(id)}" alt=""><span class="badge">${KIND_LABEL[s.kind]}</span>${mod ? '<span class="arrow">▶</span>' : ""}</button>`;
};

const statsTable = (rows: [string, string][]) =>
  `<table class="stats">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;

/** アイテムの説明カード（Magicraft の魔法説明のような形）。 */
function spellCard(id: string, attrs = "") {
  const s = SPELLS[id], mod = isMod(id);
  return `<div class="card" ${attrs}>
    <div class="head"><img src="${spellImg(id)}" alt=""><div><b>${s.name}</b><span class="tag ${mod ? "mod" : "atk"}">${mod ? "修飾 ▶右の技にかかる" : "技（飛んでいく）"}</span></div></div>
    ${statsTable(spellStats(s))}<p class="desc">${s.desc}</p></div>`;
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

export class Hud {
  private el = (id: string) => document.getElementById(id)!;
  bagOpen = false;
  private sel: { where: "slot" | "bag"; i: number } | null = null;
  private lastKey = "";

  constructor(private world: () => World, private onRestart: () => void) {
    this.el("bagBtn").addEventListener("click", () => this.toggleBag());
    document.body.classList.toggle("touch", isTouch());
  }

  toggleBag() {
    if (this.world().phase !== "play") return;
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

    const key = JSON.stringify([toy, w.bag, p.cursor, p.recharging, this.bagOpen, this.sel, w.phase, w.choices, w.doorOpen, w.room.act, w.room.index]);
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

    this.renderIntro(w);
    this.renderBag(w);
    this.renderReward(w);
    this.renderResult(w);
  }

  private renderIntro(w: World) {
    const el = this.el("intro");
    el.hidden = w.phase !== "intro";
    if (el.hidden) return;
    const touch = isTouch();
    el.innerHTML = `<div class="panel intro">
      <div class="cols">
        <div>${mama("scared", "きゃー！虫！<br>ねこちゃん、たすけてー！")}
          <div class="howto">
            <div><b>移動</b>${touch ? "画面をドラッグ" : "WASD / 矢印キー"}</div>
            <div><b>攻撃</b>${touch ? "<span class='k'>攻撃</span>を押しっぱなし（近くの虫を自動で狙う）" : "クリック長押し（マウスの方向）／ J（自動で狙う）"}</div>
            <div><b>よける</b>${touch ? "<span class='k'>ダッシュ</span>" : "Space"}（一瞬むてき）</div>
          </div></div>
        <div class="rules">
          <h3>おもちゃのしくみ</h3>
          <p>おもちゃを振ると、スロットに入れた<b>技（爪・牙など）が飛んでいく</b>。スロットは<b>左から順に</b>使われる。</p>
          <div class="example">${cell("matatabi")}${cell("bite")}<span>修飾の ▶ は<b>右隣の技</b>にかかる<br>＝「またたびで強くなったかみつき」</span></div>
          <p>スロットの下の線が「1回で一緒に出る範囲」。⚔は攻撃力の合計、⚡は使うやる気。</p>
          <p>部屋を片付けると扉が開く。扉の上の絵が<b>次の部屋のごほうび</b>（♥最大HP／⚡やる気／★技／おもちゃ）。</p>
        </div>
      </div>
      <button class="go">はじめる</button></div>`;
    el.querySelector<HTMLButtonElement>(".go")!.onclick = () => w.start();
  }

  private renderBag(w: World) {
    const el = this.el("bag");
    el.hidden = !this.bagOpen;
    if (el.hidden) return;
    const toy = w.toy, sel = this.sel;
    const isSel = (where: string, i: number) => sel?.where === where && sel.i === i;
    const BAG = Math.max(12, w.bag.length + 2);
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
      <p class="muted">${w.phase === "win" ? "春夏秋冬、ぜんぶの虫を追い払った。" : `${w.title} で力尽きた。`}</p>
      <button class="again">もう一度</button></div>`;
    el.querySelector<HTMLButtonElement>(".again")!.onclick = () => this.onRestart();
  }
}
