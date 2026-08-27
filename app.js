const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("secondary_bg_color");
  tg.MainButton.hide();
}

const BOXES = [
  { name: "Work" },
  { name: "Ideas" },
  { name: "Links" },
];

function payload(op, extra) {
  const body = Object.assign({ op: op, initData: (tg && tg.initData) || "" }, extra || {});
  return JSON.stringify(body);
}

function send(op, extra) {
  if (tg && tg.sendData) tg.sendData(payload(op, extra));
}

function render(filter) {
  const q = (filter || "").trim().toLowerCase();
  const rows = document.getElementById("rows");
  rows.innerHTML = "";
  const list = BOXES.filter((b) => !q || b.name.toLowerCase().includes(q));
  list.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = "row";
    btn.innerHTML = `<span class="title">${b.name}</span><span class="meta">0</span><span class="chev">›</span>`;
    btn.addEventListener("click", () => send("boxname", { name: b.name }));
    rows.appendChild(btn);
  });
}

const search = document.getElementById("q");
search.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const v = search.value.trim().slice(0, 40);
    if (v) send("search", { q: v });
  }
});
search.addEventListener("input", (e) => render(e.target.value));
render("");
