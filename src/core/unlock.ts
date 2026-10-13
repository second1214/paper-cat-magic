// 解放（アンロック）: 冒険の記録の合計で、新しい技・おもちゃ・レリックが出るようになる。
// 途中の季節で負けても、倒した虫や片付けた部屋は積み上がるので、次の冒険が少し変わる。DOM 非依存。

/** 全部の冒険の合計。 */
export interface Stats { kills: number; elites: number; bosses: number; rooms: number; wins: number; specials: number; curses: number; bestAct: number }
export const NO_STATS: Stats = { kills: 0, elites: 0, bosses: 0, rooms: 0, wins: 0, specials: 0, curses: 0, bestAct: 0 };

export type UnlockKind = "spell" | "toy" | "relic";
export interface Unlock { kind: UnlockKind; id: string; stat: keyof Stats; n: number }

const STAT_TEXT: Record<keyof Stats, (n: number) => string> = {
  kills: (n) => `虫を合計${n}匹たおす`,
  elites: (n) => `強い虫を合計${n}匹たおす`,
  bosses: (n) => `ボスを合計${n}回たおす`,
  rooms: (n) => `部屋を合計${n}個かたづける`,
  wins: (n) => `${n}回 守りきる`,
  specials: (n) => `特別な部屋に合計${n}回入る`,
  curses: (n) => `呪いを合計${n}回受ける`,
  bestAct: (n) => `${["秋", "冬", "春", "夏"][n]}まで進む`,
};
export const unlockText = (u: Unlock) => STAT_TEXT[u.stat](u.n);

/** 最初から使えないもの（条件を満たすと、次の冒険から出てくる）。 */
export const UNLOCKS: Unlock[] = [
  { kind: "toy", id: "cap", stat: "kills", n: 30 },
  { kind: "spell", id: "okawari", stat: "kills", n: 30 },
  { kind: "toy", id: "pingpong", stat: "rooms", n: 10 },
  { kind: "spell", id: "tsurutsuru", stat: "rooms", n: 10 },
  { kind: "toy", id: "denmouse", stat: "bosses", n: 1 },
  { kind: "spell", id: "catnipBag", stat: "bosses", n: 1 },
  { kind: "toy", id: "keri", stat: "bestAct", n: 1 },
  { kind: "relic", id: "copy", stat: "bestAct", n: 1 },
  { kind: "toy", id: "himo", stat: "kills", n: 120 },
  { kind: "spell", id: "oikake", stat: "kills", n: 120 },
  { kind: "toy", id: "kamibukuro", stat: "rooms", n: 30 },
  { kind: "spell", id: "hidamari", stat: "rooms", n: 30 },
  { kind: "toy", id: "nezumiPlush", stat: "elites", n: 5 },
  { kind: "spell", id: "sensor", stat: "elites", n: 5 },
  { kind: "toy", id: "chiiku", stat: "specials", n: 3 },
  { kind: "spell", id: "hitoiki", stat: "specials", n: 3 },
  { kind: "toy", id: "matatabiStick", stat: "curses", n: 1 },
  { kind: "relic", id: "buzzer", stat: "curses", n: 1 },
  { kind: "toy", id: "autolaser", stat: "bosses", n: 3 },
  { kind: "spell", id: "issho", stat: "bosses", n: 3 },
  { kind: "toy", id: "tunnel", stat: "rooms", n: 60 },
  { kind: "spell", id: "dryer", stat: "rooms", n: 60 },
  { kind: "toy", id: "longrod", stat: "kills", n: 300 },
  { kind: "spell", id: "kotatsu", stat: "kills", n: 300 },
  { kind: "toy", id: "suzuball", stat: "elites", n: 20 },
  { kind: "spell", id: "maigofuda", stat: "elites", n: 20 },
  { kind: "toy", id: "pichifish", stat: "bestAct", n: 3 },
  { kind: "relic", id: "nekokan", stat: "bestAct", n: 3 },
  { kind: "toy", id: "kurukuru", stat: "wins", n: 1 },
  { kind: "spell", id: "kezukuroi", stat: "wins", n: 1 },
  { kind: "relic", id: "biidama", stat: "kills", n: 600 },
];

export const isOpen = (u: Unlock, s: Stats) => s[u.stat] >= u.n;
/** まだ使えないもの（"spell:claw" の形）。 */
export const lockedKeys = (s: Stats) => UNLOCKS.filter((u) => !isOpen(u, s)).map((u) => `${u.kind}:${u.id}`);
/** 記録が before から after になって、新しく使えるようになったもの。 */
export const newlyOpen = (before: Stats, after: Stats) => UNLOCKS.filter((u) => !isOpen(u, before) && isOpen(u, after));
export const findUnlock = (kind: UnlockKind, id: string) => UNLOCKS.find((u) => u.kind === kind && u.id === id);
export function addStats(a: Stats, b: Partial<Stats>): Stats {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Stats, number][]) out[k] = k === "bestAct" ? Math.max(out[k], v) : out[k] + v;
  return out;
}
