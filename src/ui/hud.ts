// HTML の HUD・おもちゃの編集・報酬選択・はじめに・結果画面。
import { KIND_LABEL, SPELLS } from "../core/spells";
import { castGroups, TOYS, type ToyDef } from "../core/wand";
import { ROOM_COUNT, type Reward, type World } from "../game/world";

export const isTouch = () => matchMedia("(pointer: coarse)").matches;

const isMod = (id: string) => SPELLS[id].kind !== "attack";

/** ママの場面絵とセリフ。 */
const mama = (img: "scared" | "relief" | "pet" | "scream", line: string) =>
  `<div class="mama"><img src="${import.meta.env.BASE_URL}mama/${img}.png" alt="ママ"><div class="say">${line}</div></div>`;

/** 1つのアイテム（技／修飾）のアイコン。修飾には右向きの矢印を付ける。 */
const icon = (id: string | null, extra = "") => {
  if (!id) return `<div class="spell empty ${extra}"></div>`;
  const s = SPELLS[id], mod = isMod(id);
  return `<div class="spell ${mod ? "mod" : "atk"} ${extra}" style="--c:${s.color}" title="${s.name}：${s.desc}">
    <span class="badge">${KIND_LABEL[s.kind]}</span><span class="g">${s.glyph}</span>${mod ? '<span class="arrow">▶</span>' : ""}</div>`;
};

/** スロット列を「一緒に出るまとまり」ごとに括って描く。cell(i) が各スロットの中身。 */
function groupedSlots(toy: ToyDef, cell: (i: number) => string, activeStart = -1) {
  const groups = castGroups(toy), used = new Set<number>();
  const parts: string[] = [];
  let i = 0;
  while (i < toy.slots.length) {
    const g = groups.find(([a]) => a === i);
    if (g && g[1] - g[0] > 0) {
      const [a, b] = g;
      for (let k = a; k < b; k++) used.add(k);
      // 先頭・末尾の空きは括りの外に出す
      let s = a, e = b;
      while (s < e && !toy.slots[s]) parts.push(cell(s++));
      const tail: string[] = []; while (e > s && !toy.slots[e - 1]) tail.unshift(cell(--e));
      const inner = Array.from({ length: e - s }, (_, k) => cell(s + k)).join("");
      if (e > s) parts.push(`<div class="group ${a === activeStart ? "next" : ""}">${inner}</div>`);
      parts.push(...tail);
      i = b;
    } else { parts.push(cell(i)); i++; }
  }
  return parts.join("");
}

export class Hud {
  private hearts = document.getElementById("hearts")!;
  private mana = document.getElementById("manaFill")!;
  private slots = document.getElementById("slots")!;
  private roomLabel = document.getElementById("room")!;
  private bag = document.getElementById("bag")!;
  private reward = document.getElementById("reward")!;
  private result = document.getElementById("result")!;
  private intro = document.getElementById("intro")!;
  private hint = document.getElementById("hint")!;
  bagOpen = false;
  private selSlot: number | null = null;
  private lastKey = "";

  constructor(private world: () => World, private onRestart: () => void) {
    document.getElementById("bagBtn")!.addEventListener("click", () => this.toggleBag());
    document.body.classList.toggle("touch", isTouch());
  }

  toggleBag() {
    if (this.world().phase !== "play") return;
    this.bagOpen = !this.bagOpen; this.selSlot = null; this.lastKey = "";
  }

  update() {
    const w = this.world(), p = w.player, toy = w.toy;
    this.hearts.innerHTML = Array.from({ length: p.maxHp / 2 }, (_, i) => {
      const v = p.hp - i * 2;
      return `<span class="heart ${v >= 2 ? "full" : v === 1 ? "half" : ""}">♥</span>`;
    }).join("");
    this.mana.style.width = `${(p.mana / toy.manaMax) * 100}%`;
    this.roomLabel.textContent = w.room.kind === "boss" ? `${w.room.name}（ボス）` : `${w.room.name}  ${w.room.index + 1} / ${ROOM_COUNT - 1}`;
    this.hint.hidden = !(w.doorOpen && w.phase === "play");

    const key = JSON.stringify([toy.id, toy.slots, w.bag, p.cursor, p.recharging, this.bagOpen, this.selSlot, w.phase, w.rewards]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    // 下のスロット列: まとまりごとに括り、次に出るまとまりを光らせる
    this.slots.innerHTML = `<div class="toyName">${toy.name}${p.recharging ? "<small>（休けい中）</small>" : ""}</div>`
      + groupedSlots(toy, (i) => icon(toy.slots[i]), p.recharging ? -1 : p.cursor);

    this.renderIntro(w);
    this.renderBag(w);
    this.renderReward(w);
    this.renderResult(w);
  }

  private renderIntro(w: World) {
    this.intro.hidden = w.phase !== "intro";
    if (w.phase !== "intro") return;
    const touch = isTouch();
    this.intro.innerHTML = `<div class="panel">
      <h2>ママを虫から守れ！</h2>
      ${mama("scared", "きゃー！虫！<br>ねこちゃん、たすけてー！")}
      <p>ママは虫が大の苦手。おうちに入りこんだ虫を、おもちゃで追い払おう。</p>
      <div class="howto">
        <div><b>移動</b>${touch ? "画面の左半分をドラッグ" : "WASD / 矢印キー"}</div>
        <div><b>攻撃</b>${touch ? "右下の<span class='k'>攻撃</span>を押しっぱなし（近くの虫を自動で狙う）" : "クリック長押し（マウスの方向）／ J キー（近くの虫を自動で狙う）"}</div>
        <div><b>よける</b>${touch ? "<span class='k'>ダッシュ</span>（一瞬むてき）" : "Space（一瞬むてき）"}</div>
      </div>
      <h3>おもちゃのしくみ</h3>
      <p class="small">猫がおもちゃを振ると、おもちゃの先が虫へ飛んでいき、当たった所で<b>技</b>（爪・かみつき など）が決まる。<br>
      おもちゃのスロットは<b>左から順に</b>使われる。</p>
      <div class="legend">
        ${icon("claw")}<span><b>技</b>：攻撃そのもの</span>
        ${icon("matatabi")}<span><b>修飾</b>：▶の向き＝<b>右隣の技</b>を強くする</span>
      </div>
      <div class="small example">例：<div class="group">${icon("matatabi")}${icon("bite")}</div><span>＝「またたびで強くなったかみつき」<br>一緒に出るものは枠で囲んで表示</span></div>
      <button class="go">はじめる</button></div>`;
    this.intro.querySelector<HTMLButtonElement>(".go")!.onclick = () => w.start();
  }

  private renderBag(w: World) {
    this.bag.hidden = !this.bagOpen;
    if (!this.bagOpen) return;
    const toy = w.toy, sel = this.selSlot;
    const cell = (i: number) => {
      const id = toy.slots[i];
      return `<button class="pick ${sel === i ? "sel" : ""}" data-slot="${i}">${icon(id)}<small>${id ? SPELLS[id].name : "空き"}</small></button>`;
    };
    const selId = sel !== null ? toy.slots[sel] : null;
    this.bag.innerHTML = `<div class="panel">
      <h2>${toy.name}</h2>
      <p class="muted">${toy.desc}</p>
      <div class="legend small">${icon("claw")}<span>技＝攻撃</span>${icon("matatabi")}<span>修飾＝▶の向き（右隣の技）にかかる</span></div>
      <div class="row slotsEdit">${groupedSlots(toy, cell)}</div>
      <p class="muted">スロットを選んでから、手持ちを選ぶと入れ替わります。左右の矢印で並べ替え。</p>
      ${sel !== null ? `<div class="row"><button class="mv" data-d="-1">◀ 左へ</button><button class="mv" data-d="1">右へ ▶</button><button data-bag="-1">外す</button></div>` : ""}
      <h3>手持ち</h3>
      <div class="row">${w.bag.length ? w.bag.map((id, i) => `<button class="pick" data-bag="${i}">${icon(id)}<small>${SPELLS[id].name}</small></button>`).join("") : '<span class="muted">なし</span>'}</div>
      <div class="desc">${selId ? `<b>${SPELLS[selId].name}</b>（${KIND_LABEL[SPELLS[selId].kind]}）：${SPELLS[selId].desc}` : ""}</div>
      <button class="close">閉じる</button></div>`;
    this.bag.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach((b) => b.onclick = () => { this.selSlot = Number(b.dataset.slot); this.lastKey = ""; });
    this.bag.querySelectorAll<HTMLButtonElement>("[data-bag]").forEach((b) => b.onclick = () => {
      if (this.selSlot === null) return;
      const bi = Number(b.dataset.bag);
      w.swap(this.selSlot, bi < 0 ? null : bi); this.lastKey = "";
    });
    this.bag.querySelectorAll<HTMLButtonElement>(".mv").forEach((b) => b.onclick = () => {
      if (this.selSlot === null) return;
      const to = this.selSlot + Number(b.dataset.d);
      if (to < 0 || to >= toy.slots.length) return;
      w.swapSlots(this.selSlot, to); this.selSlot = to; this.lastKey = "";
    });
    this.bag.querySelector<HTMLButtonElement>(".close")!.onclick = () => this.toggleBag();
  }

  private renderReward(w: World) {
    this.reward.hidden = w.phase !== "reward";
    if (w.phase !== "reward") return;
    const card = (r: Reward, i: number) => {
      if (r.kind === "toy") {
        const t = TOYS[r.id];
        return `<button class="card toy" data-i="${i}"><div class="spell toyIcon">🧸</div><b>${t.name}</b><small class="tag">おもちゃ（持ち替え）</small><small>${t.desc}</small></button>`;
      }
      const s = SPELLS[r.id];
      return `<button class="card" data-i="${i}">${icon(r.id, "big")}<b>${s.name}</b><small class="tag">${KIND_LABEL[s.kind]}${isMod(r.id) ? "（右隣の技にかかる）" : ""}</small><small>${s.desc}</small></button>`;
    };
    this.reward.innerHTML = `<div class="panel"><h2>${w.room.name}の虫を追い払った！</h2>${mama("relief", "ふぅ…ありがとう。<br>次の部屋もお願いね")}<p class="muted">1つ選んで手持ちに加えよう（「おもちゃ」ボタンでスロットにはめられます）</p>
      <div class="row">${w.rewards.map(card).join("")}</div>
      <button class="skip">いらない</button></div>`;
    this.reward.querySelectorAll<HTMLButtonElement>("[data-i]").forEach((b) => b.onclick = () => w.takeReward(w.rewards[Number(b.dataset.i)]));
    this.reward.querySelector<HTMLButtonElement>(".skip")!.onclick = () => w.takeReward(null);
  }

  private renderResult(w: World) {
    this.result.hidden = !(w.phase === "dead" || w.phase === "win");
    if (this.result.hidden) return;
    this.result.innerHTML = `<div class="panel"><h2>${w.phase === "win" ? "スズメバチを追い払った！" : "虫にやられた…"}</h2>
      ${w.phase === "win" ? mama("pet", "よくやったね、<br>えらいえらい！") : mama("scream", "いやぁぁぁ！<br>虫がーっ！")}
      <p class="muted">${w.phase === "win" ? "おうちに平和が戻った。ママもひと安心。" : `${w.room.name}で力尽きた。ママが悲鳴を上げている…`}</p>
      <button class="again">もう一度</button></div>`;
    this.result.querySelector<HTMLButtonElement>(".again")!.onclick = () => this.onRestart();
  }
}
