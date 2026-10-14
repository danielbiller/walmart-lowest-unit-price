// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  showOverlay,
  updateOverlay,
  hideOverlay,
  renderResultPanel,
  NAV_GUARD_CHECK_MS,
} from "../../src/content/overlay";
import type { PanelCallbacks } from "../../src/content/overlay";

const noCallbacks: PanelCallbacks = {
  onFetchMore: vi.fn(),
  onRestore: vi.fn(),
  onCapChange: vi.fn(),
};

beforeEach(() => {
  document.body.innerHTML = "";
  hideOverlay();
  window.history.pushState({}, "", "/");
});

describe("overlay placement and lifecycle", () => {
  it("keeps toast, details, and panel in one overlay container", () => {
    updateOverlay("hello");
    renderResultPanel([], 0, 3, 1, true, noCallbacks);
    const overlays = document.querySelectorAll("#lup-overlay");
    expect(overlays).toHaveLength(1);
    const root = overlays[0];
    expect(root.querySelector(".lup-overlay-text")).not.toBeNull();
    expect(root.querySelector(".lup-overlay-details")).not.toBeNull();
    expect(root.querySelector(".lup-overlay-dismiss")).not.toBeNull();
    expect(root.querySelector(".lup-panel")).not.toBeNull();
  });

  it("announces status text politely", () => {
    updateOverlay("hello");
    expect(document.querySelector(".lup-overlay-text")?.getAttribute("aria-live")).toBe("polite");
  });

  it("dismiss removes the whole overlay including the panel", () => {
    updateOverlay("hello");
    renderResultPanel([], 0, 3, 1, true, noCallbacks);
    (document.querySelector(".lup-overlay-dismiss") as HTMLButtonElement).click();
    expect(document.getElementById("lup-overlay")).toBeNull();
  });

  it("hides after SPA navigation leaves the shown URL", async () => {
    updateOverlay("hello");
    expect(document.getElementById("lup-overlay")).not.toBeNull();
    window.history.pushState({}, "", "/deals");
    await new Promise((r) => setTimeout(r, NAV_GUARD_CHECK_MS + 300));
    expect(document.getElementById("lup-overlay")).toBeNull();
  }, 10000);

  it("stays while the URL is unchanged", async () => {
    updateOverlay("hello");
    await new Promise((r) => setTimeout(r, NAV_GUARD_CHECK_MS + 300));
    expect(document.getElementById("lup-overlay")).not.toBeNull();
    hideOverlay();
  }, 10000);
});
