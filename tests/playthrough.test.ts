// 自動プレイで1年分（全季節・ボス）を通し、詰み（虫に届かない・扉に行けない）がないことを確かめる。
import { describe, expect, it } from "vitest";
import { Cell, cellAt, cellCenter, reach } from "../src/game/stage";
import { ROOMS_PER_ACT, World } from "../src/game/world";
import { NO_META } from "../src/core/meta";
import { rarOf } from "../src/core/spells";

/** 目標のマスへ向かう1歩の方向（壁・家具を避けた最短路）。 */
function stepToward(w: World, target: { x: number; z: number }) {
  const L = w.room.layout, p = w.player.pos;
  const dist = reach(L, cellAt(L, target.x, target.z), (v) => v === Cell.Floor || v === Cell.Door);
  const here = cellAt(L, p.x, p.z);
  let best = here, bd = dist[here.r * L.cols + here.c];
  if (bd <= 1) best = cellAt(L, target.x, target.z);
  else for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = here.c + dc, r = here.r + dr, d = dist[r * L.cols + c];
    if (d >= 0 && (bd < 0 || d < bd)) { bd = d; best = { c, r }; }
  }
  const t = bd <= 1 ? target : cellCenter(L, best.c, best.r);
  const dx = t.x - p.x, dz = t.z - p.z, n = Math.hypot(dx, dz) || 1;
  return { x: dx / n, z: dz / n };
}

describe("playthrough", () => {
  for (const [seed, difficulty] of [[1, 1], [2, 1], [3, 1], [4, 3]]) it(`seed ${seed} 難易度${difficulty}: 全季節を最後まで進める`, () => {
    const w = new World(seed, { difficulty, meta: NO_META });
    w.start();
    const dt = 1 / 30;
    let rooms = 0, steps = 0, roomSteps = 0, lastRoom = "";
    while (w.phase !== "win") {
      if (++steps > 200000) throw new Error(`timeout at ${w.title}`);
      w.player.hp = w.player.maxHp; // 進行（詰み）だけを確かめる
      if (w.title !== lastRoom) { lastRoom = w.title; rooms++; roomSteps = 0; }
      if (++roomSteps > 30 * 240) throw new Error(`stuck in ${w.title} ${JSON.stringify({ p: w.player.pos, e: w.enemies.map((e) => [e.type, e.pos, e.hp, e.spawn]), m: w.player.mana, cur: w.player.cursor })}`);
      if (w.phase === "reward") { w.takeReward(w.choices[0]); continue; }
      if (w.phase === "shop") { w.shop!.items.forEach((_, i) => w.buy(i)); w.closeShop(); continue; }
      if (w.phase === "bench") { while (w.fusable().length) { const r = w.fusable()[0]; w.fuse(w.bag.map((id, i) => [id, i] as const).filter(([id]) => rarOf(id) === r).slice(0, 4).map(([, i]) => i)); } w.closeShop(); continue; }
      expect(w.phase).toBe("play");
      const foe = w.nearestEnemy(w.player.pos);
      const door = w.room.doors[rooms % w.room.doors.length];
      const al = w.room.altar;
      const target = al && !al.used && al.kind !== "fusion" ? al.pos : w.doorOpen ? door.pos : foe?.pos;
      const move = target ? stepToward(w, target) : { x: 0, z: 0 };
      w.update(dt, { move, aim: null, fire: !!foe, dash: false });
      const L = w.room.layout;
      for (const e of w.enemies) expect(Math.abs(e.pos.x) < L.cols / 2 && Math.abs(e.pos.z) < L.rows / 2, `${e.type} が部屋の外`).toBe(true);
    }
    expect(rooms).toBe(4 * (ROOMS_PER_ACT + 1) + 1);   // ＋さいごのママ
    expect(w.room.kind).toBe("final");
  }, 30000);   // 1年分を通すので時間がかかる（並列で遅くなっても落ちないように）
});
