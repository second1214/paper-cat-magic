// ゲームの状態と1フレームの更新。描画・入力・DOM には依存しない（x,z の2D平面で計算）。
//
// 物語: ママは虫が大の苦手。家に入りこんだ虫を、猫がおもちゃで追い払う。
import { planCast, starterToy, TOYS, type Shot, type ToyDef } from "../core/wand";
import { SPELL_IDS, type TechFx } from "../core/spells";
import { makeRng, type Rng } from "../core/rng";

export interface Vec { x: number; z: number }

/** ゴキブリ（すばやく突進）・蚊（ふらふら飛ぶ）・クモ（離れて糸を飛ばす）・スズメバチ（ボス）。 */
export type EnemyType = "roach" | "mosquito" | "spider" | "hornet";

export interface Enemy {
  id: number;
  type: EnemyType;
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  slow: number;
  hurt: number;
  t: number;
  phase: number;
  /** 出現中の残り秒（この間は動かず、当たり判定もない）。 */
  spawn: number;
}

export interface Projectile {
  id: number;
  owner: "player" | "enemy";
  pos: Vec;
  vel: Vec;
  damage: number;
  radius: number;
  life: number;
  pierce: number;
  bounce: number;
  homing: number;
  explode: number;
  slow: number;
  color: string;
  tech: TechFx;
  payload: Shot[];
  hit: Set<number>;
}

export interface Fx { kind: "boom" | "hit" | "cast" | "puff" | "tech"; tech?: TechFx; pos: Vec; radius: number; color: string; t: number; life: number }

export interface Player {
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  aim: Vec;
  facing: 1 | -1;
  iframes: number;
  dash: number;
  dashCd: number;
  hurt: number;
  mana: number;
  cursor: number;
  castCd: number;
  recharging: boolean;
  /** 自動で狙っている虫（なければ null）。 */
  target: number | null;
}

export interface Pillar { x: number; z: number; hw: number; hd: number }

export interface Room {
  index: number;
  name: string;
  kind: "combat" | "boss";
  w: number;
  d: number;
  pillars: Pillar[];
  waves: EnemyType[][];
  wave: number;
  cleared: boolean;
}

export type Phase = "intro" | "play" | "reward" | "dead" | "win";

export type Reward = { kind: "spell"; id: string } | { kind: "toy"; id: string };

export interface Input {
  move: Vec;
  /** 狙う方向（null なら一番近い虫を自動で狙う）。 */
  aim: Vec | null;
  fire: boolean;
  dash: boolean;
}

export const ROOMS = ["玄関", "廊下", "キッチン", "リビング", "ベランダ"];
export const ROOM_COUNT = ROOMS.length;

export class World {
  rng: Rng;
  time = 0;
  phase: Phase = "intro";
  player: Player;
  toy: ToyDef;
  bag: string[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  fx: Fx[] = [];
  room!: Room;
  rewards: Reward[] = [];
  doorOpen = false;
  events: string[] = [];
  private nextId = 1;

  constructor(seed = 1) {
    this.rng = makeRng(seed);
    this.toy = starterToy();
    this.bag = ["hiss", "bouncy"];
    this.player = {
      pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, hp: 6, maxHp: 6, radius: 0.32,
      aim: { x: 1, z: 0 }, facing: 1, iframes: 0, dash: 0, dashCd: 0, hurt: 0,
      mana: this.toy.manaMax, cursor: 0, castCd: 0, recharging: false, target: null,
    };
    this.enterRoom(0);
  }

  start() { if (this.phase === "intro") this.phase = "play"; }

  // ---------- 部屋 ----------
  enterRoom(index: number) {
    const boss = index === ROOM_COUNT - 1;
    const w = boss ? 10 : 9.5, d = boss ? 6.2 : 5.8;
    const pillars: Pillar[] = [];
    if (!boss) {
      const n = this.rng.int(1, 3);
      // 家具（柱）は中央の通路（入口〜出口の一直線）をふさがない位置に置く
      for (let k = 0; k < n; k++) pillars.push({ x: this.rng.range(-4, 5), z: this.rng.pick([-1, 1]) * this.rng.range(2.2, 3.6), hw: 0.6, hd: 0.5 });
    }
    const pool: EnemyType[] = index === 0 ? ["roach"] : index === 1 ? ["roach", "mosquito"] : ["roach", "mosquito", "spider"];
    const waves: EnemyType[][] = boss
      ? [["hornet"]]
      : Array.from({ length: index < 2 ? 1 : 2 }, () => Array.from({ length: 3 + index }, () => this.rng.pick(pool)));
    this.room = { index, name: ROOMS[index], kind: boss ? "boss" : "combat", w, d, pillars, waves, wave: 0, cleared: false };
    this.enemies = []; this.projectiles = []; this.doorOpen = false;
    this.player.pos = { x: -w + 1.2, z: 0 };
    this.player.vel = { x: 0, z: 0 };
    this.spawnWave();
  }

  private spawnWave() {
    const r = this.room;
    r.waves[r.wave].forEach((type, k) => {
      let pos: Vec;
      let guard = 0;
      // 猫から十分離れた所（主に部屋の右側）から現れる
      do {
        pos = type === "hornet" ? { x: 5, z: 0 } : { x: this.rng.range(0, r.w - 1), z: this.rng.range(-r.d + 1, r.d - 1) };
      } while (++guard < 30 && (dist(pos, this.player.pos) < 7 || this.inPillar(pos, 0.7)));
      const e = makeEnemy(this.nextId++, type, pos);
      e.spawn = 1.0 + k * 0.25;   // 少しずつずらして現れる
      this.enemies.push(e);
    });
  }

  // ---------- 1フレーム ----------
  update(dt: number, input: Input) {
    this.events = [];
    if (this.phase !== "play") { this.updateFx(dt); return; }
    this.time += dt;
    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.checkRoom();
  }

  /** 一番近い（出現済みの）虫。 */
  nearestEnemy(pos: Vec, maxD = Infinity) {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) { if (e.spawn > 0) continue; const d = dist(e.pos, pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  private updatePlayer(dt: number, input: Input) {
    const p = this.player, toy = this.toy;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.mana = Math.min(toy.manaMax, p.mana + toy.manaRegen * dt);

    let mv = input.move;
    const len = Math.hypot(mv.x, mv.z);
    if (len > 1) mv = { x: mv.x / len, z: mv.z / len };
    if (input.dash && p.dashCd <= 0) {
      const dir = len > 0.1 ? norm(mv) : { x: p.facing, z: 0 };
      p.dash = 0.18; p.dashCd = 0.7; p.iframes = Math.max(p.iframes, 0.3);
      p.vel = { x: dir.x * 13, z: dir.z * 13 };
      this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 0.5, color: "#ffffff", t: 0, life: 0.35 });
    }
    const speed = p.dash > 0 ? 13 : 5.2;
    p.dash = Math.max(0, p.dash - dt);
    if (p.dash <= 0) {
      const k = Math.min(1, dt * 14);
      p.vel.x += (mv.x * speed - p.vel.x) * k; p.vel.z += (mv.z * speed - p.vel.z) * k;
    }
    this.moveCircle(p.pos, p.vel, p.radius, dt);

    // 狙い: 指定があればその方向、なければ一番近い虫
    const t = this.nearestEnemy(p.pos, 14);
    p.target = input.aim ? null : t?.id ?? null;
    if (input.aim && Math.hypot(input.aim.x, input.aim.z) > 0.01) p.aim = norm(input.aim);
    else if (t) p.aim = norm({ x: t.pos.x - p.pos.x, z: t.pos.z - p.pos.z });
    else if (len > 0.1) p.aim = norm(mv);
    if (Math.abs(p.aim.x) > 0.2 && (input.fire || len < 0.1)) p.facing = p.aim.x > 0 ? 1 : -1;
    else if (Math.abs(mv.x) > 0.2) p.facing = mv.x > 0 ? 1 : -1;

    // おもちゃを振る
    p.castCd -= dt;
    if (p.castCd <= 0 && p.recharging) p.recharging = false;
    if (input.fire && p.castCd <= 0) {
      const res = planCast(toy, p.cursor, p.mana);
      if (res.shots.length) {
        p.mana -= res.manaUsed;
        const muzzle = { x: p.pos.x + p.aim.x * 0.5, z: p.pos.z + p.aim.z * 0.5 };
        res.shots.forEach((s, n) => this.fire(s, muzzle, p.aim, "player", (n - (res.shots.length - 1) / 2) * 0.16));
        this.fx.push({ kind: "cast", pos: muzzle, radius: 0.35, color: res.shots[0].stats.color, t: 0, life: 0.15 });
        p.cursor = res.nextCursor;
        p.castCd = res.wrapped ? toy.recharge : toy.castDelay;
        p.recharging = res.wrapped;
        this.events.push("cast");
      } else if (res.fizzled) {
        p.castCd = 0.1;
      } else {
        p.cursor = 0; p.castCd = toy.recharge; p.recharging = true;
      }
    }
  }

  fire(shot: Shot, from: Vec, dir: Vec, owner: "player" | "enemy", angleOffset = 0) {
    const s = shot.stats;
    const a = Math.atan2(dir.z, dir.x) + angleOffset + (this.rng.next() - 0.5) * 2 * s.spread;
    this.projectiles.push({
      id: this.nextId++, owner, pos: { ...from }, vel: { x: Math.cos(a) * s.speed, z: Math.sin(a) * s.speed },
      damage: s.damage, radius: s.radius, life: s.life, pierce: s.pierce, bounce: s.bounce, homing: s.homing,
      explode: s.explode, slow: s.slow, color: s.color, tech: s.tech, payload: shot.payload, hit: new Set(),
    });
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.spawn > 0) { e.spawn = Math.max(0, e.spawn - dt); continue; }
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt);
      e.slow = Math.max(0, e.slow - dt);
      const sp = e.speed * (e.slow > 0 ? 0.45 : 1);
      const to = norm({ x: p.pos.x - e.pos.x, z: p.pos.z - e.pos.z });
      if (e.type === "roach") {
        // カサカサ: 立ち止まっては素早く走る
        const run = (e.t % 1.4) < 0.6;
        const side = { x: -to.z, z: to.x }, w = Math.sin(e.id * 1.7) * 0.4;
        e.vel = run ? { x: (to.x + side.x * w) * sp, z: (to.z + side.z * w) * sp } : { x: e.vel.x * 0.8, z: e.vel.z * 0.8 };
      } else if (e.type === "mosquito") {
        const side = { x: -to.z, z: to.x }, w = Math.sin(e.t * 4 + e.id) * 1.1;
        e.vel = { x: (to.x + side.x * w) * sp, z: (to.z + side.z * w) * sp };
      } else if (e.type === "spider") {
        // 距離を保って糸を飛ばす
        const d = dist(e.pos, p.pos), want = d > 6 ? 1 : d < 4 ? -1 : 0;
        const side = { x: -to.z, z: to.x };
        e.vel = { x: (to.x * want + side.x * 0.4) * sp, z: (to.z * want + side.z * 0.4) * sp };
        if (e.t > 2.0) { e.t = 0; this.fire({ stats: enemyShot("#d8d8e8", 5.5), payload: [] }, e.pos, to, "enemy"); }
      } else if (e.type === "hornet") {
        e.vel = { x: to.x * sp, z: to.z * sp };
        const hpRate = e.hp / e.maxHp, period = hpRate < 0.5 ? 1.5 : 2.1;
        if (e.t > period) {
          e.t = 0; e.phase++;
          if (e.phase % 2) {
            const n = hpRate < 0.5 ? 14 : 10, off = this.rng.next() * Math.PI;
            for (let k = 0; k < n; k++) {
              const a = off + (k / n) * Math.PI * 2;
              this.fire({ stats: enemyShot("#ffcf33", 4.2), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy");
            }
          } else {
            for (let k = -1; k <= 1; k++) this.fire({ stats: enemyShot("#ff7a3d", 6.5), payload: [] }, e.pos, to, "enemy", k * 0.22);
          }
        }
      }
      this.moveCircle(e.pos, e.vel, e.radius, dt);
      if (dist(e.pos, p.pos) < e.radius + p.radius) this.hurtPlayer(1, e.pos);
    }
    for (let a = 0; a < this.enemies.length; a++) for (let b = a + 1; b < this.enemies.length; b++) {
      const A = this.enemies[a], B = this.enemies[b];
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz), m = A.radius + B.radius;
      if (d > 0 && d < m) { const k = (m - d) / d / 2; A.pos.x -= dx * k; A.pos.z -= dz * k; B.pos.x += dx * k; B.pos.z += dz * k; }
    }
  }

  private hurtPlayer(n: number, from: Vec) {
    const p = this.player;
    if (p.iframes > 0) return;
    p.hp -= n; p.iframes = 1.0; p.hurt = 0.45;
    const away = norm({ x: p.pos.x - from.x, z: p.pos.z - from.z });
    p.vel = { x: away.x * 9, z: away.z * 9 };
    this.events.push("hurt");
    if (p.hp <= 0) { p.hp = 0; this.phase = "dead"; this.events.push("dead"); }
  }

  private updateProjectiles(dt: number) {
    const keep: Projectile[] = [];
    const spawned: { shot: Shot; pos: Vec; dir: Vec }[] = [];
    for (const pr of this.projectiles) {
      pr.life -= dt;
      if (pr.homing > 0 && pr.owner === "player") {
        const t = this.nearestEnemy(pr.pos, 7);
        if (t) {
          const want = norm({ x: t.pos.x - pr.pos.x, z: t.pos.z - pr.pos.z }), sp = Math.hypot(pr.vel.x, pr.vel.z);
          const k = Math.min(1, pr.homing * dt * 6), cur = norm(pr.vel);
          const nd = norm({ x: cur.x + (want.x - cur.x) * k, z: cur.z + (want.z - cur.z) * k });
          pr.vel = { x: nd.x * sp, z: nd.z * sp };
        }
      }
      pr.pos.x += pr.vel.x * dt; pr.pos.z += pr.vel.z * dt;
      let dead = pr.life <= 0;
      if (!dead && this.hitWall(pr)) { if (pr.bounce > 0) pr.bounce--; else dead = true; }
      if (!dead) {
        if (pr.owner === "player") {
          for (const e of this.enemies) {
            if (e.spawn > 0 || pr.hit.has(e.id) || dist(e.pos, pr.pos) > e.radius + pr.radius) continue;
            pr.hit.add(e.id);
            if (pr.explode <= 0) this.damageEnemy(e, pr.damage, pr.slow);
            this.fx.push({ kind: "tech", tech: pr.tech, pos: { ...e.pos }, radius: 0.7, color: pr.color, t: 0, life: 0.35 });
            if (pr.payload.length) for (const s of pr.payload) spawned.push({ shot: s, pos: { ...pr.pos }, dir: norm(pr.vel) });
            if (pr.pierce > 0) pr.pierce--; else { dead = true; break; }
          }
        } else if (dist(this.player.pos, pr.pos) < this.player.radius + pr.radius * 0.8) {
          this.hurtPlayer(1, pr.pos); dead = true;
        }
      }
      if (dead) {
        if (pr.owner === "player" && pr.explode > 0) this.explode(pr);
        if (pr.owner === "player" && pr.payload.length && pr.hit.size === 0)
          for (const s of pr.payload) spawned.push({ shot: s, pos: { ...pr.pos }, dir: norm(pr.vel) });
        continue;
      }
      keep.push(pr);
    }
    this.projectiles = keep;
    for (const s of spawned) this.fire(s.shot, s.pos, s.dir, "player");
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((e) => {
      if (e.hp > 0) return true;
      this.fx.push({ kind: "puff", pos: { ...e.pos }, radius: e.radius * 2, color: "#ffffff", t: 0, life: 0.5 });
      return false;
    });
    if (this.enemies.length < before) this.events.push("kill");
  }

  private explode(pr: Projectile) {
    this.fx.push({ kind: "tech", tech: pr.tech, pos: { ...pr.pos }, radius: pr.explode, color: pr.color, t: 0, life: 0.45 });
    for (const e of this.enemies) {
      if (e.spawn > 0) continue;
      const d = dist(e.pos, pr.pos);
      if (d < pr.explode + e.radius) this.damageEnemy(e, pr.damage * (1 - 0.4 * Math.min(1, d / pr.explode)), pr.slow);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, slow: number) {
    e.hp -= dmg; e.hurt = 0.15;
    if (slow > 0) e.slow = Math.max(e.slow, slow);
  }

  private updateFx(dt: number) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  private checkRoom() {
    const r = this.room;
    if (r.cleared) {
      if (this.doorOpen && this.player.pos.x > r.w - 0.6 && Math.abs(this.player.pos.z) < 1.0) this.enterRoom(r.index + 1);
      return;
    }
    if (this.enemies.length) return;
    if (r.wave + 1 < r.waves.length) { r.wave++; this.spawnWave(); return; }
    r.cleared = true;
    this.projectiles = this.projectiles.filter((p) => p.owner === "player");
    if (r.kind === "boss") { this.phase = "win"; this.events.push("win"); return; }
    // 報酬: 技3つ。2部屋目の後は1つをおもちゃにする
    const spells = pickN(this.rng, SPELL_IDS, 3).map((id): Reward => ({ kind: "spell", id }));
    if (r.index === 1) {
      const toys = Object.keys(TOYS).filter((t) => t !== this.toy.id);
      spells[2] = { kind: "toy", id: this.rng.pick(toys) };
    }
    this.rewards = spells;
    this.phase = "reward";
    this.events.push("clear");
  }

  /** 報酬を受け取る。null なら受け取らない。 */
  takeReward(r: Reward | null) {
    if (this.phase !== "reward") return;
    if (r?.kind === "spell") this.bag.push(r.id);
    if (r?.kind === "toy") this.equipToy(r.id);
    this.rewards = [];
    this.phase = "play";
    this.doorOpen = true;
  }

  /** おもちゃを持ち替える。はめていた技は左から詰め直し、あふれた分は手持ちへ。 */
  equipToy(id: string) {
    const old = this.toy.slots.filter((s): s is string => !!s);
    const t = structuredClone(TOYS[id]);
    t.slots = t.slots.map((_, i) => old[i] ?? null);
    this.bag.push(...old.slice(t.slots.length));
    this.toy = t;
    this.player.cursor = 0;
    this.player.mana = Math.min(this.player.mana, t.manaMax);
  }

  swap(slotIndex: number, bagIndex: number | null) {
    const cur = this.toy.slots[slotIndex];
    if (bagIndex === null) { if (cur) this.bag.push(cur); this.toy.slots[slotIndex] = null; }
    else { const take = this.bag[bagIndex]; this.bag.splice(bagIndex, 1); if (cur) this.bag.push(cur); this.toy.slots[slotIndex] = take; }
    this.player.cursor = 0;
  }

  /** スロット同士を入れ替える（並べ替え用）。 */
  swapSlots(a: number, b: number) {
    const s = this.toy.slots; [s[a], s[b]] = [s[b], s[a]];
    this.player.cursor = 0;
  }

  // ---------- 補助 ----------
  inPillar(pos: Vec, r: number) {
    return this.room.pillars.some((p) => Math.abs(pos.x - p.x) < p.hw + r && Math.abs(pos.z - p.z) < p.hd + r);
  }

  private hitWall(pr: Projectile) {
    const r = this.room;
    let hit = false;
    if (pr.pos.x < -r.w + pr.radius || pr.pos.x > r.w - pr.radius) { pr.vel.x *= -1; pr.pos.x = clamp(pr.pos.x, -r.w + pr.radius, r.w - pr.radius); hit = true; }
    if (pr.pos.z < -r.d + pr.radius || pr.pos.z > r.d - pr.radius) { pr.vel.z *= -1; pr.pos.z = clamp(pr.pos.z, -r.d + pr.radius, r.d - pr.radius); hit = true; }
    for (const p of r.pillars) {
      const dx = pr.pos.x - p.x, dz = pr.pos.z - p.z;
      const ox = p.hw + pr.radius - Math.abs(dx), oz = p.hd + pr.radius - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) { pr.vel.x = Math.abs(pr.vel.x) * Math.sign(dx || 1); pr.pos.x = p.x + Math.sign(dx || 1) * (p.hw + pr.radius); }
        else { pr.vel.z = Math.abs(pr.vel.z) * Math.sign(dz || 1); pr.pos.z = p.z + Math.sign(dz || 1) * (p.hd + pr.radius); }
        hit = true;
      }
    }
    return hit;
  }

  private moveCircle(pos: Vec, vel: Vec, r: number, dt: number) {
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    const room = this.room;
    const exit = this.doorOpen && Math.abs(pos.z) < 1.0;
    pos.x = clamp(pos.x, -room.w + r, exit ? room.w : room.w - r);
    pos.z = clamp(pos.z, -room.d + r, room.d - r);
    for (const p of room.pillars) {
      const dx = pos.x - p.x, dz = pos.z - p.z;
      const ox = p.hw + r - Math.abs(dx), oz = p.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) pos.x += Math.sign(dx || 1) * ox; else pos.z += Math.sign(dz || 1) * oz; }
    }
  }
}

function makeEnemy(id: number, type: EnemyType, pos: Vec): Enemy {
  const t: Record<EnemyType, [number, number, number]> = { roach: [16, 0.4, 3.0], mosquito: [9, 0.3, 2.8], spider: [14, 0.42, 2.2], hornet: [380, 1.0, 1.2] };
  const [hp, radius, speed] = t[type];
  return { id, type, pos: { ...pos }, vel: { x: 0, z: 0 }, hp, maxHp: hp, radius, speed, slow: 0, hurt: 0, t: (id * 0.37) % 1, phase: 0, spawn: 0 };
}

const enemyShot = (color: string, speed: number) => ({
  damage: 1, speed, radius: 0.16, life: 4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.03, color, tech: "enemy" as TechFx,
});

function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const a = [...arr], out: T[] = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng.next() * a.length), 1)[0]);
  return out;
}
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
