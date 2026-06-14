"use strict";

const PLAYER_FORMAT = "moleworld-player";
const MAP_FORMAT = "moleworld-map";
const COMBINED_FORMAT = "moleworld-save";
const SAVE_VERSION = 1;
const U32_MAX = 4294967295;

let playerData = createEmptyPlayerData();
let mapData = createEmptyMapData();
let activeTab = "player";
let playerJsonDirty = false;
let mapJsonDirty = false;
let playerFileName = "新建玩家数据";
let mapFileName = "新建地图数据";
let importReport = null;
let selectedObjectIndex = null;
let selectedObjectSnapshot = null;
let selectedObjectDraft = null;
let objectCatalog = [];
let objectCatalogById = new Map();
let objectSearchQuery = "";
let objectPickerRenderSerial = 0;
let objectPickerRows = [];
let objectPickerRenderer = null;
let objectPickerResizeObserver = null;
let renderingSelectedObject = false;

const els = {
  playerFileInput: document.getElementById("playerFileInput"),
  mapFileInput: document.getElementById("mapFileInput"),
  editorShell: document.getElementById("editorShell"),
  fileName: document.getElementById("fileName"),
  saveTitle: document.getElementById("saveTitle"),
  saveMeta: document.getElementById("saveMeta"),
  validationBox: document.getElementById("validationBox"),
  userForm: document.getElementById("userForm"),
  playerJsonEditor: document.getElementById("playerJsonEditor"),
  mapJsonEditor: document.getElementById("mapJsonEditor"),
  formatPlayerJsonBtn: document.getElementById("formatPlayerJsonBtn"),
  formatMapJsonBtn: document.getElementById("formatMapJsonBtn"),
  exportPlayerBtn: document.getElementById("exportPlayerBtn"),
  exportMapBtn: document.getElementById("exportMapBtn"),
  openPasteMapBtn: document.getElementById("openPasteMapBtn"),
  pasteMapDialog: document.getElementById("pasteMapDialog"),
  mapBase64Input: document.getElementById("mapBase64Input"),
  loadMapBase64Btn: document.getElementById("loadMapBase64Btn"),
  closePasteMapBtn: document.getElementById("closePasteMapBtn"),
  objectMap: document.getElementById("objectMap"),
  objectsTable: document.getElementById("objectsTable"),
  mapStatsGrid: document.getElementById("mapStatsGrid"),
  selectedObjectLabel: document.getElementById("selectedObjectLabel"),
  editSceneInput: document.getElementById("editSceneInput"),
  editObjectIdInput: document.getElementById("editObjectIdInput"),
  editXInput: document.getElementById("editXInput"),
  editYInput: document.getElementById("editYInput"),
  editFlipInput: document.getElementById("editFlipInput"),
  rotateObjectBtn: document.getElementById("rotateObjectBtn"),
  deleteObjectBtn: document.getElementById("deleteObjectBtn"),
  addSceneInput: document.getElementById("addSceneInput"),
  addObjectIdInput: document.getElementById("addObjectIdInput"),
  addXInput: document.getElementById("addXInput"),
  addYInput: document.getElementById("addYInput"),
  addFlipInput: document.getElementById("addFlipInput"),
  addObjectBtn: document.getElementById("addObjectBtn"),
  addObjectHint: document.getElementById("addObjectHint"),
  addObjectMenu: document.getElementById("addObjectMenu"),
  toggleAddObjectMenuBtn: document.getElementById("toggleAddObjectMenuBtn"),
  addObjectDropdown: document.getElementById("addObjectDropdown"),
  objectSearchInput: document.getElementById("objectSearchInput"),
  objectPickerViewport: document.getElementById("objectPickerViewport"),
  objectPickerCanvas: document.getElementById("objectPickerCanvas"),
  objectPickerSpacer: document.getElementById("objectPickerSpacer"),
  objectPickerEmpty: document.getElementById("objectPickerEmpty"),
  objectCatalogList: document.getElementById("objectCatalogList"),
  sampleBtn: document.getElementById("sampleBtn"),
  importStatus: document.getElementById("importStatus"),
};

function setImportStatus(text, kind = "") {
  els.importStatus.textContent = text;
  els.importStatus.className = `import-status ${kind}`.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptyPlayerData() {
  return {
    format: PLAYER_FORMAT,
    version: SAVE_VERSION,
    exported_at: new Date().toISOString(),
    source: "local",
    user_id: 0,
    user_info: {
      name: "新建摩尔",
      cur_level: 1,
      xp: 0,
      gold: 0,
      vip_gold: 0,
      vip_level: 0,
      icon_index: 0,
      total_workers: 0,
      total_rooms: 0,
    },
  };
}

function createEmptyMapData() {
  return {
    format: MAP_FORMAT,
    version: SAVE_VERSION,
    exported_at: new Date().toISOString(),
    source: "local",
    map_blob_b64: null,
    objects: [],
  };
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function intOrZero(value) {
  return Math.trunc(numberOrZero(value));
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function isObjectIdSearch(query) {
  return /^\d+$/.test(query.trim());
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("zh-CN") : "-";
}

function byteLengthFromBase64(b64) {
  if (!b64 || typeof b64 !== "string") return 0;
  const clean = b64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function base64ToBytes(b64) {
  const bin = atob((b64 || "").replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function parseEncMapdata(b64) {
  if (!b64) return { x: null, y: null, flip: false, valid: false };
  try {
    const bytes = base64ToBytes(b64);
    if (bytes.length < 9) return { x: null, y: null, flip: false, valid: false };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      x: Number(view.getFloat32(0, true).toFixed(3)),
      y: Number(view.getFloat32(4, true).toFixed(3)),
      flip: view.getUint8(8) !== 0,
      valid: true,
    };
  } catch {
    return { x: null, y: null, flip: false, valid: false };
  }
}

function writeEncMapdata(x, y, flip) {
  const bytes = new Uint8Array(9);
  const view = new DataView(bytes.buffer);
  view.setFloat32(0, numberOrZero(x), true);
  view.setFloat32(4, numberOrZero(y), true);
  view.setUint8(8, flip ? 1 : 0);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function nextNumericField(objects, key) {
  return objects.reduce((max, obj) => Math.max(max, intOrZero(obj[key])), 0) + 1;
}

function objectName(objectId) {
  const info = objectCatalogById.get(String(objectId));
  return info?.name ? `${objectId} ${info.name}` : `#${objectId}`;
}

function objectPlainName(objectId) {
  const info = objectCatalogById.get(String(objectId));
  return info?.name || `#${objectId}`;
}

function objectDisplayName(item) {
  return item?.name || "未命名对象";
}

function objectAsset(item) {
  return window.ManorPreview?.assetForObjectInfo?.(item) || null;
}

function objectImageSrc(item) {
  const asset = objectAsset(item);
  if (asset?.src) return asset.src;
  const png = item?.texture?.png;
  return png ? `./exported-assets/${String(png).replace(/\\/g, "/")}` : "";
}

function hasObjectImage(item) {
  return !!objectImageSrc(item);
}

function isPlaceableObject(item) {
  const raw = item?.raw || {};
  const shopType = intOrZero(raw.shop_type);
  const shopSubType = intOrZero(raw.shop_sub_type);
  const lengthX = intOrZero(raw.length_x);
  const lengthY = intOrZero(raw.length_y);
  return (shopType === 1 || shopType === 2) && shopSubType >= 1 && shopSubType <= 6 && lengthX > 0 && lengthY > 0;
}

function cocoaNowSeconds() {
  return Date.now() / 1000 - 978307200;
}

function mapEditorSourceClass(objectId) {
  const info = objectCatalogById.get(String(intOrZero(objectId)));
  return intOrZero(info?.raw?.shop_type) === 1 ? "TMMapDataBuilding" : "TMMapDataBase";
}

function mapEditorDefaultSceneId(objectId, fallback = 1) {
  const objId = intOrZero(objectId);
  const info = objectCatalogById.get(String(objId));
  const type = intOrZero(info?.raw?.type);
  if (type === 15 || (objId >= 15001 && objId <= 15006)) return 6;
  return intOrZero(fallback || 1);
}

function mapEditorSourceTemplate(objectId) {
  const objId = intOrZero(objectId);
  if (mapEditorSourceClass(objId) === "TMMapDataBuilding") {
    return {
      __class: "TMMapDataBuilding",
      objectId: objId,
      baseTile: "{0, 0}",
      isFlip: false,
      beginTime: cocoaNowSeconds(),
      buildingState: 4,
      coolingTime: 0,
      gameCoolTime: 0,
      property: 0,
    };
  }
  return {
    __class: "TMMapDataBase",
    objectId: objId,
    baseTile: "{0, 0}",
    isFlip: false,
  };
}

function normalizeMapEditorObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const sourceClass = String(obj.source_class || "");
  if (sourceClass !== "map-editor" && sourceClass !== "") return obj;
  const expectedClass = mapEditorSourceClass(obj.obj_id ?? obj.objectId);
  const expectedSceneId = mapEditorDefaultSceneId(obj.obj_id ?? obj.objectId, obj.scene_id);
  if (
    obj.source_item
    && typeof obj.source_item === "object"
    && obj.source_item.__class === expectedClass
    && intOrZero(obj.scene_id) === expectedSceneId
  ) {
    return obj;
  }
  const template = mapEditorSourceTemplate(obj.obj_id ?? obj.objectId);
  return {
    ...obj,
    scene_id: expectedSceneId,
    source_class: "map-editor",
    source_item: obj.source_item?.__class === expectedClass ? obj.source_item : template,
  };
}

function filteredObjectCatalog() {
  const query = objectSearchQuery.trim().toLowerCase();
  const idSearch = isObjectIdSearch(query);
  return objectCatalog.filter((item) => {
    if (!isPlaceableObject(item)) return false;
    const name = objectDisplayName(item).toLowerCase();
    const hasVisibleBasics = !!item.name && hasObjectImage(item);
    if (!query) return hasVisibleBasics;
    if (idSearch) return item.id.includes(query);
    return hasVisibleBasics && name.includes(query);
  });
}

function objectPlacementAt(index) {
  const obj = mapData.objects?.[index];
  return obj ? parseEncMapdata(obj.enc_mapdata_b64) : { x: null, y: null, flip: false, valid: false };
}

function selectedObject() {
  return Number.isInteger(selectedObjectIndex) ? mapData.objects?.[selectedObjectIndex] || null : null;
}

function selectedDraftObject() {
  return selectedObjectDraft || selectedObject();
}

function clearMapSelection() {
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
  selectedObjectDraft = null;
}

function normalizeUserInfo(input = {}) {
  return {
    name: String(input.name ?? input.username ?? "Mole"),
    cur_level: Math.max(1, intOrZero(input.cur_level ?? input.curLevel ?? 1)),
    xp: intOrZero(input.xp),
    gold: intOrZero(input.gold),
    vip_gold: intOrZero(input.vip_gold ?? input.vipGold),
    vip_level: intOrZero(input.vip_level),
    icon_index: intOrZero(input.icon_index ?? input.iconIndex),
    total_workers: intOrZero(input.total_workers ?? input.totalWorkers),
    total_rooms: intOrZero(input.total_rooms ?? input.totalRooms),
  };
}

function normalizePlayerData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("玩家 JSON 顶层必须是对象。");
  const userInfo = input.user_info || input;
  return {
    format: PLAYER_FORMAT,
    version: SAVE_VERSION,
    exported_at: input.exported_at || new Date().toISOString(),
    source: input.source || (input.format === COMBINED_FORMAT ? "combined-json" : "json"),
    user_id: intOrZero(input.user_id ?? input.userId),
    user_info: normalizeUserInfo(userInfo),
  };
}

function normalizeObject(obj = {}, index = 0) {
  const normalized = {
    scene_id: intOrZero(obj.scene_id),
    obj_kind: intOrZero(obj.obj_kind),
    key_id: intOrZero(obj.key_id || index + 1),
    obj_id: intOrZero(obj.obj_id ?? obj.objectId),
    seq_id: intOrZero(obj.seq_id || index + 1),
    enc_mapdata_b64: typeof obj.enc_mapdata_b64 === "string" ? obj.enc_mapdata_b64 : "",
    source_class: obj.source_class || obj.__class || undefined,
    source_item: obj.source_item && typeof obj.source_item === "object" ? clone(obj.source_item) : undefined,
  };
  return normalizeMapEditorObject(normalized);
}

function normalizeMapData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("地图 JSON 顶层必须是对象。");
  const mapBlob = input.map_blob_b64 ?? input.user_info?.map_blob_b64 ?? null;
  const objects = Array.isArray(input.objects) ? input.objects.map(normalizeObject) : [];
  return {
    format: MAP_FORMAT,
    version: SAVE_VERSION,
    exported_at: input.exported_at || new Date().toISOString(),
    source: input.source || (input.format === COMBINED_FORMAT ? "combined-json" : "json"),
    map_blob_b64: mapBlob,
    map_plist_b64: typeof input.map_plist_b64 === "string" ? input.map_plist_b64 : undefined,
    map_encrypted: typeof input.map_encrypted === "boolean" ? input.map_encrypted : undefined,
    objects,
  };
}

function mapRows() {
  return (mapData.objects || []).map((obj, index) => ({
    ...obj,
    index,
    placement: parseEncMapdata(obj.enc_mapdata_b64),
  }));
}

function renderForm() {
  const ui = playerData.user_info || {};
  const fields = {
    user_id: playerData.user_id,
    name: ui.name,
    cur_level: ui.cur_level,
    xp: ui.xp,
    gold: ui.gold,
    vip_gold: ui.vip_gold,
    vip_level: ui.vip_level,
    icon_index: ui.icon_index,
    total_workers: ui.total_workers,
    total_rooms: ui.total_rooms,
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = els.userForm.elements[name];
    if (input) input.value = value ?? "";
  });
}

function renderMap(options = {}) {
  const draftPlacement = selectedObjectDraft ? parseEncMapdata(selectedObjectDraft.enc_mapdata_b64) : null;
  window.ManorPreview?.render?.(
    mapRows().filter((row) => row.placement.valid),
    {
      selectedIndex: selectedObjectIndex,
      editPreview: selectedObjectIndex != null && draftPlacement?.valid
        ? {
          index: selectedObjectIndex,
          obj: clone(selectedObjectDraft),
          placement: draftPlacement,
        }
        : null,
      preserveView: !!options.preserveView,
    },
  );
}

function stat(label, value) {
  const div = document.createElement("div");
  div.className = "stat";
  const small = document.createElement("small");
  small.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = String(value ?? "-");
  div.append(small, strong);
  return div;
}

function renderMapStats() {
  const objects = mapData.objects || [];
  const mapBytes = mapData.map_blob_b64 ? byteLengthFromBase64(mapData.map_blob_b64) : 0;
  els.mapStatsGrid.innerHTML = "";
  [
    ["对象数", formatNumber(objects.length)],
    ["地图 blob", mapData.map_blob_b64 === null ? "空" : mapData.map_blob_b64 ? `${formatNumber(mapBytes)} B` : "缺失"],
    ["来源", mapData.source || "-"],
    ["文件", mapFileName],
  ].forEach(([label, value]) => els.mapStatsGrid.appendChild(stat(label, value)));
}

function renderObjectsTable() {
  els.objectsTable.innerHTML = "";
  mapRows().forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = row.index === selectedObjectIndex ? "selected-row" : "";
    tr.addEventListener("click", () => selectObject(row.index, { preserveView: true }));
    [
      row.obj_kind,
      row.scene_id,
      row.key_id,
      row.obj_id,
      row.seq_id,
      row.placement.valid ? row.placement.x : "-",
      row.placement.valid ? row.placement.y : "-",
      row.placement.flip ? "是" : "否",
    ].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = String(value ?? "-");
      tr.appendChild(td);
    });
    const action = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-action";
    button.textContent = "选中";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectObject(row.index, { preserveView: true });
    });
    action.appendChild(button);
    tr.appendChild(action);
    els.objectsTable.appendChild(tr);
  });
}

function renderSelectedObjectPanel() {
  const obj = selectedDraftObject();
  const controls = [
    els.editSceneInput,
    els.editObjectIdInput,
    els.editXInput,
    els.editYInput,
    els.editFlipInput,
    els.rotateObjectBtn,
    els.deleteObjectBtn,
  ];
  renderingSelectedObject = true;
  if (!obj) {
    els.selectedObjectLabel.textContent = "未选择";
    controls.forEach((control) => {
      if (control) control.disabled = true;
    });
    els.editSceneInput.value = "";
    els.editObjectIdInput.value = "";
    els.editXInput.value = "";
    els.editYInput.value = "";
    els.editFlipInput.checked = false;
    renderingSelectedObject = false;
    return;
  }

  const placement = selectedObjectDraft ? parseEncMapdata(selectedObjectDraft.enc_mapdata_b64) : objectPlacementAt(selectedObjectIndex);
  els.selectedObjectLabel.textContent = `${selectedObjectIndex + 1} · ${objectName(obj.obj_id)}`;
  controls.forEach((control) => {
    if (control) control.disabled = false;
  });
  els.editSceneInput.value = obj.scene_id;
  els.editObjectIdInput.value = obj.obj_id;
  els.editXInput.value = placement.valid ? placement.x : 0;
  els.editYInput.value = placement.valid ? placement.y : 0;
  els.editFlipInput.checked = !!placement.flip;
  renderingSelectedObject = false;
}

function renderObjectPicker() {
  if (!els.objectPickerViewport || !els.objectPickerCanvas || !els.objectPickerSpacer) return;
  objectPickerRenderSerial += 1;
  if (els.addObjectDropdown.hidden) return;
  objectPickerRows = filteredObjectCatalog();
  els.objectPickerEmpty.hidden = objectPickerRows.length > 0;
  els.objectPickerViewport.hidden = objectPickerRows.length === 0;
  ensureObjectPickerRenderer();
  layoutObjectPicker();
  drawObjectPicker();
}

function ensureObjectPickerRenderer() {
  if (objectPickerRenderer || !els.objectPickerCanvas) return objectPickerRenderer;
  const canvas = els.objectPickerCanvas;
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) throw new Error("当前浏览器不可用 WebGL");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const vertex = `
    attribute vec2 a_pos;
    attribute vec2 a_uv;
    uniform vec2 u_resolution;
    varying vec2 v_uv;
    void main() {
      vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_uv = a_uv;
    }
  `;
  const fragment = `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec4 u_color;
    varying vec2 v_uv;
    void main() {
      gl_FragColor = texture2D(u_texture, v_uv) * u_color;
    }
  `;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));

  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  objectPickerRenderer = {
    gl,
    program,
    buffer: gl.createBuffer(),
    white,
    textures: new Map(),
    texturePromises: new Map(),
    textTextures: new Map(),
    layout: { width: 0, height: 0, columns: 1, cardW: 120, cardH: 142, gap: 10, totalH: 1 },
  };

  els.objectPickerViewport.addEventListener("scroll", () => drawObjectPicker());
  canvas.addEventListener("click", onObjectPickerCanvasClick);
  canvas.addEventListener("mousemove", onObjectPickerCanvasMove);
  if (!objectPickerResizeObserver && "ResizeObserver" in window) {
    objectPickerResizeObserver = new ResizeObserver(() => {
      layoutObjectPicker();
      drawObjectPicker();
    });
    objectPickerResizeObserver.observe(els.objectPickerViewport);
  }
  return objectPickerRenderer;
}

function layoutObjectPicker() {
  const renderer = ensureObjectPickerRenderer();
  if (!renderer || els.addObjectDropdown.hidden) return;
  const viewport = els.objectPickerViewport;
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight || 420);
  const gap = 10;
  const minCardW = 112;
  const columns = Math.max(1, Math.floor((width + gap) / (minCardW + gap)));
  const cardW = Math.floor((width - gap * Math.max(0, columns - 1)) / columns);
  const cardH = 142;
  const totalRows = Math.ceil(objectPickerRows.length / columns);
  const totalH = Math.max(1, totalRows * (cardH + gap));
  renderer.layout = { width, height, columns, cardW, cardH, gap, totalH };
  els.objectPickerSpacer.style.height = `${totalH}px`;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  els.objectPickerCanvas.style.height = `${height}px`;
  if (els.objectPickerCanvas.width !== Math.floor(width * dpr) || els.objectPickerCanvas.height !== Math.floor(height * dpr)) {
    els.objectPickerCanvas.width = Math.floor(width * dpr);
    els.objectPickerCanvas.height = Math.floor(height * dpr);
  }
}

function colorParts(hex) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
}

function pickerLoadImage(src) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image.decode().then(() => image);
}

function pickerTextureFor(src) {
  const renderer = ensureObjectPickerRenderer();
  if (renderer.textures.has(src)) return renderer.textures.get(src);
  if (!renderer.texturePromises.has(src)) {
    renderer.texturePromises.set(src, pickerLoadImage(src).then((image) => {
      const gl = renderer.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      const item = { texture, width: image.naturalWidth, height: image.naturalHeight };
      renderer.textures.set(src, item);
      renderer.texturePromises.delete(src);
      drawObjectPicker();
      return item;
    }).catch((error) => {
      renderer.texturePromises.delete(src);
      throw error;
    }));
  }
  return null;
}

function pickerTextTexture(text, width) {
  const renderer = ensureObjectPickerRenderer();
  const key = `${Math.round(width)}:${text}`;
  if (renderer.textTextures.has(key)) return renderer.textTextures.get(key);
  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = 26 * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.font = '13px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#65777c";
  let label = text;
  while (ctx.measureText(label).width > width - 8 && label.length > 1) {
    label = `${label.slice(0, -2)}…`;
  }
  ctx.fillText(label, width / 2, 13);
  const gl = renderer.gl;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  const item = { texture, width, height: 26 };
  renderer.textTextures.set(key, item);
  return item;
}

function drawPickerQuad(texture, x, y, w, h, color = [1, 1, 1, 1], uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const renderer = ensureObjectPickerRenderer();
  const gl = renderer.gl;
  const vertices = new Float32Array([
    x, y, uvs[0][0], uvs[0][1],
    x + w, y, uvs[1][0], uvs[1][1],
    x, y + h, uvs[3][0], uvs[3][1],
    x, y + h, uvs[3][0], uvs[3][1],
    x + w, y, uvs[1][0], uvs[1][1],
    x + w, y + h, uvs[2][0], uvs[2][1],
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform4fv(gl.getUniformLocation(renderer.program, "u_color"), color);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawPickerRect(x, y, w, h, color) {
  drawPickerQuad(ensureObjectPickerRenderer().white, x, y, w, h, colorParts(color));
}

function pickerAssetUvs(asset, texture) {
  if (!asset?.frame?.rect) return [[0, 0], [1, 0], [1, 1], [0, 1]];
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

function pickerAssetSize(asset, texture) {
  if (!asset?.frame?.rect) return { width: texture.width, height: texture.height };
  const rect = asset.frame.rect;
  return asset.frame.rotated
    ? { width: Math.max(1, rect.h), height: Math.max(1, rect.w) }
    : { width: Math.max(1, rect.w), height: Math.max(1, rect.h) };
}

function drawObjectPicker() {
  const renderer = ensureObjectPickerRenderer();
  if (!renderer || els.addObjectDropdown.hidden) return;
  layoutObjectPicker();
  const { gl, program, layout } = renderer;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  gl.viewport(0, 0, Math.floor(layout.width * dpr), Math.floor(layout.height * dpr));
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), layout.width, layout.height);
  const pos = gl.getAttribLocation(program, "a_pos");
  const uv = gl.getAttribLocation(program, "a_uv");
  gl.enableVertexAttribArray(pos);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

  const scrollTop = els.objectPickerViewport.scrollTop;
  const rowStride = layout.cardH + layout.gap;
  const firstRow = Math.max(0, Math.floor(scrollTop / rowStride));
  const lastRow = Math.min(Math.ceil(objectPickerRows.length / layout.columns), Math.ceil((scrollTop + layout.height) / rowStride) + 1);
  for (let row = firstRow; row < lastRow; row += 1) {
    for (let col = 0; col < layout.columns; col += 1) {
      const index = row * layout.columns + col;
      const item = objectPickerRows[index];
      if (!item) continue;
      const x = col * (layout.cardW + layout.gap);
      const y = row * rowStride - scrollTop;
      drawPickerRect(x, y, layout.cardW, layout.cardH, "#fbfcfc");
      drawPickerRect(x, y, layout.cardW, 1, "#d8e1e3");
      drawPickerRect(x, y + layout.cardH - 1, layout.cardW, 1, "#d8e1e3");
      drawPickerRect(x, y, 1, layout.cardH, "#d8e1e3");
      drawPickerRect(x + layout.cardW - 1, y, 1, layout.cardH, "#d8e1e3");
      const imageX = x + 10;
      const imageY = y + 10;
      const imageW = layout.cardW - 20;
      const imageH = 82;
      drawPickerRect(imageX, imageY, imageW, imageH, "#f2f5f5");
      const asset = objectAsset(item);
      const texture = asset?.src ? pickerTextureFor(asset.src) : null;
      if (asset && texture) {
        const source = pickerAssetSize(asset, texture);
        const scale = Math.min(1, imageW / source.width, imageH / source.height);
        const drawW = Math.max(1, source.width * scale);
        const drawH = Math.max(1, source.height * scale);
        drawPickerQuad(
          texture.texture,
          imageX + (imageW - drawW) / 2,
          imageY + (imageH - drawH) / 2,
          drawW,
          drawH,
          [1, 1, 1, 1],
          pickerAssetUvs(asset, texture),
        );
      } else if (!asset) {
        const noImage = pickerTextTexture("无图", imageW);
        drawPickerQuad(noImage.texture, imageX, imageY + 28, imageW, noImage.height);
      }
      const label = pickerTextTexture(objectDisplayName(item), layout.cardW - 12);
      drawPickerQuad(label.texture, x + 6, y + 106, label.width, label.height);
    }
  }
}

function objectPickerIndexAtEvent(event) {
  const renderer = ensureObjectPickerRenderer();
  const rect = els.objectPickerCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top + els.objectPickerViewport.scrollTop;
  const { columns, cardW, cardH, gap } = renderer.layout;
  const row = Math.floor(y / (cardH + gap));
  const col = Math.floor(x / (cardW + gap));
  const localX = x - col * (cardW + gap);
  const localY = y - row * (cardH + gap);
  if (col < 0 || col >= columns || localX < 0 || localX > cardW || localY < 0 || localY > cardH) return -1;
  const index = row * columns + col;
  return index >= 0 && index < objectPickerRows.length ? index : -1;
}

function onObjectPickerCanvasClick(event) {
  const index = objectPickerIndexAtEvent(event);
  if (index >= 0) addObjectById(objectPickerRows[index].id);
}

function onObjectPickerCanvasMove(event) {
  els.objectPickerCanvas.style.cursor = objectPickerIndexAtEvent(event) >= 0 ? "pointer" : "default";
}

function setObjectPickerOpen(open) {
  if (!els.addObjectDropdown) return;
  els.addObjectDropdown.hidden = !open;
  els.toggleAddObjectMenuBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  els.toggleAddObjectMenuBtn?.classList.toggle("active", open);
  if (open) {
    renderObjectPicker();
    requestAnimationFrame(() => els.objectSearchInput?.focus());
  }
}

function addObjectById(objectId) {
  els.addObjectIdInput.value = objectId;
  addObjectFromInputs({ closePicker: true });
}

function renderPlayerJson() {
  els.playerJsonEditor.value = JSON.stringify(playerData, null, 2);
  playerJsonDirty = false;
}

function renderMapJson() {
  els.mapJsonEditor.value = JSON.stringify(mapData, null, 2);
  mapJsonDirty = false;
}

function notice(text, kind = "") {
  const div = document.createElement("div");
  div.className = `notice ${kind}`.trim();
  div.textContent = text;
  return div;
}

function validatePlayer() {
  const errors = [];
  const warnings = [];
  if (!Number.isInteger(Number(playerData.user_id))) errors.push("user_id 必须是整数。");
  const ui = playerData.user_info || {};
  ["name", "cur_level", "xp", "gold", "vip_gold", "vip_level", "icon_index", "total_workers", "total_rooms"].forEach((key) => {
    if (ui[key] === undefined) errors.push(`user_info.${key} 缺失。`);
  });
  ["xp", "gold", "vip_gold"].forEach((key) => {
    const v = Number(ui[key]);
    if (Number.isFinite(v) && (v < 0 || v > U32_MAX)) warnings.push(`${key} 建议保持在 0..${U32_MAX}。`);
  });
  if (Number(ui.cur_level) > 52) warnings.push("客户端上传前通常会拒绝等级大于 52 的存档。");
  if (Number(ui.icon_index) >= 62) warnings.push("客户端会把 >=62 的头像索引归零。");
  return { errors, warnings };
}

function validateMap() {
  const errors = [];
  const warnings = [];
  if (mapData.map_blob_b64 !== undefined && mapData.map_blob_b64 !== null && typeof mapData.map_blob_b64 !== "string") {
    errors.push("map_blob_b64 只能是 null、缺失或 base64 字符串。");
  }
  if (!Array.isArray(mapData.objects)) errors.push("objects 必须是数组。");
  if ((mapData.objects || []).length > 10000) warnings.push("objects 超过建议上限 10000 行。");
  (mapData.objects || []).forEach((obj, index) => {
    ["scene_id", "obj_kind", "key_id", "obj_id", "seq_id"].forEach((key) => {
      if (!Number.isFinite(Number(obj[key]))) errors.push(`objects[${index}].${key} 必须是数字。`);
    });
    if (obj.enc_mapdata_b64 && byteLengthFromBase64(obj.enc_mapdata_b64) > 64 * 1024) {
      warnings.push(`objects[${index}].enc_mapdata_b64 超过建议单行 64KB 上限。`);
    }
  });
  return { errors, warnings };
}

function renderValidation() {
  els.validationBox.innerHTML = "";
  const { errors, warnings } = activeTab === "player" ? validatePlayer() : validateMap();
  if (importReport) {
    els.validationBox.appendChild(notice(importReport));
  }
  if (!errors.length && !warnings.length) {
    els.validationBox.appendChild(notice(activeTab === "player" ? "玩家数据校验通过。" : "地图数据校验通过。"));
  }
  errors.forEach((msg) => els.validationBox.appendChild(notice(msg, "bad")));
  warnings.forEach((msg) => els.validationBox.appendChild(notice(msg, "warn")));
}

function renderSummary() {
  const ui = playerData.user_info || {};
  const objects = mapData.objects || [];
  const mapBytes = mapData.map_blob_b64 ? byteLengthFromBase64(mapData.map_blob_b64) : 0;
  els.fileName.textContent = activeTab === "player" ? playerFileName : mapFileName;
  els.saveTitle.textContent = activeTab === "player" ? `${ui.name || "未命名"} (${playerData.user_id ?? "-"})` : `地图对象 ${objects.length}`;
  els.saveMeta.textContent = activeTab === "player"
    ? `Lv.${ui.cur_level ?? "-"} · 摩尔豆 ${formatNumber(ui.gold)} · 贝壳 ${formatNumber(ui.vip_gold)}`
    : `地图 ${mapData.map_blob_b64 === null ? "空" : formatNumber(mapBytes) + " B"} · ${objects.length} 对象`;
}

function renderAll({ includePlayerJson = true, includeMapJson = true } = {}) {
  renderSummary();
  renderForm();
  renderMapStats();
  renderObjectsTable();
  renderMap();
  renderSelectedObjectPanel();
  renderValidation();
  if (includePlayerJson) renderPlayerJson();
  if (includeMapJson) renderMapJson();
}

function renderMapEditing({ includeMapJson = true, preserveView = true } = {}) {
  renderSummary();
  renderMapStats();
  renderObjectsTable();
  renderMap({ preserveView });
  renderSelectedObjectPanel();
  renderValidation();
  if (includeMapJson) renderMapJson();
}

function applyUserForm() {
  const data = new FormData(els.userForm);
  playerData.user_id = intOrZero(data.get("user_id"));
  playerData.user_info = normalizeUserInfo({
    name: data.get("name"),
    cur_level: data.get("cur_level"),
    xp: data.get("xp"),
    gold: data.get("gold"),
    vip_gold: data.get("vip_gold"),
    vip_level: data.get("vip_level"),
    icon_index: data.get("icon_index"),
    total_workers: data.get("total_workers"),
    total_rooms: data.get("total_rooms"),
  });
  playerData.exported_at = new Date().toISOString();
  renderAll({ includeMapJson: false });
}

function syncPlayerJson() {
  if (!playerJsonDirty) return true;
  try {
    playerData = normalizePlayerData(JSON.parse(els.playerJsonEditor.value));
    playerJsonDirty = false;
    renderAll({ includePlayerJson: false });
    return true;
  } catch (error) {
    alert(`玩家 JSON 解析失败：${error.message}`);
    return false;
  }
}

function syncMapJson() {
  if (!mapJsonDirty) return true;
  try {
    mapData = normalizeMapData(JSON.parse(els.mapJsonEditor.value));
    if (selectedObjectIndex != null && !mapData.objects[selectedObjectIndex]) clearMapSelection();
    mapJsonDirty = false;
    renderAll({ includeMapJson: false });
    return true;
  } catch (error) {
    alert(`地图 JSON 解析失败：${error.message}`);
    return false;
  }
}

function selectObject(index, options = {}) {
  const count = mapData.objects?.length || 0;
  selectedObjectIndex = Number.isInteger(index) && index >= 0 && index < count ? index : null;
  selectedObjectSnapshot = selectedObjectIndex == null
    ? null
    : (options.snapshot === null ? null : clone(mapData.objects[selectedObjectIndex]));
  selectedObjectDraft = selectedObjectIndex == null ? null : clone(mapData.objects[selectedObjectIndex]);
  renderObjectsTable();
  renderSelectedObjectPanel();
  renderMap({ preserveView: options.preserveView !== false });
  if (!options.fromPreview) window.ManorPreview?.selectObject?.(selectedObjectIndex);
}

function updateSelectedDraft(patch, options = {}) {
  if (selectedObjectIndex == null) return false;
  const base = selectedObjectDraft || selectedObject();
  if (!base) return false;
  selectedObjectDraft = normalizeObject(base, selectedObjectIndex);
  const placement = parseEncMapdata(selectedObjectDraft.enc_mapdata_b64);
  const x = patch.x ?? (placement.valid ? placement.x : 0);
  const y = patch.y ?? (placement.valid ? placement.y : 0);
  const flip = patch.flip ?? !!placement.flip;
  if (patch.scene_id !== undefined) selectedObjectDraft.scene_id = intOrZero(patch.scene_id);
  if (patch.obj_id !== undefined) {
    selectedObjectDraft.obj_id = intOrZero(patch.obj_id);
    if (selectedObjectDraft.source_class === "map-editor") {
      selectedObjectDraft.scene_id = mapEditorDefaultSceneId(selectedObjectDraft.obj_id, selectedObjectDraft.scene_id);
      selectedObjectDraft.source_item = mapEditorSourceTemplate(selectedObjectDraft.obj_id);
    }
  }
  selectedObjectDraft.enc_mapdata_b64 = writeEncMapdata(x, y, flip);
  renderMapEditing({ includeMapJson: options.includeMapJson === true, preserveView: options.preserveView !== false });
  return true;
}

function updateObjectAt(index, patch, options = {}) {
  const obj = mapData.objects?.[index];
  if (!obj) return false;
  const placement = parseEncMapdata(obj.enc_mapdata_b64);
  const x = patch.x ?? (placement.valid ? placement.x : 0);
  const y = patch.y ?? (placement.valid ? placement.y : 0);
  const flip = patch.flip ?? !!placement.flip;
  if (patch.scene_id !== undefined) obj.scene_id = intOrZero(patch.scene_id);
  if (patch.obj_id !== undefined) {
    obj.obj_id = intOrZero(patch.obj_id);
    if (obj.source_class === "map-editor") {
      obj.scene_id = mapEditorDefaultSceneId(obj.obj_id, obj.scene_id);
      obj.source_item = mapEditorSourceTemplate(obj.obj_id);
    }
  }
  obj.enc_mapdata_b64 = writeEncMapdata(x, y, flip);
  mapData.exported_at = new Date().toISOString();
  renderMapEditing({ includeMapJson: options.includeMapJson !== false, preserveView: options.preserveView !== false });
  return true;
}

function applySelectedObjectInputs() {
  if (renderingSelectedObject || !selectedDraftObject()) return;
  updateSelectedDraft({
    scene_id: els.editSceneInput.value,
    obj_id: els.editObjectIdInput.value,
    x: numberOrZero(els.editXInput.value),
    y: numberOrZero(els.editYInput.value),
    flip: els.editFlipInput.checked,
  });
}

function rotateSelectedObject() {
  const obj = selectedDraftObject();
  if (!obj) return;
  const placement = selectedObjectDraft ? parseEncMapdata(selectedObjectDraft.enc_mapdata_b64) : objectPlacementAt(selectedObjectIndex);
  updateSelectedDraft({ flip: !placement.flip });
}

function confirmSelectedObject() {
  if (!selectedObject() || !selectedObjectDraft) return;
  mapData.objects[selectedObjectIndex] = normalizeObject(selectedObjectDraft, selectedObjectIndex);
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
  selectedObjectDraft = null;
  mapData.exported_at = new Date().toISOString();
  renderMapEditing({ preserveView: true });
}

function cancelSelectedObject() {
  if (selectedObjectIndex == null) return;
  if (selectedObjectSnapshot) {
    mapData.objects[selectedObjectIndex] = normalizeObject(selectedObjectSnapshot, selectedObjectIndex);
  } else if (mapData.objects[selectedObjectIndex]) {
    mapData.objects.splice(selectedObjectIndex, 1);
  }
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
  selectedObjectDraft = null;
  mapData.exported_at = new Date().toISOString();
  renderMapEditing({ preserveView: true });
}

function deleteSelectedObject() {
  if (!selectedObject()) return;
  const removed = mapData.objects.splice(selectedObjectIndex, 1)[0];
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
  selectedObjectDraft = null;
  mapData.exported_at = new Date().toISOString();
  setImportStatus(`已删除对象 ${removed.obj_id}。`, "ok");
  renderMapEditing();
}

function addObjectFromInputs(options = {}) {
  if (!syncMapJson()) return;
  const objects = mapData.objects || (mapData.objects = []);
  const objId = intOrZero(els.addObjectIdInput.value);
  if (!objId) {
    setImportStatus("请先填写要添加的 obj。", "err");
    return;
  }
  const next = normalizeObject({
    scene_id: mapEditorDefaultSceneId(objId, els.addSceneInput.value),
    obj_kind: 0,
    key_id: nextNumericField(objects, "key_id"),
    obj_id: objId,
    seq_id: nextNumericField(objects, "seq_id"),
    enc_mapdata_b64: writeEncMapdata(numberOrZero(els.addXInput.value), numberOrZero(els.addYInput.value), els.addFlipInput.checked),
    source_class: "map-editor",
    source_item: mapEditorSourceTemplate(objId),
  }, objects.length);
  objects.push(next);
  selectedObjectIndex = objects.length - 1;
  selectedObjectSnapshot = null;
  selectedObjectDraft = clone(next);
  mapData.exported_at = new Date().toISOString();
  setImportStatus(`已添加对象 ${objectPlainName(objId)}。`, "ok");
  if (options.closePicker) setObjectPickerOpen(false);
  renderMapEditing({ preserveView: true });
}

async function loadObjectCatalog() {
  try {
    const response = await fetch("./exported-assets/object-catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const rows = JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
    const byId = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = String(row.id ?? row.raw?.ID ?? "").trim();
      if (!id) continue;
      const current = byId.get(id) || {
        id,
        names: [],
        sources: [],
        raw: {},
        texture: null,
        type: null,
      };
      const rowName = String(row.name ?? row.raw?.name ?? "").trim();
      if (rowName && !current.names.includes(rowName)) current.names.push(rowName);
      if (row.source_table && !current.sources.includes(row.source_table)) current.sources.push(row.source_table);
      if (!current.texture && row.texture?.png) current.texture = row.texture;
      if (current.type == null && row.type != null) current.type = row.type;
      for (const [key, value] of Object.entries(row.raw || {})) {
        if (current.raw[key] === undefined || current.raw[key] === null || current.raw[key] === "") {
          current.raw[key] = value;
        }
      }
      byId.set(id, current);
    }
    objectCatalog = Array.from(byId.values())
      .map((item) => ({
        ...item,
        name: item.names.find((name) => /[\u4e00-\u9fff]/.test(name) && item.sources.some((source) => source.includes("zh-Hans")))
          || item.names.find(hasChineseText)
          || item.names[0]
          || "",
      }))
      .sort((a, b) => Number(a.id) - Number(b.id));
    objectCatalogById = new Map(objectCatalog.map((item) => [item.id, item]));
    if (Array.isArray(mapData.objects)) {
      mapData.objects = mapData.objects.map((obj, index) => normalizeObject(obj, index));
      if (!mapJsonDirty) renderMapJson();
    }
    els.objectCatalogList.innerHTML = "";
    for (const item of objectCatalog) {
      const option = document.createElement("option");
      option.value = item.id;
      option.label = item.name ? `${item.id} ${item.name}` : item.id;
      els.objectCatalogList.appendChild(option);
    }
    els.addObjectHint.textContent = `${objectCatalog.length} objects`;
    renderObjectPicker();
    renderSelectedObjectPanel();
    renderObjectsTable();
  } catch (error) {
    els.addObjectHint.textContent = "catalog 未加载";
    console.warn("object catalog load failed", error);
  }
}

function syncActiveJson() {
  return activeTab === "player" ? syncPlayerJson() : syncMapJson();
}

function setActiveTab(name) {
  if (!syncActiveJson()) return;
  activeTab = name;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
  renderSummary();
  renderValidation();
}

function downloadBytes(bytes, fileName, type = "application/octet-stream") {
  const blob = new Blob([bytes], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function downloadDat(bytes, fileName) {
  downloadBytes(bytes, fileName, "application/octet-stream");
}

async function importPlayerFile(file) {
  if (!file) return;
  try {
    let next;
    if (!file.name.toLowerCase().endsWith(".dat")) throw new Error("只允许导入 .dat 文件。");
    const result = await window.MoleDat.datFileToData(file);
    if (result.kind !== "userinfo") throw new Error(`${file.name} 解析为 ${result.kind}，不是玩家数据。`);
    next = result.player;
    importReport = `已导入 DAT：${result.report.fileName}=userinfo${result.report.encrypted ? "（已解密）" : ""}`;
    playerData = next;
    playerFileName = file.name;
    setImportStatus(`玩家数据导入成功：${file.name}`, "ok");
    renderAll();
  } catch (error) {
    const msg = `玩家数据导入失败：${error.message}`;
    setImportStatus(msg, "err");
    alert(msg);
  }
}

async function importMapFile(file) {
  if (!file) return;
  try {
    let next;
    if (!file.name.toLowerCase().endsWith(".dat")) throw new Error("只允许导入 .dat 文件。");
    const result = await window.MoleDat.datFileToData(file);
    if (result.kind !== "map") throw new Error(`${file.name} 解析为 ${result.kind}，不是地图数据。`);
    next = result.map;
    importReport = `已导入 DAT：${result.report.fileName}=map${result.report.encrypted ? "（已解密）" : ""}`;
    clearMapSelection();
    mapData = next;
    mapFileName = file.name;
    setImportStatus(`地图数据导入成功：${file.name}`, "ok");
    renderAll();
  } catch (error) {
    const msg = `地图数据导入失败：${error.message}`;
    setImportStatus(msg, "err");
    alert(msg);
  }
}

function openPasteDialog() {
  els.mapBase64Input.value = "";
  if (typeof els.pasteMapDialog.showModal === "function") {
    els.pasteMapDialog.showModal();
  } else {
    els.pasteMapDialog.setAttribute("open", "");
  }
}

function closePasteDialog() {
  if (typeof els.pasteMapDialog.close === "function") {
    els.pasteMapDialog.close();
  } else {
    els.pasteMapDialog.removeAttribute("open");
  }
}

async function loadMapBase64() {
  const value = els.mapBase64Input.value.trim();
  if (!value) {
    setImportStatus("请先粘贴 map base64。", "err");
    return;
  }
  els.loadMapBase64Btn.disabled = true;
  setImportStatus("正在解析粘贴的 map base64...");
  try {
    const result = await window.MoleDat.decodeMapBase64(value);
    mapData = normalizeMapData({
      source: "pasted-map-base64",
      map_blob_b64: result.map_blob_b64,
      map_plist_b64: result.map_plist_b64,
      map_encrypted: result.encrypted,
      objects: result.objects,
    });
    clearMapSelection();
    mapFileName = "pasted-map-base64";
    importReport = `已粘贴地图：map，${result.objects.length} 个对象，blob ${formatNumber(result.report.blobBytes)} B`;
    setImportStatus(`map base64 解析成功：${result.objects.length} 个对象。`, "ok");
    closePasteDialog();
    setActiveTab("map");
    renderAll();
  } catch (error) {
    const msg = `map base64 解析失败：${error.message}`;
    setImportStatus(msg, "err");
    alert(msg);
  } finally {
    els.loadMapBase64Btn.disabled = false;
  }
}

async function readEntryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readDirectoryEntries(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function collectEntryFiles(entry, out = []) {
  if (!entry) return out;
  if (entry.isFile) {
    out.push(await readEntryFile(entry));
    return out;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const entries = await readDirectoryEntries(reader);
      if (!entries.length) break;
      for (const child of entries) await collectEntryFiles(child, out);
    }
  }
  return out;
}

async function filesFromDrop(event) {
  const items = Array.from(event.dataTransfer?.items || []);
  if (!items.length) return Array.from(event.dataTransfer?.files || []);
  const files = [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      await collectEntryFiles(entry, files);
    } else {
      const file = item.getAsFile?.();
      if (file) files.push(file);
    }
  }
  return files.length ? files : Array.from(event.dataTransfer?.files || []);
}

async function importDroppedFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  const dats = list.filter((file) => file.name.toLowerCase().endsWith(".dat"));
  if (dats.length) {
    let imported = 0;
    for (const file of dats) {
      const result = await window.MoleDat.datFileToData(file);
      if (result.kind === "userinfo") {
        playerData = result.player;
        playerFileName = file.name;
        imported += 1;
      } else if (result.kind === "map") {
        clearMapSelection();
        mapData = result.map;
        mapFileName = file.name;
        imported += 1;
      }
    }
    importReport = `拖入 DAT 已识别 ${imported} 个文件。`;
    setImportStatus(importReport, "ok");
    renderAll();
    return;
  }
  importReport = "拖入内容没有 .dat 文件；只允许导入 DAT。";
  setImportStatus(importReport, "err");
}

function loadSample() {
  clearMapSelection();
  playerData = normalizePlayerData({
    user_id: 100001,
    user_info: {
      name: "测试摩尔",
      cur_level: 12,
      xp: 3456,
      gold: 7890,
      vip_gold: 123,
      vip_level: 2,
      icon_index: 5,
      total_workers: 8,
      total_rooms: 3,
    },
    source: "sample",
  });
  mapData = normalizeMapData({
    source: "sample",
    map_blob_b64: null,
    objects: [
      { scene_id: 1, obj_kind: 0, key_id: 1, obj_id: 4001, seq_id: 1, enc_mapdata_b64: writeEncMapdata(13, 5, true) },
      { scene_id: 1, obj_kind: 0, key_id: 2, obj_id: 5001, seq_id: 2, enc_mapdata_b64: writeEncMapdata(9, 18, false) },
      { scene_id: 1, obj_kind: 0, key_id: 3, obj_id: 6002, seq_id: 3, enc_mapdata_b64: writeEncMapdata(23, 21, false) },
      { scene_id: 1, obj_kind: 0, key_id: 4, obj_id: 14245, seq_id: 4, enc_mapdata_b64: writeEncMapdata(18, 12, false) },
      { scene_id: 1, obj_kind: 0, key_id: 5, obj_id: 15001, seq_id: 5, enc_mapdata_b64: writeEncMapdata(3, 17, false) },
    ],
  });
  playerFileName = "sample-player.json";
  mapFileName = "sample-map.json";
  importReport = "已载入示例玩家数据和地图数据。";
  setImportStatus(importReport, "ok");
  renderAll();
}

els.playerFileInput.addEventListener("change", (event) => {
  importPlayerFile(event.target.files?.[0]);
  event.target.value = "";
});

els.mapFileInput.addEventListener("change", (event) => {
  importMapFile(event.target.files?.[0]);
  event.target.value = "";
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

els.userForm.addEventListener("change", applyUserForm);
els.playerJsonEditor.addEventListener("input", () => {
  playerJsonDirty = true;
});
els.mapJsonEditor.addEventListener("input", () => {
  mapJsonDirty = true;
});
els.formatPlayerJsonBtn.addEventListener("click", () => {
  if (syncPlayerJson()) renderPlayerJson();
});
els.formatMapJsonBtn.addEventListener("click", () => {
  if (syncMapJson()) renderMapJson();
});
[
  els.editSceneInput,
  els.editObjectIdInput,
  els.editXInput,
  els.editYInput,
  els.editFlipInput,
].forEach((input) => {
  input.addEventListener("change", applySelectedObjectInputs);
});
els.rotateObjectBtn.addEventListener("click", rotateSelectedObject);
els.deleteObjectBtn.addEventListener("click", deleteSelectedObject);
els.addObjectBtn.addEventListener("click", addObjectFromInputs);
els.toggleAddObjectMenuBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  setObjectPickerOpen(els.addObjectDropdown.hidden);
});
els.addObjectDropdown.addEventListener("click", (event) => {
  event.stopPropagation();
});
els.objectSearchInput.addEventListener("input", () => {
  objectSearchQuery = els.objectSearchInput.value;
  renderObjectPicker();
});
document.addEventListener("click", (event) => {
  if (els.addObjectDropdown.hidden || els.addObjectMenu.contains(event.target)) return;
  setObjectPickerOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.addObjectDropdown.hidden) setObjectPickerOpen(false);
});
els.exportPlayerBtn.addEventListener("click", () => {
  if (!syncPlayerJson()) return;
  const { errors } = validatePlayer();
  renderValidation();
  if (!errors.length) {
    playerData.exported_at = new Date().toISOString();
    downloadDat(window.MoleDat.playerDataToDatBytes(playerData), "userinfo.dat");
    setImportStatus("玩家数据已导出为 userinfo.dat。", "ok");
  }
});
els.exportMapBtn.addEventListener("click", () => {
  if (!syncMapJson()) return;
  const { errors } = validateMap();
  renderValidation();
  if (!errors.length) {
    mapData.exported_at = new Date().toISOString();
    downloadDat(window.MoleDat.mapDataToDatBytes(mapData), "map.dat");
    setImportStatus("地图数据已导出为 map.dat。", "ok");
  }
});
els.openPasteMapBtn.addEventListener("click", openPasteDialog);
els.loadMapBase64Btn.addEventListener("click", loadMapBase64);
els.sampleBtn.addEventListener("click", loadSample);

["dragenter", "dragover"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.editorShell.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.editorShell.classList.remove("dragging");
  });
});

document.addEventListener("drop", async (event) => {
  try {
    setImportStatus("正在读取拖入内容...");
    await importDroppedFiles(await filesFromDrop(event));
  } catch (error) {
    const msg = `拖放读取失败：${error.message}`;
    setImportStatus(msg, "err");
    alert(msg);
  }
});

window.ManorPreview?.configureEditor?.({
  enabled: true,
  onSelect(index) {
    selectObject(index, { fromPreview: true, preserveView: true });
  },
  onMove(index, placement, event) {
    selectedObjectIndex = index;
    updateSelectedDraft(placement, {
      includeMapJson: false,
      preserveView: true,
    });
  },
  onConfirm() {
    confirmSelectedObject();
  },
  onRotate() {
    rotateSelectedObject();
  },
  onCancel() {
    cancelSelectedObject();
  },
  onDelete() {
    deleteSelectedObject();
  },
});

renderAll();
loadObjectCatalog();

window.MoleDataEditor = {
  loadPlayer(data, name = "browser-player") {
    playerData = normalizePlayerData(clone(data));
    playerFileName = name;
    renderAll();
  },
  loadMap(data, name = "browser-map") {
    clearMapSelection();
    mapData = normalizeMapData(clone(data));
    mapFileName = name;
    renderAll();
  },
  getPlayer() {
    return clone(playerData);
  },
  getMap() {
    return clone(mapData);
  },
  selectObject(index) {
    selectObject(Number(index), { preserveView: true });
  },
};
