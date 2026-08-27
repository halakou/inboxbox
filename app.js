const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("secondary_bg_color"); } catch (e) {}
  tg.MainButton.hide();
}

(function theme() {
  const hasTg = !!(getComputedStyle(document.documentElement).getPropertyValue("--tg-theme-bg-color") || "").trim();
  if (hasTg) return;
  const h = new Date().getHours();
  document.documentElement.setAttribute("data-theme", (h < 7 || h >= 19) ? "night" : "day");
})();

function qs() {
  return new URLSearchParams(location.search);
}

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
if (user.photo_url) {
  av.innerHTML = `<img alt="" src="${user.photo_url}">`;
} else {
  av.textContent = (uname[0] || "I").toUpperCase();
}

function payload(op, extra) {
  return JSON.stringify(Object.assign({ op: op, initData: (tg && tg.initData) || "" }, extra || {}));
}
function send(op, extra) {
  if (tg && tg.sendData) tg.sendData(payload(op, extra));
}

function show(name) {
  ["shelf", "box", "sources", "settings"].forEach((v) => {
    const el = document.getElementById("view-" + v);
    if (el) el.hidden = v !== name;
  });
  document.querySelectorAll(".tabs button").forEach((b) => {
    b.classList.toggle("on", b.getAttribute("data-view") === name);
  });
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
}

function openBox(box) {
  document.getElementById("box-title").textContent = box.name;
  const files = ITEMS.filter((it) => it.box === box.id);
  const root = document.getElementById("files");
  root.innerHTML = "";
  document.getElementById("box-empty").hidden = files.length > 0;
  files.forEach((it) => {
    const btn = document.createElement("button");
    btn.className = "row";
    btn.innerHTML = `<span class="icon">F</span><span class="title">${it.label}<span class="sub">${it.kind}</span></span><span class="chev">›</span>`;
    btn.addEventListener("click", () => selectFile(it));
    root.appendChild(btn);
  });
  show("box");
}

let selected = null;
function selectFile(it) {
  selected = it;
  if (!tg || !tg.MainButton) {
    send("open", { id: Number(it.id) });
    return;
  }
  tg.MainButton.setText("Open");
  tg.MainButton.show();
  tg.MainButton.onClick(() => send("open", { id: Number(it.id) }));
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
document.getElementById("back").addEventListener("click", () => show("shelf"));
document.getElementById("btn-pro").addEventListener("click", () => send("vip"));
document.getElementById("btn-privacy").addEventListener("click", () => send("settings"));
document.getElementById("btn-erase").addEventListener("click", () => send("settings"));

renderShelf();
show("shelf");
