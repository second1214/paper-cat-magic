// 技ごとの動き（飛ぶ・回る・ビーム・衝撃波・連打・設置）と属性の組み合わせが、実際に虫へ効くか。
import { describe, expect, it } from "vitest";
import { SPELLS } from "../src/core/spells";
import { cellCenter } from "../src/game/stage";
import { World, type Enemy } from "../src/game/world";

/** 敵のいない部屋に猫と、動かない虫を1匹置く。 */
function arena(slots: (string | null)[], foeAt: { dx: number; dz: number }) {
  const w = new World(5);
  w.start();
  w.room.waves = [[]]; w.enemies = []; w.projectiles = [];
  const L = w.room.layout;
  w.player.pos = cellCenter(L, L.entry.c + 3, L.entry.r);
  // 入口から右へ3マス先が床になる部屋を前提にせず、床を探して置く
  for (let r = 1; r < L.rows - 1; r++) for (let c = 2; c < L.cols - 8; c++) {
    if ([0, 1, 2, 3, 4, 5, 6].every((k) => L.grid[r * L.cols + c + k] === 0) && [-1, 1].every((dr) => [0, 1, 2, 3, 4, 5, 6].every((k) => L.grid[(r + dr) * L.cols + c + k] === 0))) {
      w.player.pos = cellCenter(L, c, r); r = L.rows; break;
    }
  }
  const foe: Enemy = {
    id: 999, type: "roach", pos: { x: w.player.pos.x + foeAt.dx, z: w.player.pos.z + foeAt.dz }, vel: { x: 0, z: 0 },
    hp: 1000, maxHp: 1000, radius: 0.4, speed: 0, slow: 0, hurt: 0, t: 0.9, phase: 0, spawn: 0,
    wet: 0, sticky: 0, repel: 0, repelDps: 0, repelTick: 0, push: { x: 0, z: 0 },
  };
  w.enemies = [foe];
  w.toy.slots = slots; w.player.cursor = 0; w.player.castCd = 0; w.player.mana = 999; w.toy.manaMax = 999;
  return { w, foe };
}

function run(w: World, sec: number, fire = true) {
  for (let t = 0; t < sec; t += 1 / 60) { w.player.hp = w.player.maxHp; w.update(1 / 60, { move: { x: 0, z: 0 }, aim: { x: 1, z: 0 }, fire, dash: false }); }
}

/** 1回だけ振って、虫が受けたダメージ。 */
function once(slots: (string | null)[], dx: number, sec = 1.5) {
  const { w, foe } = arena([...slots, null], { dx, dz: 0 });
  run(w, 1 / 60); run(w, sec, false);
  return { dmg: 1000 - foe.hp, w, foe };
}

describe("技の動き", () => {
  it("どの技も、届く位置の虫に当たる", () => {
    const where: Record<string, number> = { claw: 3, bite: 3, hairball: 3, hiss: 3, swing: 1.7, yarn: 3, laser: 4, pounce: 1.5, punch: 0.9, post: 1.3 };
    for (const [id, dx] of Object.entries(where)) {
      expect(SPELLS[id].kind).toBe("attack");
      expect(once([id], dx).dmg, id).toBeGreaterThan(0);
    }
  });
  it("連打・回る・毛糸は同じ虫に何回も当たる", () => {
    expect(once(["punch"], 0.9).dmg).toBeGreaterThanOrEqual(3 * 3);
    expect(once(["yarn"], 2).dmg).toBeGreaterThanOrEqual(4 * 2);
    expect(once(["swing"], 1.7).dmg).toBeGreaterThanOrEqual(6 * 2);
  });
  it("かじかじ（多段）で1発が何回も当たる", () => {
    const one = once(["bite"], 3).dmg, multi = once(["kajikaji", "bite"], 3).dmg;
    expect(multi).toBeGreaterThan(one * 1.8);
  });
  it("ねこジャンプは虫をはじき飛ばす", () => {
    const { w, foe } = arena(["pounce", null], { dx: 1.2, dz: 0 });
    const x0 = foe.pos.x; run(w, 1 / 60); run(w, 0.5, false);
    expect(foe.pos.x).toBeGreaterThan(x0 + 0.3);
  });
  it("爪とぎは4つまで", () => {
    const { w } = arena(["post"], { dx: 50, dz: 0 });
    for (let k = 0; k < 6; k++) { w.player.castCd = 0; run(w, 1 / 60); run(w, 0.6, false); }
    expect(w.projectiles.filter((p) => p.motion === "trap").length).toBe(4);
  });
});

describe("おうちのもの属性", () => {
  it("びしょぬれの虫にビリビリは2倍", () => {
    const dry = once(["static", "claw"], 3);
    const { w, foe } = arena(["static", "claw", null], { dx: 3, dz: 0 });
    foe.wet = 10; run(w, 1 / 60); run(w, 1, false);
    expect(1000 - foe.hp).toBeCloseTo(dry.dmg * 2, 0);
  });
  it("ビリビリは近くの虫へ飛び移る", () => {
    const { w, foe } = arena(["static", "claw", null], { dx: 3, dz: 0 });
    const other: Enemy = { ...foe, id: 1000, pos: { x: foe.pos.x + 1.5, z: foe.pos.z }, hp: 1000, push: { x: 0, z: 0 } };
    w.enemies.push(other);
    run(w, 1 / 60); run(w, 1, false);
    expect(other.hp).toBeLessThan(1000);
  });
  it("ねばねばで足止め、虫よけはじわじわ（ねばねばなら2倍）", () => {
    const { w, foe } = arena(["tape", "claw", null], { dx: 3, dz: 0 });
    run(w, 1 / 60); run(w, 0.4, false);
    expect(foe.sticky).toBeGreaterThan(0);
    const a = once(["spray", "claw"], 3, 3.2).dmg;
    const { w: w2, foe: f2 } = arena(["spray", "claw", null], { dx: 3, dz: 0 });
    f2.sticky = 99; run(w2, 1 / 60); run(w2, 3.2, false);
    expect(1000 - f2.hp).toBeGreaterThan(a * 1.4);
  });
  it("水で遅くなる", () => {
    const { w, foe } = arena(["water", "claw", null], { dx: 3, dz: 0 });
    run(w, 1 / 60); run(w, 0.4, false);
    expect(foe.wet).toBeGreaterThan(3);
  });
});

describe("召喚（Magicraft と同じ: 修飾は仲間の攻撃にかかる・召喚ごとの上限）", () => {
  it("友達猫は虫を追いかけてひっかく", () => {
    const { w, foe } = arena(["friend", null], { dx: 4, dz: 0 });
    run(w, 1 / 60); run(w, 4, false);
    expect(1000 - foe.hp).toBeGreaterThanOrEqual(4 * 3);
  });
  it("修飾・属性が友達猫の攻撃にかかる", () => {
    const { w, foe } = arena(["water", "matatabi", "friend", null], { dx: 2, dz: 0 });
    run(w, 1 / 60); run(w, 1.5, false);
    expect(foe.wet).toBeGreaterThan(0);
    const one = w.fx.find((f) => f.kind === "num");
    expect(one?.value).toBe(Math.round(4 * 1.5 + 3));
  });
  it("ルンバは部屋の中を走り回り、ぶつかった虫を吸いこむ", () => {
    const { w, foe } = arena(["roomba", null], { dx: 2.5, dz: 0 });
    run(w, 1 / 60); run(w, 6, false);
    expect(1000 - foe.hp).toBeGreaterThan(0);
    const L = w.room.layout, r = w.projectiles.find((p) => p.tech === "roomba")!;
    expect(Math.abs(r.pos.x) < L.cols / 2 && Math.abs(r.pos.z) < L.rows / 2).toBe(true);
  });
  it("上限を超えて呼ぶと、一番古い仲間が帰って入れ替わる", () => {
    const { w } = arena(["friend"], { dx: 40, dz: 0 });
    const ids: number[] = [];
    for (let k = 0; k < 4; k++) {
      w.player.castCd = 0; run(w, 1 / 60); run(w, 0.2, false);
      ids.push(w.projectiles.filter((p) => p.tech === "friend").at(-1)!.id);
    }
    const left = w.projectiles.filter((p) => p.tech === "friend").map((p) => p.id);
    expect(left).toEqual(ids.slice(-SPELLS.friend.limit!));
  });
});
