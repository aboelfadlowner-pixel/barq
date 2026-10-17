/** Runs `action` with smooth scrolling switched off, so the jump is instant (v29 `instant`). */
export function instantScroll(action: () => void): void {
  const root = document.documentElement;
  root.style.scrollBehavior = "auto";
  action();
  root.style.scrollBehavior = "";
}
