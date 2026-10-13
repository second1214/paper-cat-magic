// 音楽と効果音。音のファイルは使わず、ブラウザの WebAudio でその場で鳴らす（かわいい8bit風）。
// スマホは画面に触れるまで音を出せないので、最初のタップで unlock する。

type Track = "title" | "autumn" | "winter" | "spring" | "summer" | "boss" | "shop" | "final";

/** 曲: テンポ（8分音符/分）・メロディ・ベース（MIDI 番号、null は休み）・音色。 */
interface Song { bpm: number; mel: (number | null)[]; bass: (number | null)[]; wave: OscillatorType; vol: number }
const _ = null;
const SONGS: Record<Track, Song> = {
  title: { bpm: 220, wave: "triangle", vol: 0.5,
    mel: [72, _, 76, _, 79, 76, 77, _, 76, _, 74, _, 72, _, _, _, 74, _, 76, _, 77, 79, 81, _, 79, _, 77, 76, 74, _, _, _],
    bass: [48, _, _, _, 55, _, _, _, 53, _, _, _, 55, _, _, _, 50, _, _, _, 57, _, _, _, 55, _, _, _, 43, _, _, _] },
  autumn: { bpm: 200, wave: "triangle", vol: 0.45,
    mel: [69, _, 72, _, 74, _, 76, _, 74, 72, 69, _, 67, _, 69, _, 72, _, 74, _, 76, 79, 76, _, 74, _, 72, _, 69, _, _, _],
    bass: [45, _, _, 52, _, _, 45, _, 41, _, _, 48, _, _, 41, _, 43, _, _, 50, _, _, 43, _, 45, _, _, 52, _, _, 45, _] },
  winter: { bpm: 170, wave: "sine", vol: 0.55,
    mel: [79, _, 84, _, 83, _, 79, _, 76, _, _, _, 77, _, 79, _, 81, _, 79, _, 77, _, 76, _, 74, _, _, _, _, _, _, _],
    bass: [48, _, _, _, _, _, _, _, 45, _, _, _, _, _, _, _, 41, _, _, _, _, _, _, _, 43, _, _, _, _, _, _, _] },
  spring: { bpm: 236, wave: "square", vol: 0.28,
    mel: [77, _, 81, 84, 81, _, 79, _, 77, 79, 81, _, 77, _, _, _, 79, _, 82, 86, 82, _, 81, _, 79, 81, 79, 77, 76, _, _, _],
    bass: [41, _, 48, _, 41, _, 48, _, 46, _, 53, _, 46, _, 53, _, 48, _, 55, _, 48, _, 55, _, 41, _, 48, _, 41, _, _, _] },
  summer: { bpm: 260, wave: "square", vol: 0.26,
    mel: [74, 74, 78, _, 81, _, 78, _, 79, 79, 83, _, 81, _, _, _, 74, 76, 78, 79, 81, _, 83, _, 86, _, 83, _, 81, _, _, _],
    bass: [50, _, 57, _, 50, _, 57, _, 55, _, 62, _, 55, _, 62, _, 50, _, 57, _, 52, _, 59, _, 54, _, 57, _, 50, _, _, _] },
  boss: { bpm: 280, wave: "sawtooth", vol: 0.18,
    mel: [64, _, 67, 64, 70, _, 69, _, 64, _, 67, 64, 71, _, 70, _, 64, 64, 67, _, 70, 69, 67, 64, 63, _, 64, _, _, _, _, _],
    bass: [40, 40, 52, 40, 40, 52, 40, 52, 43, 43, 55, 43, 42, 54, 42, 54, 40, 40, 52, 40, 40, 52, 40, 52, 39, 39, 51, 39, 40, _, _, _] },
  shop: { bpm: 180, wave: "triangle", vol: 0.45,
    mel: [67, _, 71, 74, 72, _, 71, _, 69, _, 72, _, 71, _, _, _, 67, _, 71, 74, 76, _, 74, _, 72, 71, 69, _, 67, _, _, _],
    bass: [43, _, 50, _, 45, _, 52, _, 47, _, 54, _, 43, _, 50, _, 43, _, 50, _, 48, _, 55, _, 50, _, 45, _, 43, _, _, _] },
  final: { bpm: 160, wave: "sine", vol: 0.55,   // ママのこもりうた（のんびり、でも逃げられない）
    mel: [76, _, 74, _, 72, _, 74, _, 76, _, 76, _, 76, _, _, _, 74, _, 74, _, 74, _, _, _, 76, _, 79, _, 79, _, _, _],
    bass: [48, _, _, _, 55, _, _, _, 48, _, _, _, 55, _, _, _, 43, _, _, _, 50, _, _, _, 48, _, _, _, 55, _, _, _] },
};

const KEY = "paper-cat-magic:muted";
const freq = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private track: Track | null = null;
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private last = new Map<string, number>();
  muted: boolean;

  constructor() {
    let m = false;
    try { m = localStorage.getItem(KEY) === "1"; } catch { /* 保存できなくてもよい */ }
    this.muted = m;
  }

  /** 最初のタップ・キーで音を使えるようにする。 */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(KEY, this.muted ? "1" : "0"); } catch { /* 保存できなくてもよい */ }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  /** 流す曲を決める（同じ曲なら何もしない）。 */
  play(t: Track) {
    if (t === this.track) return;
    this.track = t; this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    const song = SONGS[this.track], dur = 60 / song.bpm;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const i = this.step % song.mel.length, m = song.mel[i], b = song.bass[i % song.bass.length];
      if (m !== null) this.note(this.music, freq(m), this.nextTime, dur * 1.6, song.wave, 0.22 * song.vol);
      if (b !== null) this.note(this.music, freq(b), this.nextTime, dur * 1.8, "triangle", 0.3);
      this.nextTime += dur; this.step++;
    }
  }

  private note(out: AudioNode, f: number, t: number, len: number, wave: OscillatorType, vol: number, slide = 0) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
  }

  /** 効果音（同じ音を続けて鳴らしすぎないよう間引く）。 */
  sfx(name: string) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime, gap: Record<string, number> = { cast: 0.07, coin: 0.04, pesi: 0.08, kill: 0.05 };
    if (now - (this.last.get(name) ?? -1) < (gap[name] ?? 0.03)) return;
    this.last.set(name, now);
    const s = (f: number, len: number, wave: OscillatorType, vol: number, at = 0, slide = 0) => this.note(this.master, f, now + at, len, wave, vol, slide);
    switch (name) {
      case "cast": s(880, 0.08, "square", 0.05, 0, 1.5); break;
      case "kill": s(660, 0.07, "square", 0.08); s(990, 0.09, "square", 0.07, 0.05); break;
      case "hurt": s(220, 0.25, "sawtooth", 0.18, 0, 0.5); break;
      case "coin": s(1320, 0.06, "square", 0.06); s(1760, 0.12, "square", 0.06, 0.05); break;
      case "door": [523, 659, 784].forEach((f, i) => s(f, 0.18, "triangle", 0.15, i * 0.07)); break;
      case "clear": [659, 784, 1047].forEach((f, i) => s(f, 0.2, "triangle", 0.16, i * 0.08)); break;
      case "buy": s(988, 0.08, "square", 0.08); s(1319, 0.16, "square", 0.08, 0.07); break;
      case "forge": [784, 988, 1175, 1568].forEach((f, i) => s(f, 0.15, "triangle", 0.15, i * 0.06)); break;
      case "shop": s(1047, 0.25, "sine", 0.2); s(1319, 0.3, "sine", 0.15, 0.12); break;
      case "switch": s(700, 0.06, "triangle", 0.12); break;
      case "land": s(110, 0.3, "sine", 0.35, 0, 0.6); break;
      case "pesi": s(520, 0.06, "triangle", 0.25, 0, 0.7); break;
      case "dead": [523, 440, 349, 262].forEach((f, i) => s(f, 0.3, "triangle", 0.18, i * 0.18)); break;
      case "win": case "caught": [523, 659, 784, 1047, 784, 1047].forEach((f, i) => s(f, 0.22, "triangle", 0.18, i * 0.11)); break;
      case "final": s(784, 0.4, "sine", 0.2); s(659, 0.5, "sine", 0.2, 0.25); break;
    }
  }
}
