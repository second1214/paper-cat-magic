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

describe("リビングに来る子どもたち", () => {
  const kid = (w: World, type: "boy" | "girl", dx: number) => {
    const e = { ...dummy(w.player.pos.x + dx, w.player.pos.z, 500 + dx), type, speed: type === "boy" ? 2.7 : 1.6, radius: 0.5, hp: 1e9, maxHp: 1e9 } as Enemy;
    w.enemies.push(e); return e;
  };
  it("攻撃は効かず、弾は通りぬけて後ろの虫に当たる", () => {
    const w = arena({ dx: 4, dz: 0 });
    const k = kid(w, "girl", 2); k.phase = 99;   // 遊びに夢中で追いかけてこない
    w.toy.slots = ["claw", null, null, null, null, null];
    run(w, 1 / 60, { fire: true }); run(w, 0.6);
    expect(k.hp).toBe(1e9);
    expect(w.enemies.find((e) => e.type === "roach")!.hp).toBeLessThan(1000);
  });
  it("つかまると数秒動けず♥が減り、そのあと抜け出せる", () => {
    const w = arena({ dx: 6, dz: 0 });   // 虫が残っている部屋（片付くと子どもは帰ってしまう）
    const k = kid(w, "boy", 0.6);
    const hp = w.player.hp;
    w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.player.held).toBeGreaterThan(0);
    expect(w.player.hp).toBeLessThan(hp);
    w.update(1 / 60, { move: { x: 1, z: 0 }, aim: null, fire: false, dash: false });
    const at = { ...w.player.pos };
    for (let t = 0; t < 1; t += 1 / 60) w.update(1 / 60, { move: { x: 1, z: 0 }, aim: null, fire: false, dash: false });
    expect(Math.hypot(w.player.pos.x - k.pos.x, w.player.pos.z - k.pos.z)).toBeLessThan(0.5);
    expect(Math.abs(w.player.pos.x - at.x)).toBeLessThan(0.1);   // 歩こうとしても動けない
    for (let t = 0; t < 2; t += 1 / 60) w.update(1 / 60, { move: { x: 1, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.player.held).toBe(0);
  });
  it("遠くにいても猫と遊びたくて追いかけてくる。そばに来ると猫は必死に逃げる（速くなる）", () => {
    const w = arena({ dx: 6, dz: 3 });
    const k = kid(w, "girl", 6);
    const d0 = Math.hypot(k.pos.x - w.player.pos.x, k.pos.z - w.player.pos.z);
    for (let t = 0; t < 1.5; t += 1 / 60) w.update(1 / 60, { move: { x: 0, z: 0 }, aim: null, fire: false, dash: false });
    expect(Math.hypot(k.pos.x - w.player.pos.x, k.pos.z - w.player.pos.z)).toBeLessThan(d0 - 1.5);
    k.pos = { x: w.player.pos.x + 2, z: w.player.pos.z };
    w.update(1 / 60, { move: { x: -1, z: 0 }, aim: null, fire: false, dash: false });
    expect(w.player.scared).toBe(true);
  });
  it("虫がいなくなれば、子どもがいても部屋は片付く（子どもは残って追いかけてくる）", () => {
    const w = arena(null);
    kid(w, "girl", 6).phase = 99;
    run(w, 0.1);
    expect(w.room.cleared).toBe(true);
    expect(w.enemies.filter((e) => e.type === "girl")).toHaveLength(1);
  });
});

describe("途中セーブ（部屋に入るたびに自動）", () => {
  it("再開すると、同じ部屋の入口から、持ち物・お金・HPそのままでやり直せる", () => {
    const w = new World(11); w.start();
    w.addToy("tombo"); w.addToy("denmouse"); w.bag.push("issho"); w.relics.push("tower"); w.coins = 23; w.curses = ["katai"];
    w.enterRoom(1, 4, "spell");
    w.player.hp = 3;
    const save = JSON.parse(JSON.stringify(w.checkpoint));
    const enemies = w.enemies.map((e) => [e.type, e.pos.x, e.pos.z, e.maxHp]);
    const doors = w.room.doors.map((d) => d.reward);
    // 部屋の中で進めても、セーブは部屋の入口のまま
    w.coins = 999; w.update(1 / 30, { move: { x: 1, z: 0 }, aim: null, fire: true, dash: false });
    const r = World.load(save);
    expect(r.room.act).toBe(1); expect(r.room.index).toBe(4);
    expect(r.enemies.map((e) => [e.type, e.pos.x, e.pos.z, e.maxHp])).toEqual(enemies);
    expect(r.room.doors.map((d) => d.reward)).toEqual(doors);
    expect(r.toys.map((h) => h.def.id)).toEqual(["jarashi", "tombo"]);
    expect(r.batt.map((h) => h.def.id)).toEqual(["denmouse"]);
    expect(r.bag).toContain("issho");
    expect(r.relics).toContain("tower");
    expect(r.coins).toBe(23);
    expect(r.curses).toEqual(["katai"]);
    expect(r.player.hp).toBe(w.checkpoint!.hp);
  });
});

describe("画面を埋め尽くす連鎖", () => {
  it("毛糸のほつれ: 当たった弾が割れて、まわりへ飛び散る", () => {
    const w = arena({ dx: 3, dz: 0 });
    w.toy.slots = ["hotsure", "claw", null, null, null, null, null, null];
    run(w, 1 / 60, { fire: true });
    let most = 0;
    for (let t = 0; t < 0.4; t += 1 / 60) { run(w, 1 / 60); most = Math.max(most, w.projectiles.filter((p) => p.tech === "claw").length); }
    expect(most).toBe(3);
  });
  it("何度でも: ぶんぶんが当たるたびに右の技が出る（つづけては1回だけ）", () => {
    const count = (trig: string) => {
      const w = arena({ dx: 1.7, dz: 0 });
      w.toy.slots = ["swing", trig, "claw", null, null, null, null, null];
      let n = 0;
      for (let t = 0; t < 1.4; t += 1 / 60) {
        const before = new Set(w.projectiles.map((p) => p.id));
        run(w, 1 / 60, { fire: t === 0 });
        n += w.projectiles.filter((p) => p.tech === "claw" && !before.has(p.id)).length;
      }
      return n;
    };
    expect(count("chain")).toBe(1);
    expect(count("nandodemo")).toBeGreaterThanOrEqual(2);
  });
  it("とどめ: 虫を倒した場所から右の技が出る", () => {
    const w = arena({ dx: 3, dz: 0 });
    w.enemies[0].hp = w.enemies[0].maxHp = 1;
    w.toy.slots = ["claw", "todome", "pounce", null, null, null, null, null];
    run(w, 1 / 60, { fire: true }); run(w, 0.4);
    expect(w.projectiles.some((p) => p.tech === "pounce")).toBe(true);
  });
  it("出すぎても上限で止まる（重くならない）", () => {
    const w = arena(null);
    w.toy.slots = ["tatougai", "butimake", "butimake", "post", "butimake", "butimake", "post", "butimake", "butimake", "post", "butimake", "butimake", "post"].slice(0, 8);
    w.toy.slots = ["butimake", "butimake", "butimake", "butimake", "claw", null, null, null];
    w.player.mana = 999; w.toy.manaMax = 999;
    for (let k = 0; k < 3; k++) { w.player.castCd = 0; run(w, 1 / 60, { fire: true }); }
    expect(w.projectiles.length).toBeLessThanOrEqual(400);
    expect(w.projectiles.length).toBeGreaterThan(300);
  });
  it("後半の季節には虫の大群の波がまざる", () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      const w = new World(seed); w.start(); w.enterRoom(2, 5, "spell");
      found = w.room.waves.some((wv) => wv.length >= 14);
    }
    expect(found).toBe(true);
  });
});
