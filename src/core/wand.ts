// 杖の発射計画。スロットを左から読み、1回の発射で撃つ弾の一覧を決める（純粋関数）。
import { SPELLS, type Modifier, type ProjectileStats } from "./spells";

export interface WandDef {
  name: string;
  slots: (string | null)[];
  manaMax: number;
  manaRegen: number; // 毎秒
  castDelay: number; // 発射間隔（秒）
  recharge: number; // 最後のスロットまで撃ち切った後の再装填（秒）
}

/** 実際に飛ばす1発。payload は誘発（命中地点から撃つ弾）。 */
export interface Shot {
  stats: ProjectileStats;
  payload: Shot[];
}

export interface CastResult {
  shots: Shot[];
  manaUsed: number;
  nextCursor: number;
  /** 最後のスロットまで読み切った（再装填に入る）。 */
  wrapped: boolean;
  /** マナ不足で途中で止まった。 */
  fizzled: boolean;
}

function applyMods(p: ProjectileStats, mods: Modifier[]): ProjectileStats {
  const s = { ...p };
  for (const m of mods) {
    if (m.damageMul) s.damage *= m.damageMul;
    if (m.damageAdd) s.damage += m.damageAdd;
    if (m.speedMul) s.speed *= m.speedMul;
    if (m.homing) s.homing = Math.min(1, s.homing + m.homing);
    if (m.bounce) s.bounce += m.bounce;
    if (m.pierce) s.pierce += m.pierce;
    if (m.explodeAdd) s.explode += m.explodeAdd;
    if (m.spread) s.spread += m.spread;
  }
  return s;
}

/**
 * cursor の位置から1回ぶん発射する。
 * - 修飾は次の弾に溜まる。弾まで届かなかった修飾は捨てる。
 * - 多重（multicast）は、続く弾を count 発ぶん追加で引く。
 * - 誘発は、次の弾が当たったときに撃つ弾をさらに1発ぶん引いて payload に入れる。
 * - スロットの端に達したら、そこで打ち切って wrapped を立てる（再装填）。
 */
export function planCast(wand: WandDef, cursor: number, mana: number): CastResult {
  const slots = wand.slots;
  let i = cursor;
  let used = 0;
  let wrapped = false;
  let fizzled = false;

  // 次の非空スロットを1つ消費する。マナ不足・端到達なら null。
  const take = () => {
    while (i < slots.length && !slots[i]) i++;
    if (i >= slots.length) { wrapped = true; return null; }
    const def = SPELLS[slots[i]!];
    if (!def) { i++; return null; }
    if (used + def.mana > mana) { fizzled = true; return null; }
    used += def.mana;
    i++;
    return def;
  };

  // 弾1発ぶん（とそれに付く修飾・誘発）を引く。
  const drawOne = (mods: Modifier[]): Shot[] | null => {
    const extra: Shot[] = [];
    let pendingMulti = 0;
    let triggered = false;
    for (;;) {
      if (wrapped || fizzled) return extra.length ? extra : null;
      const def = take();
      if (!def) return extra.length ? extra : null;
      if (def.kind === "modifier" && def.modifier) { mods = [...mods, def.modifier]; continue; }
      if (def.kind === "multicast") { pendingMulti += def.count ?? 2; continue; }
      if (def.kind === "trigger") { triggered = true; continue; }
      if (def.kind === "projectile" && def.projectile) {
        const shot: Shot = { stats: applyMods(def.projectile, mods), payload: [] };
        if (triggered) shot.payload = drawOne([]) ?? [];
        const out = [shot, ...extra];
        // 多重: この弾に加えて pendingMulti-1 発を引く（各々は修飾を引き継がない）
        for (let k = 1; k < pendingMulti; k++) {
          const more = drawOne([]);
          if (!more) break;
          out.push(...more);
        }
        return out;
      }
    }
  };

  const shots = drawOne([]) ?? [];
  // 端に着いていなくても、残りが全部空スロットなら次は再装填
  let j = i;
  while (j < slots.length && !slots[j]) j++;
  if (j >= slots.length) wrapped = true;
  return { shots, manaUsed: used, nextCursor: wrapped ? 0 : i, wrapped, fizzled };
}

export const STARTER_WAND: WandDef = {
  name: "見習いの杖",
  slots: ["spark", "spark", "empower", "fireball", null, null],
  manaMax: 80,
  manaRegen: 30,
  castDelay: 0.18,
  recharge: 0.55,
};
