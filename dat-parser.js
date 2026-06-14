"use strict";

(() => {
  const DAT_KEY = new TextEncoder().encode("39653543fa0d66aa");
  const APPLE_EPOCH_UNIX_MS = 978307200000;

  const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
  ];
  const INV_SBOX = [
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
    0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
    0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
    0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
    0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
    0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
    0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
    0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
    0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
    0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
    0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
    0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
    0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
    0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
    0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
  ];
  const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  function hasBplistHeader(bytes) {
    return bytes.length >= 8 && String.fromCharCode(...bytes.slice(0, 8)) === "bplist00";
  }

  function bytesToBase64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    if (typeof btoa === "function") return btoa(bin);
    return Buffer.from(bin, "binary").toString("base64");
  }

  function base64ToBytes(value) {
    const clean = String(value || "")
      .replace(/^data:[^,]*,/i, "")
      .replace(/\s/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (!clean) throw new Error("base64 is empty");
    const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
    const bin = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  function gfMul(a, b) {
    let out = 0;
    for (let i = 0; i < 8; i += 1) {
      if (b & 1) out ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1b;
      b >>= 1;
    }
    return out;
  }

  function expandKey(key) {
    const expanded = new Uint8Array(176);
    expanded.set(key);
    let bytes = 16;
    let rcon = 1;
    const temp = new Uint8Array(4);
    while (bytes < 176) {
      temp.set(expanded.slice(bytes - 4, bytes));
      if (bytes % 16 === 0) {
        const t = temp[0];
        temp[0] = SBOX[temp[1]] ^ RCON[rcon++];
        temp[1] = SBOX[temp[2]];
        temp[2] = SBOX[temp[3]];
        temp[3] = SBOX[t];
      }
      for (let i = 0; i < 4; i += 1) {
        expanded[bytes] = expanded[bytes - 16] ^ temp[i];
        bytes += 1;
      }
    }
    return expanded;
  }

  function addRoundKey(state, key, round) {
    const start = round * 16;
    for (let i = 0; i < 16; i += 1) state[i] ^= key[start + i];
  }

  function invSubBytes(state) {
    for (let i = 0; i < 16; i += 1) state[i] = INV_SBOX[state[i]];
  }

  function invShiftRows(state) {
    const s = state.slice();
    state[1] = s[13]; state[5] = s[1]; state[9] = s[5]; state[13] = s[9];
    state[2] = s[10]; state[6] = s[14]; state[10] = s[2]; state[14] = s[6];
    state[3] = s[7]; state[7] = s[11]; state[11] = s[15]; state[15] = s[3];
  }

  function invMixColumns(state) {
    for (let c = 0; c < 4; c += 1) {
      const i = c * 4;
      const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3];
      state[i] = gfMul(a0, 14) ^ gfMul(a1, 11) ^ gfMul(a2, 13) ^ gfMul(a3, 9);
      state[i + 1] = gfMul(a0, 9) ^ gfMul(a1, 14) ^ gfMul(a2, 11) ^ gfMul(a3, 13);
      state[i + 2] = gfMul(a0, 13) ^ gfMul(a1, 9) ^ gfMul(a2, 14) ^ gfMul(a3, 11);
      state[i + 3] = gfMul(a0, 11) ^ gfMul(a1, 13) ^ gfMul(a2, 9) ^ gfMul(a3, 14);
    }
  }

  function aesDecryptBlock(block, expandedKey) {
    const state = Uint8Array.from(block);
    addRoundKey(state, expandedKey, 10);
    for (let round = 9; round >= 1; round -= 1) {
      invShiftRows(state);
      invSubBytes(state);
      addRoundKey(state, expandedKey, round);
      invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, expandedKey, 0);
    return state;
  }

  function aes128EcbDecrypt(bytes, key) {
    const expandedKey = expandKey(key);
    const out = new Uint8Array(bytes.length);
    for (let offset = 0; offset < bytes.length; offset += 16) {
      out.set(aesDecryptBlock(bytes.slice(offset, offset + 16), expandedKey), offset);
    }
    return out;
  }

  function stripPkcs7(bytes) {
    if (!bytes.length) return bytes;
    const pad = bytes[bytes.length - 1];
    if (pad < 1 || pad > 16 || pad > bytes.length) return bytes;
    for (let i = bytes.length - pad; i < bytes.length; i += 1) {
      if (bytes[i] !== pad) return bytes;
    }
    return bytes.slice(0, bytes.length - pad);
  }

  function readUIntBE(bytes, offset, size) {
    let value = 0n;
    for (let i = 0; i < size; i += 1) value = (value << 8n) | BigInt(bytes[offset + i]);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("bplist integer is too large");
    return Number(value);
  }

  class BplistReader {
    constructor(bytes) {
      if (!hasBplistHeader(bytes)) throw new Error("not a binary plist");
      if (bytes.length < 40) throw new Error("binary plist is too short");
      this.bytes = bytes;
      const trailer = bytes.length - 32;
      this.offsetSize = bytes[trailer + 6];
      this.refSize = bytes[trailer + 7];
      this.objectCount = readUIntBE(bytes, trailer + 8, 8);
      this.topObject = readUIntBE(bytes, trailer + 16, 8);
      this.offsetTableOffset = readUIntBE(bytes, trailer + 24, 8);
      this.offsets = [];
      for (let i = 0; i < this.objectCount; i += 1) {
        this.offsets.push(readUIntBE(bytes, this.offsetTableOffset + i * this.offsetSize, this.offsetSize));
      }
      this.memo = new Map();
    }

    readRef(offset) {
      return readUIntBE(this.bytes, offset, this.refSize);
    }

    readLength(info, offset) {
      if (info < 0x0f) return { length: info, offset: offset + 1 };
      const marker = this.bytes[offset + 1];
      if ((marker >> 4) !== 0x01) throw new Error("invalid extended length marker");
      const size = 1 << (marker & 0x0f);
      return { length: readUIntBE(this.bytes, offset + 2, size), offset: offset + 2 + size };
    }

    parseObject(index) {
      if (this.memo.has(index)) return this.memo.get(index);
      const offset = this.offsets[index];
      const marker = this.bytes[offset];
      const type = marker >> 4;
      const info = marker & 0x0f;
      let value;
      if (type === 0x00) {
        value = info === 0x08 ? false : info === 0x09 ? true : null;
      } else if (type === 0x01) {
        const size = 1 << info;
        value = readUIntBE(this.bytes, offset + 1, size);
      } else if (type === 0x02) {
        const size = 1 << info;
        const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + offset + 1, size);
        value = size === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
      } else if (type === 0x03) {
        const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + offset + 1, 8);
        value = new Date(APPLE_EPOCH_UNIX_MS + view.getFloat64(0, false) * 1000).toISOString();
      } else if (type === 0x04) {
        const info2 = this.readLength(info, offset);
        value = { $data: bytesToBase64(this.bytes.slice(info2.offset, info2.offset + info2.length)) };
      } else if (type === 0x05) {
        const info2 = this.readLength(info, offset);
        value = new TextDecoder("ascii").decode(this.bytes.slice(info2.offset, info2.offset + info2.length));
      } else if (type === 0x06) {
        const info2 = this.readLength(info, offset);
        const chars = [];
        for (let i = 0; i < info2.length; i += 1) {
          chars.push(String.fromCharCode(readUIntBE(this.bytes, info2.offset + i * 2, 2)));
        }
        value = chars.join("");
      } else if (type === 0x08) {
        value = { $uid: readUIntBE(this.bytes, offset + 1, info + 1) };
      } else if (type === 0x0a) {
        const info2 = this.readLength(info, offset);
        const arr = [];
        for (let i = 0; i < info2.length; i += 1) {
          arr.push(this.parseObject(this.readRef(info2.offset + i * this.refSize)));
        }
        value = arr;
      } else if (type === 0x0d) {
        const info2 = this.readLength(info, offset);
        const obj = {};
        const valueOffset = info2.offset + info2.length * this.refSize;
        for (let i = 0; i < info2.length; i += 1) {
          const key = this.parseObject(this.readRef(info2.offset + i * this.refSize));
          obj[String(key)] = this.parseObject(this.readRef(valueOffset + i * this.refSize));
        }
        value = obj;
      } else {
        throw new Error(`unsupported bplist object type 0x${type.toString(16)}`);
      }
      this.memo.set(index, value);
      return value;
    }

    parse() {
      return this.parseObject(this.topObject);
    }
  }

  function uidOf(value) {
    return value && typeof value === "object" && !Array.isArray(value) && Number.isInteger(value.$uid) ? value.$uid : null;
  }

  function resolveKeyedArchive(root) {
    const objects = root?.$objects;
    const rootUid = uidOf(root?.$top?.root);
    if (!Array.isArray(objects) || rootUid == null) return { tree: root, classCounts: {} };
    const classCounts = {};
    const stack = new Set();

    function className(dict) {
      const classUid = uidOf(dict?.$class);
      const classObj = classUid == null ? null : objects[classUid];
      return classObj?.$classname || classObj?.$classes?.[0] || null;
    }

    function resolve(value, depth = 0) {
      if (depth > 48) return "<depth-limit>";
      const uid = uidOf(value);
      if (uid != null) {
        if (stack.has(uid)) return "<cycle>";
        stack.add(uid);
        const out = resolve(objects[uid], depth + 1);
        stack.delete(uid);
        return out;
      }
      if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
      if (!value || typeof value !== "object") return value;

      const cls = className(value);
      if (cls) classCounts[cls] = (classCounts[cls] || 0) + 1;
      if (Array.isArray(value["NS.keys"]) && Array.isArray(value["NS.objects"])) {
        const out = {};
        if (cls) out.__class = cls;
        value["NS.keys"].forEach((keyRef, index) => {
          out[String(resolve(keyRef, depth + 1))] = resolve(value["NS.objects"][index], depth + 1);
        });
        return out;
      }
      if (Array.isArray(value["NS.objects"])) {
        return value["NS.objects"].map((item) => resolve(item, depth + 1));
      }
      const out = {};
      if (cls) out.__class = cls;
      for (const [key, child] of Object.entries(value)) {
        if (key !== "$class") out[key] = resolve(child, depth + 1);
      }
      return out;
    }

    return { tree: resolve({ $uid: rootUid }), classCounts };
  }

  function decodeDatBytes(rawBytes) {
    const raw = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
    if (hasBplistHeader(raw)) {
      const plist = new BplistReader(raw).parse();
      return { plistBytes: raw, encrypted: false, plist, ...resolveKeyedArchive(plist) };
    }
    if (raw.length < 16) throw new Error("file is neither bplist nor AES-encrypted DAT");
    let n = Math.floor(raw.length / 16) * 16;
    while (n >= 16) {
      const decrypted = stripPkcs7(aes128EcbDecrypt(raw.slice(0, n), DAT_KEY));
      if (hasBplistHeader(decrypted)) {
        try {
          const plist = new BplistReader(decrypted).parse();
          return { plistBytes: decrypted, encrypted: true, plist, ...resolveKeyedArchive(plist) };
        } catch {
          // Try a shorter 16-byte-aligned prefix. Some DAT files carry a plaintext tail.
        }
      }
      n -= 16;
    }
    throw new Error("DAT decrypt failed");
  }

  function looksLikeMap(tree) {
    if (!tree || typeof tree !== "object" || Array.isArray(tree)) return false;
    const numericKeys = Object.keys(tree).filter((key) => /^-?\d+$/.test(key)).length;
    const hasObject = Object.values(tree).some((value) =>
      Array.isArray(value) && value.some((item) => item && typeof item === "object" && "objectId" in item),
    );
    return numericKeys >= 3 && hasObject;
  }

  function classifyDat(decoded) {
    const tree = decoded.tree;
    if (tree && typeof tree === "object" && !Array.isArray(tree)) {
      if ("curLevel" in tree || ("username" in tree && "gold" in tree)) return "userinfo";
      if (looksLikeMap(tree)) return "map";
    }
    if (Array.isArray(tree)) return tree.length ? "array" : "empty";
    return "generic";
  }

  function getInt(obj, key, fallback = 0) {
    const value = Number(obj?.[key]);
    return Number.isFinite(value) ? Math.trunc(value) : fallback;
  }

  function getString(obj, key, fallback = "") {
    const value = obj?.[key];
    return value == null ? fallback : String(value);
  }

  async function gzipBytes(bytes) {
    if (!("CompressionStream" in window)) throw new Error("this browser does not support gzip compression");
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function gunzipBytes(bytes) {
    if (!("DecompressionStream" in window)) throw new Error("this browser does not support gzip decompression");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function isGzip(bytes) {
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  }

  function numberValue(value, fallback = 0) {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (value && typeof value === "object") {
      for (const key of ["NS.intval", "NS.dblval", "NS.floatval", "NS.boolval"]) {
        if (key in value) return numberValue(value[key], fallback);
      }
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function parseBaseTile(value) {
    if (Array.isArray(value) && value.length >= 2) {
      return { x: numberValue(value[0]), y: numberValue(value[1]), valid: true };
    }
    const match = String(value || "").match(/\{\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\}/);
    if (!match) return { x: 0, y: 0, valid: false };
    return { x: Number(match[1]), y: Number(match[2]), valid: true };
  }

  function encMapdataBase64(x, y, flip) {
    const bytes = new Uint8Array(9);
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, numberValue(x), true);
    view.setFloat32(4, numberValue(y), true);
    view.setUint8(8, flip ? 1 : 0);
    return bytesToBase64(bytes);
  }

  function extractMapObjects(tree) {
    if (!tree || typeof tree !== "object" || Array.isArray(tree)) return [];
    const out = [];
    for (const [sceneKey, value] of Object.entries(tree)) {
      if (!Array.isArray(value)) continue;
      const sceneId = numberValue(sceneKey, 0);
      for (const item of value) {
        if (!item || typeof item !== "object" || !("objectId" in item)) continue;
        const tile = parseBaseTile(item.baseTile);
        if (!tile.valid) continue;
        const seq = out.length + 1;
        out.push({
          scene_id: sceneId,
          obj_kind: 0,
          key_id: seq,
          obj_id: numberValue(item.objectId, 0),
          seq_id: seq,
          enc_mapdata_b64: encMapdataBase64(tile.x, tile.y, !!item.isFlip),
          source_class: item.__class || "map",
        });
      }
    }
    return out;
  }

  async function datFilesToSave(files) {
    const decodedFiles = [];
    for (const file of files) {
      const decoded = decodeDatBytes(new Uint8Array(await file.arrayBuffer()));
      decoded.kind = classifyDat(decoded);
      decoded.fileName = file.name;
      decodedFiles.push(decoded);
    }
    const userDat = decodedFiles.find((item) => item.kind === "userinfo");
    const mapDat = decodedFiles.find((item) => item.kind === "map");
    if (!userDat) throw new Error("no userinfo DAT found");
    const user = userDat.tree || {};
    const out = {
      format: "moleworld-save",
      version: 1,
      exported_at: new Date().toISOString(),
      source: "local-dat",
      user_id: getInt(user, "userId", 0),
      user_info: {
        name: getString(user, "username", "Mole"),
        cur_level: Math.max(1, getInt(user, "curLevel", 1)),
        xp: getInt(user, "xp", 0),
        gold: getInt(user, "gold", 0),
        vip_gold: getInt(user, "vipGold", 0),
        vip_level: 0,
        icon_index: getInt(user, "iconIndex", 0),
        total_workers: getInt(user, "totalWorkers", 0),
        total_rooms: getInt(user, "totalRooms", 0),
      },
      objects: mapDat ? extractMapObjects(mapDat.tree) : [],
      social: null,
      progress: null,
    };
    if (mapDat) {
      out.user_info.map_blob_b64 = bytesToBase64(await gzipBytes(mapDat.plistBytes));
    }
    return {
      save: out,
      report: decodedFiles.map((item) => ({
        fileName: item.fileName,
        kind: item.kind,
        encrypted: item.encrypted,
        plistBytes: item.plistBytes.length,
      })),
    };
  }

  async function decodeMapBase64(value) {
    const clean = String(value || "")
      .replace(/^data:[^,]*,/i, "")
      .replace(/\s/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const inputBytes = base64ToBytes(clean);
    const plistBytes = isGzip(inputBytes) ? await gunzipBytes(inputBytes) : inputBytes;
    const decoded = decodeDatBytes(plistBytes);
    decoded.kind = classifyDat(decoded);
    if (decoded.kind !== "map") throw new Error(`base64 decoded as ${decoded.kind}, not map`);
    const mapBlobBytes = isGzip(inputBytes) ? inputBytes : await gzipBytes(decoded.plistBytes);
    return {
      objects: extractMapObjects(decoded.tree),
      map_blob_b64: bytesToBase64(mapBlobBytes),
      report: {
        kind: decoded.kind,
        encrypted: decoded.encrypted,
        plistBytes: decoded.plistBytes.length,
        blobBytes: mapBlobBytes.length,
      },
    };
  }

  window.MoleDat = {
    decodeDatBytes,
    datFilesToSave,
    classifyDat,
    decodeMapBase64,
  };
})();
