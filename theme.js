// Color theme switcher (works on the sign-in screen too, so it lives outside app.js).
(function () {
  const KEY = "mcat-theme";
  const current = () => document.documentElement.dataset.theme || "aurora";
  const sync = () => document.querySelectorAll("[data-theme-set]").forEach(dot => dot.classList.toggle("active", dot.dataset.themeSet === current()));
  document.addEventListener("click", event => {
    const dot = event.target.closest("[data-theme-set]");
    if (!dot || dot.dataset.themeSet === current()) return;
    const theme = dot.dataset.themeSet;
    const fade = document.createElement("div");
    fade.className = "theme-fade";
    document.body.appendChild(fade);
    fade.addEventListener("animationend", () => fade.remove());
    if (theme === "aurora") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    sync();
  });
  sync();
})();
