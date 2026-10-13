// レリック・装備セット・おもちゃの複数持ち。
import { describe, expect, it } from "vitest";
import { gearBonus, NO_BONUS, RARITY, RELICS, rollGear, totalBonus, type GearItem } from "../src/core/items";
import { DIFFS, metaBonus, NO_META, runReward } from "../src/core/meta";
import { ROOMS_PER_ACT, World } from "../src/game/world";

const G = (id: string, rar: GearItem["rar"] = 0): GearItem => ({ id, rar, fx: [] });
const play = (seed = 2) => { const w = new World(seed); w.start(); w.enemies = []; return w; };
const reward = (w: World, kind: "relic" | "gear" | "toy", id: string) => { w.phase = "reward"; w.choices = [{ kind, id }]; w.takeReward(w.choices[0]); };

describe("装備セット", () => {
  it("同じセットを2つ・3つそろえるとボーナスが増える", () => {
    const one = totalBonus([], { hat: G("mikan"), body: null, collar: null });
    const two = totalBonus([], { hat: G("mikan"), body: G("suika"), collar: null });
    const three = totalBonus([], { hat: G("mikan"), body: G("suika"), collar: G("cherry") });
    expect(one.maxHp).toBe(2);
    expect(two.maxHp).toBe(4);              // みかん＋2つセット
    expect(three.iframes).toBeCloseTo(0.5); // 3つセット
    expect(totalBonus([], { hat: G("halo"), body: G("aloha"), collar: G("nametag") }).dashPower).toBe(0);
  });
  it("同じ場所の装備は交換される", () => {
    const w = play();
    reward(w, "gear", "mikan"); reward(w, "gear", "beanie");
    expect(w.gear.hat?.id).toBe("beanie");
    expect(w.bonus.maxHp).toBe(0);
  });
});

describe("レリック", () => {
  it("最大HPが増え、そのぶん回復する", () => {
    const w = play(); const before = w.player.maxHp;
    reward(w, "relic", "oyatsu");
    expect(w.player.maxHp).toBe(before + RELICS.oyatsu.bonus.maxHp!);
    expect(w.player.hp).toBe(w.player.maxHp);
  });
  it("攻撃力が上がる", () => {
    const base = play(); base.fire({ stats: { ...shot() }, payload: [] }, base.player.pos, { x: 1, z: 0 }, "player");
    const w = play(); reward(w, "relic", "tower"); w.fire({ stats: { ...shot() }, payload: [] }, w.player.pos, { x: 1, z: 0 }, "player");
    expect(w.projectiles.at(-1)!.damage).toBeCloseTo(base.projectiles.at(-1)!.damage * 1.15);
  });
  it("同じレリックは二度出ない", () => {
    const w = play(); reward(w, "relic", "milk");
    for (let k = 0; k < 20; k++) { (w as unknown as { offer(k: string): void }).offer("relic"); expect(w.choices.some((c) => c.id === "milk")).toBe(false); }
  });
  it("何も持っていなければ効果なし", () => expect(totalBonus([], { hat: null, body: null, collar: null })).toEqual(NO_BONUS));
});

describe("おもちゃの複数持ち", () => {
  it("3つまで増え、それ以上は今のおもちゃと交換", () => {
    const w = play();
    reward(w, "toy", "tombo"); reward(w, "toy", "tissue");
    expect(w.toys.map((h) => h.def.id)).toEqual(["jarashi", "tombo", "tissue"]);
    const slotsBefore = w.toy.slots.filter(Boolean);
    reward(w, "toy", "tombo");
    expect(w.toys.length).toBe(3);
    expect(w.toy.id).toBe("tombo");
    expect(w.toy.slots.filter(Boolean)).toEqual(slotsBefore.slice(0, 4));
  });
  it("持ち替えると、やる気と次のスロットはおもちゃごとに覚えている", () => {
    const w = play();
    reward(w, "toy", "tombo");
    w.player.mana = 10; w.player.cursor = 2;
    w.switchToy(1);
    expect(w.toy.id).toBe("tombo");
    expect(w.player.cursor).toBe(0);
    expect(w.player.mana).toBe(w.manaMax);
    w.switchToy(0);
    expect(w.player.cursor).toBe(2);
    expect(w.player.mana).toBe(10);
  });
  it("やる気アップのごほうびは全部のおもちゃに効き、あとで増えたおもちゃにも引き継ぐ", () => {
    const w = play();
    w.room.reward = "mp"; w.room.waves = [[]]; w.room.wave = 0;
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    reward(w, "toy", "tissue");
    expect(w.toys[1].def.manaMax).toBe(110 + 20);
  });
});

function shot() {
  return { damage: 10, speed: 10, radius: 0.2, life: 1, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0, color: "#fff", tech: "claw" as const,
    motion: "shot" as const, hits: 1, hitEvery: 0.1, reach: 0, element: "none" as const, knock: 0 };
}

describe("装備のレアリティ", () => {
  it("レアリティが上がるほど効果が大きく、エピック以上は特殊効果がつく", () => {
    expect(gearBonus(G("aloha", 0)).speedMul).toBeCloseTo(1.05);
    expect(gearBonus(G("aloha", 2)).speedMul).toBeCloseTo(1.1);
    expect(gearBonus(G("mikan", 3)).maxHp).toBe(6);
    let r = 0; const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    for (let k = 0; k < 200; k++) { const g = rollGear("lei", rand, 3, 3); expect(g.fx.length).toBe(RARITY[g.rar].fx); expect(new Set(g.fx).size).toBe(g.fx.length); }
  });
  it("運が良いほどレアが出やすい", () => {
    const count = (luck: number) => { let r = 1, n = 0; const rand = () => (r = (r * 9301 + 49297) % 233280) / 233280; for (let k = 0; k < 2000; k++) if (rollGear("lei", rand, luck, 0).rar >= 2) n++; return n; };
    expect(count(3)).toBeGreaterThan(count(0) * 1.5);
  });
});

describe("難易度・季節・ねこの成長", () => {
  it("難易度で虫の体力と数が変わる", () => {
    const hp = (d: number) => { const w = new World(4, { difficulty: d, meta: NO_META }); return w.room.waves.flat().length; };
    expect(hp(3)).toBeGreaterThan(hp(0));
    expect(DIFFS[3].hp).toBeGreaterThan(DIFFS[0].hp);
  });
  it("季節ごとに出る虫とボスが違う", () => {
    const w = new World(5);
    const seen = new Set<string>();
    for (let act = 0; act < 4; act++) for (let i = 0; i <= ROOMS_PER_ACT; i++) { w.enterRoom(act, i, null); w.room.waves.flat().forEach((t) => seen.add(`${act}:${t}`)); }
    expect(seen.has("0:stinkbug") && seen.has("1:camel") && seen.has("2:ant") && seen.has("3:roach")).toBe(true);
    expect([...seen].filter((x) => /King|queen|hornet/.test(x)).sort()).toEqual(["0:stinkKing", "1:camelKing", "2:queen", "3:hornet"]);
  });
  it("ねこの成長が効き、にぼしは難易度で増える", () => {
    const w = new World(2, { difficulty: 1, meta: { ...NO_META, hp: 2, atk: 3, gift: 1 } });
    expect(w.player.maxHp).toBe(6 + 4);
    expect(w.bonus.dmgMul).toBeCloseTo(1.18);
    expect(w.relics.length).toBe(1);
    expect(totalBonus([], { hat: null, body: null, collar: null }, metaBonus(NO_META))).toEqual(NO_BONUS);
    expect(runReward(10, 2, false, 2)).toBeGreaterThan(runReward(10, 2, false, 1));
  });
});
