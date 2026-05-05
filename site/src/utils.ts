export function getElement<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

export function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in restricted browsing contexts.
  }
}

export function initCopyButtons() {
  const timers = new WeakMap<HTMLElement, number>();

  document.querySelectorAll<HTMLElement>(".copy-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const text = button.dataset.copy ?? button.dataset.cmd;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
      } catch {
        return;
      }

      button.classList.add("copied");
      const currentTimer = timers.get(button);
      if (currentTimer !== undefined) window.clearTimeout(currentTimer);
      timers.set(
        button,
        window.setTimeout(() => {
          button.classList.remove("copied");
          timers.delete(button);
        }, 1500),
      );
    });
  });
}
