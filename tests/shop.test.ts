// お店（Magicraft のお店と鍛冶）・カリカリ・さいごのママ。
import { describe, expect, it } from "vitest";
import { spellDef, SPELLS } from "../src/core/spells";
import { ACTS, ROOMS_PER_ACT, World } from "../src/game/world";

const shopWorld = () => { const w = new World(3); w.start(); w.enterRoom(0, 1, "shop"); return w; };

describe("お店", () => {
  it("お店の部屋は虫が出ず、ボス猫に近づくと開く", () => {
    const w = shopWorld();
    expect(w.room.kind).toBe("shop");
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.enemies.length).toBe(0);
    expect(w.doorOpen).toBe(true);
    w.player.pos = { ...w.shop!.pos };
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.phase).toBe("shop");
  });
  it("カリカリで買える・足りなければ買えない・入れ替えはだんだん高くなる", () => {
    const w = shopWorld(); w.phase = "shop";
    const i = w.shop!.items.findIndex((x) => x.kind === "spell"), it0 = w.shop!.items[i];
    expect(w.buy(i)).toBe(false);
    w.coins = 100; const bag = w.bag.length;
    expect(w.buy(i)).toBe(true);
    expect(w.coins).toBe(100 - it0.price); expect(w.bag.length).toBe(bag + 1); expect(w.buy(i)).toBe(false);
    const c = w.shop!.rerollCost; expect(w.reroll()).toBe(true); expect(w.shop!.rerollCost).toBe(c + 2);
  });
  it("鍛冶: 同じ技3つで★の技1つ。★は強い", () => {
    const w = shopWorld();
    w.bag = ["claw", "claw", "claw", "bite"];
    expect(w.forgeable()).toEqual(["claw"]);
    expect(w.forge("claw")).toBe(true);
    expect(w.bag).toEqual(["bite", "claw+"]);
    expect(spellDef("claw+").projectile!.damage).toBeCloseTo(SPELLS.claw.projectile!.damage * 1.6, 1);
    expect(spellDef("matatabi++").mana).toBeLessThan(SPELLS.matatabi.mana);
  });
  it("虫を倒すとカリカリが落ち、近づくと拾える", () => {
    const w = new World(2); w.start();
    const e = w.enemies[0]; e.spawn = 0; e.hp = 0;
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.pickups.length).toBeGreaterThan(0);
    w.pickups.forEach((p) => { p.pos = { ...w.player.pos }; });
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.coins).toBeGreaterThan(0);
  });
});

describe("さいごのママ", () => {
  const finalWorld = () => {
    const w = new World(4); w.start();
    w.enterRoom(ACTS - 1, ROOMS_PER_ACT, null); w.enemies = []; w.room.waves = [[]];
    w.doorOpen = true; (w as unknown as { goThrough(d: unknown): void }).goThrough({});
    return w;
  };
  it("夏のボスのあとはママの部屋。ママは倒せない（肉球でたたくと少し止まるだけ）", () => {
    const w = finalWorld();
    expect(w.room.kind).toBe("final");
    const m = w.enemies[0]; expect(m.type).toBe("mama");
    m.spawn = 0; m.pos = { x: w.player.pos.x + 1.2, z: w.player.pos.z };
    const hp = m.hp;
    for (let k = 0; k < 10; k++) w.update(1 / 60, { move: { x: 0, z: 0 }, aim: { x: 1, z: 0 }, fire: true, dash: false });
    expect(m.hp).toBe(hp);
    expect(m.slow).toBeGreaterThan(0);
    expect(w.player.mana).toBe(w.manaMax);   // おもちゃは使えない（やる気は減らない）
  });
  it("ママにつかまったらクリア", () => {
    const w = finalWorld();
    const m = w.enemies[0]; m.spawn = 0;
    for (let k = 0; k < 60 * 30 && w.phase !== "win"; k++) w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.phase).toBe("win");
  });
});
