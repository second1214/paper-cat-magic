import { describe, expect, it } from "vitest";
import { BOSS_TEMPLATE, buildLayout, Cell, reach, TEMPLATES } from "../src/game/stage";
import { makeRng } from "../src/core/rng";

const all = { ...TEMPLATES, boss: BOSS_TEMPLATE };

describe("部屋のテンプレート", () => {
  for (const [name, t] of Object.entries(all)) {
    it(`${name}: 形がそろっていて、入口から全部の床と出口へ行ける`, () => {
      expect(new Set(t.map((r) => r.length)).size).toBe(1);
      for (const flipX of [false, true]) for (const flipY of [false, true]) {
        const L = buildLayout(t, "living", makeRng(1), { flipX, flipY, doors: [1, 2, 3] });
        expect(L.exits.length).toBeGreaterThan(0);
        const d = reach(L, L.entry, (v) => v === Cell.Floor || v === Cell.Door);
        for (let k = 0; k < L.grid.length; k++) if (L.grid[k] === Cell.Floor) expect(d[k]).toBeGreaterThanOrEqual(0);
        for (const e of L.exits) expect(d[e.r * L.cols + e.c]).toBeGreaterThan(0);
      }
    });
  }

  it("使わない出口は壁になり、家具はまとまりごとに1つ", () => {
    const L = buildLayout(TEMPLATES.rect, "study", makeRng(3), { doors: [2] });
    expect(L.exits.map((e) => e.slot)).toEqual([2]);
    expect(L.props.length).toBe(5);
  });
});
