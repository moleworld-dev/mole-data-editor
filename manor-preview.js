"use strict";

(() => {
  const ASSET_ROOT = "./exported-assets/";
  const TILE_WIDTH = 60;
  const TILE_HEIGHT = 30;
  const HALF_TILE_WIDTH = TILE_WIDTH / 2;
  const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;
  const MAP_HEIGHT = 1110;
  const ORIGIN_TILE_X = 30;
  const ORIGIN_TILE_Y = 30;
  const MAP_INIT_WIDTH = 1200;
  const MAP_INIT_HEIGHT = 795;
  const MAP_INITIAL_VIEW_X = 0;
  const MAP_INITIAL_VIEW_Y = 0;
  const MAP_GROUND_Y = -1110;
  const MAP_GROUND_HEIGHT = MAP_HEIGHT * 3;
  const MAP_GROUND_COLOR = [74 / 255, 166 / 255, 57 / 255, 1];
  const MAP_LEFT_SEA_X = -1080;
  const MAP_LEFT_SEA_WIDTH = 250;
  const MAP_LEFT_BEACH_X = -830;
  const MAP_LEFT_BEACH_WIDTH = 725;
  const MAP_LEFT_SEA_COLOR = [83 / 255, 175 / 255, 203 / 255, 1];
  const MAP_LEFT_BEACH_COLOR = [227 / 255, 208 / 255, 146 / 255, 1];
  const MAP_BOUND_PADDING = 36;
  const MAP_MAX_ZOOM = 1.8;
  const SELECTED_GLOW_PASSES = [
    { expand: 22, color: [1, 0.75, 0.12, 0.14] },
    { expand: 14, color: [1, 0.82, 0.18, 0.22] },
    { expand: 7, color: [1, 0.95, 0.48, 0.34] },
  ];
  const BACKGROUND_LAYER_X = 0;
  const BACKGROUND_LAYER_Y = 0;
  const PROPERTY_TABLES = new Set(["property", "propertyHV"]);
  const NAME_TABLES = new Set(["zh-Hans.lproj_property_description", "zh-Hans.lproj_property_descriptionHV"]);
  const SKIPPED_BACKGROUND_IMAGES = new Set(["", "flower", "tree8"]);

  const state = {
    ready: false,
    error: null,
    saveRows: [],
    sprites: [],
    backgroundSprites: [],
    gridLines: [],
    objectInfo: new Map(),
    frameByName: new Map(),
    textureCache: new Map(),
    atlasSizes: new Map(),
    gl: null,
    programs: null,
    buffers: null,
    canvas: null,
    status: null,
    tooltip: null,
    fitBtn: null,
    mapBtn: null,
    gridBtn: null,
    missingBtn: null,
    showMap: true,
    showGrid: false,
    showMissing: true,
    panX: 0,
    panY: 0,
    zoom: 1,
    dragging: false,
    pointer: null,
    hovered: null,
    selectedIndex: null,
    objectDragging: null,
    editor: {
      enabled: false,
      onSelect: null,
      onMove: null,
    },
    needsFit: true,
  };

  function text(value, fallback = "") {
    return value == null || value === "" ? fallback : String(value);
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function setStatus(message, kind = "") {
    if (!state.status) return;
    state.status.textContent = message;
    state.status.className = `preview-status ${kind}`.trim();
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`);
    return JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
  }

  function md5(input) {
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
    const bytes = Array.from(new TextEncoder().encode(input));
    const originalBitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 0; i < 8; i += 1) bytes.push((originalBitLength / 2 ** (8 * i)) & 0xff);
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
    return [a, b, c, d].map((word) => {
      let out = "";
      for (let i = 0; i < 4; i += 1) out += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
      return out;
    }).join("");
  }

  async function loadImage(src) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    await image.decode();
    return image;
  }

  function mergeCatalog(catalog) {
    const byId = new Map();
    for (const row of catalog) {
      const id = text(row.id || row.raw?.ID).trim();
      if (!id) continue;
      let info = byId.get(id);
      if (!info) {
        info = {
          id,
          name: `#${id}`,
          description: "",
          raw: {},
          texture: null,
          sourceTables: [],
        };
        byId.set(id, info);
      }
      const source = text(row.source_table);
      info.sourceTables.push(source);
      if (PROPERTY_TABLES.has(source)) info.raw = { ...info.raw, ...(row.raw || {}) };
      if (NAME_TABLES.has(source)) {
        if (row.name) info.name = text(row.name).trim();
        if (row.raw?.description) info.description = text(row.raw.description).trim();
      }
      if (!info.texture && row.texture?.png) info.texture = row.texture;
    }
    return byId;
  }

  async function buildAssetIndex() {
    const [catalog, frames, backgroundRows] = await Promise.all([
      fetchJson(`${ASSET_ROOT}object-catalog.json`),
      fetchJson(`${ASSET_ROOT}atlas-frames.json`),
      fetchJson(`${ASSET_ROOT}tables/Background.json`),
    ]);
    state.objectInfo = mergeCatalog(catalog);
    state.frameByName = new Map(frames.map((frame) => [frame.frame_name, frame]));

    for (const info of state.objectInfo.values()) {
      info.md5FrameName = `${md5(info.id)}.png`;
    }
    state.backgroundSprites = buildBackgroundSprites(backgroundRows);
  }

  function standaloneAsset(info) {
    if (!info?.texture?.png) return null;
    return {
      kind: "image",
      src: `${ASSET_ROOT}${info.texture.png.replace(/\\/g, "/")}`,
      width: num(info.texture.width, 96),
      height: num(info.texture.height, 96),
      frame: null,
    };
  }

  function texturePath(name) {
    return text(name).replace(/\\/g, "/").replace(/\.pvr\.ccz$/i, ".png").replace(/\.pvr$/i, ".png");
  }

  function assetFromFrame(frame) {
    if (!frame) return null;
    const colorRect = parseRectText(frame.raw?.sourceColorRect);
    return {
      kind: "atlas",
      src: `${ASSET_ROOT}textures/png/${texturePath(frame.texture)}`,
      width: num(frame.source_size?.w, frame.rect?.w || 96),
      height: num(frame.source_size?.h, frame.rect?.h || 96),
      trim: colorRect
        ? { x: colorRect.x, y: colorRect.y, width: colorRect.w, height: colorRect.h }
        : { x: 0, y: 0, width: num(frame.rect?.w, 96), height: num(frame.rect?.h, 96) },
      frame,
    };
  }

  function frameAsset(info) {
    if (!info) return null;
    const directFrame = `${info.id}.png`;
    const direct = state.frameByName.get(directFrame);
    const encrypted = state.frameByName.get(info.md5FrameName);
    const frame = direct || encrypted;
    return assetFromFrame(frame);
  }

  function parseRectText(value) {
    const match = text(value).match(/\{\{(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\},\{(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\}\}/);
    if (!match) return null;
    return {
      x: Number(match[1]),
      y: Number(match[2]),
      w: Number(match[3]),
      h: Number(match[4]),
    };
  }

  function parsePointText(value) {
    const match = text(value).match(/\{\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\}/);
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
  }

  function assetForObject(info) {
    return standaloneAsset(info) || frameAsset(info);
  }

  function buildBackgroundSprites(rows) {
    if (!Array.isArray(rows)) return [];
    const sprites = [];
    for (const [index, row] of rows.entries()) {
      const image = text(row.image).trim();
      const animation = num(row.animation, 0);
      if (animation !== 0 || SKIPPED_BACKGROUND_IMAGES.has(image)) continue;
      const position = parsePointText(row.position);
      const anchor = parsePointText(row.anchor) || { x: 0.5, y: 0.5 };
      if (!position) continue;
      const frame = state.frameByName.get(`${image}.png`);
      const asset = assetFromFrame(frame);
      if (!asset) continue;
      const scale = Math.max(0.01, num(row.scale, 1));
      const width = asset.width * scale;
      const height = asset.height * scale;
      const layerX = BACKGROUND_LAYER_X + position.x;
      const layerY = BACKGROUND_LAYER_Y + position.y;
      const x = layerX - width * anchor.x;
      const y = MAP_HEIGHT - layerY - height * (1 - anchor.y);
      sprites.push({
        key: `bg:${index}:${image}`,
        row,
        info: { id: image, name: image },
        asset,
        x,
        y,
        width,
        height,
        anchor,
        flip: /^yes$/i.test(text(row.flip)),
        missing: false,
        sortY: num(row.depth, image.startsWith("river") ? 4 : image.startsWith("snowmountain") ? 7 : 6),
        background: true,
      });
    }
    return sprites.sort((a, b) => a.sortY - b.sortY);
  }

  function tileToWorld(column, line) {
    const col = Math.trunc(column);
    const mapY = ORIGIN_TILE_Y + line * TILE_HEIGHT + HALF_TILE_HEIGHT - (Math.abs(col) % 2) * HALF_TILE_HEIGHT;
    return {
      x: ORIGIN_TILE_X + column * HALF_TILE_WIDTH,
      y: mapY,
    };
  }

  function placementTile(placement) {
    return {
      line: placement.x,
      column: placement.y,
    };
  }

  function anchorFor(info, flip, asset) {
    const raw = info?.raw || {};
    const restPlace = text(raw.rest_place);
    const lengthX = Math.max(1, num(raw.length_x, 1));
    const lengthY = Math.max(1, num(raw.length_y, 1));
    const size = lengthX + lengthY;
    if (size < 1) return { x: 0.5, y: 0 };
    if (restPlace === "4" && asset) {
      const offset = ((lengthX - lengthY) * TILE_WIDTH * 0.5) / Math.max(1, asset.width);
      const baseX = 0.5 + (flip ? -offset : offset);
      const baseY = 1 - ((lengthX + lengthY) * TILE_HEIGHT * 0.5) / Math.max(1, asset.height);
      return { x: baseX, y: Math.max(0, Math.min(1, baseY)) };
    }
    const baseX = lengthX / size;
    return { x: flip ? 1 - baseX : baseX, y: 0 };
  }

  function spriteFromRow(row) {
    const placement = row.placement || {};
    if (!placement.valid) return null;
    const objectId = text(row.obj_id);
    const info = state.objectInfo.get(objectId) || {
      id: objectId,
      name: `#${objectId}`,
      raw: {},
      description: "",
    };
    const raw = info.raw || {};
    const lengthX = Math.max(1, num(raw.length_x, 1));
    const lengthY = Math.max(1, num(raw.length_y, 1));
    const tile = placementTile(placement);
    const base = tileToWorld(tile.column, tile.line);
    const asset = assetForObject(info);
    const anchor = anchorFor(info, !!placement.flip, asset);
    const fallbackWidth = Math.max(48, (lengthX + lengthY) * HALF_TILE_WIDTH);
    const fallbackHeight = Math.max(32, (lengthX + lengthY) * HALF_TILE_HEIGHT);
    const width = asset?.width || fallbackWidth;
    const height = asset?.height || fallbackHeight;
    return {
      key: `${row.index}:${objectId}:${row.seq_id}`,
      row,
      info,
      asset,
      base,
      x: base.x - width * anchor.x,
      y: base.y - height * (1 - anchor.y),
      width,
      height,
      anchor,
      tile,
      lengthX,
      lengthY,
      flip: !!placement.flip,
      sortY: base.y + lengthY * TILE_HEIGHT,
      missing: !asset,
    };
  }

  function buildGrid(sprites) {
    if (!sprites.length) return [];
    let minCol = Infinity;
    let maxCol = -Infinity;
    let minLine = Infinity;
    let maxLine = -Infinity;
    for (const sprite of sprites) {
      const p = sprite.row.placement;
      const tile = placementTile(p);
      minCol = Math.min(minCol, Math.floor(tile.column) - 4);
      maxCol = Math.max(maxCol, Math.ceil(tile.column + sprite.lengthY) + 4);
      minLine = Math.min(minLine, Math.floor(tile.line) - 4);
      maxLine = Math.max(maxLine, Math.ceil(tile.line + sprite.lengthX) + 4);
    }
    const lines = [];
    for (let line = minLine; line <= maxLine; line += 1) {
      let last = null;
      for (let col = minCol; col <= maxCol; col += 1) {
        const point = tileToWorld(col, line);
        if (last) lines.push(last, point);
        last = point;
      }
    }
    for (let col = minCol; col <= maxCol; col += 1) {
      let last = null;
      for (let line = minLine; line <= maxLine; line += 1) {
        const point = tileToWorld(col, line);
        if (last) lines.push(last, point);
        last = point;
      }
    }
    return lines;
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(gl, vertex, fragment) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function initGl() {
    const gl = state.canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) throw new Error("当前浏览器不可用 WebGL");
    state.gl = gl;
    const commonVertex = `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      attribute vec4 a_color;
      uniform vec2 u_resolution;
      uniform vec2 u_pan;
      uniform float u_zoom;
      varying vec2 v_uv;
      varying vec4 v_color;
      void main() {
        vec2 pixel = a_pos * u_zoom + u_pan;
        vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        v_uv = a_uv;
        v_color = a_color;
      }
    `;
    state.programs = {
      texture: createProgram(
        gl,
        commonVertex,
        `
          precision mediump float;
          uniform sampler2D u_texture;
          varying vec2 v_uv;
          varying vec4 v_color;
          void main() {
            vec4 tex = texture2D(u_texture, v_uv);
            gl_FragColor = tex * v_color;
          }
        `,
      ),
      color: createProgram(
        gl,
        commonVertex,
        `
          precision mediump float;
          varying vec4 v_color;
          void main() {
            gl_FragColor = v_color;
          }
        `,
      ),
    };
    state.buffers = {
      texture: gl.createBuffer(),
      color: gl.createBuffer(),
    };
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  function resizeCanvas() {
    const rect = state.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (state.canvas.width !== width || state.canvas.height !== height) {
      state.canvas.width = width;
      state.canvas.height = height;
      state.gl.viewport(0, 0, width, height);
      state.needsFit = true;
    }
  }

  function includeBounds(bounds, minX, minY, maxX, maxY) {
    bounds.minX = Math.min(bounds.minX, minX);
    bounds.minY = Math.min(bounds.minY, minY);
    bounds.maxX = Math.max(bounds.maxX, maxX);
    bounds.maxY = Math.max(bounds.maxY, maxY);
  }

  function movementBounds() {
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const mapSprites = state.showMap ? state.backgroundSprites : [];
    for (const sprite of mapSprites) {
      includeBounds(bounds, sprite.x, sprite.y, sprite.x + sprite.width, sprite.y + sprite.height);
    }
    if (mapSprites.length) {
      includeBounds(bounds, MAP_LEFT_SEA_X, bounds.minY, MAP_LEFT_BEACH_X + MAP_LEFT_BEACH_WIDTH, bounds.maxY);
    }
    if (!Number.isFinite(bounds.minX)) {
      for (const sprite of state.sprites) {
        includeBounds(bounds, sprite.x, sprite.y, sprite.x + sprite.width, sprite.y + sprite.height);
      }
    }
    if (!Number.isFinite(bounds.minX)) {
      includeBounds(bounds, MAP_INITIAL_VIEW_X, MAP_INITIAL_VIEW_Y, MAP_INITIAL_VIEW_X + MAP_INIT_WIDTH, MAP_INITIAL_VIEW_Y + MAP_INIT_HEIGHT);
    }
    return {
      minX: bounds.minX - MAP_BOUND_PADDING,
      minY: bounds.minY - MAP_BOUND_PADDING,
      maxX: bounds.maxX + MAP_BOUND_PADDING,
      maxY: bounds.maxY + MAP_BOUND_PADDING,
    };
  }

  function clampPanAxis(value, minWorld, maxWorld, viewSize) {
    const minPan = viewSize - maxWorld * state.zoom;
    const maxPan = -minWorld * state.zoom;
    if (minPan > maxPan) return viewSize / 2 - ((minWorld + maxWorld) / 2) * state.zoom;
    return Math.max(minPan, Math.min(maxPan, value));
  }

  function minMapZoom(bounds = movementBounds()) {
    const height = Math.max(1, bounds.maxY - bounds.minY);
    return Math.min(MAP_MAX_ZOOM, state.canvas.height / height);
  }

  function clampZoom(bounds = movementBounds()) {
    state.zoom = Math.max(minMapZoom(bounds), Math.min(MAP_MAX_ZOOM, state.zoom));
  }

  function clampPan() {
    const bounds = movementBounds();
    clampZoom(bounds);
    state.panX = clampPanAxis(state.panX, bounds.minX, bounds.maxX, state.canvas.width);
    state.panY = clampPanAxis(state.panY, bounds.minY, bounds.maxY, state.canvas.height);
  }

  async function textureFor(src) {
    if (state.textureCache.has(src)) return state.textureCache.get(src);
    const image = await loadImage(src);
    const gl = state.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const item = { texture, width: image.naturalWidth, height: image.naturalHeight };
    state.textureCache.set(src, item);
    state.atlasSizes.set(src, { width: item.width, height: item.height });
    return item;
  }

  function pushVertex(out, x, y, u, v, color) {
    out.push(x, y, u, v, color[0], color[1], color[2], color[3]);
  }

  function uvCorners(asset, texture) {
    if (!asset.frame) return [[0, 0], [1, 0], [1, 1], [0, 1]];
    const rect = asset.frame.rect;
    const width = asset.frame.rotated ? rect.h : rect.w;
    const height = asset.frame.rotated ? rect.w : rect.h;
    const x0 = rect.x / texture.width;
    const y0 = rect.y / texture.height;
    const x1 = (rect.x + width) / texture.width;
    const y1 = (rect.y + height) / texture.height;
    if (!asset.frame.rotated) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return [[x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  }

  function spriteVertices(sprite, texture, options = {}) {
    const trim = sprite.asset.trim || { x: 0, y: 0, width: sprite.width, height: sprite.height };
    const expand = Math.max(0, num(options.expand, 0));
    const x0 = sprite.x + trim.x - expand;
    const y0 = sprite.y + trim.y - expand;
    const x1 = sprite.x + trim.x + trim.width + expand;
    const y1 = sprite.y + trim.y + trim.height + expand;
    const corners = sprite.flip
      ? [[x1, y0], [x0, y0], [x0, y1], [x1, y1]]
      : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const uvs = uvCorners(sprite.asset, texture);
    const color = options.color || [1, 1, 1, 1];
    const out = [];
    for (const index of [0, 1, 2, 0, 2, 3]) {
      pushVertex(out, corners[index][0], corners[index][1], uvs[index][0], uvs[index][1], color);
    }
    return out;
  }

  function selectedGlowVertices(sprite, texture) {
    return SELECTED_GLOW_PASSES.flatMap((pass) => spriteVertices(sprite, texture, pass));
  }

  function footprintVertices(sprite, colorOverride = null) {
    const p = sprite.base;
    const w = Math.max(TILE_WIDTH, (sprite.lengthX + sprite.lengthY) * HALF_TILE_WIDTH);
    const h = Math.max(TILE_HEIGHT, (sprite.lengthX + sprite.lengthY) * HALF_TILE_HEIGHT);
    const x0 = p.x - w * 0.5;
    const x1 = p.x + w * 0.5;
    const y0 = p.y - h;
    const yMid = p.y - h * 0.5;
    const y1 = p.y;
    const color = colorOverride || (sprite.missing ? [0.72, 0.22, 0.16, 0.5] : [0.12, 0.48, 0.41, 0.35]);
    const out = [];
    const points = [
      [p.x, y0],
      [x1, yMid],
      [p.x, y1],
      [x0, yMid],
    ];
    for (const index of [0, 1, 2, 0, 2, 3]) {
      pushVertex(out, points[index][0], points[index][1], 0, 0, color);
    }
    return out;
  }

  function rectVertices(x, y, width, height, color) {
    const out = [];
    const x1 = x + width;
    const y1 = y + height;
    for (const point of [
      [x, y],
      [x1, y],
      [x1, y1],
      [x, y],
      [x1, y1],
      [x, y1],
    ]) {
      pushVertex(out, point[0], point[1], 0, 0, color);
    }
    return out;
  }

  function groundLayerVertices() {
    const out = [];
    // Matches VillageLayer setBkg: green clear color, then left sea and beach CCLayerColor strips.
    out.push(
      ...rectVertices(MAP_LEFT_SEA_X, MAP_GROUND_Y, MAP_LEFT_SEA_WIDTH, MAP_GROUND_HEIGHT, MAP_LEFT_SEA_COLOR),
      ...rectVertices(MAP_LEFT_BEACH_X, MAP_GROUND_Y, MAP_LEFT_BEACH_WIDTH, MAP_GROUND_HEIGHT, MAP_LEFT_BEACH_COLOR),
    );
    return out;
  }

  function lineVertices(lines) {
    const out = [];
    const color = [0.15, 0.38, 0.34, 0.17];
    for (const point of lines) pushVertex(out, point.x, point.y, 0, 0, color);
    return out;
  }

  function drawBuffer(program, buffer, data, mode, count, texture = null) {
    const gl = state.gl;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
    const stride = 8 * 4;
    const pos = gl.getAttribLocation(program, "a_pos");
    const uv = gl.getAttribLocation(program, "a_uv");
    const color = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(pos);
    gl.enableVertexAttribArray(uv);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 2 * 4);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, stride, 4 * 4);
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), state.canvas.width, state.canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, "u_pan"), state.panX, state.panY);
    gl.uniform1f(gl.getUniformLocation(program, "u_zoom"), state.zoom);
    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
    }
    gl.drawArrays(mode, 0, count);
  }

  async function draw() {
    if (!state.gl) return;
    resizeCanvas();
    if (state.needsFit) fit();
    clampPan();
    const gl = state.gl;
    if (state.showMap) {
      gl.clearColor(MAP_GROUND_COLOR[0], MAP_GROUND_COLOR[1], MAP_GROUND_COLOR[2], MAP_GROUND_COLOR[3]);
    } else {
      gl.clearColor(0, 0, 0, 0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (state.showMap) {
      const groundData = groundLayerVertices();
      drawBuffer(
        state.programs.color,
        state.buffers.color,
        groundData,
        gl.TRIANGLES,
        groundData.length / 8,
      );
    }

    if (state.showMap && state.backgroundSprites.length) {
      for (const sprite of state.backgroundSprites) {
        try {
          const texture = await textureFor(sprite.asset.src);
          const data = spriteVertices(sprite, texture);
          drawBuffer(state.programs.texture, state.buffers.texture, data, gl.TRIANGLES, 6, texture.texture);
        } catch {
          sprite.missing = true;
        }
      }
    }

    if (state.showGrid && state.gridLines.length) {
      const data = lineVertices(state.gridLines);
      drawBuffer(state.programs.color, state.buffers.color, data, gl.LINES, state.gridLines.length);
    }

    const selected = state.sprites.find((sprite) => sprite.row.index === state.selectedIndex);
    if (selected) {
      const data = footprintVertices(selected, [1, 0.78, 0.18, 0.48]);
      drawBuffer(state.programs.color, state.buffers.color, data, gl.TRIANGLES, 6);
    }

    const sorted = state.sprites.slice().sort((a, b) => a.sortY - b.sortY || num(a.row.seq_id) - num(b.row.seq_id));
    for (const sprite of sorted) {
      if (sprite.asset) {
        try {
          const texture = await textureFor(sprite.asset.src);
          if (sprite.row.index === state.selectedIndex) {
            const glowData = selectedGlowVertices(sprite, texture);
            drawBuffer(state.programs.texture, state.buffers.texture, glowData, gl.TRIANGLES, glowData.length / 8, texture.texture);
          }
          const data = spriteVertices(sprite, texture);
          drawBuffer(state.programs.texture, state.buffers.texture, data, gl.TRIANGLES, 6, texture.texture);
          continue;
        } catch {
          sprite.missing = true;
        }
      }
      if (state.showMissing) {
        const data = footprintVertices(sprite);
        drawBuffer(state.programs.color, state.buffers.color, data, gl.TRIANGLES, 6);
      }
    }
  }

  function fit() {
    state.needsFit = false;
    const fitSprites = state.sprites;
    if (!fitSprites.length) {
      if (state.showMap && state.backgroundSprites.length) {
        fitRect(MAP_INITIAL_VIEW_X, MAP_INITIAL_VIEW_Y, MAP_INITIAL_VIEW_X + MAP_INIT_WIDTH, MAP_INITIAL_VIEW_Y + MAP_INIT_HEIGHT, 80, 70);
      } else {
        state.zoom = Math.min(MAP_MAX_ZOOM, Math.max(0.6, state.canvas.width / 900));
        state.panX = state.canvas.width / 2;
        state.panY = state.canvas.height / 2;
        clampPan();
      }
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const sprite of fitSprites) {
      minX = Math.min(minX, sprite.x, sprite.base ? sprite.base.x - TILE_WIDTH : sprite.x);
      minY = Math.min(minY, sprite.y, sprite.base ? sprite.base.y - TILE_HEIGHT : sprite.y);
      maxX = Math.max(maxX, sprite.x + sprite.width, sprite.base ? sprite.base.x + TILE_WIDTH : sprite.x + sprite.width);
      maxY = Math.max(maxY, sprite.y + sprite.height, sprite.base ? sprite.base.y + TILE_HEIGHT : sprite.y + sprite.height);
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    fitRect(minX, minY, maxX, maxY, Math.max(180, width * 0.2), Math.max(140, height * 0.2));
  }

  function fitRect(minX, minY, maxX, maxY, padX, padY) {
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    state.zoom = Math.min(MAP_MAX_ZOOM, Math.min(state.canvas.width / (width + padX), state.canvas.height / (height + padY)));
    clampZoom();
    state.panX = state.canvas.width / 2 - ((minX + maxX) / 2) * state.zoom;
    state.panY = state.canvas.height / 2 - ((minY + maxY) / 2) * state.zoom;
    clampPan();
  }

  function screenToWorld(clientX, clientY) {
    const rect = state.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sx = (clientX - rect.left) * dpr;
    const sy = (clientY - rect.top) * dpr;
    return {
      sx,
      sy,
      x: (sx - state.panX) / state.zoom,
      y: (sy - state.panY) / state.zoom,
    };
  }

  function roundPlacement(value) {
    return Math.round(num(value));
  }

  function pick(clientX, clientY) {
    const p = screenToWorld(clientX, clientY);
    const sorted = state.sprites.slice().sort((a, b) => b.sortY - a.sortY);
    for (const sprite of sorted) {
      if (p.x >= sprite.x && p.x <= sprite.x + sprite.width && p.y >= sprite.y && p.y <= sprite.y + sprite.height) {
        return sprite;
      }
      const dx = Math.abs(p.x - sprite.base.x);
      const dy = Math.abs(p.y - sprite.base.y);
      if (dx <= TILE_WIDTH && dy <= TILE_HEIGHT) return sprite;
    }
    return null;
  }

  function renderTooltip(event) {
    if (!state.tooltip) return;
    const sprite = state.hovered;
    if (!sprite) {
      state.tooltip.hidden = true;
      return;
    }
    const p = sprite.row.placement;
    state.tooltip.hidden = false;
    state.tooltip.style.left = `${event.offsetX + 14}px`;
    state.tooltip.style.top = `${event.offsetY + 14}px`;
    state.tooltip.innerHTML = `
      <strong>${escapeHtml(sprite.info.name || `#${sprite.info.id}`)}</strong><br>
      obj=${escapeHtml(sprite.info.id)}, seq=${escapeHtml(sprite.row.seq_id)}<br>
      tile=(${escapeHtml(p.x)}, ${escapeHtml(p.y)}) ${sprite.flip ? "flip" : ""}<br>
      ${sprite.missing ? "未匹配到贴图，显示 footprint 占位" : escapeHtml(sprite.asset.frame?.frame_name || sprite.asset.src)}
    `;
  }

  function beginObjectDrag(event, sprite) {
    const placement = sprite.row.placement || {};
    const world = screenToWorld(event.clientX, event.clientY);
    state.selectedIndex = sprite.row.index;
    state.objectDragging = {
      pointerId: event.pointerId,
      index: sprite.row.index,
      startWorld: world,
      startPlacement: {
        x: num(placement.x),
        y: num(placement.y),
        flip: !!placement.flip,
      },
      current: {
        x: num(placement.x),
        y: num(placement.y),
        flip: !!placement.flip,
      },
    };
    state.editor.onSelect?.(sprite.row.index, sprite.row);
    state.canvas.classList.add("moving-object");
    draw();
  }

  function updateObjectDrag(event, final = false) {
    const drag = state.objectDragging;
    if (!drag) return;
    const world = screenToWorld(event.clientX, event.clientY);
    const next = {
      x: roundPlacement(drag.startPlacement.x + (world.y - drag.startWorld.y) / TILE_HEIGHT),
      y: roundPlacement(drag.startPlacement.y + (world.x - drag.startWorld.x) / HALF_TILE_WIDTH),
      flip: drag.startPlacement.flip,
    };
    drag.current = next;
    state.editor.onMove?.(drag.index, next, { final });
  }

  function finishObjectDrag(event) {
    if (!state.objectDragging) return;
    updateObjectDrag(event, true);
    state.objectDragging = null;
    state.canvas.classList.remove("moving-object");
  }

  function attachEvents() {
    state.fitBtn?.addEventListener("click", () => {
      state.needsFit = true;
      draw();
    });
    state.mapBtn?.addEventListener("click", () => {
      state.showMap = !state.showMap;
      state.mapBtn.classList.toggle("active", state.showMap);
      state.needsFit = true;
      draw();
    });
    state.gridBtn?.addEventListener("click", () => {
      state.showGrid = !state.showGrid;
      state.gridBtn.classList.toggle("active", state.showGrid);
      draw();
    });
    state.missingBtn?.addEventListener("click", () => {
      state.showMissing = !state.showMissing;
      state.missingBtn.classList.toggle("active", state.showMissing);
      draw();
    });
    state.canvas.addEventListener("pointerdown", (event) => {
      state.canvas.setPointerCapture(event.pointerId);
      const picked = pick(event.clientX, event.clientY);
      if (state.editor.enabled && picked) {
        beginObjectDrag(event, picked);
        event.preventDefault();
        return;
      }
      state.dragging = true;
      state.pointer = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
      state.canvas.classList.add("dragging");
    });
    state.canvas.addEventListener("pointermove", (event) => {
      if (state.objectDragging) {
        updateObjectDrag(event, false);
        state.hovered = state.sprites.find((sprite) => sprite.row.index === state.objectDragging.index) || null;
        renderTooltip(event);
        return;
      }
      if (state.dragging && state.pointer) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        state.panX = state.pointer.panX + (event.clientX - state.pointer.x) * dpr;
        state.panY = state.pointer.panY + (event.clientY - state.pointer.y) * dpr;
        draw();
      }
      state.hovered = pick(event.clientX, event.clientY);
      renderTooltip(event);
    });
    state.canvas.addEventListener("pointerup", (event) => {
      finishObjectDrag(event);
      state.dragging = false;
      state.canvas.classList.remove("dragging");
    });
    state.canvas.addEventListener("pointerleave", () => {
      if (state.objectDragging) return;
      state.dragging = false;
      state.hovered = null;
      state.canvas.classList.remove("dragging");
      state.canvas.classList.remove("moving-object");
      if (state.tooltip) state.tooltip.hidden = true;
    });
    state.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const before = screenToWorld(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      state.zoom *= factor;
      clampZoom();
      state.panX = before.sx - before.x * state.zoom;
      state.panY = before.sy - before.y * state.zoom;
      draw();
    }, { passive: false });
    new ResizeObserver(() => {
      state.needsFit = true;
      draw();
    }).observe(state.canvas);
  }

  async function init() {
    state.canvas = document.getElementById("objectMap");
    if (!state.canvas) return;
    state.status = document.getElementById("previewStatus");
    state.tooltip = document.getElementById("previewTooltip");
    state.fitBtn = document.getElementById("previewFitBtn");
    state.mapBtn = document.getElementById("previewMapBtn");
    state.gridBtn = document.getElementById("previewGridBtn");
    state.missingBtn = document.getElementById("previewMissingBtn");
    try {
      initGl();
      attachEvents();
      await buildAssetIndex();
      state.ready = true;
      render(state.saveRows);
    } catch (error) {
      state.error = error;
      setStatus(`摆放预览加载失败：${error.message}。请通过本地 HTTP 服务打开页面，并确认 exported-assets 已导出。`, "bad");
      console.error(error);
    }
  }

  function render(rows, options = {}) {
    state.saveRows = Array.isArray(rows) ? rows : [];
    if ("selectedIndex" in options) state.selectedIndex = Number.isInteger(options.selectedIndex) ? options.selectedIndex : null;
    if (!state.ready) return;
    state.sprites = state.saveRows.map(spriteFromRow).filter(Boolean);
    state.gridLines = buildGrid(state.sprites);
    const missing = state.sprites.filter((sprite) => sprite.missing).length;
    if (!state.sprites.length) {
      setStatus(`已绘制地图底图：${state.backgroundSprites.length} 个静态背景块。导入 map.dat 或新增对象后会叠加庄园摆放。`);
    } else {
      setStatus(`WebGL 预览：地图 ${state.backgroundSprites.length} 块，${state.sprites.length} 个对象，${state.sprites.length - missing} 个匹配贴图，${missing} 个缺图占位。`);
    }
    if (!options.preserveView) state.needsFit = true;
    draw();
  }

  window.ManorPreview = {
    render,
    configureEditor(options = {}) {
      state.editor = { ...state.editor, ...options };
    },
    selectObject(index) {
      state.selectedIndex = Number.isInteger(index) ? index : null;
      draw();
    },
    fit() {
      state.needsFit = true;
      draw();
    },
  };

  init();
})();
