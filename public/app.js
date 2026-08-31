const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("secondary_bg_color"); } catch (e) {}
  if (tg.MainButton) tg.MainButton.hide();
  if (tg.BackButton) tg.BackButton.hide();
  if (tg.SettingsButton) {
    tg.SettingsButton.show();
    tg.SettingsButton.onClick(() => show("settings"));
  }
}

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

const KIND_FA = {
  photo: "عکس", video: "ویدیو", document: "فایل", audio: "آهنگ",
  voice: "ویس", text: "متن", link: "لینک", animation: "گیف", sticker: "استیکر"
};
function kindLabel(k) { return KIND_FA[k] || k || "فایل"; }

const params = qs();
const PLAN = params.get("plan") === "pro" ? "Pro" : "Free";
const BOXES = decodeParts(params.get("boxes"), 3).map((b) => ({
  id: b[0],
  name: decodeURIComponent(b[1] || "باکس"),
  count: Number(b[2] || 0),
}));
const ITEMS = decodeParts(params.get("items"), 7).map((it) => ({
  id: it[0],
  box: it[1],
  kind: it[2],
  bytes: Number(it[3] || 0),
  label: decodeURIComponent(it[4] || it[2] || "فایل"),
  pin: it[5] === "1",
  opened: it[6] === "1",
}));
const SOURCES = decodeParts(params.get("sources"), 3).map((s) => ({
  id: s[0],
  username: decodeURIComponent(s[1] || ""),
  title: decodeURIComponent(s[2] || s[1] || "منبع"),
}));

const DEFAULT_BOXES = [
  { id: "inbox", name: "ورود" },
  { id: "work", name: "کار" },
  { id: "ideas", name: "ایده‌ها" },
  { id: "links", name: "لینک‌ها" },
];
if (!BOXES.length) {
  DEFAULT_BOXES.forEach((b, i) => BOXES.push({ id: b.id || String(i + 1), name: b.name, count: 0 }));
}

const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
const uname = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "InboxBox";
document.getElementById("uname").textContent = uname;
const planFa = PLAN === "Pro" ? "پرو" : "رایگان";
document.getElementById("plan").textContent = planFa;
document.getElementById("set-plan").textContent = planFa;
const av = document.getElementById("avatar");
if (user.photo_url) av.innerHTML = `<img alt="" src="${user.photo_url}">`;
else av.textContent = (uname[0] || "ق").toUpperCase();

function payload(op, extra) {
  return JSON.stringify(Object.assign({ op: op, initData: (tg && tg.initData) || "" }, extra || {}));
}
function send(op, extra) {
  const body = payload(op, extra);
  const onPages = /github\.io$/i.test(location.hostname);
  const api = (window.INBOXBOX_API || (onPages ? "" : "")).replace(/\/$/, "");
  const useFetch = !onPages && !!(tg && tg.initData);
  if (useFetch) {
    fetch((api || "") + "/api/op", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": tg.initData },
      body: body,
    }).catch(() => {});
    return;
  }
  if (tg && tg.sendData) tg.sendData(body);
}

let currentBox = null;
let filter = "all";
let selected = new Set();

function show(name) {
  ["shelf", "box", "sources", "settings"].forEach((v) => {
    const el = document.getElementById("view-" + v);
    if (el) el.hidden = v !== name;
  });
  document.querySelectorAll(".tabs button").forEach((b) => {
    b.classList.toggle("on", b.getAttribute("data-view") === name);
  });
  if (tg && tg.BackButton) {
    if (name === "box") {
      tg.BackButton.show();
      tg.BackButton.onClick(() => show("shelf"));
    } else tg.BackButton.hide();
  }
  hideMain();
}

function hideMain() {
  selected.clear();
  if (tg && tg.MainButton) tg.MainButton.hide();
}

function rowBtn(html, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "row";
  btn.innerHTML = html;
  btn.addEventListener("click", onClick);
  return btn;
}

function totalItems() {
  return ITEMS.length || BOXES.reduce((n, b) => n + (b.count || 0), 0);
}

function renderShelf() {
  const empty = document.getElementById("empty-hero");
  if (empty) empty.hidden = totalItems() > 0;
  const root = document.getElementById("boxes");
  root.innerHTML = "";
  BOXES.forEach((b) => {
    const n = b.count || ITEMS.filter((it) => it.box === b.id).length;
    root.appendChild(rowBtn(
      `<span class="icon">${(b.name[0] || "ب")}</span><span class="title">${b.name}<span class="sub">${n} مورد</span></span><span class="meta">${n}</span><span class="chev">‹</span>`,
      () => openBox(b)
    ));
  });
  const rec = document.getElementById("recent");
  rec.innerHTML = "";
  const opened = ITEMS.filter((it) => it.opened).slice(0, 8);
  const recentSaved = ITEMS.slice(0, 8);
  const recent = opened.length ? opened : recentSaved;
  const recEmpty = document.getElementById("recent-empty");
  if (recEmpty) recEmpty.hidden = recent.length > 0;
  recent.forEach((it) => {
    rec.appendChild(rowBtn(
      `<span class="icon">ف</span><span class="title">${it.label}<span class="sub">${kindLabel(it.kind)}</span></span><span class="chev">‹</span>`,
      () => { haptic("ok"); send("open", { id: Number(it.id) }); }
    ));
  });
  const pinRoot = document.getElementById("pinned");
  const pins = ITEMS.filter((it) => it.pin);
  document.getElementById("pinned-wrap").hidden = pins.length === 0;
  if (pinRoot) {
    pinRoot.innerHTML = "";
    pins.forEach((it) => {
      pinRoot.appendChild(rowBtn(
        `<span class="icon">پ</span><span class="title">${it.label}</span><span class="chev">‹</span>`,
        () => { haptic("ok"); send("open", { id: Number(it.id) }); }
      ));
    });
  }
}

function filteredItems(box) {
  let list = ITEMS.filter((it) => it.box === box.id);
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  if (q) list = list.filter((it) => (it.label || "").toLowerCase().includes(q) || (it.kind || "").includes(q) || (kindLabel(it.kind) || "").includes(q));
  if (filter === "files") list = list.filter((it) => it.kind !== "text");
  if (filter === "text") list = list.filter((it) => it.kind === "text");
  if (filter === "recent") list = list.slice(0, 8);
  if (filter === "pinned") list = list.filter((it) => it.pin);
  return list;
}

function openBox(box) {
  currentBox = box;
  filter = "all";
  document.querySelectorAll(".filters button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-filter") === "all"));
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
  files.forEach((it) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row" + (selected.has(it.id) ? " on" : "");
    btn.innerHTML = `<span class="icon">ف</span><span class="title">${it.label}<span class="sub">${kindLabel(it.kind)}</span></span><span class="chev">‹</span>`;
    btn.addEventListener("click", () => toggleFile(it, btn));
    root.appendChild(btn);
  });
}

function toggleFile(it, btn) {
  if (selected.has(it.id)) selected.delete(it.id);
  else selected.add(it.id);
  btn.classList.toggle("on", selected.has(it.id));
  haptic("sel");
  if (!tg || !tg.MainButton) return;
  if (!selected.size) {
    tg.MainButton.hide();
    return;
  }
  tg.MainButton.setText(selected.size === 1 ? "باز کردن" : "باز کردن " + selected.size);
  tg.MainButton.show();
  tg.MainButton.onClick(() => {
    const ids = Array.from(selected).map(Number);
    haptic("ok");
    if (ids.length === 1) send("open", { id: ids[0] });
    else send("open_many", { ids: ids });
  });
}

function renderSources() {
  const root = document.getElementById("sources");
  root.innerHTML = "";
  document.getElementById("src-empty").hidden = SOURCES.length > 0;
  SOURCES.forEach((s) => {
    const a = document.createElement("a");
    a.className = "row";
    const handle = s.username ? "@" + s.username.replace(/^@/, "") : "";
    a.href = s.username ? "https://t.me/" + s.username.replace(/^@/, "") : "#";
    a.innerHTML = `<span class="icon">م</span><span class="title">${s.title}<span class="sub">${handle}</span></span><span class="chev">‹</span>`;
    root.appendChild(a);
  });
}

document.querySelectorAll(".tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    const v = b.getAttribute("data-view");
    haptic("sel");
    if (v === "sources") renderSources();
    show(v);
  });
});
document.querySelectorAll(".filters button").forEach((b) => {
  b.addEventListener("click", () => {
    filter = b.getAttribute("data-filter");
    document.querySelectorAll(".filters button").forEach((x) => x.classList.toggle("on", x === b));
    renderFiles();
  });
});
document.getElementById("q").addEventListener("input", renderFiles);
document.getElementById("btn-pro").addEventListener("click", () => { haptic("ok"); send("vip"); });
document.getElementById("btn-privacy").addEventListener("click", () => {
  haptic("sel");
  const msg = "فایل‌هایت روی سرور تلگرام می‌مانند. InboxBox فقط شناسه فایل و برچسب را نگه می‌دارد، نه خود فایل.";
  if (tg && tg.showAlert) tg.showAlert(msg);
  else window.alert(msg);
});
document.getElementById("btn-erase").addEventListener("click", () => {
  haptic("warn");
  const ask = "همه فهرست قفسه پاک شود؟ خود فایل‌ها روی تلگرام می‌مانند.";
  const go = () => { send("erase"); };
  if (tg && tg.showConfirm) tg.showConfirm(ask, (ok) => { if (ok) go(); });
  else if (window.confirm(ask)) go();
});

renderShelf();
const start = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || params.get("startapp") || "";
window.setTimeout(() => {
  document.getElementById("skel").hidden = true;
  document.getElementById("app").hidden = false;
  if (start === "sources") { renderSources(); show("sources"); }
  else show("shelf");
  try {
    if (tg && tg.checkHomeScreenStatus && totalItems() > 0) {
      tg.checkHomeScreenStatus((status) => {
        if (status === "missed" && tg.addToHomeScreen) tg.addToHomeScreen();
      });
    }
  } catch (e) {}
}, 160);
