const tg = window.Telegram && window.Telegram.WebApp;
const KIND_EN = {
  photo: "Photo", video: "Video", document: "File", audio: "Audio",
  voice: "Voice", text: "Text", link: "Link", animation: "GIF", sticker: "Sticker",
  video_note: "Video"
};
const ICONS = {
  photo: '<path d="M4 7h16v12H4z"/><circle cx="9" cy="12" r="1.4"/><path d="m4 16 5-4 4 3 3-2 4 3"/>',
  video: '<rect x="4" y="7" width="12" height="10" rx="1.5"/><path d="m16 10 5-2v8l-5-2z"/>',
  document: '<path d="M7 4h7l5 5v11H7z"/><path d="M14 4v5h5"/>',
  audio: '<path d="M9 9v6M12 7v10M15 10v4M6 11v2M18 11v2"/>',
  voice: '<rect x="9" y="5" width="6" height="9" rx="3"/><path d="M7 12a5 5 0 0 0 10 0M12 17v2"/>',
  text: '<path d="M6 7h12M8 12h8M9 17h6"/>',
  link: '<path d="M10 13a4 4 0 0 1 0-6l2-2a4 4 0 0 1 6 6l-1 1M14 11a4 4 0 0 1 0 6l-2 2a4 4 0 0 1-6-6l1-1"/>',
  animation: '<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M9 10h.01M12 14 9.5 11.5 15 10"/>',
  sticker: '<circle cx="12" cy="12" r="8"/><path d="M8 14c1.2 2 6.8 2 8 0M9 10h.01M15 10h.01"/>',
  video_note: '<circle cx="12" cy="12" r="8"/><path d="m10 9 6 3-6 3z"/>'
};
function kindLabel(k) { return KIND_EN[k] || k || "File"; }
function svgIcon(k) {
  const d = ICONS[k] || ICONS.document;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + d + "</svg>";
}
const TRAY_SVG = '<svg viewBox="0 0 28 22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="12" width="26" height="9" rx="2"/><rect x="5" y="6" width="18" height="7" rx="1.6"/><rect x="9" y="1" width="10" height="6" rx="1.3"/></svg>';

function nativeChrome() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("secondary_bg_color"); } catch (e) {}
  try { tg.setBackgroundColor("bg_color"); } catch (e) {}
  try { tg.setBottomBarColor("bottom_bar_bg_color"); } catch (e) {}
  try { if (tg.isVersionAtLeast && tg.isVersionAtLeast("8.0") && tg.requestFullscreen) tg.requestFullscreen(); } catch (e) {}
  try { if (tg.hideKeyboard) tg.hideKeyboard(); } catch (e) {}
  try { if (tg.lockOrientation) tg.lockOrientation(); } catch (e) {}
  if (tg.MainButton) tg.MainButton.hide();
  if (tg.BackButton) tg.BackButton.hide();
  if (tg.SettingsButton) {
    tg.SettingsButton.show();
    tg.SettingsButton.onClick(() => show("settings"));
  }
  if (tg.onEvent) tg.onEvent("themeChanged", function () {});
  const ua = navigator.userAgent || "";
  if (ua.indexOf("; LOW)") !== -1) document.documentElement.setAttribute("data-low", "1");
}
nativeChrome();

(function theme() {
  const hasTg = !!(getComputedStyle(document.documentElement).getPropertyValue("--tg-theme-bg-color") || "").trim();
  if (!hasTg) {
    const h = new Date().getHours();
    document.documentElement.setAttribute("data-theme", (h < 7 || h >= 19) ? "night" : "day");
  }
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.setAttribute("data-low", "1");
  }
})();

function haptic(kind) {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (kind === "ok") tg.HapticFeedback.notificationOccurred("success");
    else if (kind === "warn") tg.HapticFeedback.notificationOccurred("warning");
    else if (kind === "sel") tg.HapticFeedback.selectionChanged();
    else tg.HapticFeedback.impactOccurred("light");
  } catch (e) {}
}

function qs() { return new URLSearchParams(location.search); }
function decodeParts(raw, n) {
  if (!raw) return [];
  return raw.split(",").filter(Boolean).map((part) => {
    const bits = part.split(":");
    while (bits.length < n) bits.push("");
    return bits;
  });
}
function esc(s) {
  return String(s || "").replace(/[<>&]/g, function (c) {
    return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c];
  });
}
function apiBase() {
  if (window.INBOXBOX_API) return String(window.INBOXBOX_API).replace(/\/$/, "");
  const host = location.hostname || "";
  if (host === "inboxbox.halakou.workers.dev" || /\.workers\.dev$/i.test(host)) return "";
  return "https://inboxbox.halakou.workers.dev";
}

const params = qs();
let PLAN = params.get("plan") === "pro" ? "Pro" : "Free";
let USED = 0, CAP = 40, PIN_USED = 0, PIN_CAP = 3;
const BOXES = decodeParts(params.get("boxes"), 3).map((b) => ({
  id: b[0], name: decodeURIComponent(b[1] || "Box"), count: Number(b[2] || 0)
}));
const ITEMS = decodeParts(params.get("items"), 7).map((it) => ({
  id: it[0], box: it[1], kind: it[2], bytes: Number(it[3] || 0),
  label: decodeURIComponent(it[4] || it[2] || "File"), pin: it[5] === "1", opened: it[6] === "1"
}));
const SOURCES = decodeParts(params.get("sources"), 3).map((s) => ({
  id: s[0], username: decodeURIComponent(s[1] || ""), title: decodeURIComponent(s[2] || s[1] || "Source")
}));
const DEFAULT_BOXES = [
  { id: "inbox", name: "Inbox" }, { id: "work", name: "Work" },
  { id: "ideas", name: "Ideas" }, { id: "links", name: "Links" }
];
if (!BOXES.length) DEFAULT_BOXES.forEach((b) => BOXES.push({ id: b.id, name: b.name, count: 0 }));

const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
const uname = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "InboxBox";
const unameEl = document.getElementById("uname");
if (unameEl) unameEl.textContent = uname;

function paintPlan() {
  const planLabel = PLAN === "Pro" ? "Pro" : "Free";
  const a = document.getElementById("plan");
  const b = document.getElementById("set-plan");
  if (a) a.textContent = planLabel;
  if (b) b.textContent = planLabel;
  const card = document.getElementById("pro-card");
  if (card) card.hidden = PLAN === "Pro";
  const q = document.getElementById("quota");
  if (q) {
    if (PLAN === "Pro" || !CAP) q.hidden = true;
    else {
      q.hidden = false;
      q.textContent = USED + " of " + CAP + " free items. Pro files for you.";
    }
  }
  paintCta();
}
paintPlan();

function payload(op, extra) {
  return JSON.stringify(Object.assign({ op: op, initData: (tg && tg.initData) || "" }, extra || {}));
}
function send(op, extra) {
  const body = payload(op, extra);
  const initData = (tg && tg.initData) || "";
  if (initData) {
    fetch(apiBase() + "/api/op", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData },
      body: body
    }).then(function () {
      if (op === "erase" || op === "pin" || op === "add_box" || op === "add_rule") return loadShelf().then(function () { renderShelf(); renderSources(); });
    }).catch(function () {});
    return;
  }
  if (tg && tg.sendData) tg.sendData(body);
}

async function loadShelf() {
  const initData = (tg && tg.initData) || "";
  if (!initData) return false;
  try {
    const res = await fetch(apiBase() + "/api/shelf", { headers: { "X-Telegram-Init-Data": initData } });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data || !data.ok) return false;
    PLAN = data.plan === "pro" ? "Pro" : "Free";
    USED = Number(data.used || 0);
    CAP = Number(data.cap || 0);
    PIN_USED = Number(data.pinUsed || 0);
    PIN_CAP = Number(data.pinCap || 0);
    paintPlan();
    if (Array.isArray(data.boxes) && data.boxes.length) {
      BOXES.length = 0;
      data.boxes.forEach(function (b) {
        BOXES.push({ id: String(b.id), name: b.name, count: Number(b.count || 0) });
      });
    }
    ITEMS.length = 0;
    (data.items || []).forEach(function (it) {
      ITEMS.push({
        id: String(it.id), box: String(it.box), kind: it.kind, bytes: Number(it.bytes || 0),
        label: it.label || it.kind, pin: !!it.pin, opened: !!it.opened
      });
    });
    SOURCES.length = 0;
    (data.sources || []).forEach(function (s) {
      SOURCES.push({ id: String(s.id), username: s.username || "", title: s.title || "", boxId: s.boxId || "" });
    });
    return true;
  } catch (e) { return false; }
}

let currentBox = null;
let currentView = "shelf";
let filter = "all";
let selected = new Set();

function show(name) {
  currentView = name;
  ["shelf", "box", "sources", "settings"].forEach(function (v) {
    const el = document.getElementById("view-" + v);
    if (el) el.hidden = v !== name;
  });
  document.querySelectorAll(".dock button").forEach(function (b) {
    b.classList.toggle("on", b.getAttribute("data-view") === name);
  });
  const titles = { shelf: "Shelf", sources: "Sources", settings: "Settings" };
  const h = document.getElementById("headline");
  if (h) h.textContent = name === "box" && currentBox ? currentBox.name : (titles[name] || "Shelf");
  document.body.classList.toggle("in-box", name === "box");
  if (tg && tg.BackButton) {
    if (name === "box") {
      tg.BackButton.show();
      tg.BackButton.onClick(function () { show("shelf"); });
    } else tg.BackButton.hide();
  }
  hideMain();
  paintCta();
  try {
    if (tg && tg.CloudStorage && (name === "shelf" || name === "sources" || name === "settings")) {
      tg.CloudStorage.setItem("tab", name);
    }
  } catch (e) {}
}

function hideMain() {
  selected.clear();
}

function paintCta() {
  if (!tg || !tg.MainButton) return;
  if (selected.size) {
    tg.MainButton.setParams({
      text: selected.size === 1 ? "Open" : "Open " + selected.size,
      has_shine_effect: false,
      is_visible: true
    });
    tg.MainButton.onClick(function () {
      const ids = Array.from(selected).map(Number);
      haptic("ok");
      if (ids.length === 1) send("open", { id: ids[0] });
      else send("open_many", { ids: ids });
    });
    return;
  }
  if (PLAN !== "Pro" && (currentView === "settings" || (CAP && USED / CAP >= 0.5))) {
    tg.MainButton.setParams({
      text: "InboxBox Pro · $1",
      has_shine_effect: true,
      is_visible: true
    });
    tg.MainButton.onClick(function () { haptic("ok"); wantPro(); });
    return;
  }
  tg.MainButton.hide();
}

function totalItems() {
  return ITEMS.length || BOXES.reduce(function (n, b) { return n + (b.count || 0); }, 0);
}

function itemRowHtml(it) {
  return '<span class="icon k-' + (it.kind || "file") + '">' + svgIcon(it.kind) + '</span><span class="title">' +
    esc(it.label || kindLabel(it.kind)) + '<span class="sub">' + kindLabel(it.kind) + "</span></span><span class=\"chev\">›</span>";
}

function renderShelf() {
  const empty = document.getElementById("empty-hero");
  if (empty) empty.hidden = totalItems() > 0;
  const root = document.getElementById("boxes");
  root.className = "trays";
  root.innerHTML = "";
  BOXES.forEach(function (b) {
    const n = b.count || ITEMS.filter(function (it) { return it.box === b.id; }).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tray";
    btn.innerHTML = '<span class="tray-art">' + TRAY_SVG + '</span><span class="tray-name">' + esc(b.name) +
      '</span><span class="tray-n">' + n + (n === 1 ? " item" : " items") + "</span>";
    btn.addEventListener("click", function () { haptic("sel"); openBox(b); });
    root.appendChild(btn);
  });
  const rec = document.getElementById("recent");
  rec.className = "rail";
  rec.innerHTML = "";
  const opened = ITEMS.filter(function (it) { return it.opened; }).slice(0, 8);
  const recent = opened.length ? opened : ITEMS.slice(0, 8);
  const recEmpty = document.getElementById("recent-empty");
  if (recEmpty) recEmpty.hidden = recent.length > 0;
  recent.forEach(function (it) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tile k-" + (it.kind || "file");
    btn.innerHTML = '<span class="tile-glyph">' + svgIcon(it.kind) + '</span><p class="tile-k">' +
      kindLabel(it.kind) + '</p><p class="tile-l">' + esc(it.label || kindLabel(it.kind)) + "</p>";
    btn.addEventListener("click", function () { haptic("ok"); send("open", { id: Number(it.id) }); });
    rec.appendChild(btn);
  });
  const pinRoot = document.getElementById("pinned");
  const pins = ITEMS.filter(function (it) { return it.pin; });
  document.getElementById("pinned-wrap").hidden = pins.length === 0;
  if (pinRoot) {
    pinRoot.innerHTML = "";
    pins.forEach(function (it) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "row";
      btn.innerHTML = itemRowHtml(it);
      btn.addEventListener("click", function () { haptic("ok"); send("open", { id: Number(it.id) }); });
      pinRoot.appendChild(btn);
    });
  }
  paintPlan();
}

function filteredItems(box) {
  let list = ITEMS.filter(function (it) { return it.box === box.id; });
  const qel = document.getElementById("q");
  const q = (qel && qel.value || "").trim().toLowerCase();
  if (q) list = list.filter(function (it) {
    return (it.label || "").toLowerCase().indexOf(q) !== -1 || (it.kind || "").indexOf(q) !== -1 || (kindLabel(it.kind) || "").indexOf(q) !== -1;
  });
  if (filter === "files") list = list.filter(function (it) { return it.kind !== "text"; });
  if (filter === "text") list = list.filter(function (it) { return it.kind === "text"; });
  if (filter === "recent") list = list.slice(0, 8);
  if (filter === "pinned") list = list.filter(function (it) { return it.pin; });
  return list;
}

function openBox(box) {
  currentBox = box;
  filter = "all";
  document.querySelectorAll(".filters button").forEach(function (b) {
    b.classList.toggle("on", b.getAttribute("data-filter") === "all");
  });
  document.getElementById("box-title").textContent = box.name;
  const q = document.getElementById("q");
  if (q) q.value = "";
  renderFiles();
  show("box");
}

function renderFiles() {
  const files = currentBox ? filteredItems(currentBox) : [];
  const root = document.getElementById("files");
  root.innerHTML = "";
  document.getElementById("box-empty").hidden = files.length > 0;
  files.forEach(function (it) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row" + (selected.has(it.id) ? " on" : "");
    btn.innerHTML = itemRowHtml(it);
    btn.addEventListener("click", function () { toggleFile(it, btn); });
    root.appendChild(btn);
  });
}

function toggleFile(it, btn) {
  if (selected.has(it.id)) selected.delete(it.id);
  else selected.add(it.id);
  btn.classList.toggle("on", selected.has(it.id));
  haptic("sel");
  paintCta();
}

function renderSources() {
  const root = document.getElementById("sources");
  root.innerHTML = "";
  document.getElementById("src-empty").hidden = SOURCES.length > 0;
  SOURCES.forEach(function (s) {
    const wrap = document.createElement("div");
    wrap.className = "row";
    const handle = s.username ? "@" + s.username.replace(/^@/, "") : "";
    wrap.innerHTML = '<span class="icon">' + svgIcon("link") + '</span><span class="title">' +
      esc(s.title) + '<span class="sub">' + esc(handle || "Auto-sort this source") + "</span></span><span class=\"chev\">›</span>";
    wrap.addEventListener("click", function () {
      haptic("sel");
      if (PLAN !== "Pro") { wantPro("Auto-sort is Pro. Forwards from a channel land in the box you choose."); return; }
      const names = BOXES.map(function (b, i) { return (i + 1) + ". " + b.name; }).join("\n");
      const pick = window.prompt("Send files from this source to which box?\n" + names);
      const n = Number(pick);
      if (!n || !BOXES[n - 1]) return;
      send("add_rule", { sourceId: Number(s.id), boxId: Number(BOXES[n - 1].id) });
    });
    root.appendChild(wrap);
  });
}

document.querySelectorAll(".dock button").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = b.getAttribute("data-view");
    haptic("sel");
    if (v === "sources") renderSources();
    show(v);
  });
});
document.querySelectorAll(".filters button").forEach(function (b) {
  b.addEventListener("click", function () {
    filter = b.getAttribute("data-filter");
    document.querySelectorAll(".filters button").forEach(function (x) { x.classList.toggle("on", x === b); });
    renderFiles();
  });
});
function wantPro(reason) {
  haptic("warn");
  const msg = reason || "Pro files for you. $1/month, $10/year, or $20 lifetime.";
  show("settings");
  if (tg && tg.showPopup) {
    tg.showPopup({
      title: "InboxBox Pro",
      message: msg,
      buttons: [
        { id: "month", type: "default", text: "$1 / month" },
        { id: "year", type: "default", text: "$10 / year" },
        { id: "life", type: "default", text: "$20 lifetime" }
      ]
    }, function (id) { if (id) send("vip", { tier: id }); });
  } else if (tg && tg.showAlert) tg.showAlert(msg);
}

function buy(tier) { haptic("ok"); send("vip", { tier: tier }); }

document.getElementById("q").addEventListener("input", renderFiles);
["month", "year", "life"].forEach(function (t) {
  const el = document.getElementById("btn-pro-" + t);
  if (el) el.addEventListener("click", function () { buy(t); });
});
const newBox = document.getElementById("btn-new-box");
if (newBox) newBox.addEventListener("click", function () {
  haptic("sel");
  if (PLAN !== "Pro") { wantPro("Custom boxes are Pro. Free keeps Inbox, Work, Ideas, Links."); return; }
  const name = window.prompt("Box name");
  if (name && name.trim()) send("add_box", { name: name.trim() });
});
document.getElementById("btn-privacy").addEventListener("click", function () {
  haptic("sel");
  const msg = "Your files stay on Telegram. InboxBox keeps file IDs and labels only, never the file bytes.";
  if (tg && tg.showAlert) tg.showAlert(msg);
  else window.alert(msg);
});
document.getElementById("btn-erase").addEventListener("click", function () {
  haptic("warn");
  const ask = "Erase the whole shelf index? Files on Telegram are not deleted.";
  const go = function () {
    send("erase");
    ITEMS.length = 0; SOURCES.length = 0;
    BOXES.forEach(function (b) { b.count = 0; });
    USED = 0;
    renderShelf(); renderSources(); paintPlan();
  };
  if (tg && tg.showConfirm) tg.showConfirm(ask, function (ok) { if (ok) go(); });
  else if (window.confirm(ask)) go();
});
document.getElementById("btn-home").addEventListener("click", function () {
  haptic("sel");
  try {
    if (tg && tg.addToHomeScreen) tg.addToHomeScreen();
    else if (tg && tg.showAlert) tg.showAlert("This Telegram version cannot add a Home Screen shortcut.");
  } catch (e) {}
});

const start = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get("startapp") || "";
function boot() {
  renderShelf();
  document.getElementById("skel").hidden = true;
  document.getElementById("app").hidden = false;
  if (start === "sources") { renderSources(); show("sources"); }
  else if (start === "settings") show("settings");
  else show("shelf");
  try {
    if (tg && tg.CloudStorage) {
      tg.CloudStorage.getItem("tab", function (err, v) {
        if (!err && v && !start) {
          if (v === "sources") renderSources();
          if (v === "shelf" || v === "sources" || v === "settings") show(v);
        }
      });
    }
  } catch (e) {}
  try {
    if (tg && tg.checkHomeScreenStatus && totalItems() > 0) {
      tg.checkHomeScreenStatus(function (status) {
        if (status === "missed" && tg.addToHomeScreen) tg.addToHomeScreen();
      });
    }
  } catch (e) {}
  try { if (tg && tg.requestWriteAccess) tg.requestWriteAccess(); } catch (e) {}
}
let booted = false;
function bootOnce() {
  if (booted) return;
  booted = true;
  boot();
}
loadShelf().finally(bootOnce);
setTimeout(bootOnce, 1200);

