// HTML の HUD・杖の編集・報酬選択・結果画面。
import { SPELLS } from "../core/spells";
import { ROOM_COUNT, type World } from "../game/world";

const icon = (id: string | null, extra = "") => {
  if (!id) return `<div class="spell empty ${extra}"></div>`;
  const s = SPELLS[id];
  return `<div class="spell ${extra}" style="--c:${s.color}" title="${s.name}：${s.desc}（マナ${s.mana}）"><span>${s.glyph}</span></div>`;
};

export class Hud {
  private hearts = document.getElementById("hearts")!;
  private mana = document.getElementById("manaFill")!;
  private slots = document.getElementById("slots")!;
  private roomLabel = document.getElementById("room")!;
  private bag = document.getElementById("bag")!;
  private reward = document.getElementById("reward")!;
  private result = document.getElementById("result")!;
  private hint = document.getElementById("hint")!;
  bagOpen = false;
  private selSlot: number | null = null;
  private lastKey = "";

  constructor(private world: () => World, private onRestart: () => void) {
    document.getElementById("bagBtn")!.addEventListener("click", () => this.toggleBag());
  }

  toggleBag() {
    if (this.world().phase !== "play") return;
    this.bagOpen = !this.bagOpen; this.selSlot = null; this.lastKey = "";
  }

  update() {
    const w = this.world(), p = w.player;
    this.hearts.innerHTML = Array.from({ length: p.maxHp / 2 }, (_, i) => {
      const v = p.hp - i * 2;
      return `<span class="heart ${v >= 2 ? "full" : v === 1 ? "half" : ""}">♥</span>`;
    }).join("");
    this.mana.style.width = `${(p.mana / w.wand.manaMax) * 100}%`;
    this.roomLabel.textContent = w.room.kind === "boss" ? "ボス" : `部屋 ${w.room.index + 1} / ${ROOM_COUNT - 1}`;
    this.hint.hidden = !(w.doorOpen && w.phase === "play");

    const key = JSON.stringify([w.wand.slots, w.bag, p.cursor, p.recharging, this.bagOpen, this.selSlot, w.phase, w.rewardChoices]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.slots.innerHTML = w.wand.slots.map((id, i) => icon(id, i === p.cursor && !p.recharging ? "cursor" : "")).join("")
      + `<div class="wandName">${w.wand.name}${p.recharging ? "（装填中）" : ""}</div>`;

    // 杖の編集
    this.bag.hidden = !this.bagOpen;
    if (this.bagOpen) {
      this.bag.innerHTML = `<div class="panel">
        <h2>杖を編集</h2>
        <p class="muted">スロットを選んでから、手持ちの魔法を選ぶと入れ替わります。左のスロットから順に発射されます。</p>
        <div class="row">${w.wand.slots.map((id, i) => `<button class="pick ${this.selSlot === i ? "sel" : ""}" data-slot="${i}">${icon(id)}<small>${id ? SPELLS[id].name : "空き"}</small></button>`).join("")}</div>
        <h3>手持ち</h3>
        <div class="row">${w.bag.length ? w.bag.map((id, i) => `<button class="pick" data-bag="${i}">${icon(id)}<small>${SPELLS[id].name}</small></button>`).join("") : '<span class="muted">なし</span>'}
          ${this.selSlot !== null ? `<button class="pick" data-bag="-1"><div class="spell empty"></div><small>外す</small></button>` : ""}</div>
        <div class="desc">${this.selSlot !== null && w.wand.slots[this.selSlot] ? `${SPELLS[w.wand.slots[this.selSlot]!].name}：${SPELLS[w.wand.slots[this.selSlot]!].desc}` : ""}</div>
        <button class="close">閉じる（Tab）</button></div>`;
      this.bag.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach((b) => b.onclick = () => { this.selSlot = Number(b.dataset.slot); this.lastKey = ""; });
      this.bag.querySelectorAll<HTMLButtonElement>("[data-bag]").forEach((b) => b.onclick = () => {
        if (this.selSlot === null) return;
        const bi = Number(b.dataset.bag);
        w.swap(this.selSlot, bi < 0 ? null : bi); this.lastKey = "";
      });
      this.bag.querySelector<HTMLButtonElement>(".close")!.onclick = () => this.toggleBag();
    }

    // 報酬
    this.reward.hidden = w.phase !== "reward";
    if (w.phase === "reward") {
      this.reward.innerHTML = `<div class="panel"><h2>部屋クリア！</h2><p class="muted">魔法を1つ選んで手持ちに加えよう（Tabで杖に入れられます）</p>
        <div class="row">${w.rewardChoices.map((id) => `<button class="card" data-id="${id}">${icon(id, "big")}<b>${SPELLS[id].name}</b><small>${SPELLS[id].desc}</small><small class="muted">マナ ${SPELLS[id].mana}</small></button>`).join("")}</div>
        <button class="skip">いらない</button></div>`;
      this.reward.querySelectorAll<HTMLButtonElement>("[data-id]").forEach((b) => b.onclick = () => w.takeReward(b.dataset.id!));
      this.reward.querySelector<HTMLButtonElement>(".skip")!.onclick = () => w.takeReward(null);
    }

    // 結果
    this.result.hidden = !(w.phase === "dead" || w.phase === "win");
    if (!this.result.hidden) {
      this.result.innerHTML = `<div class="panel"><h2>${w.phase === "win" ? "ゴーレムを倒した！" : "やられた…"}</h2>
        <p class="muted">${w.phase === "win" ? "1階クリア。続きは今後のお楽しみ。" : `部屋 ${w.room.index + 1} で力尽きた`}</p>
        <button class="again">もう一度</button></div>`;
      this.result.querySelector<HTMLButtonElement>(".again")!.onclick = () => this.onRestart();
    }
  }
}
