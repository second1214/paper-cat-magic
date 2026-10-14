// dist-crazygames を CrazyGames にアップロードする zip にまとめる（追加の道具なしで動くよう、zip を自前で書く）。
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const root = "dist-crazygames", out = "my-cat-crazygames.zip";
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(root).sort();
const local = [], central = [];
let offset = 0;
for (const f of files) {
  const name = Buffer.from(relative(root, f).split("\\").join("/")), raw = readFileSync(f), comp = deflateRawSync(raw, { level: 9 }), crc = crc32(raw);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  local.push(h, name, comp); central.push(c, name);
  offset += 30 + name.length + comp.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(`${out}: ${files.length} files, ${(offset / 1e6).toFixed(1)} MB`);
