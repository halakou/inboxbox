const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("secondary_bg_color"); } catch (e) {}
  if (tg.MainButton) tg.MainButton.hide();
  if (tg.BackButton) tg.BackButton.hide();
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

function qs() { return new URLSearchParams(location.search); }
function decodeParts(raw, n) {
  if (!raw) return [];
  return raw.split(",").filter(Boolean).map((part) => {
    const bits = part.split(":");
    while (bits.length < n) bits.push("");
    return bits;
  });
}

const params = qs();
const PLAN = params.get("plan") === "pro" ? "Pro" : "Free";
const BOXES = decodeParts(params.get("boxes"), 3).map((b) => ({
  id: b[0],
  name: decodeURIComponent(b[1] || "Box"),
  count: Number(b[2] || 0),
}));
const ITEMS = decodeParts(params.get("items"), 5).map((it) => ({
  id: it[0],
  box: it[1],
  kind: it[2],
  bytes: Number(it[3] || 0),
  label: decodeURIComponent(it[4] || it[2] || "file"),
}));
const SOURCES = decodeParts(params.get("sources"), 3).map((s) => ({
  id: s[0],
  username: decodeURIComponent(s[1] || ""),
  title: decodeURIComponent(s[2] || s[1] || "channel"),
}));
if (!BOXES.length) {
  ["Work", "Ideas", "Links"].forEach((name, i) => BOXES.push({ id: String(i + 1), name: name, count: 0 }));
}

const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
const uname = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "InboxBox";
document.getElementById("uname").textContent = uname;
document.getElementById("plan").textContent = PLAN;
document.getElementById("set-plan").textContent = PLAN;
const av = document.getElementById("avatar");
if (user.photo_url) av.innerHTML = `<img alt="" src="${user.photo_url}">`;
else av.textContent = (uname[0] || "I").toUpperCase();

function payload(op, extra) {
  return JSON.stringify(Object.assign({ op: op, initData: (tg && tg.initData) || "" }, extra || {}));
}
function send(op, extra) {
  if (tg && tg.sendData) tg.sendData(payload(op, extra));
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

function renderShelf() {
  const root = document.getElementById("boxes");
  root.innerHTML = "";
  BOXES.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "row";
    btn.innerHTML = `<span class="icon">${(b.name[0] || "B")}</span><span class="title">${b.name}<span class="sub">${b.count} files</span></span><span class="meta">${b.count}</span><span class="chev">›</span>`;
    btn.addEventListener("click", () => openBox(b));
    root.appendChild(btn);
  });
  const rec = document.getElementById("recent");
  rec.innerHTML = "";
  ITEMS.slice(0, 5).forEach((it) => {
    const btn = document.createElement("button");
    btn.className = "row";
    btn.innerHTML = `<span class="icon">F</span><span class="title">${it.label}<span class="sub">${it.kind}</span></span><span class="chev">›</span>`;
    btn.addEventListener("click", () => send("open", { id: Number(it.id) }));
    rec.appendChild(btn);
  });
}

function filteredItems(box) {
  let list = ITEMS.filter((it) => it.box === box.id);
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  if (q) list = list.filter((it) => (it.label || "").toLowerCase().includes(q) || (it.kind || "").includes(q));
  if (filter === "files") list = list.filter((it) => it.kind !== "text");
  if (filter === "text") list = list.filter((it) => it.kind === "text");
  if (filter === "recent") list = list.slice(0, 8);
  return list;
}

function openBox(box) {
  currentBox = box;
  filter = "all";
  document.querySelectorAll(".filters button").forEach((b) => b.classList.toggle("on", b.getAttribute("data-filter") === "all"));
  document.getElementById("box-title").textContent = box.name;
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
    btn.className = "row" + (selected.has(it.id) ? " on" : "");
    btn.innerHTML = `<span class="icon">F</span><span class="title">${it.label}<span class="sub">${it.kind}</span></span><span class="chev">›</span>`;
    btn.addEventListener("click", () => toggleFile(it, btn));
    root.appendChild(btn);
  });
}

function toggleFile(it, btn) {
  if (selected.has(it.id)) selected.delete(it.id);
  else selected.add(it.id);
  btn.classList.toggle("on", selected.has(it.id));
  if (!tg || !tg.MainButton) return;
  if (!selected.size) {
    tg.MainButton.hide();
    return;
  }
  tg.MainButton.setText(selected.size === 1 ? "Open" : "Open " + selected.size);
  tg.MainButton.show();
  tg.MainButton.onClick(() => {
    const ids = Array.from(selected).map(Number);
    if (ids.length === 1) send("open", { id: ids[0] });
    else send("open_many", { ids: ids });
  });
}

function renderSources() {
  const root = document.getElementById("sources");
  root.innerHTML = "";
  document.getElementById("src-empty").hidden = SOURCES.length > 0;
  SOURCES.forEach((s) => {
    const row = document.createElement("div");
    row.className = "row static";
    const handle = s.username ? "@" + s.username.replace(/^@/, "") : "";
    row.innerHTML = `<span class="icon">S</span><span class="title">${s.title}<span class="sub">${handle}</span></span>`;
    root.appendChild(row);
  });
}

document.querySelectorAll(".tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    const v = b.getAttribute("data-view");
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
document.getElementById("btn-pro").addEventListener("click", () => send("vip"));
document.getElementById("btn-privacy").addEventListener("click", () => send("settings"));
document.getElementById("btn-erase").addEventListener("click", () => send("settings"));

renderShelf();
window.setTimeout(() => {
  document.getElementById("skel").hidden = true;
  document.getElementById("app").hidden = false;
}, 160);
