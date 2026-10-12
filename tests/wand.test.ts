import { describe, expect, it } from "vitest";
import { planCast, type WandDef } from "../src/core/wand";
import { SPELLS } from "../src/core/spells";

const wand = (slots: (string | null)[]): WandDef => ({ name: "t", slots, manaMax: 999, manaRegen: 0, castDelay: 0.1, recharge: 0.5 });

describe("planCast", () => {
  it("1回に弾1発ずつ、左から順に撃つ", () => {
    const w = wand(["spark", "ice", "bolt"]);
    const a = planCast(w, 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.shots[0].stats.color).toBe(SPELLS.spark.projectile!.color);
    expect(a.nextCursor).toBe(1);
    const b = planCast(w, a.nextCursor, 999);
    expect(b.shots[0].stats.color).toBe(SPELLS.ice.projectile!.color);
    const c = planCast(w, b.nextCursor, 999);
    expect(c.wrapped).toBe(true);
    expect(c.nextCursor).toBe(0);
  });

  it("修飾は次の弾にだけ乗る", () => {
    const w = wand(["empower", "spark", "spark"]);
    const a = planCast(w, 0, 999);
    expect(a.shots[0].stats.damage).toBeCloseTo(4 * 1.5 + 2);
    const b = planCast(w, a.nextCursor, 999);
    expect(b.shots[0].stats.damage).toBe(4);
  });

  it("二連は続く2発を同時に撃つ", () => {
    const w = wand(["twin", "spark", "ice", "bolt"]);
    const a = planCast(w, 0, 999);
    expect(a.shots).toHaveLength(2);
    expect(a.nextCursor).toBe(3);
  });

  it("誘発は次の弾の命中時に、その次の弾を撃つ", () => {
    const w = wand(["trigger", "spark", "fireball"]);
    const a = planCast(w, 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.shots[0].payload).toHaveLength(1);
    expect(a.shots[0].payload[0].stats.explode).toBeGreaterThan(0);
    expect(a.wrapped).toBe(true);
  });

  it("マナ不足なら止まり、使ったマナは足りた分だけ", () => {
    const w = wand(["twin", "spark", "fireball"]);
    const a = planCast(w, 0, SPELLS.twin.mana + SPELLS.spark.mana);
    expect(a.fizzled).toBe(true);
    expect(a.shots).toHaveLength(1);
    expect(a.manaUsed).toBe(SPELLS.twin.mana + SPELLS.spark.mana);
  });

  it("空スロットは飛ばし、弾のない修飾は捨てる", () => {
    const w = wand([null, "spark", null, "homing", null]);
    const a = planCast(w, 0, 999);
    expect(a.shots).toHaveLength(1);
    expect(a.wrapped).toBe(false);
    const b = planCast(w, a.nextCursor, 999);
    expect(b.shots).toHaveLength(0);
    expect(b.wrapped).toBe(true);
  });
});
