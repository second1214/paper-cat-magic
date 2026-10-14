// 技と修飾が想定どおりに動くか（着弾地点から出るか・発動のきっかけ・修飾のかかり方）。
import { describe, expect, it } from "vitest";
import { cellCenter } from "../src/game/stage";
import { World, type Enemy } from "../src/game/world";
import { SPELLS } from "../src/core/spells";
import { planCast, type ToyDef } from "../src/core/wand";

const dummy = (x: number, z: number, id: number, hp = 1000): Enemy => ({ id, type: "roach", pos: { x, z }, vel: { x: 0, z: 0 }, hp, maxHp: hp, radius: 0.4, speed: 0, slow: 0, hurt: 0, t: 0.9, phase: 0, spawn: 0, wet: 0, sticky: 0, repel: 0, repelDps: 0, repelTick: 0, push: { x: 0, z: 0 }, elite: null, atk: 0 });
/** 縦5マス×横11マスが床の所に猫を置く。 */
function arena() {
  const w = new World(5); w.start(); w.room.waves = [[]]; w.enemies = []; w.projectiles = [];
  const L = w.room.layout;
  for (let r = 3; r < L.rows - 3; r++) for (let c = 2; c < L.cols - 12; c++) if ([-2, -1, 0, 1, 2].every((dr) => Array.from({ length: 11 }, (_, k) => k).every((k) => L.grid[(r + dr) * L.cols + c + k] === 0))) { w.player.pos = cellCenter(L, c, r); r = L.rows; break; }
  w.player.mana = 9999; w.toy.manaMax = 9999; return w;
}
/** 技を1回だけ振って sec 秒すすめ、そのあいだに新しく出た技（tech）を、出た位置とともに集める。 */
function cast(w: World, slots: (string | null)[], sec: number) {
  w.toy.slots = [...slots, ...Array(Math.max(0, 8 - slots.length)).fill(null)];
  const born: { tech: string; at: { x: number; z: number }; id: number; t: number; payload: boolean; foes: Map<number, { x: number; z: number }> }[] = [], seen = new Set<number>();
  for (let t = 0; t < sec; t += 1 / 60) {
    w.player.hp = w.player.maxHp;
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: { x: 1, z: 0 }, fire: t === 0, dash: false });
    for (const q of w.projectiles) if (!seen.has(q.id)) {   // 出た瞬間の位置と、そのときの虫の位置（はじき飛ばされる前）
      seen.add(q.id);
      born.push({ tech: q.tech, at: { ...(q.anchor ?? q.origin) }, id: q.id, t, payload: !!q.anchor, foes: new Map(w.enemies.map((e) => [e.id, { ...e.pos }])) });
    }
  }
  return born;
}
const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("つづけて: 左の技の着弾地点から右の技が出る", () => {
  // 左の技（動きがそれぞれ違う）× 右の技 ねこジャンプ（その場で広がる輪）。輪の中心が、当たった虫の位置になる
  for (const [left, dx] of [["claw", 3], ["swing", 1.7], ["yarn", 3], ["laser", 4], ["pounce", 1.5], ["punch", 0.9], ["hammer", 1.0], ["post", 1.3], ["shabon", 2]] as const) {
    it(`${SPELLS[left].name} → つづけて → ねこジャンプ`, () => {
      const w = arena(), p = w.player.pos, A = dummy(p.x + dx, p.z, 1); w.enemies = [A];
      const born = cast(w, [left, "chain", "pounce"], 2);
      const ring = born.find((b) => b.tech === "pounce" && b.payload);
      expect(ring, "右の技が出ていない").toBeTruthy();
      expect(d(ring!.at, ring!.foes.get(1)!)).toBeLessThan(0.8);
      expect(d(ring!.at, p)).toBeGreaterThan(0.5);
    });
  }
  it("右が飛ぶ技なら、当たった虫を通りこして先の虫へ飛ぶ", () => {
    const w = arena(), p = w.player.pos, A = dummy(p.x + 3, p.z, 1), B = dummy(p.x + 6, p.z, 2); w.enemies = [A, B];
    cast(w, ["claw", "chain", "bite"], 1.5);
    expect(1000 - B.hp).toBeGreaterThanOrEqual(SPELLS.bite.projectile!.damage);
    expect(1000 - A.hp).toBe(SPELLS.claw.projectile!.damage);
  });
  it("右の置く技は、着弾地点にそのまま置く", () => {
    const w = arena(), p = w.player.pos, A = dummy(p.x + 3, p.z, 1); w.enemies = [A];
    const post = cast(w, ["claw", "chain", "post"], 0.6).find((b) => b.tech === "post")!;
    const trap = w.projectiles.find((q) => q.id === post.id)!;
    expect(d(trap.pos, A.pos)).toBeLessThan(0.6);
  });
  it("右の技が2つ（二刀流）なら、扇状にずれて出る", () => {
    const w = arena(), p = w.player.pos; w.enemies = [dummy(p.x + 3, p.z, 1)];
    cast(w, ["claw", "chain", "double", "bite", "bite"], 0.4);
    const bites = w.projectiles.filter((q) => q.tech === "bite");
    expect(bites).toHaveLength(2);
    expect(Math.abs(bites[0].dir.z - bites[1].dir.z)).toBeGreaterThan(0.1);
  });
  it("当たらずに消えたら、消えた所から出る", () => {
    const w = arena(), p = w.player.pos; w.enemies = [dummy(p.x - 50, p.z, 1)];   // 虫はいない方向
    const born = cast(w, ["claw", "chain", "pounce"], 1.4);
    const ring = born.find((b) => b.tech === "pounce")!;
    expect(d(ring.at, p)).toBeGreaterThan(2.5);
  });
});

describe("発動のきっかけ", () => {
  it("何度でも: 貫通する飛ぶ技は、当たった虫ごとに出る", () => {
    const w = arena(), p = w.player.pos, A = dummy(p.x + 3, p.z, 1), B = dummy(p.x + 3.8, p.z, 2); w.enemies = [A, B];
    const born = cast(w, ["pushy", "claw", "nandodemo", "pounce"], 0.8);
    const rings = born.filter((b) => b.tech === "pounce");
    expect(rings.length).toBe(2);
    expect(d(rings[0].at, rings[0].foes.get(A.id)!)).toBeLessThan(0.8);
    expect(d(rings[1].at, rings[1].foes.get(B.id)!)).toBeLessThan(0.8);
  });
  it("ぴょんぴょん: 当たったときではなく、壁ではね返った所から出る", () => {
    const w = arena(), p = w.player.pos; w.enemies = [dummy(p.x - 50, p.z, 1)];
    const born = cast(w, ["ahiru", "pyonpyon", "pounce"], 3);
    const rings = born.filter((b) => b.tech === "pounce");
    expect(rings.length).toBeGreaterThanOrEqual(1);
    const L = w.room.layout;
    for (const r of rings) {   // はね返った所は、壁か家具のすぐそば
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const c = Math.floor(r.at.x + dx * 0.7 + L.cols / 2), rr = Math.floor(r.at.z + dz * 0.7 + L.rows / 2); return L.grid[rr * L.cols + c] !== 0; });
      expect(near).toBe(true);
    }
  });
  it("とどめ: 倒した虫の場所から出る（倒さないと出ない）", () => {
    const w = arena(), p = w.player.pos, A = dummy(p.x + 3, p.z, 1, 1); w.enemies = [A, dummy(p.x - 50, p.z, 9)];
    const born = cast(w, ["claw", "todome", "pounce"], 0.8);
    const ring = born.find((b) => b.tech === "pounce");
    expect(ring).toBeTruthy();
    expect(d(ring!.at, ring!.foes.get(A.id) ?? A.pos)).toBeLessThan(0.8);
    const w2 = arena(), p2 = w2.player.pos; w2.enemies = [dummy(p2.x + 3, p2.z, 1)];
    expect(cast(w2, ["claw", "todome", "pounce"], 0.8).some((b) => b.tech === "pounce")).toBe(false);
  });
  it("とどめ: かじかじの続きの攻撃で倒しても出る", () => {
    const w = arena(), p = w.player.pos, A = dummy(p.x + 3, p.z, 1, 20); w.enemies = [A, dummy(p.x - 50, p.z, 9)];
    const born = cast(w, ["kajikaji", "bite", "todome", "pounce"], 1.2);
    expect(A.hp).toBeLessThanOrEqual(0);
    expect(born.some((b) => b.tech === "pounce")).toBe(true);
  });
  it("ひと呼吸: 時間の前に当たって消えても、右の技は出る", () => {
    const w = arena(), p = w.player.pos, A = dummy(p.x + 2, p.z, 1); w.enemies = [A];
    const born = cast(w, ["claw", "hitoiki", "pounce"], 1);
    expect(born.some((b) => b.tech === "pounce")).toBe(true);
  });
  it("ひと呼吸: 当たらなければ0.45秒後の場所から出る", () => {
    const w = arena(), p = w.player.pos; w.enemies = [dummy(p.x - 50, p.z, 1)];
    const ring = cast(w, ["claw", "hitoiki", "pounce"], 1).find((b) => b.tech === "pounce")!;
    expect(ring.t).toBeGreaterThan(0.4); expect(ring.t).toBeLessThan(0.55);
  });
  it("友達猫に つづけて: 友達猫がひっかくたびに、その場所から出る", () => {
    const w = arena(), p = w.player.pos; w.enemies = [dummy(p.x + 3, p.z, 1)];
    const born = cast(w, ["friend", "chain", "flash"], 3);
    expect(born.filter((b) => b.tech === "flash").length).toBeGreaterThanOrEqual(2);
  });
});

describe("修飾のかかり方", () => {
  const toy = (slots: (string | null)[]): ToyDef => ({ id: "t", name: "t", desc: "", slots, manaMax: 9999, manaRegen: 0, castDelay: 0.1, recharge: 0.5 });
  const base = planCast(toy(["claw"]), 0, 9999).shots[0].stats;
  const mods = Object.values(SPELLS).filter((s) => s.kind === "modifier");
  for (const m of mods) {
    it(`${m.name}（${m.dir ?? "right"}）が技にかかる`, () => {
      const slots = m.dir === "left" ? ["claw", m.id] : m.dir === "both" ? ["claw", m.id, "claw"] : m.dir === "all" ? ["claw", "hiss", m.id] : [m.id, "claw"];
      const r = planCast(toy(slots), 0, 9999);
      if (m.id === "churu") { expect(r.manaUsed).toBe(SPELLS.claw.mana - 15); return; }
      if (m.id === "massigura") { expect(r.delayAdd).toBeLessThan(0); return; }
      if (m.modifier?.copies) { expect(r.shots.length).toBe(m.modifier.copies); return; }
      expect(r.shots[0].stats, "変わっていない").not.toEqual(base);
      if (m.dir === "both") { expect(r.shots).toHaveLength(2); expect(r.shots[1].stats).not.toEqual(base); }
    });
  }
});
