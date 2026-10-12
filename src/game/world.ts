// ゲームの状態と1フレームの更新。描画・入力・DOM には依存しない（x,z の2D平面で計算）。
//
// 物語: ママは虫が大の苦手。家に入りこんだ虫を、猫がおもちゃで追い払う。
// 構成（Magicraft 風）: 季節ごとの「章」= 部屋4つ＋ボス。部屋を片付けると出口が2〜3個開き、
// 扉の上のアイコンで「次の部屋をクリアしたときのごほうび」を選んで進む。
import { planCast, starterToy, TOYS, type Shot, type ToyDef } from "../core/wand";
import { SPELL_IDS, type Element, type Motion, type TechFx } from "../core/spells";
import { makeRng, type Rng } from "../core/rng";
import {
  BOSS_TEMPLATE, buildLayout, Cell, cellAt, cellCenter, cellValue, SEASON_NAME, SEASONS, TEMPLATES, THEME_NAME, THEMES,
  type Layout, type Season, type Theme,
} from "./stage";

export interface Vec { x: number; z: number }

/** ゴキブリ（立ち止まっては走る）・蚊（ふらふら飛ぶ）・クモ（離れて糸を飛ばす）・スズメバチ（ボス）。 */
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
  /** 属性の残り秒: びしょぬれ・ねばねば・虫よけ。 */
  wet: number;
  sticky: number;
  repel: number;
  repelDps: number;
  repelTick: number;
  /** はじき飛ばされている勢い。 */
  push: Vec;
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
  motion: Motion;
  hits: number;
  hitEvery: number;
  reach: number;
  element: Element;
  knock: number;
  /** 出てからの秒数と、最初の寿命。 */
  t: number;
  life0: number;
  /** ビーム・衝撃波の起点。 */
  origin: Vec;
  /** 回る技の角度と角速度。 */
  ang: number;
  angVel: number;
  /** 向き（連打・ビームの方向）。 */
  dir: Vec;
  /** 虫ごとの当たった回数と、次に当たれる時刻（多段）。 */
  hitLog: Map<number, { n: number; next: number }>;
  payloadDone: boolean;
}

/** 当たったときの性質（遅れて当たる多段にも使う）。 */
interface HitInfo { slow: number; element: Element; tech: TechFx; color: string; knock: number }

export interface Fx { kind: "hit" | "cast" | "puff" | "tech" | "num" | "zap"; tech?: TechFx; value?: number; pos: Vec; to?: Vec; radius: number; color: string; t: number; life: number }

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
  target: number | null;
  /** ねこジャンプの残り秒（見た目用）。 */
  pounce: number;
}

/** 扉のごほうび。部屋をクリアすると受け取れる。 */
export type RewardKind = "hp" | "mp" | "spell" | "toy" | "boss" | "next";
export const REWARD_INFO: Record<RewardKind, { icon: string; label: string; color: string }> = {
  hp: { icon: "♥", label: "最大HP アップ", color: "#ff5f7e" },
  mp: { icon: "⚡", label: "やる気 アップ", color: "#3fa7ff" },
  spell: { icon: "★", label: "技・修飾をもらう", color: "#ffb52e" },
  toy: { icon: "🧸", label: "おもちゃをもらう", color: "#c77dff" },
  boss: { icon: "☠", label: "ボス", color: "#e03131" },
  next: { icon: "➜", label: "次の季節へ", color: "#2f9e44" },
};

export interface Door { slot: number; pos: Vec; dir: "up" | "down" | "left" | "right"; reward: RewardKind }

export interface Room {
  act: number; // 0..3（季節）
  index: number; // 章の中で 0..ROOMS_PER_ACT（最後がボス）
  season: Season;
  theme: Theme;
  kind: "combat" | "boss";
  layout: Layout;
  w: number; // 半幅（カメラ用）
  d: number;
  waves: EnemyType[][];
  wave: number;
  cleared: boolean;
  /** この部屋をクリアしたときのごほうび（入ってきた扉で決まる）。 */
  reward: RewardKind | null;
  doors: Door[];
}

export type Phase = "intro" | "play" | "reward" | "dead" | "win";

export type Choice = { kind: "spell"; id: string } | { kind: "toy"; id: string };

export interface Input {
  move: Vec;
  /** 狙う方向（null なら一番近い虫を自動で狙う）。 */
  aim: Vec | null;
  fire: boolean;
  dash: boolean;
}

export const ROOMS_PER_ACT = 4; // ＋ボス
export const ACTS = SEASONS.length;

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
  choices: Choice[] = [];
  doorOpen = false;
  events: string[] = [];
  /** 一度だけ出す短いお知らせ（「最大HP +1」など）。 */
  toast: { text: string; t: number } | null = null;
  private nextId = 1;
  private usedThemes: Theme[] = [];
  /** 虫が猫へ向かう道順（地面用・飛ぶ虫用）。猫のいるマスが変わったら作り直す。 */
  private flow: { ground: Int16Array; air: Int16Array; key: number } | null = null;

  constructor(seed = 1) {
    this.rng = makeRng(seed);
    this.toy = starterToy();
    this.bag = ["swing", "water", "static"];
    this.player = {
      pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, hp: 6, maxHp: 6, radius: 0.32,
      aim: { x: 1, z: 0 }, facing: 1, iframes: 0, dash: 0, dashCd: 0, hurt: 0,
      mana: this.toy.manaMax, cursor: 0, castCd: 0, recharging: false, target: null, pounce: 0,
    };
    this.enterRoom(0, 0, null);
  }

  start() { if (this.phase === "intro") this.phase = "play"; }

  get title() {
    const r = this.room;
    return `${SEASON_NAME[r.season]}・${r.kind === "boss" ? "ボス" : `${THEME_NAME[r.theme]} ${r.index + 1}/${ROOMS_PER_ACT}`}`;
  }

  // ---------- 部屋 ----------
  enterRoom(act: number, index: number, reward: RewardKind | null) {
    const boss = index === ROOMS_PER_ACT;
    const season = SEASONS[act];
    if (index === 0) this.usedThemes = [];
    let theme: Theme;
    if (boss) theme = "garden";
    else {
      const left = THEMES.filter((t) => !this.usedThemes.includes(t));
      theme = this.rng.pick(left.length ? left : THEMES);
      this.usedThemes.push(theme);
    }
    // 出口の数: 2〜3（ボス直前は1つ＝ボス）
    const slots = [1, 2, 3].sort(() => this.rng.next() - 0.5);
    const doorSlots = boss ? [1] : index === ROOMS_PER_ACT - 1 ? [slots[0]] : slots.slice(0, this.rng.next() < 0.5 ? 2 : 3);
    const tpl = boss ? BOSS_TEMPLATE : TEMPLATES[this.rng.pick(Object.keys(TEMPLATES))];
    const layout = buildLayout(tpl, theme, this.rng, { flipX: false, flipY: !boss && this.rng.next() < 0.5, doors: doorSlots });

    // 敵の組み合わせ（章が進むほど多く・強く）
    const pool: EnemyType[] = act === 0 && index === 0 ? ["roach"] : act === 0 && index === 1 ? ["roach", "mosquito"] : ["roach", "mosquito", "spider"];
    const waveCount = boss ? 1 : index < 2 && act === 0 ? 1 : 2;
    const waves: EnemyType[][] = boss
      ? [["hornet"]]
      : Array.from({ length: waveCount }, () => Array.from({ length: 3 + index + act }, () => this.rng.pick(pool)));

    // 次の扉のごほうび（重ならないように）
    const kinds: RewardKind[] = ["hp", "mp", "spell", "spell", "toy"];
    const used = new Set<RewardKind>();
    const doors: Door[] = layout.exits.map((e) => {
      let k: RewardKind;
      if (boss) k = "next";
      else if (index === ROOMS_PER_ACT - 1) k = "boss";
      else { do k = this.rng.pick(kinds); while (used.has(k) && used.size < 4); used.add(k); }
      return { slot: e.slot, pos: cellCenter(layout, e.c, e.r), dir: e.dir, reward: k };
    });

    this.room = {
      act, index, season, theme, kind: boss ? "boss" : "combat", layout,
      w: layout.cols / 2, d: layout.rows / 2, waves, wave: 0, cleared: false, reward, doors,
    };
    this.enemies = []; this.projectiles = []; this.doorOpen = false; this.flow = null;
    this.player.pos = cellCenter(layout, layout.entry.c, layout.entry.r);
    this.player.vel = { x: 0, z: 0 };
    this.spawnWave();
  }

  private spawnWave() {
    const r = this.room, L = r.layout;
    const floors: Vec[] = [];
    for (let rr = 1; rr < L.rows - 1; rr++) for (let c = 1; c < L.cols - 1; c++) if (cellValue(L, c, rr) === Cell.Floor) floors.push(cellCenter(L, c, rr));
    const far = floors.filter((p) => dist(p, this.player.pos) > 7);
    r.waves[r.wave].forEach((type, k) => {
      const pos = type === "hornet" ? cellCenter(L, L.cols - 5, L.rows >> 1) : this.rng.pick(far.length ? far : floors);
      const e = makeEnemy(this.nextId++, type, pos, r.act);
      e.spawn = 1.0 + k * 0.25;
      this.enemies.push(e);
    });
  }

  // ---------- 1フレーム ----------
  update(dt: number, input: Input) {
    this.events = [];
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
    if (this.phase !== "play") { this.updateFx(dt); return; }
    this.time += dt;
    this.updatePlayer(dt, input);
    this.updateFlow();
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
    p.pounce = Math.max(0, p.pounce - dt);
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
    this.moveCircle(p.pos, p.vel, p.radius, dt, false, true);

    // 狙い: 指定があればその方向、なければ一番近い虫
    const t = this.nearestEnemy(p.pos, 16);
    p.target = input.aim ? null : t?.id ?? null;
    if (input.aim && Math.hypot(input.aim.x, input.aim.z) > 0.01) p.aim = norm(input.aim);
    else if (t) p.aim = norm({ x: t.pos.x - p.pos.x, z: t.pos.z - p.pos.z });
    else if (len > 0.1) p.aim = norm(mv);
    // 向き: 攻撃中は狙う方向、それ以外は歩く方向（小さな揺れで反転しないよう、はっきり横向きのときだけ）
    const look = input.fire ? p.aim.x : mv.x;
    if (Math.abs(look) > 0.35) p.facing = look > 0 ? 1 : -1;

    // おもちゃを振る
    p.castCd -= dt;
    if (p.castCd <= 0 && p.recharging) p.recharging = false;
    if (input.fire && p.castCd <= 0) {
      const res = planCast(toy, p.cursor, p.mana);
      if (res.shots.length) {
        p.mana -= res.manaUsed;
        const L = this.room.layout, front = { x: p.pos.x + p.aim.x * 0.5, z: p.pos.z + p.aim.z * 0.5 }, fc = cellAt(L, front.x, front.z);
        const muzzle = cellValue(L, fc.c, fc.r) === Cell.Floor ? front : { ...p.pos }; // 家具にくっついていても撃てる
        res.shots.forEach((s, n) => {
          const k = res.shots.length;
          // 回る技は円周に等間隔、ほかは扇状に少しずらす
          const off = s.stats.motion === "orbit" ? (n / k) * Math.PI * 2 : (n - (k - 1) / 2) * 0.16;
          this.fire(s, s.stats.motion === "shot" ? muzzle : p.pos, p.aim, "player", off);
          if (s.stats.motion === "ring") p.pounce = 0.4;
        });
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

    // 開いた扉に入ったら次の部屋へ
    if (this.doorOpen) for (const d of this.room.doors) if (dist(p.pos, d.pos) < 0.7) { this.goThrough(d); break; }
  }

  private goThrough(d: Door) {
    const r = this.room;
    if (r.kind === "boss") {
      if (r.act + 1 >= ACTS) { this.phase = "win"; this.events.push("win"); return; }
      this.enterRoom(r.act + 1, 0, null);
    } else this.enterRoom(r.act, r.index + 1, d.reward === "boss" ? null : d.reward);
  }

  fire(shot: Shot, from: Vec, dir: Vec, owner: "player" | "enemy", angleOffset = 0) {
    const s = shot.stats, L = this.room.layout;
    const a = Math.atan2(dir.z, dir.x) + (s.motion === "orbit" ? 0 : angleOffset) + (this.rng.next() - 0.5) * 2 * s.spread;
    const d = { x: Math.cos(a), z: Math.sin(a) };
    const pr: Projectile = {
      id: this.nextId++, owner, pos: { ...from }, vel: { x: d.x * s.speed, z: d.z * s.speed },
      damage: s.damage, radius: s.radius, life: s.life, pierce: s.pierce, bounce: s.bounce, homing: s.homing,
      explode: s.explode, slow: s.slow, color: s.color, tech: s.tech, payload: shot.payload,
      motion: s.motion, hits: s.hits, hitEvery: s.hitEvery, reach: s.reach, element: s.element, knock: s.knock,
      t: 0, life0: s.life, origin: { ...from }, ang: a + angleOffset, angVel: s.speed, dir: d, hitLog: new Map(), payloadDone: false,
    };
    if (s.motion === "orbit") { pr.vel = { x: 0, z: 0 }; pr.pos = { x: from.x + Math.cos(pr.ang) * s.reach, z: from.z + Math.sin(pr.ang) * s.reach }; }
    if (s.motion === "ring" || s.motion === "melee") pr.vel = { x: 0, z: 0 };
    if (s.motion === "beam" && s.speed === 0) {
      // 一瞬で届くビーム: 壁・家具に当たるところまで
      pr.vel = { x: 0, z: 0 };
      let t = 0;
      while (t < s.reach) { const c = cellAt(L, from.x + d.x * (t + 0.1), from.z + d.z * (t + 0.1)); if (cellValue(L, c.c, c.r) !== Cell.Floor) break; t += 0.1; }
      pr.pos = { x: from.x + d.x * t, z: from.z + d.z * t };
    }
    if (s.motion === "trap") {
      pr.vel = { x: 0, z: 0 };
      const ahead = { x: from.x + d.x * s.reach, z: from.z + d.z * s.reach }, c = cellAt(L, ahead.x, ahead.z);
      pr.pos = cellValue(L, c.c, c.r) === Cell.Floor ? ahead : { ...from };
      const traps = this.projectiles.filter((q) => q.motion === "trap");
      if (traps.length >= 4) this.projectiles = this.projectiles.filter((q) => q !== traps[0]);
    }
    this.projectiles.push(pr);
  }

  // ---------- 虫 ----------
  private updateFlow() {
    const L = this.room.layout, pc = cellAt(L, this.player.pos.x, this.player.pos.z), key = pc.r * L.cols + pc.c;
    if (this.flow?.key === key) return;
    const bfs = (pass: (v: Cell) => boolean) => {
      const d = new Int16Array(L.cols * L.rows).fill(-1), q = [key]; d[key] = 0;
      for (let i = 0; i < q.length; i++) {
        const k = q[i], c = k % L.cols, r = (k / L.cols) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = (r + dr) * L.cols + c + dc;
          if (d[nk] >= 0 || !pass(cellValue(L, c + dc, r + dr))) continue;
          d[nk] = d[k] + 1; q.push(nk);
        }
      }
      return d;
    };
    this.flow = { key, ground: bfs((v) => v === Cell.Floor), air: bfs((v) => v === Cell.Floor || v === Cell.Prop) };
  }

  /** 道順に沿って猫へ向かう方向（近ければ直進）。 */
  private chase(e: Enemy, flying: boolean): Vec {
    const p = this.player.pos, L = this.room.layout;
    const direct = norm({ x: p.x - e.pos.x, z: p.z - e.pos.z });
    if (!this.flow || dist(e.pos, p) < 1.6) return direct;
    const field = flying ? this.flow.air : this.flow.ground;
    const ec = cellAt(L, e.pos.x, e.pos.z);
    const here = field[ec.r * L.cols + ec.c];
    let best: Vec | null = null, bd = here < 0 ? 1e9 : here;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const c = ec.c + dc, r = ec.r + dr;
      if (c < 0 || r < 0 || c >= L.cols || r >= L.rows) continue;
      const v = field[r * L.cols + c];
      if (v < 0) continue;
      if (dc && dr && (field[ec.r * L.cols + c] < 0 || field[r * L.cols + ec.c] < 0)) continue; // 角は切らない
      if (v < bd) { bd = v; const t = cellCenter(L, c, r); best = { x: t.x - e.pos.x, z: t.z - e.pos.z }; }
    }
    return best ? norm(best) : direct;
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.spawn > 0) { e.spawn = Math.max(0, e.spawn - dt); continue; }
      e.t += dt;
      e.hurt = Math.max(0, e.hurt - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.wet = Math.max(0, e.wet - dt);
      e.sticky = Math.max(0, e.sticky - dt);
      if (e.repel > 0) {
        e.repel -= dt; e.repelTick -= dt;
        if (e.repelTick <= 0) { e.repelTick = 0.5; this.damageEnemy(e, e.repelDps * 0.5 * (e.sticky > 0 ? 2 : 1), 0, "#7bd96a"); }
      }
      const sp = e.speed * (e.slow > 0 ? 0.45 : 1) * (e.wet > 0 ? 0.7 : 1) * (e.sticky > 0 ? (e.type === "hornet" ? 0.35 : 0) : 1);
      const flying = e.type === "mosquito" || e.type === "hornet";
      const to = this.chase(e, flying);
      const direct = norm({ x: p.pos.x - e.pos.x, z: p.pos.z - e.pos.z });
      if (e.type === "roach") {
        const run = (e.t % 1.4) < 0.6;
        e.vel = run ? { x: to.x * sp, z: to.z * sp } : { x: e.vel.x * 0.8, z: e.vel.z * 0.8 };
      } else if (e.type === "mosquito") {
        const side = { x: -to.z, z: to.x }, w = Math.sin(e.t * 4 + e.id) * 0.9;
        e.vel = { x: (to.x + side.x * w) * sp, z: (to.z + side.z * w) * sp };
      } else if (e.type === "spider") {
        const d = dist(e.pos, p.pos), want = d > 6 ? 1 : d < 4 ? -1 : 0;
        const side = { x: -direct.z, z: direct.x };
        const mv = want > 0 ? to : { x: direct.x * want, z: direct.z * want };
        e.vel = { x: (mv.x + side.x * 0.4) * sp, z: (mv.z + side.z * 0.4) * sp };
        if (e.t > 2.0) { e.t = 0; this.fire({ stats: enemyShot("#d8d8e8", 5.5), payload: [] }, e.pos, direct, "enemy"); }
      } else if (e.type === "hornet") {
        e.vel = { x: to.x * sp, z: to.z * sp };
        const hpRate = e.hp / e.maxHp, period = (hpRate < 0.5 ? 1.5 : 2.1) - this.room.act * 0.12;
        if (e.t > period) {
          e.t = 0; e.phase++;
          if (e.phase % 2) {
            const n = (hpRate < 0.5 ? 14 : 10) + this.room.act * 2, off = this.rng.next() * Math.PI;
            for (let k = 0; k < n; k++) {
              const a = off + (k / n) * Math.PI * 2;
              this.fire({ stats: enemyShot("#ffcf33", 4.2), payload: [] }, e.pos, { x: Math.cos(a), z: Math.sin(a) }, "enemy");
            }
          } else {
            for (let k = -1; k <= 1; k++) this.fire({ stats: enemyShot("#ff7a3d", 6.5), payload: [] }, e.pos, direct, "enemy", k * 0.22);
          }
        }
      }
      const k = Math.exp(-7 * dt);
      this.moveCircle(e.pos, { x: e.vel.x + e.push.x, z: e.vel.z + e.push.z }, e.radius, dt, flying, false);
      e.push.x *= k; e.push.z *= k;
      if (dist(e.pos, p.pos) < e.radius + p.radius) this.hurtPlayer(1, e.pos);
    }
    for (let a = 0; a < this.enemies.length; a++) for (let b = a + 1; b < this.enemies.length; b++) {
      const A = this.enemies[a], B = this.enemies[b];
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz), m = A.radius + B.radius;
      if (d > 0 && d < m) {
        const k = (m - d) / d / 2; A.pos.x -= dx * k; A.pos.z -= dz * k; B.pos.x += dx * k; B.pos.z += dz * k;
        for (const E of [A, B]) this.moveCircle(E.pos, ZERO, E.radius, 0, E.type === "mosquito" || E.type === "hornet", false);
      }
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

  // ---------- 弾 ----------
  /** 多段で遅れて当たる分。 */
  private later: { t: number; eid: number; dmg: number; info: HitInfo; dir: Vec }[] = [];

  private updateProjectiles(dt: number) {
    const keep: Projectile[] = [];
    const spawned: { shot: Shot; pos: Vec; dir: Vec }[] = [];
    const L = this.room.layout, p = this.player;
    const blocks = (x: number, z: number) => { const c = cellAt(L, x, z), v = cellValue(L, c.c, c.r); return v !== Cell.Floor; };

    this.later = this.later.filter((h) => {
      h.t -= dt; if (h.t > 0) return true;
      const e = this.enemies.find((q) => q.id === h.eid);
      if (e && e.hp > 0) this.hitEnemy(e, h.dmg, h.info, h.dir);
      return false;
    });

    for (const pr of this.projectiles) {
      pr.life -= dt; pr.t += dt;
      const ox = pr.pos.x, oz = pr.pos.z;
      // 動き
      if (pr.motion === "orbit") {
        pr.ang += pr.angVel * dt;
        pr.pos = { x: p.pos.x + Math.cos(pr.ang) * pr.reach, z: p.pos.z + Math.sin(pr.ang) * pr.reach };
      } else if (pr.motion === "melee") {
        pr.pos = { x: p.pos.x + pr.dir.x * pr.reach * 0.55, z: p.pos.z + pr.dir.z * pr.reach * 0.55 };
      } else if (pr.motion === "shot" || pr.motion === "beam") {
        if (pr.homing > 0 && pr.owner === "player" && pr.motion === "shot") {
          const t = this.nearestEnemy(pr.pos, 7);
          if (t) {
            const want = norm({ x: t.pos.x - pr.pos.x, z: t.pos.z - pr.pos.z }), sp = Math.hypot(pr.vel.x, pr.vel.z);
            const k = Math.min(1, pr.homing * dt * 6), cur = norm(pr.vel);
            const nd = norm({ x: cur.x + (want.x - cur.x) * k, z: cur.z + (want.z - cur.z) * k });
            pr.vel = { x: nd.x * sp, z: nd.z * sp };
          }
        }
        pr.pos.x += pr.vel.x * dt; pr.pos.z += pr.vel.z * dt;
      }
      let dead = pr.life <= 0;

      if (!dead && pr.owner === "enemy") {
        if (dist(p.pos, pr.pos) < p.radius + pr.radius * 0.8) { this.hurtPlayer(1, pr.pos); dead = true; }
      } else if (!dead) {
        const info: HitInfo = { slow: pr.slow, element: pr.element, tech: pr.tech, color: pr.color, knock: pr.knock };
        const R = pr.motion === "ring" ? pr.reach * Math.min(1, pr.t / (pr.life0 * 0.75)) : 0;
        for (const e of this.enemies) {
          if (e.spawn > 0 || e.hp <= 0) continue;
          const rec = pr.hitLog.get(e.id);
          if (rec && (rec.n >= pr.hits || pr.t < rec.next || pr.motion === "shot")) continue;
          let touch = false, push: Vec = pr.dir;
          switch (pr.motion) {
            case "shot": touch = segDist(e.pos, ox, oz, pr.pos) <= e.radius + pr.radius; push = norm(pr.vel); break; // 速い弾が通り抜けないよう線分で判定
            case "orbit": touch = segDist(e.pos, ox, oz, pr.pos) <= e.radius + pr.radius; push = norm({ x: e.pos.x - p.pos.x, z: e.pos.z - p.pos.z }); break;
            case "beam": touch = segDist(e.pos, pr.origin.x, pr.origin.z, pr.pos) <= e.radius + pr.radius; break;
            case "ring": { const d = dist(e.pos, pr.origin); touch = d <= R + e.radius && d >= R - e.radius - 0.6; push = norm({ x: e.pos.x - pr.origin.x, z: e.pos.z - pr.origin.z }); break; }
            case "melee": touch = dist(e.pos, pr.pos) <= pr.reach * 0.55 + e.radius; break;
            case "trap": touch = dist(e.pos, pr.pos) <= pr.radius + e.radius; push = { x: 0, z: 0 }; break;
          }
          if (!touch) continue;
          pr.hitLog.set(e.id, { n: (rec?.n ?? 0) + (pr.motion === "shot" ? pr.hits : 1), next: pr.t + pr.hitEvery });
          if (pr.explode <= 0) this.hitEnemy(e, pr.damage, info, push);
          if (pr.motion === "shot") {
            for (let k = 1; k < pr.hits; k++) this.later.push({ t: k * pr.hitEvery, eid: e.id, dmg: pr.damage, info, dir: push }); // かじかじ: 食い込んで削る
            if (pr.payload.length) for (const s of pr.payload) spawned.push({ shot: s, pos: { ...pr.pos }, dir: norm(pr.vel) });
            if (pr.pierce > 0) pr.pierce--; else { dead = true; break; }
          } else if (!pr.payloadDone && pr.payload.length) {
            pr.payloadDone = true;
            for (const s of pr.payload) spawned.push({ shot: s, pos: { ...e.pos }, dir: pr.dir });
          }
        }
      }
      // 壁・家具（虫に当たる判定のあと。壁ぎわの虫にも当たるように）
      if (!dead && (pr.motion === "shot" || pr.motion === "beam") && (pr.vel.x || pr.vel.z) && blocks(pr.pos.x, pr.pos.z)) {
        if (pr.motion === "beam") { pr.pos.x = ox; pr.pos.z = oz; pr.vel = { x: 0, z: 0 }; }   // 毛糸玉は壁で止まる（糸は残る）
        else if (pr.bounce > 0) {
          pr.bounce--;
          const hx = blocks(pr.pos.x, oz), hz = blocks(ox, pr.pos.z);
          if (hx || !hz) pr.vel.x *= -1;
          if (hz || !hx) pr.vel.z *= -1;
          pr.pos.x = ox; pr.pos.z = oz;
        } else dead = true;
      }
      if (dead) {
        if (pr.owner === "player" && pr.explode > 0) this.explode(pr);
        if (pr.owner === "player" && pr.payload.length && pr.hitLog.size === 0 && pr.motion === "shot")
          for (const s of pr.payload) spawned.push({ shot: s, pos: { x: ox, z: oz }, dir: norm(pr.vel) });
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
    const info: HitInfo = { slow: pr.slow, element: pr.element, tech: pr.tech, color: pr.color, knock: pr.knock };
    for (const e of this.enemies) {
      if (e.spawn > 0) continue;
      const d = dist(e.pos, pr.pos);
      if (d < pr.explode + e.radius) this.hitEnemy(e, pr.damage * (1 - 0.4 * Math.min(1, d / pr.explode)), info, norm({ x: e.pos.x - pr.pos.x, z: e.pos.z - pr.pos.z }), false);
    }
  }

  /** 技が虫に当たった: ダメージ・属性・はじき飛ばし。 */
  private hitEnemy(e: Enemy, dmg: number, h: HitInfo, dir: Vec, mark = true) {
    if (h.element === "static" && e.wet > 0) dmg *= 2;
    this.damageEnemy(e, dmg, h.slow);
    if (mark) this.fx.push({ kind: "tech", tech: h.tech, pos: { ...e.pos }, radius: 0.55, color: h.color, t: 0, life: 0.3 });
    if (h.knock) { const k = h.knock * (e.type === "hornet" ? 0.15 : 1); e.push.x += dir.x * k; e.push.z += dir.z * k; }
    switch (h.element) {
      case "wet": e.wet = 4; break;
      case "sticky": e.sticky = e.type === "hornet" ? 0.6 : 1.6; break;
      case "repel": e.repelDps = Math.max(e.repel > 0 ? e.repelDps : 0, 2 + dmg * 0.4); e.repel = 3; break;
      case "static": {
        // 近くの虫へ飛び移る（びしょぬれなら2倍・4匹）
        const n = e.wet > 0 ? 4 : 2;
        const near = this.enemies.filter((q) => q !== e && q.spawn <= 0 && q.hp > 0 && dist(q.pos, e.pos) < 3.5)
          .sort((a, b) => dist(a.pos, e.pos) - dist(b.pos, e.pos)).slice(0, n);
        for (const q of near) {
          this.damageEnemy(q, dmg * 0.45 * (q.wet > 0 ? 2 : 1), 0, "#ffe066");
          this.fx.push({ kind: "zap", pos: { ...e.pos }, to: { ...q.pos }, radius: 0.1, color: "#ffe066", t: 0, life: 0.25 });
        }
        break;
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number, slow: number, color = "#ffffff") {
    e.hp -= dmg; e.hurt = 0.15;
    if (slow > 0) e.slow = Math.max(e.slow, slow);
    this.fx.push({ kind: "num", value: Math.max(1, Math.round(dmg)), pos: { x: e.pos.x, z: e.pos.z }, radius: 0.5, color, t: 0, life: 0.7 });
  }

  private updateFx(dt: number) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  // ---------- クリアとごほうび ----------
  private checkRoom() {
    const r = this.room;
    if (r.cleared || this.enemies.length) return;
    if (r.wave + 1 < r.waves.length) { r.wave++; this.spawnWave(); return; }
    r.cleared = true;
    this.projectiles = this.projectiles.filter((p) => p.owner === "player");
    this.events.push("clear");
    const p = this.player;
    if (r.kind === "boss") { p.hp = p.maxHp; this.offer("spell"); return; }
    const reward = r.reward;
    if (reward === "hp") { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); this.notify("最大HP ＋1♥"); }
    else if (reward === "mp") { this.toy.manaMax += 20; this.toy.manaRegen += 4; p.mana = this.toy.manaMax; this.notify("やる気 最大＋20・回復＋4"); }
    else if (reward === "spell" || reward === "toy") { this.offer(reward); return; }
    this.doorOpen = true;
  }

  private offer(kind: "spell" | "toy") {
    if (kind === "toy") {
      const toys = Object.keys(TOYS).filter((t) => t !== this.toy.id);
      this.choices = toys.map((id): Choice => ({ kind: "toy", id }));
    } else this.choices = pickN(this.rng, SPELL_IDS, 3).map((id): Choice => ({ kind: "spell", id }));
    this.phase = "reward";
  }

  private notify(text: string) { this.toast = { text, t: 2.2 }; }

  /** ごほうびを受け取る。null なら受け取らない。 */
  takeReward(c: Choice | null) {
    if (this.phase !== "reward") return;
    if (c?.kind === "spell") this.bag.push(c.id);
    if (c?.kind === "toy") this.equipToy(c.id);
    this.choices = [];
    this.phase = "play";
    this.doorOpen = true;
  }

  /** おもちゃを持ち替える。はめていた技は左から詰め直し、あふれた分は手持ちへ。やる気アップは引き継ぐ。 */
  equipToy(id: string) {
    const old = this.toy.slots.filter((s): s is string => !!s);
    const base = TOYS[this.toy.id];
    const bonusMax = this.toy.manaMax - base.manaMax, bonusRegen = this.toy.manaRegen - base.manaRegen;
    const t = structuredClone(TOYS[id]);
    t.manaMax += bonusMax; t.manaRegen += bonusRegen;
    t.slots = t.slots.map((_, i) => old[i] ?? null);
    this.bag.push(...old.slice(t.slots.length));
    this.toy = t;
    this.player.cursor = 0;
    this.player.mana = Math.min(this.player.mana, t.manaMax);
  }

  /** 置き場所どうしで入れ替える（スロット⇔スロット、スロット⇔手持ち、手持ち⇔手持ち）。 */
  move(from: { where: "slot" | "bag"; i: number }, to: { where: "slot" | "bag"; i: number }) {
    const get = (p: typeof from) => (p.where === "slot" ? this.toy.slots[p.i] : this.bag[p.i]) ?? null;
    const set = (p: typeof from, v: string | null) => { if (p.where === "slot") this.toy.slots[p.i] = v; else this.bag[p.i] = v as string; };
    const a = get(from), b = get(to);
    set(from, b); set(to, a);
    this.bag = this.bag.filter(Boolean);
    this.player.cursor = 0;
  }

  // ---------- 当たり判定 ----------
  /** 円を動かし、壁・家具（飛ぶ虫は家具を越える）・閉じた扉で止める。 */
  private moveCircle(pos: Vec, vel: Vec, r: number, dt: number, flying: boolean, player: boolean) {
    const L = this.room.layout;
    const solid = (c: number, rr: number) => {
      const v = cellValue(L, c, rr);
      if (v === Cell.Wall) return true;
      if (v === Cell.Prop) return !flying;
      if (v === Cell.Door) return !(player && this.doorOpen);
      return false;
    };
    for (const axis of ["x", "z"] as const) {
      pos[axis] += vel[axis] * dt;
      const c0 = Math.floor(pos.x - r + L.cols / 2), c1 = Math.floor(pos.x + r + L.cols / 2);
      const r0 = Math.floor(pos.z - r + L.rows / 2), r1 = Math.floor(pos.z + r + L.rows / 2);
      for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) {
        if (!solid(c, rr)) continue;
        const cx = c - L.cols / 2, cz = rr - L.rows / 2;  // マスの左上
        const nx = Math.max(cx, Math.min(pos.x, cx + 1)), nz = Math.max(cz, Math.min(pos.z, cz + 1));
        const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 0) { pos.x += (dx / d) * (r - d); pos.z += (dz / d) * (r - d); continue; }
        // 中心がマスの中に入り込んだ（押し合いなど）: 一番近い辺から外へ出す
        const out = [pos.x - cx, cx + 1 - pos.x, pos.z - cz, cz + 1 - pos.z];
        const k = out.indexOf(Math.min(...out));
        if (k === 0) pos.x = cx - r; else if (k === 1) pos.x = cx + 1 + r; else if (k === 2) pos.z = cz - r; else pos.z = cz + 1 + r;
      }
    }
  }
}

const ZERO: Vec = { x: 0, z: 0 };

/** 点 q と線分 (ax,az)-b の距離。 */
function segDist(q: Vec, ax: number, az: number, b: Vec) {
  const vx = b.x - ax, vz = b.z - az, l2 = vx * vx + vz * vz;
  const t = l2 ? Math.max(0, Math.min(1, ((q.x - ax) * vx + (q.z - az) * vz) / l2)) : 0;
  return Math.hypot(q.x - (ax + vx * t), q.z - (az + vz * t));
}

function makeEnemy(id: number, type: EnemyType, pos: Vec, act: number): Enemy {
  const t: Record<EnemyType, [number, number, number]> = { roach: [16, 0.4, 3.0], mosquito: [9, 0.3, 2.8], spider: [14, 0.42, 2.2], hornet: [380, 1.0, 1.2] };
  const [hp0, radius, speed] = t[type];
  const hp = Math.round(hp0 * (1 + act * (type === "hornet" ? 0.8 : 0.6)));
  return { id, type, pos: { ...pos }, vel: { x: 0, z: 0 }, hp, maxHp: hp, radius, speed: speed * (1 + act * 0.06), slow: 0, hurt: 0, t: (id * 0.37) % 1, phase: 0, spawn: 0,
    wet: 0, sticky: 0, repel: 0, repelDps: 0, repelTick: 0, push: { x: 0, z: 0 } };
}

const enemyShot = (color: string, speed: number) => ({
  damage: 1, speed, radius: 0.16, life: 4, pierce: 0, bounce: 0, homing: 0, explode: 0, slow: 0, spread: 0.03, color, tech: "enemy" as TechFx,
  motion: "shot" as Motion, hits: 1, hitEvery: 0.1, reach: 0, element: "none" as Element, knock: 0,
});

function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const a = [...arr], out: T[] = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng.next() * a.length), 1)[0]);
  return out;
}
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
