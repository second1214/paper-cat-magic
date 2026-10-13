import { describe, expect, it } from "vitest";
import { BOSS_TEMPLATE, buildLayout, Cell, FINAL_TEMPLATE, OUTDOOR_TEMPLATES, reach, ROOM_W, ROOM_H, SHOP_TEMPLATE, stretch, TEMPLATES } from "../src/game/stage";
import { makeRng } from "../src/core/rng";

const all = { ...TEMPLATES, ...OUTDOOR_TEMPLATES, boss: BOSS_TEMPLATE, shop: SHOP_TEMPLATE, final: FINAL_TEMPLATE };
const withDoors = { ...TEMPLATES, ...OUTDOOR_TEMPLATES, shop: SHOP_TEMPLATE };

describe("部屋のテンプレート", () => {
  for (const [name, t] of Object.entries(all)) {
    it(`${name}: 形がそろっていて、入口から全部の床と出口へ行ける`, () => {
      expect(new Set(t.map((r) => r.length)).size).toBe(1);
      for (const flipX of [false, true]) for (const flipY of [false, true]) {
        const L = buildLayout(t, "living", makeRng(1), { flipX, flipY, doors: [1, 2, 3] });
        if (name !== "final") expect(L.exits.length).toBeGreaterThan(0);   // さいごの部屋は出口なし
        const d = reach(L, L.entry, (v) => v === Cell.Floor || v === Cell.Door);
        for (let k = 0; k < L.grid.length; k++) if (L.grid[k] === Cell.Floor) expect(d[k]).toBeGreaterThanOrEqual(0);
        for (const e of L.exits) expect(d[e.r * L.cols + e.c]).toBeGreaterThan(0);
      }
    });
  }

  for (const [name, t] of Object.entries(withDoors)) it(`${name}: 出口の候補 1・2・3 がそろっている（どれを選んでも出口がある）`, () => {
    for (const slot of [1, 2, 3]) expect(buildLayout(t, "living", makeRng(1), { doors: [slot] }).exits.length, `slot ${slot}`).toBe(1);
  });

  it("部屋は広げても扉が増えない", () => {
    const t = stretch(["#####", "#E..1", "#...#", "#...#", "##2##"], 7, 7);
    expect(t.length).toBe(7); expect(t[0].length).toBe(7);
    expect(t.join("").split("").filter((c) => /[12E]/.test(c)).length).toBe(3);
    expect(TEMPLATES.rect[0].length).toBe(ROOM_W); expect(TEMPLATES.rect.length).toBe(ROOM_H);
  });

  it("使わない出口は壁になり、家具はまとまりごとに1つ", () => {
    const L = buildLayout(TEMPLATES.rect, "study", makeRng(3), { doors: [2] });
    expect(L.exits.map((e) => e.slot)).toEqual([2]);
    expect(L.props.length).toBe(5);   // 広げても家具のまとまりの数は同じ
  });
});
