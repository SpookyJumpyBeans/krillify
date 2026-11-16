// Packages the extension for the Chrome Web Store.
//
//   node tools/build-store.mjs
//
// Writes dist/store/ (the unpacked store build, for loading and testing) and
// dist/krillify-<version>-store.zip (the file to upload). The store build differs from
// extension/ only in its manifest: the listing name, and no GitHub permission, so maintainer
// mode is absent (Settings hides it when the permission isn't declared).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'extension');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'store');

const storeName = 'Krillify: Answer Helper for Krillion Puffer Party';
const storeDescription = "Unofficial helper for Krillion's Puffer Party: three rare answer suggestions for each category, right beside the game.";
if (storeName.length > 75) throw new Error('Store name is over 75 characters.');
if (storeDescription.length > 132) throw new Error('Store description is over 132 characters.');

const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
delete manifest.optional_host_permissions;
manifest.name = storeName;
manifest.short_name = 'Krillify';
manifest.description = storeDescription;
manifest.homepage_url = 'https://github.com/SpookyJumpyBeans/krillify';

// Every file the extension ships, in a stable order.
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(path.relative(source, full).split(path.sep).join('/'));
  }
})(source);

fs.rmSync(unpacked, {recursive: true, force: true});
const contents = new Map();
for (const file of files) {
  const data = file === 'manifest.json' ? Buffer.from(JSON.stringify(manifest, null, 2) + '\n') : fs.readFileSync(path.join(source, file));
  contents.set(file, data);
  fs.mkdirSync(path.dirname(path.join(unpacked, file)), {recursive: true});
  fs.writeFileSync(path.join(unpacked, file), data);
}

// Minimal ZIP writer (deflate), so packaging needs no extra tools.
const crcTable = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const locals = [], centrals = [];
let offset = 0;
for (const [name, data] of contents) {
  const packed = zlib.deflateRawSync(data, {level: 9});
  const nameBuf = Buffer.from(name, 'utf8'), crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); // fixed 1980-01-01 timestamp for reproducible zips
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
  locals.push(local, nameBuf, packed);
  centrals.push(central, nameBuf);
  offset += local.length + nameBuf.length + packed.length;
}
const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(contents.size, 8); end.writeUInt16LE(contents.size, 10);
end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
const zipPath = path.join(dist, `krillify-${manifest.version}-store.zip`);
fs.writeFileSync(zipPath, Buffer.concat([...locals, ...centrals, end]));
console.log(`${contents.size} files, ${(fs.statSync(zipPath).size / 1024).toFixed(0)} KB -> ${zipPath}`);
console.log(`Unpacked store build for testing: ${unpacked}`);
