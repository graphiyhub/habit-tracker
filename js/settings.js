export function setTheme(theme) {
  const selected = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selected;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = selected === "dark" ? "#151720" : "#f5f6fa";
  return selected;
}

export function applySettings(state) {
  setTheme(state.settings.theme);
}
