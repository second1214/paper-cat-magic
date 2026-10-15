/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 公開先（"crazygames" のときだけ CrazyGames SDK を使う）。 */
  readonly VITE_PORTAL?: string;
  /** みんなのランキングの API の場所（なければ同じ場所）。 */
  readonly VITE_API?: string;
  /** 画像をフォルダなしの平らな構成で置く（cat/a.png → cat_a.png）。 */
  readonly VITE_FLAT?: string;
  /** ごほうび広告を出す（CrazyGames の本公開のときだけ 1）。 */
  readonly VITE_ADS?: string;
}
