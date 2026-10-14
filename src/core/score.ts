// エンドレスモードのポイントと、ランキングに送る記録の確かめ（ゲームとサーバーの両方で使う。DOM 非依存）。

export interface RunScore { rooms: number; bosses: number; elites: number; kills: number }
export interface Entry extends RunScore { name: string; score: number }

/** ポイント: 片付けた部屋×100・ボス×500・強い虫×30・倒した虫×5。 */
export const POINTS = { rooms: 100, bosses: 500, elites: 30, kills: 5 } as const;
export const scoreOf = (r: RunScore) => r.rooms * POINTS.rooms + r.bosses * POINTS.bosses + r.elites * POINTS.elites + r.kills * POINTS.kills;

/** 名前に使えない言葉（ひどい言葉・連絡先を書くのを防ぐ）。 */
const NG = ["http", "www.", ".com", ".jp", "@", "死ね", "しね", "殺", "ころす", "fuck", "shit", "sex", "セックス", "ちんこ", "まんこ", "うんこ", "kill"];
export function cleanName(raw: string): string | null {
  const name = raw.normalize("NFKC").replace(/[\u0000-\u001f\u007f<>"'`]/g, "").trim().slice(0, 12);
  if (!name) return null;
  const low = name.toLowerCase();
  if (NG.some((w) => low.includes(w))) return null;
  if (/\d{6,}/.test(name)) return null;   // 電話番号などの長い数字
  return name;
}

/** ありえない記録かどうか（部屋1つで出せる量に上限をつけて、改ざんをはじく）。 */
export function plausible(r: RunScore): boolean {
  const ints = [r.rooms, r.bosses, r.elites, r.kills].every((v) => Number.isInteger(v) && v >= 0);
  return ints && r.rooms >= 1 && r.rooms <= 3000 && r.bosses <= Math.floor(r.rooms / 8) + 1 && r.elites <= r.rooms * 20 && r.kills <= r.rooms * 90;
}
