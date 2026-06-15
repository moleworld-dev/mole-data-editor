"use strict";

(() => {
  const DAT_KEY = new TextEncoder().encode("39653543fa0d66aa");
  const APPLE_EPOCH_UNIX_MS = 978307200000;
  const DAT_FOOTER_VERSION = new Uint8Array([0x00, 0x00, 0x01, 0x00]);
  const DAT_MD5_PLACEHOLDER = new Uint8Array([0x01, 0xee, 0x5e, 0x1d, 0x8b, 0xf7, 0x81, 0x57, 0x67, 0x54, 0xbe, 0x70, 0x93, 0x01, 0xff, 0xe9]);

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

  function subBytes(state) {
    for (let i = 0; i < 16; i += 1) state[i] = SBOX[state[i]];
  }

  function shiftRows(state) {
    const s = state.slice();
    state[1] = s[5]; state[5] = s[9]; state[9] = s[13]; state[13] = s[1];
    state[2] = s[10]; state[6] = s[14]; state[10] = s[2]; state[14] = s[6];
    state[3] = s[15]; state[7] = s[3]; state[11] = s[7]; state[15] = s[11];
  }

  function mixColumns(state) {
    for (let c = 0; c < 4; c += 1) {
      const i = c * 4;
      const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3];
      state[i] = gfMul(a0, 2) ^ gfMul(a1, 3) ^ a2 ^ a3;
      state[i + 1] = a0 ^ gfMul(a1, 2) ^ gfMul(a2, 3) ^ a3;
      state[i + 2] = a0 ^ a1 ^ gfMul(a2, 2) ^ gfMul(a3, 3);
      state[i + 3] = gfMul(a0, 3) ^ a1 ^ a2 ^ gfMul(a3, 2);
    }
  }

  function aesEncryptBlock(block, expandedKey) {
    const state = Uint8Array.from(block);
    addRoundKey(state, expandedKey, 0);
    for (let round = 1; round <= 9; round += 1) {
      subBytes(state);
      shiftRows(state);
      mixColumns(state);
      addRoundKey(state, expandedKey, round);
    }
    subBytes(state);
    shiftRows(state);
    addRoundKey(state, expandedKey, 10);
    return state;
  }

  function padPkcs7(bytes) {
    const actualPad = 16 - (bytes.length % 16 || 16) || 16;
    const out = new Uint8Array(bytes.length + actualPad);
    out.set(bytes);
    out.fill(actualPad, bytes.length);
    return out;
  }

  function aes128EcbEncrypt(bytes, key) {
    const padded = padPkcs7(bytes);
    const expandedKey = expandKey(key);
    const out = new Uint8Array(padded.length);
    for (let offset = 0; offset < padded.length; offset += 16) {
      out.set(aesEncryptBlock(padded.slice(offset, offset + 16), expandedKey), offset);
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

  function utf8Bytes(value) {
    return new TextEncoder().encode(String(value));
  }

  function utf16BeBytes(value) {
    const text = String(value);
    const out = new Uint8Array(text.length * 2);
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      out[i * 2] = (code >> 8) & 0xff;
      out[i * 2 + 1] = code & 0xff;
    }
    return out;
  }

  function writeUIntBE(out, value, size) {
    let n = BigInt(value);
    for (let i = size - 1; i >= 0; i -= 1) {
      out[i] = Number(n & 0xffn);
      n >>= 8n;
    }
  }

  function intSizeFor(value) {
    const n = BigInt(value);
    if (n <= 0xffn) return 1;
    if (n <= 0xffffn) return 2;
    if (n <= 0xffffffffn) return 4;
    return 8;
  }

  function intPowerForSize(size) {
    return size === 1 ? 0 : size === 2 ? 1 : size === 4 ? 2 : 3;
  }

  function encodeLength(type, length, out) {
    if (length < 15) {
      out.push((type << 4) | length);
      return;
    }
    out.push((type << 4) | 0x0f);
    const size = intSizeFor(length);
    out.push(0x10 | intPowerForSize(size));
    const bytes = new Uint8Array(size);
    writeUIntBE(bytes, length, size);
    out.push(...bytes);
  }

  function encodeUIntObject(value, out) {
    const size = intSizeFor(value);
    out.push(0x10 | intPowerForSize(size));
    const bytes = new Uint8Array(size);
    writeUIntBE(bytes, value, size);
    out.push(...bytes);
  }

  function concatBytes(chunks) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  function md5Bytes(input) {
    function add32(a, b) {
      return (a + b) & 0xffffffff;
    }
    function rol(num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt));
    }
    function cmn(q, a, b, x, s, t) {
      return add32(rol(add32(add32(a, q), add32(x, t)), s), b);
    }
    function ff(a, b, c, d, x, s, t) {
      return cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function gg(a, b, c, d, x, s, t) {
      return cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function hh(a, b, c, d, x, s, t) {
      return cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function ii(a, b, c, d, x, s, t) {
      return cmn(c ^ (b | ~d), a, b, x, s, t);
    }

    const bytes = Array.from(input);
    const originalBitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 0; i < 8; i += 1) bytes.push(Math.floor(originalBitLength / 2 ** (8 * i)) & 0xff);

    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const x = [];
      for (let i = 0; i < 16; i += 1) {
        const j = offset + i * 4;
        x[i] = bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24);
      }
      const aa = a, bb = b, cc = c, dd = d;
      a = ff(a, b, c, d, x[0], 7, -680876936); d = ff(d, a, b, c, x[1], 12, -389564586); c = ff(c, d, a, b, x[2], 17, 606105819); b = ff(b, c, d, a, x[3], 22, -1044525330);
      a = ff(a, b, c, d, x[4], 7, -176418897); d = ff(d, a, b, c, x[5], 12, 1200080426); c = ff(c, d, a, b, x[6], 17, -1473231341); b = ff(b, c, d, a, x[7], 22, -45705983);
      a = ff(a, b, c, d, x[8], 7, 1770035416); d = ff(d, a, b, c, x[9], 12, -1958414417); c = ff(c, d, a, b, x[10], 17, -42063); b = ff(b, c, d, a, x[11], 22, -1990404162);
      a = ff(a, b, c, d, x[12], 7, 1804603682); d = ff(d, a, b, c, x[13], 12, -40341101); c = ff(c, d, a, b, x[14], 17, -1502002290); b = ff(b, c, d, a, x[15], 22, 1236535329);
      a = gg(a, b, c, d, x[1], 5, -165796510); d = gg(d, a, b, c, x[6], 9, -1069501632); c = gg(c, d, a, b, x[11], 14, 643717713); b = gg(b, c, d, a, x[0], 20, -373897302);
      a = gg(a, b, c, d, x[5], 5, -701558691); d = gg(d, a, b, c, x[10], 9, 38016083); c = gg(c, d, a, b, x[15], 14, -660478335); b = gg(b, c, d, a, x[4], 20, -405537848);
      a = gg(a, b, c, d, x[9], 5, 568446438); d = gg(d, a, b, c, x[14], 9, -1019803690); c = gg(c, d, a, b, x[3], 14, -187363961); b = gg(b, c, d, a, x[8], 20, 1163531501);
      a = gg(a, b, c, d, x[13], 5, -1444681467); d = gg(d, a, b, c, x[2], 9, -51403784); c = gg(c, d, a, b, x[7], 14, 1735328473); b = gg(b, c, d, a, x[12], 20, -1926607734);
      a = hh(a, b, c, d, x[5], 4, -378558); d = hh(d, a, b, c, x[8], 11, -2022574463); c = hh(c, d, a, b, x[11], 16, 1839030562); b = hh(b, c, d, a, x[14], 23, -35309556);
      a = hh(a, b, c, d, x[1], 4, -1530992060); d = hh(d, a, b, c, x[4], 11, 1272893353); c = hh(c, d, a, b, x[7], 16, -155497632); b = hh(b, c, d, a, x[10], 23, -1094730640);
      a = hh(a, b, c, d, x[13], 4, 681279174); d = hh(d, a, b, c, x[0], 11, -358537222); c = hh(c, d, a, b, x[3], 16, -722521979); b = hh(b, c, d, a, x[6], 23, 76029189);
      a = hh(a, b, c, d, x[9], 4, -640364487); d = hh(d, a, b, c, x[12], 11, -421815835); c = hh(c, d, a, b, x[15], 16, 530742520); b = hh(b, c, d, a, x[2], 23, -995338651);
      a = ii(a, b, c, d, x[0], 6, -198630844); d = ii(d, a, b, c, x[7], 10, 1126891415); c = ii(c, d, a, b, x[14], 15, -1416354905); b = ii(b, c, d, a, x[5], 21, -57434055);
      a = ii(a, b, c, d, x[12], 6, 1700485571); d = ii(d, a, b, c, x[3], 10, -1894986606); c = ii(c, d, a, b, x[10], 15, -1051523); b = ii(b, c, d, a, x[1], 21, -2054922799);
      a = ii(a, b, c, d, x[8], 6, 1873313359); d = ii(d, a, b, c, x[15], 10, -30611744); c = ii(c, d, a, b, x[6], 15, -1560198380); b = ii(b, c, d, a, x[13], 21, 1309151649);
      a = ii(a, b, c, d, x[4], 6, -145523070); d = ii(d, a, b, c, x[11], 10, -1120210379); c = ii(c, d, a, b, x[2], 15, 718787259); b = ii(b, c, d, a, x[9], 21, -343485551);
      a = add32(a, aa); b = add32(b, bb); c = add32(c, cc); d = add32(d, dd);
    }

    const out = new Uint8Array(16);
    [a, b, c, d].forEach((word, wordIndex) => {
      for (let i = 0; i < 4; i += 1) out[wordIndex * 4 + i] = (word >>> (i * 8)) & 0xff;
    });
    return out;
  }

  function appendDatFooter(encryptedBytes) {
    const hashInput = concatBytes([encryptedBytes, DAT_FOOTER_VERSION, DAT_MD5_PLACEHOLDER]);
    return concatBytes([encryptedBytes, DAT_FOOTER_VERSION, md5Bytes(hashInput)]);
  }

  function isUidObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) && Number.isInteger(value.$uid);
  }

  function isDataObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) && typeof value.$data === "string";
  }

  function isRealObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) && "$real" in value;
  }

  function writeBinaryPlist(root) {
    const objects = [];
    const primitiveMemo = new Map();
    const uidMemo = new Map();
    let emitOrder = null;
    const emitted = new Set();

    function addEmit(index) {
      if (emitOrder && !emitted.has(index)) {
        emitOrder.push(index);
        emitted.add(index);
      }
    }

    function addObject(rep) {
      const index = objects.length;
      objects.push(rep);
      addEmit(index);
      return index;
    }

    function reserveObject(rep = null) {
      const index = objects.length;
      objects.push(rep);
      return index;
    }

    function rememberPrimitive(value, index) {
      primitiveMemo.set(`${typeof value}:${String(value)}`, index);
    }

    function isKeyedArchiveRoot(value) {
      return value && typeof value === "object" && !Array.isArray(value)
        && value.$archiver === "NSKeyedArchiver"
        && Array.isArray(value.$objects)
        && value.$top && isUidObject(value.$top.root);
    }

    function flatten(value) {
      if (isDataObject(value)) {
        return addObject({ type: "data", bytes: base64ToBytes(value.$data) });
      }
      if (isRealObject(value)) {
        const primitiveKey = `real:${Number(value.$real)}`;
        if (primitiveMemo.has(primitiveKey)) {
          const index = primitiveMemo.get(primitiveKey);
          if (objects[index] == null) flattenInto(index, value);
          return index;
        }
        const index = addObject({ type: "real", value: Number(value.$real) });
        primitiveMemo.set(primitiveKey, index);
        return index;
      }
      if (isUidObject(value)) {
        if (uidMemo.has(value.$uid)) {
          const index = uidMemo.get(value.$uid);
          if (objects[index] == null) flattenInto(index, value);
          return index;
        }
        const index = addObject({ type: "uid", value: value.$uid });
        uidMemo.set(value.$uid, index);
        return index;
      }
      if (Array.isArray(value)) {
        const index = addObject(null);
        flattenContainerInto(index, value);
        return index;
      }
      if (value && typeof value === "object") {
        const index = addObject(null);
        flattenContainerInto(index, value);
        return index;
      }
      const primitiveKey = `${typeof value}:${String(value)}`;
      if (primitiveMemo.has(primitiveKey)) {
        const index = primitiveMemo.get(primitiveKey);
        if (objects[index] == null) flattenInto(index, value);
        return index;
      }
      const index = addObject({ type: "primitive", value });
      rememberPrimitive(value, index);
      return index;
    }

    function flattenShallow(value, pending) {
      if (Array.isArray(value) || (value && typeof value === "object" && !isDataObject(value) && !isRealObject(value) && !isUidObject(value))) {
        const index = reserveObject();
        pending.push([index, value]);
        return index;
      }
      return flatten(value);
    }

    function flattenContainerInto(index, value) {
      addEmit(index);
      const pending = [];
      if (Array.isArray(value)) {
        objects[index] = {
          type: "array",
          itemRefs: value.map((item) => flattenShallow(item, pending)),
        };
      } else {
        const entries = Object.entries(value);
        objects[index] = {
          type: "dict",
          keyRefs: entries.map(([key]) => flatten(String(key))),
          valueRefs: entries.map(([key, child]) => {
            if (key === "$classname" && typeof child === "string" && entries.some(([entryKey]) => entryKey === "$classes")) {
              const primitiveKey = `${typeof child}:${String(child)}`;
              if (primitiveMemo.has(primitiveKey)) return primitiveMemo.get(primitiveKey);
              const childIndex = reserveObject();
              rememberPrimitive(child, childIndex);
              pending.push([childIndex, child]);
              return childIndex;
            }
            return flattenShallow(child, pending);
          }),
        };
      }
      pending.forEach(([childIndex, child]) => flattenInto(childIndex, child));
      return index;
    }

    function seedKeyedArchiveLayout(value) {
      emitOrder = [];
      objects.push(
        { type: "dict", keyRefs: [1, 2, 3, 4], valueRefs: [5, 6, 7, 8] },
        { type: "primitive", value: "$archiver" },
        { type: "primitive", value: "$objects" },
        { type: "primitive", value: "$top" },
        { type: "primitive", value: "$version" },
        { type: "primitive", value: value.$archiver },
        { type: "array", itemRefs: [] },
        { type: "dict", keyRefs: [], valueRefs: [] },
        { type: "primitive", value: value.$version },
      );
      [0, 1, 2, 3, 4, 5, 6].forEach(addEmit);
      for (let i = 1; i <= 5; i += 1) rememberPrimitive(objects[i].value, i);
      rememberPrimitive(value.$version, 8);

      const pendingObjects = [];
      objects[6].itemRefs = value.$objects.map((item) => {
        if (!item || typeof item !== "object") {
          const key = `${typeof item}:${String(item)}`;
          if (primitiveMemo.has(key)) return primitiveMemo.get(key);
          const slot = objects.length;
          objects.push(null);
          rememberPrimitive(item, slot);
          pendingObjects.push([slot, item]);
          return slot;
        }
        const slot = objects.length;
        objects.push(null);
        pendingObjects.push([slot, item]);
        return slot;
      });
      pendingObjects.forEach(([slot, item]) => {
        flattenInto(slot, item);
      });
      addEmit(7);
      objects[7].keyRefs = [flatten("root")];
      objects[7].valueRefs = [flatten(value.$top.root)];
      addEmit(8);
      return 0;
    }

    function flattenInto(index, value) {
      addEmit(index);
      if (isDataObject(value)) {
        objects[index] = { type: "data", bytes: base64ToBytes(value.$data) };
        return index;
      }
      if (isRealObject(value)) {
        objects[index] = { type: "real", value: Number(value.$real) };
        return index;
      }
      if (isUidObject(value)) {
        objects[index] = { type: "uid", value: value.$uid };
        uidMemo.set(value.$uid, index);
        return index;
      }
      if (Array.isArray(value)) {
        flattenContainerInto(index, value);
        return index;
      }
      if (value && typeof value === "object") {
        flattenContainerInto(index, value);
        return index;
      }
      objects[index] = { type: "primitive", value };
      rememberPrimitive(value, index);
      return index;
    }

    const topObject = isKeyedArchiveRoot(root) ? seedKeyedArchiveLayout(root) : flatten(root);
    const refSize = intSizeFor(Math.max(objects.length - 1, 0));
    const chunks = [utf8Bytes("bplist00")];
    const offsets = [];

    function refBytes(ref) {
      const out = new Uint8Array(refSize);
      writeUIntBE(out, ref, refSize);
      return out;
    }

    function objectBytes(obj) {
      const out = [];
      if (obj.type === "primitive") {
        const value = obj.value;
        if (value === null || value === undefined) {
          out.push(0x00);
        } else if (value === false) {
          out.push(0x08);
        } else if (value === true) {
          out.push(0x09);
        } else if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
          encodeUIntObject(value, out);
        } else if (typeof value === "number") {
          out.push(0x23);
          const bytes = new Uint8Array(8);
          new DataView(bytes.buffer).setFloat64(0, value, false);
          out.push(...bytes);
        } else {
          const text = String(value);
          const ascii = /^[\x00-\x7f]*$/.test(text);
          const bytes = ascii ? utf8Bytes(text) : utf16BeBytes(text);
          encodeLength(ascii ? 0x05 : 0x06, text.length, out);
          out.push(...bytes);
        }
      } else if (obj.type === "uid") {
        const size = intSizeFor(obj.value);
        out.push(0x80 | (size - 1));
        const bytes = new Uint8Array(size);
        writeUIntBE(bytes, obj.value, size);
        out.push(...bytes);
      } else if (obj.type === "real") {
        out.push(0x23);
        const bytes = new Uint8Array(8);
        new DataView(bytes.buffer).setFloat64(0, obj.value, false);
        out.push(...bytes);
      } else if (obj.type === "data") {
        encodeLength(0x04, obj.bytes.length, out);
        out.push(...obj.bytes);
      } else if (obj.type === "array") {
        encodeLength(0x0a, obj.itemRefs.length, out);
        for (const ref of obj.itemRefs) out.push(...refBytes(ref));
      } else if (obj.type === "dict") {
        encodeLength(0x0d, obj.keyRefs.length, out);
        for (const ref of obj.keyRefs) out.push(...refBytes(ref));
        for (const ref of obj.valueRefs) out.push(...refBytes(ref));
      }
      return Uint8Array.from(out);
    }

    const order = emitOrder || objects.map((_, index) => index);
    for (const index of order) {
      offsets[index] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      chunks.push(objectBytes(objects[index]));
    }

    const offsetTableOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const offsetSize = intSizeFor(Math.max(...offsets, 0));
    const offsetTable = new Uint8Array(offsets.length * offsetSize);
    offsets.forEach((offset, index) => writeUIntBE(offsetTable.subarray(index * offsetSize, (index + 1) * offsetSize), offset, offsetSize));
    chunks.push(offsetTable);

    const trailer = new Uint8Array(32);
    trailer[6] = offsetSize;
    trailer[7] = refSize;
    writeUIntBE(trailer.subarray(8, 16), objects.length, 8);
    writeUIntBE(trailer.subarray(16, 24), topObject, 8);
    writeUIntBE(trailer.subarray(24, 32), offsetTableOffset, 8);
    chunks.push(trailer);
    return concatBytes(chunks);
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
          return {
            plistBytes: decrypted,
            encrypted: true,
            datTailBytes: raw.slice(n),
            plist,
            ...resolveKeyedArchive(plist),
          };
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
    return numericKeys >= 1 && hasObject;
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
          source_item: item,
        });
      }
    }
    return out;
  }

  function userDatToPlayerData(decoded, source = "local-dat") {
    const user = decoded.tree || {};
    const hidden = {
      available_workers: getInt(user, "availableWorkers", getInt(user, "totalWorkers", 3)),
      upgrade_percent: getInt(user, "upgradePercent", 0),
      next_story_section_id: getInt(user, "nextStorySectionId", 1),
      cur_quest_id: getInt(user, "curQuestId", 0),
      cur_quest_result: numberValue(user.curQuestResult, 0),
      next_quest_id: getInt(user, "nextQuestId", 1),
      map_extend: getInt(user, "mapExtend", 1),
      npcs: decodeUserInfoNpcs(user),
      gifts: decodedUserArchiveField(decoded, "gifts") || [],
      achieve_unlock: decodedUserArchiveField(decoded, "achieveUnlock") || null,
      attribute_value: decodedUserArchiveField(decoded, "attributeValue") || null,
    };
    return {
      format: "moleworld-player",
      version: 1,
      exported_at: new Date().toISOString(),
      source,
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
      user_hidden: hidden,
    };
  }

  async function mapDatToMapData(decoded, source = "local-dat") {
    return {
      format: "moleworld-map",
      version: 1,
      exported_at: new Date().toISOString(),
      source,
      map_blob_b64: bytesToBase64(await gzipBytes(decoded.plistBytes)),
      map_plist_b64: bytesToBase64(decoded.plistBytes),
      map_encrypted: decoded.encrypted,
      objects: extractMapObjects(decoded.tree),
    };
  }

  async function datFileToData(file) {
    const decoded = decodeDatBytes(new Uint8Array(await file.arrayBuffer()));
    decoded.kind = classifyDat(decoded);
    decoded.fileName = file.name;
    const report = {
      fileName: decoded.fileName,
      kind: decoded.kind,
      encrypted: decoded.encrypted,
      plistBytes: decoded.plistBytes.length,
    };
    if (decoded.kind === "userinfo") {
      return { kind: decoded.kind, player: userDatToPlayerData(decoded), report };
    }
    if (decoded.kind === "map") {
      return { kind: decoded.kind, map: await mapDatToMapData(decoded), report };
    }
    return { kind: decoded.kind, decoded, report };
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
    const player = userDatToPlayerData(userDat);
    const out = {
      format: "moleworld-save",
      version: 1,
      exported_at: new Date().toISOString(),
      source: "local-dat",
      user_id: player.user_id,
      user_info: player.user_info,
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
      map_plist_b64: bytesToBase64(decoded.plistBytes),
      encrypted: decoded.encrypted,
      report: {
        kind: decoded.kind,
        encrypted: decoded.encrypted,
        plistBytes: decoded.plistBytes.length,
        blobBytes: mapBlobBytes.length,
      },
    };
  }

  function archiveUid(index) {
    return { $uid: index };
  }

  function createArchiveBuilder() {
    const objects = ["$null"];
    const classCache = new Map();
    const keyStringCache = new Map();

    function add(value) {
      objects.push(value);
      return objects.length - 1;
    }

    function reserve() {
      objects.push(null);
      return objects.length - 1;
    }

    function set(index, value) {
      objects[index] = value;
      return index;
    }

    function classIndex(className, classes) {
      const allClasses = classes || [className, "NSObject"];
      const key = `${className}\0${allClasses.join("\0")}`;
      if (!classCache.has(key)) {
        classCache.set(key, add({
          $classes: allClasses,
          $classname: className,
        }));
      }
      return classCache.get(key);
    }

    function addValue(value) {
      if (Array.isArray(value)) return addArray(value);
      if (value && typeof value === "object") {
        if (isDataObject(value) || isUidObject(value)) return add(value);
        return addDict(value);
      }
      return add(value);
    }

    function addDict(entries, className = "NSDictionary", classes) {
      const keyRefs = [];
      const valueRefs = [];
      for (const [key, value] of Object.entries(entries)) {
        keyRefs.push(archiveUid(add(String(key))));
        valueRefs.push(archiveUid(addValue(value)));
      }
      return add({
        $class: archiveUid(classIndex(className, classes || [className, "NSObject"])),
        "NS.keys": keyRefs,
        "NS.objects": valueRefs,
      });
    }

    function addDictRefs(entries, className = "NSDictionary", classes) {
      const keyRefs = [];
      const valueRefs = [];
      for (const [key, index] of Object.entries(entries)) {
        keyRefs.push(archiveUid(add(String(key))));
        valueRefs.push(archiveUid(index));
      }
      return add({
        $class: archiveUid(classIndex(className, classes || [className, "NSObject"])),
        "NS.keys": keyRefs,
        "NS.objects": valueRefs,
      });
    }

    function addArray(items, className = "NSArray") {
      return add({
        $class: archiveUid(classIndex(className, [className, "NSObject"])),
        "NS.objects": items.map((item) => archiveUid(addValue(item))),
      });
    }

    function addArrayRefs(itemIndexes, className = "NSArray") {
      return add({
        $class: archiveUid(classIndex(className, [className, "NSObject"])),
        "NS.objects": itemIndexes.map((index) => archiveUid(index)),
      });
    }

    function addRaw(value) {
      return add(value);
    }

    function addKeyString(value) {
      const key = String(value);
      if (!keyStringCache.has(key)) keyStringCache.set(key, add(key));
      return keyStringCache.get(key);
    }

    function finish(rootIndex) {
      return {
        $archiver: "NSKeyedArchiver",
        $objects: objects,
        $top: { root: archiveUid(rootIndex) },
        $version: 100000,
      };
    }

    return { addDict, addDictRefs, addArray, addArrayRefs, addRaw, addKeyString, reserve, set, classIndex, finish };
  }

  function archiveToDatBytes(rootIndex, builder) {
    const plistBytes = writeBinaryPlist(builder.finish(rootIndex));
    return aes128EcbEncrypt(plistBytes, DAT_KEY);
  }

  function playerDataToUserTree(playerData) {
    const info = playerData?.user_info || {};
    const hidden = playerData?.user_hidden || {};
    const totalWorkers = getInt(info, "total_workers", getInt(info, "totalWorkers", 3));
    const availableWorkers = getInt(hidden, "available_workers", getInt(hidden, "availableWorkers", totalWorkers));
    const tree = {
      __class: "UserInfoData",
      username: getString(info, "name", "Mole"),
      userId: getInt(playerData, "user_id", getInt(playerData, "userId", 0)),
      curLevel: Math.max(1, getInt(info, "cur_level", getInt(info, "curLevel", 1))),
      xp: getInt(info, "xp", 0),
      gold: getInt(info, "gold", 300),
      vipGold: getInt(info, "vip_gold", getInt(info, "vipGold", 0)),
      totalWorkers,
      availableWorkers,
      upgradePercent: getInt(hidden, "upgrade_percent", getInt(hidden, "upgradePercent", 0)),
      iconIndex: getInt(info, "icon_index", getInt(info, "iconIndex", 0)),
      totalRooms: getInt(info, "total_rooms", getInt(info, "totalRooms", 1)),
      nextStorySectionId: getInt(hidden, "next_story_section_id", getInt(hidden, "nextStorySectionId", 1)),
      curQuestId: getInt(hidden, "cur_quest_id", getInt(hidden, "curQuestId", 0)),
      curQuestResult: numberValue(hidden.cur_quest_result ?? hidden.curQuestResult, 0),
      nextQuestId: getInt(hidden, "next_quest_id", getInt(hidden, "nextQuestId", 1)),
      mapExtend: getInt(hidden, "map_extend", getInt(hidden, "mapExtend", 1)),
      npcs: buildUserInfoNpcs(hidden),
    };

    const gifts = userInfoArray(hidden.gifts);
    if (gifts.length) tree.gifts = gifts;

    const achieveUnlock = userInfoDictionary(hidden.achieve_unlock ?? hidden.achieveUnlock);
    if (achieveUnlock) tree.achieveUnlock = achieveUnlock;

    const attributeValue = userInfoDictionary(hidden.attribute_value ?? hidden.attributeValue);
    if (attributeValue) tree.attributeValue = attributeValue;

    return tree;
  }

  function appleArchiveNow() {
    return (Date.now() - APPLE_EPOCH_UNIX_MS) / 1000;
  }

  function decodeUserInfoNpcs(source) {
    const npcs = userInfoArray(source?.npcs)
      .filter((npc) => npc && typeof npc === "object")
      .map((npc) => ({
        npc_id: getInt(npc, "npc_id", getInt(npc, "npcId", 0)),
        index: getInt(npc, "index", 0),
        last_cool_down_time: numberValue(npc.last_cool_down_time ?? npc.lastCoolDownTime, appleArchiveNow()),
      }))
      .filter((npc) => npc.npc_id);
    if (npcs.length) return npcs;
    const now = appleArchiveNow();
    return [97, 98, 93, 103].map((npcId) => ({
      npc_id: npcId,
      index: 0,
      last_cool_down_time: now,
    }));
  }

  function buildUserInfoNpcs(source) {
    const npcs = userInfoArray(source?.npcs)
      .filter((npc) => npc && typeof npc === "object")
      .map((npc) => ({
        __class: "NpcData",
        npcId: getInt(npc, "npc_id", getInt(npc, "npcId", 0)),
        index: getInt(npc, "index", 0),
        lastCoolDownTime: numberValue(npc.last_cool_down_time ?? npc.lastCoolDownTime, appleArchiveNow()),
      }))
      .filter((npc) => npc.npcId);
    if (npcs.length) return npcs;
    const now = appleArchiveNow();
    return [97, 98, 93, 103].map((npcId) => ({
      __class: "NpcData",
      npcId,
      index: 0,
      lastCoolDownTime: now,
    }));
  }

  function userInfoArray(value) {
    return Array.isArray(value) ? clonePlain(value) : [];
  }

  function userInfoDictionary(value) {
    if (Array.isArray(value)) {
      const typedEntries = value
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
          key: nsNumberArchiveObject(entry.key),
          value: nsNumberArchiveObject(entry.value),
        }));
      return typedEntries.length ? { __class: "NSMutableDictionary", __typedEntries: typedEntries } : null;
    }
    if (!value || typeof value !== "object") return null;
    const entries = Object.entries(value).filter(([key]) => key !== "__class" && key !== "__entries" && key !== "source_item");
    if (!entries.length) return null;
    if (entries.some(([key]) => key === "[object Object]")) return null;
    return {
      __class: value.__class || "NSMutableDictionary",
      __entries: entries,
    };
  }

  function nsNumberArchiveObject(value) {
    if (value && typeof value === "object") {
      if ("NS.intval" in value) return { __class: "NSNumber", "NS.intval": getInt(value, "NS.intval", 0) };
      if ("NS.dblval" in value) return { __class: "NSNumber", "NS.dblval": numberValue(value["NS.dblval"], 0) };
      if ("NS.floatval" in value) return { __class: "NSNumber", "NS.floatval": numberValue(value["NS.floatval"], 0) };
      if ("value" in value) return nsNumberArchiveObject(value.value);
    }
    return { __class: "NSNumber", "NS.intval": getInt({ value }, "value", 0) };
  }

  function decodedUserArchiveField(decoded, key) {
    const root = archiveRootDictionary(decoded.plist);
    if (!root || !(key in root)) return null;
    return archiveValueToTree(decoded.plist, root[key]);
  }

  function archiveClassName(objects, dict) {
    const classUid = uidOf(dict?.$class);
    const cls = classUid == null ? null : objects?.[classUid];
    return cls?.$classname || cls?.$classes?.[0] || null;
  }

  function archiveValueToTree(plist, value, depth = 0) {
    if (depth > 48) return null;
    const objects = plist?.$objects;
    const uid = uidOf(value);
    if (uid != null) return archiveValueToTree(plist, objects?.[uid], depth + 1);
    if (Array.isArray(value)) return value.map((item) => archiveValueToTree(plist, item, depth + 1));
    if (!value || typeof value !== "object") return value;
    if (isDataObject(value) || isRealObject(value)) return clonePlain(value);

    const cls = archiveClassName(objects, value);
    if (cls === "NSNumber") return numberValue(value, 0);
    if (Array.isArray(value["NS.keys"]) && Array.isArray(value["NS.objects"])) {
      return value["NS.keys"].map((keyRef, index) => ({
        key: archiveValueToTree(plist, keyRef, depth + 1),
        value: archiveValueToTree(plist, value["NS.objects"][index], depth + 1),
      }));
    }
    if (Array.isArray(value["NS.objects"])) {
      return value["NS.objects"].map((item) => archiveValueToTree(plist, item, depth + 1));
    }
    const out = {};
    if (cls) out.__class = cls;
    for (const [entryKey, child] of Object.entries(value)) {
      if (entryKey !== "$class") out[entryKey] = archiveValueToTree(plist, child, depth + 1);
    }
    return out;
  }

  function playerDataToDatBytes(playerData) {
    const builder = createArchiveBuilder();
    const rootIndex = addTreeValueOriginalOrder(builder, playerDataToUserTree(playerData));
    const plistBytes = writeBinaryPlist(builder.finish(rootIndex));
    return appendDatFooter(aes128EcbEncrypt(plistBytes, DAT_KEY));
  }

  function clonePlain(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function baseTileStringFromObject(obj) {
    const placement = parseBaseTileFromEncMapdata(obj?.enc_mapdata_b64);
    const x = Number.isFinite(placement.x) ? placement.x : 0;
    const y = Number.isFinite(placement.y) ? placement.y : 0;
    return `{${Number(x.toFixed(3))}, ${Number(y.toFixed(3))}}`;
  }

  function parseBaseTileFromEncMapdata(value) {
    try {
      const bytes = base64ToBytes(value || "");
      if (bytes.length < 9) return { x: 0, y: 0, flip: false };
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return {
        x: view.getFloat32(0, true),
        y: view.getFloat32(4, true),
        flip: view.getUint8(8) !== 0,
      };
    } catch {
      return { x: 0, y: 0, flip: false };
    }
  }

  function mapDataToTree(mapData) {
    const scenes = new Map();
    for (const obj of mapData?.objects || []) {
      const sceneId = String(getInt(obj, "scene_id", 0));
      if (!scenes.has(sceneId)) scenes.set(sceneId, []);
      const placement = parseBaseTileFromEncMapdata(obj.enc_mapdata_b64);
      const sourceItem = obj.source_item && typeof obj.source_item === "object" ? clonePlain(obj.source_item) : {};
      const className = obj.source_class && obj.source_class !== "map" && obj.source_class !== "map-editor"
        ? String(obj.source_class)
        : (sourceItem.__class || "TMMapDataBase");
      scenes.get(sceneId).push({
        ...sourceItem,
        __class: className,
        objectId: getInt(obj, "obj_id", getInt(obj, "objectId", 0)),
        baseTile: baseTileStringFromObject(obj),
        isFlip: !!placement.flip,
      });
    }
    return Object.fromEntries([...scenes.entries()].sort((a, b) => Number(a[0]) - Number(b[0])));
  }

  function mapArchiveBaseTree(mapData) {
    if (mapData?.map_plist_b64) {
      try {
        return clonePlain(decodeDatBytes(base64ToBytes(mapData.map_plist_b64)).tree);
      } catch {
        // Fall through to a minimal map tree if the stored source plist is not usable.
      }
    }
    return { __class: "NSMutableDictionary" };
  }

  function isMapObjectScene(value) {
    return Array.isArray(value) && value.some((item) => item && typeof item === "object" && "objectId" in item);
  }

  function mergedMapTree(mapData) {
    const tree = mapArchiveBaseTree(mapData);
    if (!tree || typeof tree !== "object" || Array.isArray(tree)) return mapDataToTree(mapData);
    const nextScenes = mapDataToTree(mapData);
    const entries = [];
    const seen = new Set();
    for (const key of mapArchiveRootKeyOrder(mapData)) {
      if (!(key in tree)) continue;
      const value = tree[key];
      entries.push([key, isMapObjectScene(value) ? (nextScenes[key] || []) : value]);
      seen.add(key);
    }
    for (const [key, value] of Object.entries(nextScenes)) {
      if (!seen.has(key)) {
        entries.push([key, value]);
        seen.add(key);
      }
    }
    for (const [key, value] of Object.entries(tree)) {
      if (key !== "__class" && !seen.has(key)) entries.push([key, value]);
    }
    return {
      __class: tree.__class || "NSMutableDictionary",
      __entries: entries,
    };
  }

  function mapArchiveRootKeyOrder(mapData) {
    if (!mapData?.map_plist_b64) return [];
    try {
      const decoded = decodeDatBytes(base64ToBytes(mapData.map_plist_b64));
      const objects = decoded.plist?.$objects;
      const root = archiveRootDictionary(decoded.plist);
      if (!Array.isArray(objects) || !Array.isArray(root?.["NS.keys"])) return [];
      return root["NS.keys"].map((ref) => archiveKeyText(objects, ref)).filter((key) => key != null);
    } catch {
      return [];
    }
  }

  function archiveClassesFor(className) {
    if (className === "NSMutableDictionary") return ["NSMutableDictionary", "NSDictionary", "NSObject"];
    if (className === "NSDictionary") return ["NSDictionary", "NSObject"];
    if (className === "NSMutableArray") return ["NSMutableArray", "NSArray", "NSObject"];
    if (className === "NSArray") return ["NSArray", "NSObject"];
    if (className === "NSNumber") return ["NSNumber", "NSValue", "NSObject"];
    if (
      className === "TMMapDataFarm"
      || className === "TMMapDataBuilding"
      || className === "TMMapDataSpacials"
      || className === "TMMapDataFirework"
      || className === "TMMapDataShop"
      || className === "TMMapDataShip"
      || className === "TMMapDataRestaurant"
      || className === "TMMapDataTransObject"
      || className === "TMMapDataApartment"
      || className === "TMMapDataSuperShellTree"
      || className === "TMMapDataCafeShop"
      || className === "TMMapDataRewardBox"
      || className === "TMMapDataYellowDuck"
      || className === "TMMapDataWaterTower"
    ) return [className, "TMMapDataBase", "NSObject"];
    if (className === "TMMapDataBase") return ["TMMapDataBase", "NSObject"];
    return [className, "NSObject"];
  }

  function isDirectArchiveScalar(value) {
    return value == null || typeof value === "number" || typeof value === "boolean";
  }

  function isRealArchiveField(key) {
    return key === "NS.dblval"
      || key === "NS.floatval"
      || key === "curQuestResult"
      || key === "lastCoolDownTime"
      || key === "beginTime"
      || key === "coolingTime"
      || key === "gameCoolTime";
  }

  function addTreeValue(builder, value) {
    if (Array.isArray(value)) {
      return builder.addArrayRefs(value.map((item) => addTreeValue(builder, item)), "NSMutableArray");
    }
    if (value && typeof value === "object") {
      const className = value.__class || "NSMutableDictionary";
      const entries = Object.entries(value).filter(([key]) => key !== "__class");
      if (className === "NSMutableDictionary" || className === "NSDictionary") {
        const refs = {};
        for (const [key, child] of entries) refs[key] = addTreeValue(builder, child);
        return builder.addDictRefs(refs, className, archiveClassesFor(className));
      }
      const out = {
        $class: archiveUid(builder.classIndex(className, archiveClassesFor(className))),
      };
      for (const [key, child] of entries) {
        out[key] = isDirectArchiveScalar(child) ? child : archiveUid(addTreeValue(builder, child));
      }
      return builder.addRaw(out);
    }
    return builder.addRaw(value);
  }

  function addTreeValueOriginalOrder(builder, value) {
    if (isRealObject(value)) return builder.addRaw(value);

    if (Array.isArray(value)) {
      const index = builder.reserve();
      const classUid = builder.classIndex("NSMutableArray", archiveClassesFor("NSMutableArray"));
      const refs = value.map((item) => archiveUid(addTreeValueOriginalOrder(builder, item)));
      return builder.set(index, {
        $class: archiveUid(classUid),
        "NS.objects": refs,
      });
    }

    if (value && typeof value === "object") {
      const className = value.__class || "NSMutableDictionary";
      const entries = (Array.isArray(value.__entries) ? value.__entries : Object.entries(value))
        .filter(([key]) => key !== "__class" && key !== "source_item" && key !== "__entries" && key !== "__typedEntries");

      if (className === "NSMutableDictionary" || className === "NSDictionary") {
        const index = builder.reserve();
        const classUid = builder.classIndex(className, archiveClassesFor(className));
        const typedEntries = Array.isArray(value.__typedEntries) ? value.__typedEntries : null;
        const keyRefs = typedEntries
          ? typedEntries.map((entry) => archiveUid(addTreeValueOriginalOrder(builder, entry.key)))
          : entries.map(([key]) => archiveUid(builder.addKeyString(key)));
        const valueRefs = typedEntries
          ? typedEntries.map((entry) => archiveUid(addTreeValueOriginalOrder(builder, entry.value)))
          : entries.map(([key, child]) => {
            const value = isRealArchiveField(key) ? { $real: numberValue(child, 0) } : child;
            return archiveUid(addTreeValueOriginalOrder(builder, value));
          });
        return builder.set(index, {
          $class: archiveUid(classUid),
          "NS.keys": keyRefs,
          "NS.objects": valueRefs,
        });
      }

      const index = builder.reserve();
      const classUid = builder.classIndex(className, archiveClassesFor(className));
      const out = { $class: archiveUid(classUid) };
      for (const [key, child] of entries) {
        if (isRealArchiveField(key)) {
          out[key] = { $real: numberValue(child, 0) };
        } else {
          out[key] = isDirectArchiveScalar(child) ? child : archiveUid(addTreeValueOriginalOrder(builder, child));
        }
      }
      return builder.set(index, out);
    }

    return builder.addRaw(value);
  }

  function archiveRootDictionary(plist) {
    const objects = plist?.$objects;
    const rootUid = uidOf(plist?.$top?.root);
    const root = Array.isArray(objects) && rootUid != null ? objects[rootUid] : null;
    return root && typeof root === "object" ? root : null;
  }

  function archiveKeyText(objects, ref) {
    const uid = uidOf(ref);
    return uid == null ? null : String(objects[uid]);
  }

  function mapDataToDatBytes(mapData) {
    const builder = createArchiveBuilder();
    const rootIndex = addTreeValueOriginalOrder(builder, mergedMapTree(mapData));
    return writeBinaryPlist(builder.finish(rootIndex));
  }

  window.MoleDat = {
    decodeDatBytes,
    datFileToData,
    datFilesToSave,
    classifyDat,
    decodeMapBase64,
    playerDataToDatBytes,
    mapDataToDatBytes,
  };
})();
