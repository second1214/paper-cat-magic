// みんなのランキング（Cloudflare Pages Functions）。D1 データベースを "DB" という名前でつなぐと動く。
// GET  /api/scores → 上位50
// POST /api/scores {name, rooms, bosses, elites, kills, score} → 確かめて保存し、何位かを返す
import { cleanName, plausible, scoreOf, type Entry } from "../../src/core/score";

interface D1Result<T> { results: T[] }
interface D1Stmt { bind(...v: unknown[]): D1Stmt; all<T>(): Promise<D1Result<T>>; first<T>(): Promise<T | null>; run(): Promise<unknown> }
interface D1 { prepare(sql: string): D1Stmt; exec(sql: string): Promise<unknown> }
interface Ctx { request: Request; env: { DB?: D1 } }

// CrazyGames など別の場所に置いた版からも呼べるようにする（Cookie は使わないので、どこからでもよい）
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } });

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

async function ready(db: D1) {
  await db.exec("CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, score INTEGER NOT NULL, rooms INTEGER NOT NULL, bosses INTEGER NOT NULL, elites INTEGER NOT NULL, kills INTEGER NOT NULL, ip TEXT NOT NULL, at INTEGER NOT NULL)");
  await db.exec("CREATE INDEX IF NOT EXISTS scores_score ON scores (score DESC)");
}

/** 送った人の判別用（IPそのものは保存せず、日ごとに変わるハッシュだけ）。 */
async function who(req: Request) {
  const ip = req.headers.get("cf-connecting-ip") ?? "?", day = new Date().toISOString().slice(0, 10);
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${day}|my-cat`));
  return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ env }: Ctx) {
  if (!env.DB) return json({ ok: false, error: "ランキングは準備中です / Ranking not available yet" }, 503);
  await ready(env.DB);
  const r = await env.DB.prepare("SELECT name, score, rooms, bosses, elites, kills, at FROM scores ORDER BY score DESC, at ASC LIMIT 50").all();
  return json({ ok: true, top: r.results });
}

export async function onRequestPost({ request, env }: Ctx) {
  if (!env.DB) return json({ ok: false, error: "ランキングは準備中です / Ranking not available yet" }, 503);
  let b: Partial<Entry>;
  try { b = await request.json(); } catch { return json({ ok: false, error: "送り方がおかしい / Bad request" }, 400); }
  const name = cleanName(String(b.name ?? ""));
  if (!name) return json({ ok: false, error: "その名前は使えません / Name not allowed" }, 400);
  const run = { rooms: Number(b.rooms), bosses: Number(b.bosses), elites: Number(b.elites), kills: Number(b.kills) };
  if (!plausible(run) || scoreOf(run) !== Number(b.score)) return json({ ok: false, error: "記録がおかしい / Invalid record" }, 400);
  await ready(env.DB);
  const ip = await who(request), now = Date.now();
  const last = await env.DB.prepare("SELECT at FROM scores WHERE ip = ? ORDER BY at DESC LIMIT 1").bind(ip).first<{ at: number }>();
  if (last && now - last.at < 30_000) return json({ ok: false, error: "少し時間をおいてから送ってね / Please wait a bit before sending again" }, 429);
  const score = scoreOf(run);
  await env.DB.prepare("INSERT INTO scores (name, score, rooms, bosses, elites, kills, ip, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(name, score, run.rooms, run.bosses, run.elites, run.kills, ip, now).run();
  const higher = await env.DB.prepare("SELECT COUNT(*) AS n FROM scores WHERE score > ?").bind(score).first<{ n: number }>();
  return json({ ok: true, rank: (higher?.n ?? 0) + 1 });
}
