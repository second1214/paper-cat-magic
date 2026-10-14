// みんなのランキング（Cloudflare Pages Functions の /api/scores）。つながらないときは「準備中」として静かに失敗する。
import type { Entry } from "../core/score";

export interface Board { ok: true; top: (Entry & { at: number })[] }
const URL_ = "./api/scores";
const NAME_KEY = "paper-cat-magic:name";

async function call(init?: RequestInit): Promise<Response | null> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try { const r = await fetch(URL_, { ...init, signal: ctl.signal }); return r; } catch { return null; } finally { clearTimeout(t); }
}

/** 上位を読む（だめなら null）。 */
export async function fetchBoard(): Promise<Board | null> {
  const r = await call();
  if (!r?.ok) return null;
  try { const j = await r.json(); return j?.ok ? j as Board : null; } catch { return null; }
}

/** 記録を送る。何位か（だめならエラーの理由）を返す。 */
export async function submitScore(e: Entry): Promise<{ rank: number } | { error: string }> {
  const r = await call({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e) });
  if (!r) return { error: "つながらなかった（あとでもう一度）" };
  try {
    const j = await r.json();
    return r.ok && j.ok ? { rank: j.rank } : { error: j.error ?? "送れなかった" };
  } catch { return { error: "ランキングは準備中です" }; }
}

export const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } };
export const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* 保存できなくてもよい */ } };
