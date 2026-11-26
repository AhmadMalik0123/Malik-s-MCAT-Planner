// Color theme switcher (works on the sign-in screen too, so it lives outside app.js).
(function () {
  const KEY = "mcat-theme";
  const current = () => document.documentElement.dataset.theme || "aurora";
  const sync = () => document.querySelectorAll("[data-theme-set]").forEach(dot => dot.classList.toggle("active", dot.dataset.themeSet === current()));
  const MODE_KEY = "mcat-mode";
  const fadeOnce = () => { const fade = document.createElement("div"); fade.className = "theme-fade"; document.body.appendChild(fade); fade.addEventListener("animationend", () => fade.remove()); };
  document.addEventListener("click", event => {
    const sw = document.querySelector(".theme-switch");
    if (event.target.closest("[data-theme-open]")) { sw.classList.toggle("open"); return; }
    if (sw && !event.target.closest(".theme-switch")) sw.classList.remove("open");
    if (event.target.closest("[data-mode-toggle]")) {
      const light = document.documentElement.dataset.mode !== "light";
      fadeOnce();
      if (light) document.documentElement.dataset.mode = "light"; else delete document.documentElement.dataset.mode;
      try { localStorage.setItem(MODE_KEY, light ? "light" : "dark"); } catch (e) {}
      return;
    }
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
