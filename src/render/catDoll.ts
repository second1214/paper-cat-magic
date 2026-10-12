// 主人公の猫（紙人形）。状態に応じてステッカー画像を差し替える。
import * as THREE from "three";

const STAND = 1.45; // 立ち姿の高さ（ワールド単位）。カメラを引いたので大きめ

/** 画像名と、1ピクセルあたりのワールド長。素材ごとに描かれた縮尺が違うので個別に揃える。 */
const FRAMES: Record<string, number> = {
  A04_blink_1: STAND / 365, A04_blink_2: STAND / 365, A04_blink_3: STAND / 365,
  A01_walk_1: STAND / 297, A01_walk_2: STAND / 297, A01_walk_3: STAND / 297, A01_walk_4: STAND / 297,
  A02_run_1: STAND / 297, A02_run_2: STAND / 297, A02_run_3: STAND / 297, A02_run_4: STAND / 297,
  A05_jump_1: STAND / 297, A05_jump_2: STAND / 297, A05_jump_3: STAND / 297, A05_jump_4: STAND / 297,
  A03_turn_4: STAND / 322,
  P14_hiss: STAND / 379,
  P03_sit_happy: 1.6 / 420,
  P09_belly_up: 1.25 / 417,
};

export type CatState = "idle" | "walk" | "dash" | "hurt" | "happy" | "down";

export class CatDoll {
  group = new THREE.Group();
  private pivot = new THREE.Group();
  private cards = new Map<string, THREE.Group>();
  private shown = "";

  static async load(base: string) {
    const doll = new CatDoll();
    const loader = new THREE.TextureLoader();
    await Promise.all(Object.entries(FRAMES).map(async ([name, px]) => {
      const tex = await loader.loadAsync(`${base}cat/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const w = tex.image.width * px, h = tex.image.height * px;
      const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
      const g = new THREE.Group();
      const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false }));
      front.castShadow = true;
      front.customDepthMaterial = new THREE.MeshDepthMaterial({ map: tex, alphaTest: 0.5, depthPacking: THREE.RGBADepthPacking });
      g.add(front);
      for (let i = 1; i <= 3; i++) {   // 紙の厚み
        const e = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: 0xb8ad9c, side: THREE.DoubleSide }));
        e.position.z = -0.006 * i; g.add(e);
      }
      g.visible = false;
      doll.cards.set(name, g); doll.pivot.add(g);
    }));
    doll.group.add(doll.pivot);
    return doll;
  }

  private show(name: string) {
    if (name === this.shown) return;
    if (this.shown) this.cards.get(this.shown)!.visible = false;
    this.cards.get(name)!.visible = true; this.shown = name;
  }

  /** t: 経過秒、facing: 右=1/左=-1、blinking: 点滅（無敵中）。 */
  update(t: number, state: CatState, facing: 1 | -1, speed: number, blinking: boolean) {
    let name: string, bob = 0, sy = 1;
    switch (state) {
      case "walk": name = `A01_walk_${(Math.floor(t * Math.max(6, speed * 1.8)) % 4) + 1}`; bob = 0.02 * Math.abs(Math.sin(t * 12)); break;
      case "dash": name = `A02_run_${(Math.floor(t * 16) % 4) + 1}`; bob = 0.06; break;
      case "hurt": name = "P14_hiss"; break;
      case "happy": name = "P03_sit_happy"; sy = 1 + 0.015 * Math.sin(t * 3); break;
      case "down": name = "P09_belly_up"; break;
      default: {
        // 待機: 半目 → ときどきまばたき → 時々キラキラ目
        const c = t % 6;
        name = c > 4.3 && c < 4.45 ? "A04_blink_2" : c > 4.45 && c < 5.6 ? "A04_blink_3" : "A04_blink_1";
        sy = 1 + 0.012 * Math.sin(t * 3.2);
      }
    }
    this.show(name);
    this.pivot.position.y = bob;
    this.pivot.scale.set(facing, sy, 1);   // 左向きは表を反転（紙の裏は見せない）
    this.pivot.visible = !blinking || Math.floor(t * 20) % 2 === 0;
  }
}
