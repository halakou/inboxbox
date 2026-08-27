const tg = window.Telegram && window.Telegram.WebApp;
if (tg) tg.ready();
document.querySelectorAll("button[data-cmd]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cmd = btn.getAttribute("data-cmd");
    if (tg && tg.sendData) tg.sendData(cmd);
  });
});
