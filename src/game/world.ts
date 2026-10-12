// ゲームの状態と1フレームの更新。描画・入力・DOM には依存しない（x,z の2D平面で計算）。
import { planCast, STARTER_WAND, type Shot, type WandDef } from "../core/wand";
import { SPELL_IDS } from "../core/spells";
import { makeRng, type Rng } from "../core/rng";

export interface Vec { x: number; z: number }

export type EnemyType = "slime" | "bat" | "wisp" | "golem";

export interface Enemy {
  id: number;
  type: EnemyType;
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  slow: number; // 鈍足の残り秒
  hurt: number; // 被弾演出の残り秒
  t: number; // 行動タイマー
  phase: number; // ボスの攻撃段階など
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
  payload: Shot[];
  hit: Set<number>;
}

export interface Fx { kind: "boom" | "hit" | "cast" | "puff"; pos: Vec; radius: number; color: string; t: number; life: number }

export interface Player {
  pos: Vec;
  vel: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  aim: Vec; // 正規化した照準方向
  facing: 1 | -1;
  iframes: number;
  dash: number; // ダッシュ残り秒
  dashCd: number;
  hurt: number;
  mana: number;
  cursor: number;
  castCd: number;
  recharging: boolean;
}

export interface Pillar { x: number; z: number; hw: number; hd: number }

export interface Room {
  index: number;
  kind: "combat" | "boss";
  w: number; // 半幅（x）
  d: number; // 半奥行き（z）
  pillars: Pillar[];
  waves: EnemyType[][];
  wave: number;
  cleared: boolean;
}

export type Phase = "play" | "reward" | "dead" | "win";

export interface Input {
  move: Vec; // -1..1
  aim: Vec | null; // ワールド上の照準方向（null なら移動方向）
  fire: boolean;
  dash: boolean;
}

export const ROOM_COUNT = 5; // 戦闘4部屋 + ボス

export class World {
  rng: Rng;
  time = 0;
  phase: Phase = "play";
  player: Player;
  wand: WandDef;
  bag: string[] = []; // 杖に入れていない手持ちの魔法
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  fx: Fx[] = [];
  room!: Room;
  rewardChoices: string[] = [];
  doorOpen = false;
  events: string[] = []; // 描画側へ伝える一度きりのイベント（"hurt" など）
  private nextId = 1;

  constructor(seed = 1) {
    this.rng = makeRng(seed);
    this.wand = structuredClone(STARTER_WAND);
    this.bag = ["ice", "bounce"];
    this.player = {
      pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, hp: 6, maxHp: 6, radius: 0.32,
      aim: { x: 1, z: 0 }, facing: 1, iframes: 0, dash: 0, dashCd: 0, hurt: 0,
      mana: this.wand.manaMax, cursor: 0, castCd: 0, recharging: false,
    };
    this.enterRoom(0);
  }

  // ---------- 部屋 ----------
  enterRoom(index: number) {
    const boss = index === ROOM_COUNT - 1;
    const w = boss ? 8.5 : 7.5, d = boss ? 5.5 : 4.8;
    const pillars: Pillar[] = [];
    if (!boss) {
      const n = this.rng.int(1, 3);
      // 柱は中央の通路（入口〜出口の一直線）をふさがない位置に置く
      for (let k = 0; k < n; k++) pillars.push({ x: this.rng.range(-4, 4), z: this.rng.pick([-1, 1]) * this.rng.range(1.8, 3), hw: 0.5, hd: 0.5 });
    }
    const pool: EnemyType[] = index === 0 ? ["slime"] : index === 1 ? ["slime", "bat"] : ["slime", "bat", "wisp"];
    const waves: EnemyType[][] = boss
      ? [["golem"]]
      : Array.from({ length: index < 2 ? 1 : 2 }, () => Array.from({ length: 3 + index }, () => this.rng.pick(pool)));
    this.room = { index, kind: boss ? "boss" : "combat", w, d, pillars, waves, wave: 0, cleared: false };
    this.enemies = []; this.projectiles = []; this.doorOpen = false;
    this.player.pos = { x: -w + 1.2, z: 0 };
    this.player.vel = { x: 0, z: 0 };
    this.spawnWave();
  }

  private spawnWave() {
    const r = this.room;
    for (const type of r.waves[r.wave]) {
      let pos: Vec;
      let guard = 0;
      do {
        pos = type === "golem" ? { x: 3, z: 0 } : { x: this.rng.range(-r.w + 3, r.w - 1), z: this.rng.range(-r.d + 1, r.d - 1) };
      } while (++guard < 20 && (dist(pos, this.player.pos) < 4 || this.inPillar(pos, 0.6)));
      this.enemies.push(makeEnemy(this.nextId++, type, pos));
    }
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

  private updatePlayer(dt: number, input: Input) {
    const p = this.player, w = this.wand;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.mana = Math.min(w.manaMax, p.mana + w.manaRegen * dt);

    let mv = input.move;
    const len = Math.hypot(mv.x, mv.z);
    if (len > 1) mv = { x: mv.x / len, z: mv.z / len };
    if (input.dash && p.dashCd <= 0 && len > 0.1) {
      p.dash = 0.18; p.dashCd = 0.7; p.iframes = Math.max(p.iframes, 0.25);
      this.fx.push({ kind: "puff", pos: { ...p.pos }, radius: 0.5, color: "#ffffff", t: 0, life: 0.35 });
    }
    const speed = p.dash > 0 ? 13 : 5.2;
    p.dash = Math.max(0, p.dash - dt);
    const tx = mv.x * speed, tz = mv.z * speed;
    const k = Math.min(1, dt * (p.dash > 0 ? 30 : 14));
    p.vel.x += (tx - p.vel.x) * k; p.vel.z += (tz - p.vel.z) * k;
    this.moveCircle(p.pos, p.vel, p.radius, dt);

    if (input.aim && Math.hypot(input.aim.x, input.aim.z) > 0.01) p.aim = norm(input.aim);
    else if (len > 0.1) p.aim = norm(mv);
    if (Math.abs(p.aim.x) > 0.2) p.facing = p.aim.x > 0 ? 1 : -1;

    // 杖
    p.castCd -= dt;
    if (p.castCd <= 0 && p.recharging) { p.recharging = false; }
    if (input.fire && p.castCd <= 0) {
      const res = planCast(w, p.cursor, p.mana);
      if (res.shots.length) {
        p.mana -= res.manaUsed;
        const muzzle = { x: p.pos.x + p.aim.x * 0.5, z: p.pos.z + p.aim.z * 0.5 };
        res.shots.forEach((s, n) => this.fire(s, muzzle, p.aim, "player", (n - (res.shots.length - 1) / 2) * 0.16));
        this.fx.push({ kind: "cast", pos: muzzle, radius: 0.35, color: res.shots[0].stats.color, t: 0, life: 0.15 });
        p.cursor = res.nextCursor;
        p.castCd = res.wrapped ? w.recharge : w.castDelay;
        p.recharging = res.wrapped;
      } else if (res.fizzled) {
        p.castCd = 0.1; // マナ待ち
      } else {
        p.cursor = 0; p.castCd = w.recharge; p.recharging = true;
      }
    }
  }

  fire(shot: Shot, from: Vec, dir: Vec, owner: "player" | "enemy", angleOffset = 0) {
    const s = shot.stats;
    const a = Math.atan2(dir.z, dir.x) + angleOffset + (this.rng.next() - 0.5) * 2 * s.spread;
    this.projectiles.push({
      id: this.nextId++, owner, pos: { ...from }, vel: { x: Math.cos(a) * s.speed, z: Math.sin(a) * s.speed },
      damage: s.damage, radius: s.radius, life: s.life, pierce: s.pierce, bounce: s.bounce, homing: s.homing,
      explode: s.explode, slow: s.slow, color: s.color, payload: shot.payload, hit: new Set(),
    });
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt);
      e.slow = Math.max(0, e.slow - dt);
      const sp = e.speed * (e.slow > 0 ? 0.45 : 1);
      const to = norm({ x: p.pos.x - e.pos.x, z: p.pos.z - e.pos.z });
      if (e.type === "slime") {
        // ぴょんぴょん跳ねて近づく
        const hop = (e.t % 1.1) < 0.45;
        e.vel = hop ? { x: to.x * sp, z: to.z * sp } : { x: e.vel.x * 0.85, z: e.vel.z * 0.85 };
      } else if (e.type === "bat") {
        // 蛇行しながら素早く
        const side = { x: -to.z, z: to.x }, w = Math.sin(e.t * 5 + e.id) * 0.9;
        e.vel = { x: (to.x + side.x * w) * sp, z: (to.z + side.z * w) * sp };
      } else if (e.type === "wisp") {
        // 距離を保って弾を撃つ
        const d = dist(e.pos, p.pos), want = d > 5 ? 1 : d < 3.5 ? -1 : 0;
        const side = { x: -to.z, z: to.x };
        e.vel = { x: (to.x * want + side.x * 0.5) * sp, z: (to.z * want + side.z * 0.5) * sp };
        if (e.t > 1.6) {
          e.t = 0;
          this.fire({ stats: enemyBolt("#7aa2ff", 6), payload: [] }, e.pos, to, "enemy");
        }
      } else if (e.type === "golem") {
        // ボス: ゆっくり歩き、全方位弾と狙い撃ちを交互に
        e.vel = { x: to.x * sp, z: to.z * sp };
        const hpRate = e.hp / e.maxHp;
        const period = hpRate < 0.5 ? 1.4 : 2.0;
        if (e.t > period) {
          e.t = 0; e.phase++;
          if (e.phase % 2) {
            const n = hpRate < 0.5 ? 16 : 12, off = this.rng.next() * Math.PI;
            for (let k = 0; k < n; k++) {
              const a = off + (k / n) * Math.PI * 2;
              this.fire({ stats: enemyBolt("#ffb347", 4.5), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy");
            }
          } else {
            for (let k = -1; k <= 1; k++) this.fire({ stats: enemyBolt("#ff7a7a", 7.5), payload: [] }, e.pos, to, "enemy", k * 0.22);
          }
        }
      }
      this.moveCircle(e.pos, e.vel, e.radius, dt);
      // 接触ダメージ
      if (dist(e.pos, p.pos) < e.radius + p.radius) this.hurtPlayer(1, e.pos);
    }
    // 敵同士の押し合い
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
      // 壁・柱
      if (!dead && this.hitWall(pr)) {
        if (pr.bounce > 0) pr.bounce--;
        else dead = true;
      }
      // 当たり判定
      if (!dead) {
        if (pr.owner === "player") {
          for (const e of this.enemies) {
            if (pr.hit.has(e.id) || dist(e.pos, pr.pos) > e.radius + pr.radius) continue;
            pr.hit.add(e.id);
            if (pr.explode <= 0) this.damageEnemy(e, pr.damage, pr.slow);
            this.fx.push({ kind: "hit", pos: { ...pr.pos }, radius: 0.4, color: pr.color, t: 0, life: 0.2 });
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
    this.fx.push({ kind: "boom", pos: { ...pr.pos }, radius: pr.explode, color: pr.color, t: 0, life: 0.4 });
    for (const e of this.enemies) {
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
      // 右の扉に入ったら次の部屋
      if (this.doorOpen && this.player.pos.x > r.w - 0.6 && Math.abs(this.player.pos.z) < 1.0) this.enterRoom(r.index + 1);
      return;
    }
    if (this.enemies.length) return;
    if (r.wave + 1 < r.waves.length) { r.wave++; this.spawnWave(); return; }
    r.cleared = true;
    this.projectiles = this.projectiles.filter((p) => p.owner === "player");
    if (r.kind === "boss") { this.phase = "win"; this.events.push("win"); return; }
    this.rewardChoices = pickN(this.rng, SPELL_IDS, 3);
    this.phase = "reward";
    this.events.push("clear");
  }

  /** 報酬を受け取る（手持ちに加える）。null なら受け取らない。 */
  takeReward(id: string | null) {
    if (this.phase !== "reward") return;
    if (id) this.bag.push(id);
    this.rewardChoices = [];
    this.phase = "play";
    this.doorOpen = true;
  }

  /** 杖のスロットと手持ちを入れ替える。 */
  swap(slotIndex: number, bagIndex: number | null) {
    const cur = this.wand.slots[slotIndex];
    if (bagIndex === null) { if (cur) this.bag.push(cur); this.wand.slots[slotIndex] = null; }
    else { const take = this.bag[bagIndex]; this.bag.splice(bagIndex, 1); if (cur) this.bag.push(cur); this.wand.slots[slotIndex] = take; }
    this.player.cursor = 0;
  }

  // ---------- 補助 ----------
  private nearestEnemy(pos: Vec, maxD: number) {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) { const d = dist(e.pos, pos); if (d < bd) { bd = d; best = e; } }
    return best;
  }

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

  /** 円を動かし、部屋の壁と柱で止める（扉が開いていれば右壁の出口だけ抜けられる）。 */
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
  const t: Record<EnemyType, [number, number, number]> = { slime: [16, 0.42, 3.2], bat: [10, 0.32, 4.4], wisp: [14, 0.38, 2.4], golem: [420, 1.0, 1.3] };
  const [hp, radius, speed] = t[type];
  return { id, type, pos: { ...pos }, vel: { x: 0, z: 0 }, hp, maxHp: hp, radius, speed, slow: 0, hurt: 0, t: (id * 0.37) % 1, phase: 0 };
}

const enemyBolt = (color: string, speed: number) => ({
  damage: 1, speed, radius: 0.16, life: 4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.03, color,
});

function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const a = [...arr], out: T[] = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng.next() * a.length), 1)[0]);
  return out;
}
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
