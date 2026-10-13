// つづけて・サブスロット・電池式・強い虫・特別な部屋・呪い・秘密の隠し場所・解放。
import { describe, expect, it } from "vitest";
import { cellCenter } from "../src/game/stage";
import { World, type Enemy } from "../src/game/world";
import { rarOf, SPELLS } from "../src/core/spells";
import { lockedKeys, newlyOpen, NO_STATS, UNLOCKS } from "../src/core/unlock";

/** 床の広い所に猫と、動かない虫を置く。 */
function arena(foe: { dx: number; dz: number } | null, seed = 5) {
  const w = new World(seed);
  w.start();
  w.room.waves = [[]]; w.enemies = []; w.projectiles = [];
  const L = w.room.layout;
  for (let r = 2; r < L.rows - 2; r++) for (let c = 2; c < L.cols - 8; c++) {
    if ([-1, 0, 1].every((dr) => [0, 1, 2, 3, 4, 5, 6].every((k) => L.grid[(r + dr) * L.cols + c + k] === 0))) { w.player.pos = cellCenter(L, c, r); r = L.rows; break; }
  }
  if (foe) w.enemies = [dummy(w.player.pos.x + foe.dx, w.player.pos.z + foe.dz)];
  w.player.mana = 999; w.toy.manaMax = 999;
  return w;
}
const dummy = (x: number, z: number, id = 999): Enemy => ({
  id, type: "roach", pos: { x, z }, vel: { x: 0, z: 0 }, hp: 1000, maxHp: 1000, radius: 0.4, speed: 0, slow: 0, hurt: 0, t: 0.9, phase: 0, spawn: 0,
  wet: 0, sticky: 0, repel: 0, repelDps: 0, repelTick: 0, push: { x: 0, z: 0 }, elite: null,
});
function run(w: World, sec: number, o: { fire?: boolean; move?: { x: number; z: number }; dash?: boolean } = {}) {
  for (let t = 0; t < sec; t += 1 / 60) { w.player.hp = w.player.maxHp; w.update(1 / 60, { move: o.move ?? { x: 0, z: 0 }, aim: { x: 1, z: 0 }, fire: !!o.fire, dash: !!o.dash }); }
}

describe("つづけて（Magicraft のトリガー）", () => {
  it("ひっかき→つづけて→ぶんぶん: ひっかきの当たった所を中心にぶんぶんが回る", () => {
    const w = arena({ dx: 4, dz: 0 });
    w.toy.slots = ["claw", "chain", "swing", null, null, null];
    run(w, 1 / 60, { fire: true });
    run(w, 0.5);
    const orbit = w.projectiles.find((p) => p.motion === "orbit");
    expect(orbit).toBeTruthy();
    expect(orbit!.anchor).toBeTruthy();
    const foe = w.enemies[0];
    expect(Math.hypot(orbit!.anchor!.x - foe.pos.x, orbit!.anchor!.z - foe.pos.z)).toBeLessThan(1);
    expect(Math.hypot(orbit!.anchor!.x - w.player.pos.x, orbit!.anchor!.z - w.player.pos.z)).toBeGreaterThan(2.5);
  });
});

describe("サブスロット", () => {
  it("紙袋: じっとしているとサブスロットが、やる気を使わずにいっぺんに出る", () => {
    const w = arena({ dx: 3, dz: 0 });
    w.addToy("kamibukuro"); w.switchToy(1);
    w.toy.sub!.slots = ["claw", "claw"];
    const mana = w.player.mana;
    run(w, 1.7);
    expect(w.enemies[0].hp).toBeLessThan(1000);
    expect(w.player.mana).toBeGreaterThanOrEqual(Math.min(mana, w.manaMax) - 1);
  });
  it("猫トンネル: ダッシュでたまる", () => {
    const w = arena(null);
    w.addToy("tunnel"); w.switchToy(1);
    w.toy.sub!.slots = ["claw", null];
    run(w, 1 / 60, { dash: true, move: { x: 1, z: 0 } }); run(w, 0.8, { move: { x: 0, z: 0 } });
    expect(w.toys[1].charge).toBe(1);
    run(w, 1 / 60, { dash: true, move: { x: -1, z: 0 } });
    expect(w.toys[1].charge).toBe(0);
    expect(w.projectiles.some((p) => p.tech === "claw")).toBe(true);
  });
});

describe("電池式のおもちゃ", () => {
  it("持っているだけで、近くの虫へ自動で振る（持ち替えの3つとは別）", () => {
    const w = arena({ dx: 3, dz: 0 });
    w.addToy("denmouse");
    expect(w.batt).toHaveLength(1);
    expect(w.toys).toHaveLength(1);
    run(w, 3);
    expect(w.enemies[0].hp).toBeLessThan(1000);
  });
  it("2つまで。3つ目は古い方と交換し、入っていた技は手持ちへ", () => {
    const w = arena(null);
    const bag = w.bag.length;
    w.addToy("denmouse"); w.addToy("autolaser"); w.addToy("pichifish");
    expect(w.batt.map((h) => h.def.id)).toEqual(["autolaser", "pichifish"]);
    expect(w.bag.length).toBe(bag + 1);
  });
});

describe("全体修飾", () => {
  it("やる気の最大が減る", () => {
    const w = arena(null), before = w.manaMax;
    w.toy.slots[5] = "maigofuda";
    expect(w.manaMax).toBe(before - SPELLS.maigofuda.mana);
  });
});

describe("特別な部屋・強い虫・呪い", () => {
  const enter = (kind: "treasure" | "rest" | "fusion" | "challenge" | "curse") => {
    const w = new World(3); w.start(); w.enterRoom(1, 3, kind); return w;
  };
  const touch = (w: World) => { w.player.pos = { ...w.room.altar!.pos }; run(w, 1 / 30); };
  it("宝箱: 虫が出ず、扉が開いていて、近づくとごほうびを選べる", () => {
    const w = enter("treasure");
    expect(w.enemies).toHaveLength(0);
    run(w, 1 / 30);
    expect(w.doorOpen).toBe(true);
    touch(w);
    expect(w.phase).toBe("reward");
    expect(w.choices.length).toBeGreaterThan(0);
  });
  it("ママのおひざで全回復", () => {
    const w = enter("rest");
    w.player.hp = 1; w.player.pos = { ...w.room.altar!.pos };
    w.update(1 / 30, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.player.hp).toBe(w.player.maxHp);
  });
  it("強い虫の部屋は強い虫が出て、倒すとカリカリが多い", () => {
    const w = enter("challenge");
    const elites = w.enemies.filter((e) => e.elite);
    expect(elites.length).toBeGreaterThan(0);
    expect(elites[0].maxHp).toBeGreaterThan(30);
  });
  it("あやしい箱: 呪いと引きかえにごほうび、にぼしの計算にも入る", () => {
    const w = enter("curse");
    touch(w);
    expect(w.phase).toBe("reward");
    const c = w.choices[0];
    expect(c.kind).toBe("pact");
    const coins = w.coins;
    w.takeReward(c);
    expect(w.curses).toHaveLength(1);
    expect(w.coins).toBeGreaterThan(coins);
    expect(w.phase).toBe("play");
  });
  it("呪い「虫がかたい」で虫の体力が上がる", () => {
    const a = new World(9); a.start(); a.enterRoom(1, 4, "spell");
    const b = new World(9); b.start(); b.curses = ["katai"]; b.enterRoom(1, 4, "spell");
    expect(b.enemies[0].maxHp).toBeGreaterThan(a.enemies[0].maxHp);
  });
  it("秘密の隠し場所: 同じレア度の技4つ → 1つ上のレア度の技1つ", () => {
    const w = enter("fusion");
    touch(w);
    expect(w.phase).toBe("bench");
    w.bag = ["claw", "bite", "hiss", "matatabi"];
    expect(w.fusable()).toEqual([0]);
    const got = w.fuse([0, 1, 2, 3]);
    expect(w.bag).toEqual([got]);
    expect(rarOf(got!)).toBe(1);
    w.bag = ["claw", "bite", "hiss", "laser"];
    expect(w.fuse([0, 1, 2, 3])).toBeNull();
  });
});

describe("解放（負けても積み上がる）", () => {
  it("解放していないものは、ごほうび・お店に出てこない", () => {
    const locked = lockedKeys(NO_STATS);
    const w = new World(4, { difficulty: 1, meta: { hp: 0, atk: 0, mana: 0, speed: 0, luck: 0, gift: 0 }, locked });
    w.start();
    const seen = new Set<string>();
    for (let k = 0; k < 60; k++) {
      (w as unknown as { offer(k: string): void }).offer(k % 2 ? "toy" : "spell");
      for (const c of w.choices) seen.add(`${c.kind}:${c.id}`);
      w.takeReward(null);
    }
    for (const key of locked) expect(seen.has(key), key).toBe(false);
    expect(seen.size).toBeGreaterThan(10);
  });
  it("記録が増えると解放される", () => {
    const after = { ...NO_STATS, kills: 40, rooms: 12 };
    const got = newlyOpen(NO_STATS, after).map((u) => u.id);
    expect(got).toEqual(expect.arrayContaining(["cap", "okawari", "pingpong", "tsurutsuru"]));
    expect(lockedKeys(after).length).toBe(UNLOCKS.length - got.length);
  });
});
