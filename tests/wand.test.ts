import { describe, expect, it } from "vitest";
import { castAll, castGroups, groupSummary, passiveCost, planCast, type ToyDef } from "../src/core/wand";
import { SPELLS } from "../src/core/spells";

const toy = (slots: (string | null)[], extra: Partial<ToyDef> = {}): ToyDef => ({
  id: "t", name: "t", desc: "", slots, manaMax: 999, manaRegen: 0, castDelay: 0.1, recharge: 0.5, ...extra,
});

describe("planCast", () => {
  it("1回に技1つずつ、左から順に出す", () => {
    const t = toy(["claw", "hiss", "bite"]);
    const a = planCast(t, 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.shots[0].stats.tech).toBe("claw");
    expect(a.nextCursor).toBe(1);
    const b = planCast(t, a.nextCursor, 999);
    expect(b.shots[0].stats.tech).toBe("hiss");
    const c = planCast(t, b.nextCursor, 999);
    expect(c.wrapped).toBe(true);
    expect(c.nextCursor).toBe(0);
  });

  it("修飾は右隣の技にだけかかる", () => {
    const t = toy(["matatabi", "claw", "claw"]);
    const a = planCast(t, 0, 999);
    expect(a.shots[0].stats.damage).toBeCloseTo(5 * 1.5 + 3);
    const b = planCast(t, a.nextCursor, 999);
    expect(b.shots[0].stats.damage).toBe(5);
  });

  it("二刀流は続く2つの技を同時に出す", () => {
    const t = toy(["double", "claw", "hiss", "bite"]);
    const a = planCast(t, 0, 999);
    expect(a.shots).toHaveLength(2);
    expect(a.nextCursor).toBe(3);
  });

  it("[A][つづけて][B]: A が当たった所から B を出す", () => {
    const t = toy(["claw", "chain", "swing"]);
    const a = planCast(t, 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.shots[0].stats.tech).toBe("claw");
    expect(a.shots[0].payload).toHaveLength(1);
    expect(a.shots[0].payload[0].stats.motion).toBe("orbit");
    expect(a.wrapped).toBe(true);
  });

  it("つづけては何段でもつながり、修飾は右の技にかかる", () => {
    const a = planCast(toy(["claw", "chain", "matatabi", "bite", "chain", "hairball"]), 0, 999);
    const b = a.shots[0].payload[0];
    expect(b.stats.damage).toBeCloseTo(14 * 1.5 + 3);
    expect(b.payload[0].stats.explode).toBeGreaterThan(0);
  });

  it("ひと呼吸は時間で出す", () => {
    const a = planCast(toy(["claw", "hitoiki", "bite"]), 0, 999);
    expect(a.shots[0].timer).toBe(SPELLS.hitoiki.timer);
    expect(a.shots[0].payload).toHaveLength(1);
  });

  it("◀修飾は左の技にかかる", () => {
    const a = planCast(toy(["claw", "okawari", "bite"]), 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.shots[0].stats.hits).toBe(2);
    expect(a.nextCursor).toBe(2);
  });

  it("◀▶修飾は左右の技にかかり、2つをいっしょに出す", () => {
    const a = planCast(toy(["claw", "catnipBag", "bite", "hiss"]), 0, 999);
    expect(a.shots.map((s) => s.stats.tech)).toEqual(["claw", "bite"]);
    expect(a.shots[0].stats.damage).toBeCloseTo(5 * 1.3);
    expect(a.shots[1].stats.damage).toBeCloseTo(14 * 1.3);
    expect(a.nextCursor).toBe(3);
  });

  it("全体修飾はどこに置いても全部の技にかかり、読まれず、やる気の最大を減らす", () => {
    const t = toy(["claw", "bite", "maigofuda"]);
    expect(planCast(t, 0, 999).shots[0].stats.damage).toBe(7);
    const b = planCast(t, 1, 999);
    expect(b.shots[0].stats.damage).toBe(16);
    expect(b.wrapped).toBe(true);
    expect(b.manaUsed).toBe(SPELLS.bite.mana);
    expect(passiveCost(t)).toBe(SPELLS.maigofuda.mana);
  });

  it("ふたつ持ちは左の技と右の技を1つにまとめる", () => {
    const a = planCast(toy(["water", "claw", "issho", "hairball"]), 0, 999);
    expect(a.shots).toHaveLength(1);
    const s = a.shots[0].stats;
    expect(s.tech).toBe("hairball");
    expect(s.damage).toBe(5 + 9);
    expect(s.element).toBe("wet");
    expect(s.explode).toBeGreaterThan(0);
  });

  it("やる気不足なら止まり、使ったのは足りた分だけ", () => {
    const t = toy(["double", "claw", "hairball"]);
    const a = planCast(t, 0, SPELLS.double.mana + SPELLS.claw.mana);
    expect(a.fizzled).toBe(true);
    expect(a.shots).toHaveLength(1);
    expect(a.manaUsed).toBe(SPELLS.double.mana + SPELLS.claw.mana);
  });

  it("空スロットは飛ばし、技のない修飾は捨てる", () => {
    const t = toy([null, "claw", null, "stare", null]);
    const a = planCast(t, 0, 999);
    expect(a.shots).toHaveLength(1);
    const b = planCast(t, a.nextCursor, 999);
    expect(b.shots).toHaveLength(0);
    expect(b.wrapped).toBe(true);
  });

  it("おもちゃの性質はすべての技にかかる", () => {
    const t = toy(["claw"], { baseMod: { bounce: 1 } });
    expect(planCast(t, 0, 999).shots[0].stats.bounce).toBe(1);
  });
});

describe("castGroups", () => {
  it("修飾と、それがかかる技をひとまとめにする", () => {
    const t = toy(["claw", "matatabi", "stare", "bite", null, "double", "claw", "hiss"]);
    expect(castGroups(t)).toEqual([[0, 1], [1, 4], [4, 8]]);
  });
});

describe("groupSummary", () => {
  it("まとまりごとの合計攻撃力を出す", () => {
    const t = toy(["claw", "matatabi", "bite", "chain", "claw", "claw"]);
    const g = groupSummary(t);
    expect(g.map((x) => [x.start, x.end])).toEqual([[0, 1], [1, 5], [5, 6]]);
    expect(g[0].damage).toBe(5);
    expect(g[1].damage).toBe(Math.round(14 * 1.5 + 3 + 5));
    expect(g[2].damage).toBe(5);
  });
  it("いっぺんに出すおもちゃは全部で1まとまり", () => {
    const t = toy(["claw", "bite", "hiss"], { castAll: true });
    expect(castAll(t, 999).shots).toHaveLength(3);
    expect(groupSummary(t)).toHaveLength(1);
  });
});
