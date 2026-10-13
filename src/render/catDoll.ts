// 主人公の猫（紙人形）。状態に応じてステッカー画像を差し替える。
import * as THREE from "three";

const STAND = 1.45; // 立ち姿の高さ（ワールド単位）。カメラを引いたので大きめ

/** 画像名と、1ピクセルあたりのワールド長。素材ごとに描かれた縮尺が違うので個別に揃える。 */
const FRAMES: Record<string, number> = {
  A04_blink_1: STAND / 365, A04_blink_2: STAND / 365, A04_blink_3: STAND / 365,
  A01_walk_1: STAND / 300, A01_walk_2: STAND / 300, A01_walk_3: STAND / 300, A01_walk_4: STAND / 300,
  A02_run_1: STAND / 297, A02_run_2: STAND / 297, A02_run_3: STAND / 297, A02_run_4: STAND / 297,
  A05_jump_1: STAND / 297, A05_jump_2: STAND / 297, A05_jump_3: STAND / 297, A05_jump_4: STAND / 297,
  A03_turn_4: STAND / 322,
  P14_hiss: STAND / 379,
  P03_sit_happy: 1.6 / 420,
  P09_belly_up: 1.25 / 417,
};

export type CatState = "idle" | "walk" | "dash" | "jump" | "hurt" | "happy" | "down";

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

  private lastT = 0;
  /** 歩き・走りのコマ送り位置。速さに合わせて積み上げる（t×速さで直接求めると、加速中にコマが飛び飛びになる）。 */
  private stride = 0;

  /** t: 経過秒、facing: 右=1/左=-1、blinking: 点滅（無敵中）、jump: ねこジャンプの進み 0..1。 */
  update(t: number, state: CatState, facing: 1 | -1, speed: number, blinking: boolean, jump = 0) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t;
    let name: string, bob = 0, sy = 1, tilt = 0;
    switch (state) {
      case "walk": {
        // 4コマ = 2歩（そろう→右足→そろう→左足）。紙人形らしく、歩みに合わせてわずかに弾ませて傾ける
        this.stride += dt * (1.2 + speed * 0.35);           // 1歩 = stride 1（速さ5.2で約3歩/秒）
        const ph = this.stride * Math.PI;
        name = `A01_walk_${(Math.floor(this.stride * 2) % 4) + 1}`;
        bob = Math.abs(Math.sin(ph)) * 0.05;
        tilt = Math.sin(ph) * 0.035;
        break;
      }
      case "jump": {
        name = `A05_jump_${Math.min(4, Math.floor(jump * 4) + 1)}`;
        bob = Math.sin(Math.min(1, jump / 0.8) * Math.PI) * 0.7; break;
      }
      case "dash": this.stride += dt * 16; name = `A02_run_${(Math.floor(this.stride) % 4) + 1}`; bob = 0.06; break;
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
    this.pivot.rotation.z = tilt * facing;
    this.pivot.scale.set(facing, sy, 1);   // 左向きは表を反転（紙の裏は見せない）
    this.pivot.visible = !blinking || Math.floor(t * 20) % 2 === 0;
  }
}
