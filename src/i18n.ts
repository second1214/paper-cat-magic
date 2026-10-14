// ことば（日本語／英語）。起動時に一度だけ決める（切りかえはページを読み直す）。
// 文言はその場で L("日本語", "English") と並べて書く（どちらも同じ所に見えるので直しやすい）。

const KEY = "paper-cat-magic:lang";
export type Lang = "ja" | "en";

function detect(): Lang {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "ja" || q === "en") return q;
    const s = localStorage.getItem(KEY);
    if (s === "ja" || s === "en") return s;
  } catch { /* なにもしない */ }
  const n = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return n.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export const LANG: Lang = typeof window === "undefined" ? "ja" : detect();
export const isJa = LANG === "ja";

/** 日本語と英語を並べて書き、今のことばの方を返す。 */
export const L = (ja: string, en: string) => (isJa ? ja : en);

/** ことばを切りかえて読み直す。 */
export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* なにもしない */ }
  location.reload();
}
