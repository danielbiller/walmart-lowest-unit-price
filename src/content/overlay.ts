// Responsibility: fixed-position status banner shown during cross-page
// fetch/sort activation. Safe DOM APIs only — no innerHTML.

const OVERLAY_ID = "lup-overlay";
const TEXT_CLASS = "lup-overlay-text";
const DISMISS_CLASS = "lup-overlay-dismiss";

function getOverlay(): HTMLElement | null {
  return document.getElementById(OVERLAY_ID);
}

/** Creates the overlay banner (if not already present) and appends it to document.body. */
export function showOverlay(): void {
  if (getOverlay()) return;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "lup-overlay";

  const text = document.createElement("span");
  text.className = TEXT_CLASS;
  overlay.appendChild(text);

  const dismiss = document.createElement("button");
  dismiss.className = DISMISS_CLASS;
  dismiss.type = "button";
  dismiss.textContent = "\u00D7";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.addEventListener("click", hideOverlay);
  overlay.appendChild(dismiss);

  document.body.appendChild(overlay);
}

/** Ensures the overlay exists, then sets its status text. */
export function updateOverlay(text: string): void {
  showOverlay();
  const textEl = getOverlay()?.querySelector<HTMLElement>(`.${TEXT_CLASS}`);
  if (textEl) textEl.textContent = text;
}

/** Removes the overlay from the DOM if present. */
export function hideOverlay(): void {
  getOverlay()?.remove();
}
