// Responsibility: fixed-position status banner + expandable results panel
// shown during/after sort activation. Safe DOM APIs only — no innerHTML.

const OVERLAY_ID = "lup-overlay";
const TEXT_CLASS = "lup-overlay-text";
const DISMISS_CLASS = "lup-overlay-dismiss";
const DETAILS_CLASS = "lup-overlay-details";
const PANEL_CLASS = "lup-panel";

export type PanelGroup = { dimension: string; count: number; cheapestTitle: string };

export type PanelCallbacks = {
  onFetchMore: (count: number | "all") => void;
  onRestore: () => void;
  onCapChange: (cap: number) => void;
};

export const PAGE_CAP_MIN = 1;
export const PAGE_CAP_MAX = 20;

function getOverlay(): HTMLElement | null {
  return document.getElementById(OVERLAY_ID);
}

/** How often to check whether SPA navigation left the results page. */
export const NAV_GUARD_CHECK_MS = 2000;

let navGuardTimer: ReturnType<typeof setInterval> | null = null;
let shownUrl: string | null = null;

/**
 * Hides the overlay once SPA navigation leaves the URL it was shown on.
 * Content scripts get no navigation event without extra permissions, so a
 * short-lived interval (only while the overlay exists) compares URLs.
 * Every show refreshes the bound URL, so re-renders never trip the guard.
 */
function ensureNavGuard(): void {
  shownUrl = location.href;
  if (navGuardTimer !== null) return;
  navGuardTimer = setInterval(() => {
    if (!getOverlay() || location.href !== shownUrl) {
      hideOverlay();
    }
    if (!getOverlay() && navGuardTimer !== null) {
      clearInterval(navGuardTimer);
      navGuardTimer = null;
    }
  }, NAV_GUARD_CHECK_MS);
}

/** Creates the overlay banner (if not already present) and appends it to document.body. */
export function showOverlay(): void {
  ensureNavGuard();
  if (getOverlay()) return;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "lup-overlay";

  const text = document.createElement("span");
  text.className = TEXT_CLASS;
  text.setAttribute("aria-live", "polite");
  overlay.appendChild(text);

  const details = document.createElement("button");
  details.className = DETAILS_CLASS;
  details.type = "button";
  details.textContent = "Details";
  details.hidden = true;
  details.setAttribute("aria-expanded", "false");
  details.addEventListener("click", () => {
    const panel = getOverlay()?.querySelector<HTMLElement>(`.${PANEL_CLASS}`);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    details.setAttribute("aria-expanded", String(!panel.hidden));
  });
  overlay.appendChild(details);

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

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

/**
 * Renders (or re-renders) the expandable dashboard inside the overlay:
 * per-group rows, page-cap stepper, fetch-more and restore controls.
 * Reveals the Details toggle. Safe DOM APIs only — no innerHTML.
 */
export function renderResultPanel(
  groups: PanelGroup[],
  pricedCount: number,
  unpricedCount: number,
  pageCap: number,
  canFetchMore: boolean,
  callbacks: PanelCallbacks
): void {
  showOverlay();
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.querySelector<HTMLElement>(`.${DETAILS_CLASS}`)?.removeAttribute("hidden");

  let panel = overlay.querySelector<HTMLElement>(`.${PANEL_CLASS}`);
  const wasOpen = panel ? !panel.hidden : false;
  panel?.remove();

  panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Sort details");
  panel.hidden = !wasOpen;

  const summary = document.createElement("div");
  summary.className = `${PANEL_CLASS}-summary`;
  summary.textContent = `${pricedCount} priced · ${unpricedCount} moved to end · ${groups.length} group(s)`;
  panel.appendChild(summary);

  const list = document.createElement("ul");
  list.className = `${PANEL_CLASS}-groups`;
  for (const group of groups) {
    const item = document.createElement("li");
    const best = group.cheapestTitle.length > 0 ? ` · best: ${group.cheapestTitle}` : "";
    item.textContent = `${group.dimension} · ${group.count} item(s)${best}`;
    item.title = group.cheapestTitle;
    list.appendChild(item);
  }
  panel.appendChild(list);

  const stepper = document.createElement("div");
  stepper.className = `${PANEL_CLASS}-stepper`;
  const capLabel = document.createElement("span");
  capLabel.textContent = "Pages: ";
  const capValue = document.createElement("span");
  const paintCap = (cap: number) => { capValue.textContent = String(cap); };
  paintCap(pageCap);
  const minus = makeButton("−", () => {
    const next = Math.max(PAGE_CAP_MIN, Number(capValue.textContent) - 1);
    paintCap(next);
    callbacks.onCapChange(next);
  });
  const plus = makeButton("+", () => {
    const next = Math.min(PAGE_CAP_MAX, Number(capValue.textContent) + 1);
    paintCap(next);
    callbacks.onCapChange(next);
  });
  stepper.append(capLabel, minus, capValue, plus);
  panel.appendChild(stepper);

  const actions = document.createElement("div");
  actions.className = `${PANEL_CLASS}-actions`;
  const more = makeButton("+5 more", () => callbacks.onFetchMore(5));
  const all = makeButton("Fetch all", () => callbacks.onFetchMore("all"));
  const restore = makeButton("Restore", () => callbacks.onRestore());
  more.disabled = !canFetchMore;
  all.disabled = !canFetchMore;
  actions.append(more, all, restore);
  panel.appendChild(actions);

  overlay.appendChild(panel);
}
