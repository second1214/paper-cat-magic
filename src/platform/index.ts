// 公開先ごとの違い（CrazyGames 版だけ SDK を使う）。ふつうの Web 版では何もしない。
// CrazyGames 版は `npm run build:crazy`（VITE_PORTAL=crazygames）で作る。

interface CgSdk {
  init(): Promise<void>;
  environment: string;
  game: { loadingStart(): void; loadingStop(): void; gameplayStart(): void; gameplayStop(): void; happytime(): void };
  ad: { requestAd(type: "rewarded" | "midgame", cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void };
  data: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
}

export const PORTAL = import.meta.env.VITE_PORTAL ?? "web";

/** 画像などの場所。CrazyGames 版はフォルダなしの平らな構成（cat/a.png → cat_a.png。iPhone からでもアップロードできるように）。 */
export const asset = (p: string) => import.meta.env.BASE_URL + (import.meta.env.VITE_FLAT ? p.split("/").join("_") : p);
let sdk: CgSdk | null = null;

const loadScript = (src: string) => new Promise<void>((ok, ng) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = ng; document.head.appendChild(s); });

/** 最初に一度だけ呼ぶ（保存データを読む前に）。SDK が使えなくても遊べるように、失敗は無視する。 */
export async function initPlatform() {
  if (PORTAL !== "crazygames") return;
  try {
    await loadScript("https://sdk.crazygames.com/crazygames-sdk-v3.js");
    const s = (window as unknown as { CrazyGames?: { SDK: CgSdk } }).CrazyGames?.SDK;
    if (!s) return;
    await s.init();
    if (s.environment === "disabled") return;
    sdk = s; sdk.game.loadingStart();
  } catch { sdk = null; }
}

/** 読み込みが終わった。 */
export const loadingDone = () => { try { sdk?.game.loadingStop(); } catch { /* なにもしない */ } };

let playing = false;
/** 遊んでいる最中か（メニュー・ポーズ・結果画面は false）。変わったときだけ SDK に伝える。 */
export function setPlaying(on: boolean) {
  if (on === playing) return;
  playing = on;
  try { if (on) sdk?.game.gameplayStart(); else sdk?.game.gameplayStop(); } catch { /* なにもしない */ }
}

/** うれしい瞬間（ボスを倒した・守りきった）。 */
export const happy = () => { try { sdk?.game.happytime(); } catch { /* なにもしない */ } };

/** 広告を見てごほうびがもらえるか。 */
/** お試し公開（Basic Launch）では広告が使えないので、本公開用のビルド（VITE_ADS=1）だけで出す。 */
export const adsAvailable = () => !!sdk && import.meta.env.VITE_ADS === "1";

/** ごほうび広告を流す。最後まで見たら true。流れている間は onStart/onEnd で音を止める。 */
export function rewardedAd(onStart: () => void, onEnd: () => void): Promise<boolean> {
  return new Promise((done) => {
    if (!sdk) { done(false); return; }
    let started = false;
    const end = (ok: boolean) => { if (started) onEnd(); done(ok); };
    try {
      sdk.ad.requestAd("rewarded", {
        adStarted: () => { started = true; onStart(); },
        adFinished: () => end(true),
        adError: () => end(false),
      });
    } catch { end(false); }
  });
}

/** 保存（CrazyGames ではアカウントに同期される SDK の保存、それ以外はブラウザ）。使えないときは何もしない。 */
export const store = {
  get(k: string): string | null { try { return sdk ? sdk.data.getItem(k) : localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { if (sdk) sdk.data.setItem(k, v); else localStorage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } },
  remove(k: string) { try { if (sdk) sdk.data.removeItem(k); else localStorage.removeItem(k); } catch { /* なにもしない */ } },
};
