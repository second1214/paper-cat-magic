/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 公開先（"crazygames" のときだけ CrazyGames SDK を使う）。 */
  readonly VITE_PORTAL?: string;
  /** みんなのランキングの API の場所（なければ同じ場所）。 */
  readonly VITE_API?: string;
}
