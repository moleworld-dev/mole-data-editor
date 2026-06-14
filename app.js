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
let objectCatalog = [];
let objectCatalogById = new Map();
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

function objectPlacementAt(index) {
  const obj = mapData.objects?.[index];
  return obj ? parseEncMapdata(obj.enc_mapdata_b64) : { x: null, y: null, flip: false, valid: false };
}

function selectedObject() {
  return Number.isInteger(selectedObjectIndex) ? mapData.objects?.[selectedObjectIndex] || null : null;
}

function clearMapSelection() {
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
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
  return {
    scene_id: intOrZero(obj.scene_id),
    obj_kind: intOrZero(obj.obj_kind),
    key_id: intOrZero(obj.key_id || index + 1),
    obj_id: intOrZero(obj.obj_id ?? obj.objectId),
    seq_id: intOrZero(obj.seq_id || index + 1),
    enc_mapdata_b64: typeof obj.enc_mapdata_b64 === "string" ? obj.enc_mapdata_b64 : "",
    source_class: obj.source_class || obj.__class || undefined,
  };
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
  window.ManorPreview?.render?.(
    mapRows().filter((row) => row.placement.valid),
    {
      selectedIndex: selectedObjectIndex,
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
  const obj = selectedObject();
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

  const placement = objectPlacementAt(selectedObjectIndex);
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
    if (selectedObjectIndex != null && !mapData.objects[selectedObjectIndex]) selectedObjectIndex = null;
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
  renderObjectsTable();
  renderSelectedObjectPanel();
  renderMap({ preserveView: options.preserveView !== false });
  if (!options.fromPreview) window.ManorPreview?.selectObject?.(selectedObjectIndex);
}

function updateObjectAt(index, patch, options = {}) {
  const obj = mapData.objects?.[index];
  if (!obj) return false;
  const placement = parseEncMapdata(obj.enc_mapdata_b64);
  const x = patch.x ?? (placement.valid ? placement.x : 0);
  const y = patch.y ?? (placement.valid ? placement.y : 0);
  const flip = patch.flip ?? !!placement.flip;
  if (patch.scene_id !== undefined) obj.scene_id = intOrZero(patch.scene_id);
  if (patch.obj_id !== undefined) obj.obj_id = intOrZero(patch.obj_id);
  obj.enc_mapdata_b64 = writeEncMapdata(x, y, flip);
  mapData.exported_at = new Date().toISOString();
  renderMapEditing({ includeMapJson: options.includeMapJson !== false, preserveView: options.preserveView !== false });
  return true;
}

function applySelectedObjectInputs() {
  if (renderingSelectedObject || !selectedObject()) return;
  updateObjectAt(selectedObjectIndex, {
    scene_id: els.editSceneInput.value,
    obj_id: els.editObjectIdInput.value,
    x: numberOrZero(els.editXInput.value),
    y: numberOrZero(els.editYInput.value),
    flip: els.editFlipInput.checked,
  });
}

function rotateSelectedObject() {
  const obj = selectedObject();
  if (!obj) return;
  const placement = objectPlacementAt(selectedObjectIndex);
  updateObjectAt(selectedObjectIndex, { flip: !placement.flip });
}

function confirmSelectedObject() {
  if (!selectedObject()) return;
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
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
  mapData.exported_at = new Date().toISOString();
  renderMapEditing({ preserveView: true });
}

function deleteSelectedObject() {
  if (!selectedObject()) return;
  const removed = mapData.objects.splice(selectedObjectIndex, 1)[0];
  selectedObjectIndex = null;
  selectedObjectSnapshot = null;
  mapData.exported_at = new Date().toISOString();
  setImportStatus(`已删除对象 ${removed.obj_id}。`, "ok");
  renderMapEditing();
}

function addObjectFromInputs() {
  if (!syncMapJson()) return;
  const objects = mapData.objects || (mapData.objects = []);
  const objId = intOrZero(els.addObjectIdInput.value);
  if (!objId) {
    setImportStatus("请先填写要添加的 obj。", "err");
    return;
  }
  const next = normalizeObject({
    scene_id: intOrZero(els.addSceneInput.value || 1),
    obj_kind: 0,
    key_id: nextNumericField(objects, "key_id"),
    obj_id: objId,
    seq_id: nextNumericField(objects, "seq_id"),
    enc_mapdata_b64: writeEncMapdata(numberOrZero(els.addXInput.value), numberOrZero(els.addYInput.value), els.addFlipInput.checked),
    source_class: "map-editor",
  }, objects.length);
  objects.push(next);
  selectedObjectIndex = objects.length - 1;
  selectedObjectSnapshot = null;
  mapData.exported_at = new Date().toISOString();
  setImportStatus(`已添加对象 ${objectName(objId)}。`, "ok");
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
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        name: String(row.name ?? row.raw?.name ?? "").trim(),
      });
    }
    objectCatalogById = byId;
    objectCatalog = Array.from(byId.values()).sort((a, b) => Number(a.id) - Number(b.id));
    els.objectCatalogList.innerHTML = "";
    for (const item of objectCatalog) {
      const option = document.createElement("option");
      option.value = item.id;
      option.label = item.name ? `${item.id} ${item.name}` : item.id;
      els.objectCatalogList.appendChild(option);
    }
    els.addObjectHint.textContent = `${objectCatalog.length} objects`;
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

function downloadJson(data, fileName) {
  const out = clone(data);
  out.exported_at = new Date().toISOString();
  const blob = new Blob([`${JSON.stringify(out, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

async function importPlayerFile(file) {
  if (!file) return;
  try {
    let next;
    if (file.name.toLowerCase().endsWith(".dat")) {
      const result = await window.MoleDat.datFileToData(file);
      if (result.kind !== "userinfo") throw new Error(`${file.name} 解析为 ${result.kind}，不是玩家数据。`);
      next = result.player;
      importReport = `已导入 DAT：${result.report.fileName}=userinfo${result.report.encrypted ? "（已解密）" : ""}`;
    } else {
      next = normalizePlayerData(JSON.parse(await file.text()));
      importReport = `已导入玩家 JSON：${file.name}`;
    }
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
    if (file.name.toLowerCase().endsWith(".dat")) {
      const result = await window.MoleDat.datFileToData(file);
      if (result.kind !== "map") throw new Error(`${file.name} 解析为 ${result.kind}，不是地图数据。`);
      next = result.map;
      importReport = `已导入 DAT：${result.report.fileName}=map${result.report.encrypted ? "（已解密）" : ""}`;
    } else {
      next = normalizeMapData(JSON.parse(await file.text()));
      importReport = `已导入地图 JSON：${file.name}`;
    }
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
  if (activeTab === "player") {
    await importPlayerFile(list[0]);
  } else {
    await importMapFile(list[0]);
  }
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
els.exportPlayerBtn.addEventListener("click", () => {
  if (!syncPlayerJson()) return;
  const { errors } = validatePlayer();
  renderValidation();
  if (!errors.length) downloadJson(playerData, `moleworld-player-${playerData.user_id || "new"}.json`);
});
els.exportMapBtn.addEventListener("click", () => {
  if (!syncMapJson()) return;
  const { errors } = validateMap();
  renderValidation();
  if (!errors.length) downloadJson(mapData, "moleworld-map.json");
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
    updateObjectAt(index, placement, {
      includeMapJson: event?.final !== false,
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
