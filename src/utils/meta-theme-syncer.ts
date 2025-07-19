// syncs the <meta name="theme-color"> tag with the current CSS --primary-bg variable (dependant on theme!).

export function syncThemeColorMeta() {
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary-bg")
    .trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", color);
  }
}
