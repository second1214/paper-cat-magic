import { describe, expect, it } from "vitest";
import { castGroups, planCast, type ToyDef } from "../src/core/wand";
import { SPELLS } from "../src/core/spells";

const toy = (slots: (string | null)[], extra: Partial<ToyDef> = {}): ToyDef => ({
  id: "t", name: "t", lure: "feather", desc: "", slots, manaMax: 999, manaRegen: 0, castDelay: 0.1, recharge: 0.5, ...extra,
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

  it("つづけては、当たった所からさらに右の技を出す", () => {
    const t = toy(["chain", "claw", "hairball"]);
    const a = planCast(t, 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.shots[0].payload).toHaveLength(1);
    expect(a.shots[0].payload[0].stats.explode).toBeGreaterThan(0);
    expect(a.wrapped).toBe(true);
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
