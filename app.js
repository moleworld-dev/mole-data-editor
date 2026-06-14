"use strict";

const SAVE_FORMAT = "moleworld-save";
const SAVE_VERSION = 1;
const U32_MAX = 4294967295;

let saveData = null;
let activeFileName = "";
let rawDirty = false;
let originalMapBlobState = { present: false, value: undefined };
let importReport = null;

const els = {
  fileInput: document.getElementById("fileInput"),
  folderInput: document.getElementById("folderInput"),
  emptyState: document.getElementById("emptyState"),
  editorShell: document.getElementById("editorShell"),
  fileName: document.getElementById("fileName"),
  saveTitle: document.getElementById("saveTitle"),
  saveMeta: document.getElementById("saveMeta"),
  downloadBtn: document.getElementById("downloadBtn"),
  validationBox: document.getElementById("validationBox"),
  statsGrid: document.getElementById("statsGrid"),
  userForm: document.getElementById("userForm"),
  mapBlobInfo: document.getElementById("mapBlobInfo"),
  keepMapBtn: document.getElementById("keepMapBtn"),
  clearMapBtn: document.getElementById("clearMapBtn"),
  mapBase64Input: document.getElementById("mapBase64Input"),
  loadMapBase64Btn: document.getElementById("loadMapBase64Btn"),
  objectMap: document.getElementById("objectMap"),
  objectsTable: document.getElementById("objectsTable"),
  addObjectBtn: document.getElementById("addObjectBtn"),
  sampleBtn: document.getElementById("sampleBtn"),
  importStatus: document.getElementById("importStatus"),
  jsonEditor: document.getElementById("jsonEditor"),
  formatJsonBtn: document.getElementById("formatJsonBtn"),
};

function setImportStatus(text, kind = "") {
  if (!els.importStatus) return;
  els.importStatus.textContent = text;
  els.importStatus.className = `import-status ${kind}`.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptySave() {
  return {
    format: SAVE_FORMAT,
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
    objects: [],
    social: null,
    progress: null,
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

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
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
      bytes,
    };
  } catch {
    return { x: null, y: null, flip: false, valid: false };
  }
}

function writeEncMapdata(originalB64, x, y, flip) {
  let bytes;
  try {
    bytes = originalB64 ? base64ToBytes(originalB64) : new Uint8Array(9);
  } catch {
    bytes = new Uint8Array(9);
  }
  if (bytes.length < 9) {
    const expanded = new Uint8Array(9);
    expanded.set(bytes);
    bytes = expanded;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setFloat32(0, numberOrZero(x), true);
  view.setFloat32(4, numberOrZero(y), true);
  view.setUint8(8, flip ? 1 : 0);
  return bytesToBase64(bytes);
}

function itemCategory(id) {
  if (id >= 1000 && id <= 2999) return "工作间";
  if (id >= 3000 && id <= 3999) return "种子/作物";
  if (id >= 4000 && id <= 4999) return "家具";
  if (id >= 5000 && id <= 5999) return "小屋/房间";
  if (id >= 6000 && id <= 6999) return "功能建筑";
  if (id >= 14000 && id <= 14999) return "装饰摆件";
  if (id >= 15000 && id <= 15999) return "树";
  if (id >= 21000 && id <= 21999) return "建筑设施";
  if (id >= 25000 && id <= 25999) return "金币礼包";
  if (id >= 100000 && id <= 199999) return "材料";
  return "物件";
}

function objectLabel(id) {
  const known = {
    5001: "小屋",
    5002: "大屋",
    6002: "功能建筑",
    6003: "功能建筑",
    15001: "树",
    4001: "小家具",
    4005: "高级家具",
    14021: "装饰摆件",
    25001: "摩尔豆礼包(500)",
    25002: "摩尔豆礼包(1000)",
    25003: "摩尔豆礼包(5000)",
    25004: "摩尔豆礼包(12000)",
    25005: "摩尔豆礼包(40000)",
    30001: "摩尔公寓",
    30002: "布兰的家",
    30101: "水果店",
  };
  return known[id] || `${itemCategory(id)} #${id}`;
}

function validateSave(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) errors.push("存档顶层必须是 JSON 对象。");
  if (data?.format !== SAVE_FORMAT) errors.push(`format 应为 ${SAVE_FORMAT}。`);
  if (data?.version !== SAVE_VERSION) warnings.push(`当前只按 v${SAVE_VERSION} 结构编辑，文件版本是 ${data?.version ?? "缺失"}。`);
  if (!Number.isInteger(Number(data?.user_id))) errors.push("user_id 必须是整数。");
  if (!data?.user_info || typeof data.user_info !== "object") errors.push("缺少 user_info。");

  const ui = data?.user_info || {};
  ["name", "cur_level", "xp", "gold", "vip_gold", "vip_level", "icon_index", "total_workers", "total_rooms"].forEach((key) => {
    if (ui[key] === undefined) errors.push(`user_info.${key} 缺失。`);
  });
  ["xp", "gold", "vip_gold"].forEach((key) => {
    const v = Number(ui[key]);
    if (Number.isFinite(v) && (v < 0 || v > U32_MAX)) warnings.push(`${key} 会按 u32 写协议，建议保持在 0..${U32_MAX}。`);
  });
  if (Number(ui.cur_level) > 52) warnings.push("客户端上传前会拒绝等级大于 52 的存档。");
  if (Number(ui.icon_index) >= 62) warnings.push("客户端 decodeRemoteData 会把 >=62 的头像索引归零。");
  if (ui.map_blob_b64 !== undefined && ui.map_blob_b64 !== null && typeof ui.map_blob_b64 !== "string") {
    errors.push("map_blob_b64 只能缺失、null 或 base64 字符串。");
  }
  if (data.objects !== undefined && data.objects !== null && !Array.isArray(data.objects)) errors.push("objects 必须是数组或缺失。");
  if (Array.isArray(data.objects) && data.objects.length > 10000) warnings.push("objects 超过建议上限 10000 行。");
  (data.objects || []).forEach((obj, index) => {
    ["scene_id", "obj_kind", "key_id", "obj_id", "seq_id"].forEach((key) => {
      if (!Number.isFinite(Number(obj[key]))) errors.push(`objects[${index}].${key} 必须是数字。`);
    });
    if (obj.enc_mapdata_b64 && byteLengthFromBase64(obj.enc_mapdata_b64) > 64 * 1024) {
      warnings.push(`objects[${index}].enc_mapdata_b64 超过建议单行 64KB 上限。`);
    }
  });
  return { errors, warnings };
}

function notice(text, kind = "") {
  const div = document.createElement("div");
  div.className = `notice ${kind}`.trim();
  div.textContent = text;
  return div;
}

function renderValidation() {
  els.validationBox.innerHTML = "";
  if (!saveData) return;
  const { errors, warnings } = validateSave(saveData);
  if (importReport?.length) {
    els.validationBox.appendChild(
      notice(
        `已读取 DAT：${importReport
          .map((item) => `${item.fileName}=${item.kind}${item.encrypted ? "(已解密)" : ""}`)
          .join("，")}`,
      ),
    );
  }
  if (!errors.length && !warnings.length) {
    els.validationBox.appendChild(notice("校验通过。可下载修改版。"));
  }
  errors.forEach((msg) => els.validationBox.appendChild(notice(msg, "bad")));
  warnings.forEach((msg) => els.validationBox.appendChild(notice(msg, "warn")));
  els.downloadBtn.disabled = errors.length > 0;
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

function renderSummary() {
  const ui = saveData.user_info || {};
  const objects = saveData.objects || [];
  const mapBytes = ui.map_blob_b64 ? byteLengthFromBase64(ui.map_blob_b64) : 0;
  els.fileName.textContent = activeFileName || "浏览器内存";
  els.saveTitle.textContent = `${ui.name || "未命名"} (${saveData.user_id ?? "-"})`;
  els.saveMeta.textContent = `${saveData.format || "unknown"} v${saveData.version ?? "?"} · ${objects.length} 对象 · 地图 ${formatNumber(mapBytes)} B`;

  els.statsGrid.innerHTML = "";
  [
    ["等级", `Lv.${ui.cur_level ?? "-"}`],
    ["经验", formatNumber(ui.xp)],
    ["摩尔豆", formatNumber(ui.gold)],
    ["贝壳", formatNumber(ui.vip_gold)],
    ["VIP", `V${ui.vip_level ?? 0}`],
    ["头像", ui.icon_index ?? "-"],
    ["工人/房间", `${ui.total_workers ?? "-"} / ${ui.total_rooms ?? "-"}`],
    ["地图 blob", ui.map_blob_b64 === null ? "清空" : ui.map_blob_b64 ? `${formatNumber(mapBytes)} B` : "保留/缺失"],
  ].forEach(([label, value]) => els.statsGrid.appendChild(stat(label, value)));

  els.mapBlobInfo.textContent =
    ui.map_blob_b64 === undefined
      ? "字段缺失：导出时会保持缺失状态。"
      : ui.map_blob_b64 === null
        ? "显式 null：表示清空地图，客户端通常会回到默认地图。"
        : `base64 字符串，约 ${formatNumber(mapBytes)} 字节 gzip NSKeyedArchiver。`;
}

function renderForm() {
  const ui = saveData.user_info || {};
  const fields = {
    user_id: saveData.user_id,
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
  els.keepMapBtn.classList.toggle("active", saveData.user_info?.map_blob_b64 !== null);
  els.clearMapBtn.classList.toggle("active", saveData.user_info?.map_blob_b64 === null);
}

function objectRows() {
  return (saveData.objects || []).map((obj, index) => ({
    ...obj,
    index,
    placement: parseEncMapdata(obj.enc_mapdata_b64),
  }));
}

function renderMap() {
  const rows = objectRows().filter((row) => row.placement.valid);
  window.ManorPreview?.render?.(rows);
}

function inputCell(row, key, cls = "tiny", type = "number") {
  const input = document.createElement("input");
  input.className = cls;
  input.type = type;
  input.value = row[key] ?? "";
  input.addEventListener("change", () => {
    if (type === "checkbox") return;
    saveData.objects[row.index][key] = intOrZero(input.value);
    syncAfterEdit();
  });
  return input;
}

function renderObjectsTable() {
  els.objectsTable.innerHTML = "";
  objectRows().forEach((row) => {
    const tr = document.createElement("tr");
    const cells = [
      inputCell(row, "obj_kind"),
      inputCell(row, "scene_id"),
      inputCell(row, "key_id", "wide"),
      inputCell(row, "obj_id", "wide"),
      inputCell(row, "seq_id", "wide"),
    ];

    const x = document.createElement("input");
    x.className = "tiny";
    x.type = "number";
    x.step = "0.001";
    x.value = row.placement.valid ? row.placement.x : "";
    const y = x.cloneNode();
    y.value = row.placement.valid ? row.placement.y : "";
    const flip = document.createElement("input");
    flip.type = "checkbox";
    flip.checked = !!row.placement.flip;

    const updatePlacement = () => {
      saveData.objects[row.index].enc_mapdata_b64 = writeEncMapdata(
        saveData.objects[row.index].enc_mapdata_b64,
        x.value,
        y.value,
        flip.checked,
      );
      syncAfterEdit();
    };
    x.addEventListener("change", updatePlacement);
    y.addEventListener("change", updatePlacement);
    flip.addEventListener("change", updatePlacement);

    [...cells, x, y, flip].forEach((node) => {
      const td = document.createElement("td");
      td.appendChild(node);
      tr.appendChild(td);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "删除";
    del.addEventListener("click", () => {
      saveData.objects.splice(row.index, 1);
      syncAfterEdit();
    });
    const td = document.createElement("td");
    td.appendChild(del);
    tr.appendChild(td);
    els.objectsTable.appendChild(tr);
  });
}

function renderJson() {
  els.jsonEditor.value = JSON.stringify(saveData, null, 2);
  rawDirty = false;
}

function renderAll({ includeRaw = true } = {}) {
  renderSummary();
  renderForm();
  renderMap();
  renderObjectsTable();
  renderValidation();
  if (includeRaw) renderJson();
}

function syncAfterEdit() {
  renderAll({ includeRaw: true });
}

function applyUserForm() {
  if (!saveData) return;
  const data = new FormData(els.userForm);
  saveData.user_id = intOrZero(data.get("user_id"));
  saveData.user_info = saveData.user_info || {};
  saveData.user_info.name = String(data.get("name") || "");
  ["cur_level", "xp", "gold", "vip_gold", "vip_level", "icon_index", "total_workers", "total_rooms"].forEach((key) => {
    saveData.user_info[key] = intOrZero(data.get(key));
  });
  renderAll({ includeRaw: true });
}

async function loadFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    alert(`JSON 解析失败：${error.message}`);
    return;
  }
  loadJsonData(parsed, file.name, null);
}

async function loadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) {
    setImportStatus("没有读取到文件。请直接拖入 userinfo.dat，或同时选中 userinfo.dat 和 map.dat。", "err");
    return;
  }
  setImportStatus(`读取到 ${files.length} 个文件：${files.map((file) => file.name).slice(0, 6).join("、")}`, "ok");
  const datFiles = files.filter((file) => file.name.toLowerCase().endsWith(".dat"));
  if (datFiles.length) {
    try {
      const result = await window.MoleDat.datFilesToSave(datFiles);
      setImportStatus(
        `DAT 解析成功：${result.report.map((item) => `${item.fileName}=${item.kind}`).join("，")}`,
        "ok",
      );
      loadJsonData(result.save, datFiles.map((file) => file.name).join(" + "), result.report);
    } catch (error) {
      const msg = `DAT 读取失败：${error.message}`;
      setImportStatus(msg, "err");
      alert(msg);
    }
    return;
  }
  await loadFile(files[0]);
}

function readEntryFile(entry) {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
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
    try {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        await collectEntryFiles(entry, files);
      } else {
        const file = item.getAsFile?.();
        if (file) files.push(file);
      }
    } catch {
      const file = item.getAsFile?.();
      if (file) files.push(file);
    }
  }
  return files.length ? files : Array.from(event.dataTransfer?.files || []);
}

function loadJsonData(parsed, name = "浏览器内存", report = null) {
  saveData = parsed;
  activeFileName = name;
  importReport = report;
  originalMapBlobState = {
    present: Object.prototype.hasOwnProperty.call(saveData?.user_info || {}, "map_blob_b64"),
    value: saveData?.user_info?.map_blob_b64,
  };
  if (els.emptyState) els.emptyState.hidden = true;
  els.editorShell.hidden = false;
  renderAll();
}

function syncRawJson() {
  if (!rawDirty) return true;
  try {
    saveData = JSON.parse(els.jsonEditor.value);
    rawDirty = false;
    renderAll({ includeRaw: false });
    return true;
  } catch (error) {
    alert(`原始 JSON 解析失败：${error.message}`);
    return false;
  }
}

function setActiveTab(name) {
  if (!syncRawJson()) return;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
}

function downloadSave() {
  if (!syncRawJson()) return;
  const { errors } = validateSave(saveData);
  if (errors.length) {
    renderValidation();
    return;
  }
  const out = clone(saveData);
  if (!out.exported_at) out.exported_at = new Date().toISOString();
  const blob = new Blob([`${JSON.stringify(out, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  const safeId = out.user_id ?? "save";
  a.href = URL.createObjectURL(blob);
  a.download = `moleworld-save-${safeId}-edited.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

els.fileInput.addEventListener("change", (event) => {
  loadFiles(event.target.files);
});

els.folderInput.addEventListener("change", (event) => {
  loadFiles(event.target.files);
});

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
    const files = await filesFromDrop(event);
    await loadFiles(files);
  } catch (error) {
    const msg = `拖放读取失败：${error.message}`;
    setImportStatus(msg, "err");
    alert(msg);
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

els.userForm.addEventListener("change", applyUserForm);
els.downloadBtn.addEventListener("click", downloadSave);
els.jsonEditor.addEventListener("input", () => {
  rawDirty = true;
});

els.formatJsonBtn.addEventListener("click", () => {
  if (syncRawJson()) renderJson();
});

els.keepMapBtn.addEventListener("click", () => {
  saveData.user_info = saveData.user_info || {};
  if (originalMapBlobState.present) {
    saveData.user_info.map_blob_b64 = originalMapBlobState.value;
  } else {
    delete saveData.user_info.map_blob_b64;
  }
  syncAfterEdit();
});

els.clearMapBtn.addEventListener("click", () => {
  saveData.user_info = saveData.user_info || {};
  saveData.user_info.map_blob_b64 = null;
  syncAfterEdit();
});

els.loadMapBase64Btn.addEventListener("click", async () => {
  const value = els.mapBase64Input.value.trim();
  if (!value) {
    setImportStatus("请先粘贴 map base64。", "err");
    return;
  }
  els.loadMapBase64Btn.disabled = true;
  setImportStatus("正在解析粘贴的 map base64...");
  try {
    const result = await window.MoleDat.decodeMapBase64(value);
    saveData.user_info = saveData.user_info || {};
    saveData.user_info.map_blob_b64 = result.map_blob_b64;
    saveData.objects = result.objects;
    originalMapBlobState = { present: true, value: result.map_blob_b64 };
    importReport = [{
      fileName: "pasted-map-base64",
      kind: result.report.kind,
      encrypted: result.report.encrypted,
      plistBytes: result.report.plistBytes,
    }];
    rawDirty = false;
    renderAll();
    setImportStatus(
      `map base64 解析成功：${result.objects.length} 个对象，blob ${formatNumber(result.report.blobBytes)} B。`,
      "ok",
    );
  } catch (error) {
    const msg = `map base64 解析失败：${error.message}`;
    setImportStatus(msg, "err");
    alert(msg);
  } finally {
    els.loadMapBase64Btn.disabled = false;
  }
});

els.addObjectBtn.addEventListener("click", () => {
  saveData.objects = saveData.objects || [];
  const seq = Date.now();
  saveData.objects.push({
    scene_id: 1,
    obj_kind: 0,
    key_id: seq,
    obj_id: 4001,
    seq_id: seq,
    enc_mapdata_b64: writeEncMapdata("", 0, 0, false),
  });
  syncAfterEdit();
});

els.sampleBtn.addEventListener("click", () => {
  loadJsonData(
    {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      exported_at: new Date().toISOString(),
      source: "sample",
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
        map_blob_b64: null,
      },
      objects: [
        {
          scene_id: 1,
          obj_kind: 0,
          key_id: 1,
          obj_id: 4001,
          seq_id: 1,
          enc_mapdata_b64: writeEncMapdata("", 13, 5, true),
        },
        {
          scene_id: 1,
          obj_kind: 0,
          key_id: 2,
          obj_id: 5001,
          seq_id: 2,
          enc_mapdata_b64: writeEncMapdata("", 9, 18, false),
        },
        {
          scene_id: 1,
          obj_kind: 0,
          key_id: 3,
          obj_id: 6002,
          seq_id: 3,
          enc_mapdata_b64: writeEncMapdata("", 23, 21, false),
        },
        {
          scene_id: 1,
          obj_kind: 0,
          key_id: 4,
          obj_id: 14245,
          seq_id: 4,
          enc_mapdata_b64: writeEncMapdata("", 18, 12, false),
        },
        {
          scene_id: 1,
          obj_kind: 0,
          key_id: 5,
          obj_id: 15001,
          seq_id: 5,
          enc_mapdata_b64: writeEncMapdata("", 3, 17, false),
        },
      ],
      social: { friends: [] },
      progress: { redeems: [] },
    },
    "sample-save.json",
  );
});

loadJsonData(createEmptySave(), "新建存档", null);

window.MoleDataEditor = {
  loadJson(data, name) {
    loadJsonData(clone(data), name);
  },
  getSave() {
    return clone(saveData);
  },
};
