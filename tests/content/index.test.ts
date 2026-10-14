// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

let listener: ((message: unknown) => void) | null = null;
let indexMod: typeof import("../../src/content/index");

function tileHtml(id: string, aria: string): string {
  return `<div class="cell"><div data-item-id="${id}" aria-label="${aria}">${id}</div></div>`;
}

function pricedTile(id: string, price: string, unit: string, title: string): string {
  return tileHtml(id, `Price ${price} ${unit} ${title}`);
}

function setGrid(cells: string[]): void {
  document.body.innerHTML = `<div id="row">${cells.join("")}</div>`;
}

function gridOrder(): (string | null)[] {
  return [...document.getElementById("row")!.children].map((cell) => {
    const tile = cell.matches("[data-item-id]") ? cell : cell.querySelector("[data-item-id]");
    return tile?.getAttribute("data-item-id") ?? null;
  });
}

async function waitForOverlay(match: RegExp, timeoutMs = 5000): Promise<string> {
  const start = Date.now();
  for (;;) {
    const text = document.querySelector("#lup-overlay .lup-overlay-text")?.textContent?.trim() ?? "";
    if (match.test(text)) return text;
    if (Date.now() - start > timeoutMs) throw new Error(`overlay never matched ${match}: "${text}"`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

beforeAll(async () => {
  vi.stubGlobal("chrome", {
    runtime: { onMessage: { addListener: (fn: (message: unknown) => void) => { listener = fn; } } },
  });
  indexMod = await import("../../src/content/index");
});

beforeEach(() => {
  document.body.innerHTML = "";
  indexMod.__resetState();
  vi.unstubAllGlobals();
  vi.stubGlobal("chrome", {
    runtime: { onMessage: { addListener: (fn: (message: unknown) => void) => { listener = fn; } } },
  });
});

describe("initialSort default", () => {
  it("sorts the current page with zero fetches", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("must not fetch"); });
    vi.stubGlobal("fetch", fetchMock);
    setGrid([
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      tileHtml("u", "Bananas Fresh $1.00 each"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ]);
    listener?.({ type: "lup:activate" });
    const text = await waitForOverlay(/page\(s\)/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(text).toBe("Sorted 2 by unit price · 1 moved to end · 1 group(s) · 1 page(s).");
    expect(gridOrder()).toEqual(["b", "a", "u"]);
  });

  it("reports unsorted when nothing resolves a unit price", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("must not fetch"); }));
    setGrid([tileHtml("x", "Bananas Fresh $1.00 each"), tileHtml("y", "Socks $5.00")]);
    listener?.({ type: "lup:activate" });
    const text = await waitForOverlay(/nothing sorted/);
    expect(text).toBe("No unit prices found — nothing sorted.");
    expect(gridOrder()).toEqual(["x", "y"]);
  });

  it("reports stalled fetching instead of silent single-page success", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      // bot-block page: HTTP 200 with zero product tiles
      text: async () =>
        `<!doctype html><html><head><title>Robot or human?</title></head><body><div>Robot or human?</div></body></html>`,
    }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    setGrid([pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz")]);
    await indexMod.initialSort(3);
    const text = await waitForOverlay(/page\(s\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // page 2 empty -> early stop
    expect(text).toBe("Sorted 1 by unit price · 0 moved to end · 1 group(s) · 1 page(s). No tiles found on further pages.");
  });
});

describe("fetchMore", () => {
  function pageDoc(ids: { id: string; price: string; unit: string; title: string }[]): string {
    return `<!doctype html><html><body>${ids.map((t) => pricedTile(t.id, t.price, t.unit, t.title)).join("")}</body></html>`;
  }

  it("resumes after the last fetched page and re-sorts", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const page = new URL(String(input)).searchParams.get("page");
      const html =
        page === "2"
          ? pageDoc([{ id: "c", price: "$2.00", unit: "$0.10/oz", title: "Oil 20 oz" }])
          : `<!doctype html><html><body><div>none</div></body></html>`;
      return { ok: true, text: async () => html } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    setGrid([
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ]);
    await indexMod.initialSort();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(gridOrder()).toEqual(["b", "a"]);

    await indexMod.fetchMore(5);
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("page"));
    expect(urls).toEqual(["2", "3"]); // page 3 empty -> early stop
    expect(gridOrder()).toEqual(["c", "b", "a"]);
    expect(await waitForOverlay(/2 page\(s\)/)).toBe(
      "Sorted 3 by unit price · 0 moved to end · 1 group(s) · 2 page(s)."
    );

    await indexMod.fetchMore(5); // resumes at page 4, not page 2
    const urls2 = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("page"));
    expect(urls2).toEqual(["2", "3", "4"]);
  });
});

describe("restore and panel", () => {
  function rowIds(): (string | null)[] {
    return [...document.getElementById("row")!.children].map((cell) => {
      if (cell.id === "ad1") return "ad1";
      const tile = cell.matches("[data-item-id]") ? cell : cell.querySelector("[data-item-id]");
      return tile?.getAttribute("data-item-id") ?? null;
    });
  }

  function panelButton(label: string): HTMLButtonElement {
    const buttons = [...document.querySelectorAll("#lup-overlay .lup-panel button")];
    const found = buttons.find((b) => b.textContent === label);
    if (!found) throw new Error(`panel button "${label}" not found`);
    return found as HTMLButtonElement;
  }

  it("restore returns the grid exactly and removes fetched tiles", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const page = new URL(String(input)).searchParams.get("page");
      const html =
        page === "2"
          ? `<!doctype html><html><body>${pricedTile("c", "$2.00", "$0.10/oz", "Oil 20 oz")}</body></html>`
          : `<!doctype html><html><body><div>none</div></body></html>`;
      return { ok: true, text: async () => html } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    document.body.innerHTML = `<div id="row"><div class="cell"><div data-item-id="a" aria-label="Price $6.00 $0.50/oz Oil 12 oz">a</div></div><div class="ad" id="ad1">promo</div><div class="cell"><div data-item-id="u" aria-label="Bananas Fresh $1.00 each">u</div></div><div class="cell"><div data-item-id="b" aria-label="Price $4.80 $0.40/oz Oil 12 oz">b</div></div></div>`;
    // Out-of-row tile (e.g. side carousel): stamped/tagged in place, must still be cleaned.
    const stray = document.createElement("div");
    stray.setAttribute("data-item-id", "stray");
    stray.setAttribute("aria-label", "Price $3.00 $0.30/oz Oil 10 oz");
    stray.textContent = "stray";
    document.body.appendChild(stray);

    await indexMod.initialSort();
    expect(rowIds()).toEqual(["ad1", "b", "a", "u"]);
    expect(document.getElementById("ad1")!.style.display).toBe("none");
    // Out-of-row tiles are fully ignored: never stamped, tagged, or counted.
    expect(stray.hasAttribute("data-lup-ranked")).toBe(false);

    await indexMod.fetchMore(5);
    expect(rowIds()).toEqual(["ad1", "c", "b", "a", "u"]);

    indexMod.restore();
    expect(rowIds()).toEqual(["a", "ad1", "u", "b"]);
    expect(document.getElementById("ad1")!.style.display).toBe("");
    expect(document.querySelectorAll(".lup-badge")).toHaveLength(0);
    expect(document.querySelectorAll(".lup-estimate")).toHaveLength(0);
    expect(document.querySelectorAll("[data-lup-ranked]")).toHaveLength(0);
    expect(document.querySelector("#lup-overlay .lup-overlay-text")?.textContent).toBe(
      "Restored original order."
    );
  });

  it("panel renders groups with working fetch and restore buttons", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const page = new URL(String(input)).searchParams.get("page");
      const html =
        page === "2"
          ? `<!doctype html><html><body>${pricedTile("c", "$2.00", "$0.10/oz", "Oil 20 oz")}</body></html>`
          : `<!doctype html><html><body><div>none</div></body></html>`;
      return { ok: true, text: async () => html } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    setGrid([
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ]);
    await indexMod.initialSort();

    const panel = document.querySelector("#lup-overlay .lup-panel") as HTMLElement;
    expect(panel.hidden).toBe(true);
    expect(panel.querySelectorAll(".lup-panel-groups li")).toHaveLength(1);
    (document.querySelector(".lup-overlay-details") as HTMLButtonElement).click();
    expect(panel.hidden).toBe(false);

    panelButton("+5 more").click();
    await waitForOverlay(/2 page\(s\)/);
    expect(fetchMock.mock.calls.map(([i]) => new URL(String(i)).searchParams.get("page"))).toEqual([
      "2",
      "3",
    ]);
    expect(gridOrder()).toEqual(["c", "b", "a"]);

    panelButton("Restore").click();
    await waitForOverlay(/Restored original order/);
    expect(gridOrder()).toEqual(["a", "b"]);
  });

  it("stepper changes the default page cap", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const page = new URL(String(input)).searchParams.get("page");
      const html =
        page === "2" || page === "3"
          ? `<!doctype html><html><body>${pricedTile(`p${page}`, "$2.00", "$0.10/oz", "Oil 20 oz")}</body></html>`
          : `<!doctype html><html><body><div>none</div></body></html>`;
      return { ok: true, text: async () => html } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    setGrid([pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz")]);
    await indexMod.initialSort();

    panelButton("+").click();
    panelButton("+").click(); // cap 1 -> 3
    await indexMod.initialSort(); // uses default cap
    await waitForOverlay(/3 page\(s\)/);
    expect(fetchMock.mock.calls.map(([i]) => new URL(String(i)).searchParams.get("page"))).toEqual([
      "2",
      "3",
    ]);

    panelButton("−").click();
    panelButton("−").click(); // reset cap to 1 for isolation
  });
});

describe("icon reshow", () => {  it("dismiss then re-click reshows with zero work", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("must not fetch"); });
    vi.stubGlobal("fetch", fetchMock);
    setGrid([
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ]);
    listener?.({ type: "lup:activate" });
    const first = await waitForOverlay(/1 page\(s\)/);
    expect(gridOrder()).toEqual(["b", "a"]);

    (document.querySelector(".lup-overlay-dismiss") as HTMLButtonElement).click();
    expect(document.getElementById("lup-overlay")).toBeNull();

    // Sabotage a stamp: a fresh sort would restore it, a reshow will not.
    document.querySelector('[data-item-id="b"]')!.removeAttribute("data-lup-ranked");
    // Yield like a real second click would (separate user event after the
    // first run's continuations have flushed).
    await new Promise((r) => setTimeout(r, 50));
    listener?.({ type: "lup:activate" });
    expect(await waitForOverlay(/1 page\(s\)/)).toBe(first);
    expect(document.querySelector('[data-item-id="b"]')!.hasAttribute("data-lup-ranked")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("new URL fresh-sorts instead of reshowing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("must not fetch"); }));
    setGrid([
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ]);
    listener?.({ type: "lup:activate" });
    await waitForOverlay(/1 page\(s\)/);

    window.history.pushState({}, "", "/search?q=other");
    document.querySelector('[data-item-id="b"]')!.removeAttribute("data-lup-ranked");
    // Separate user event: let the first run's continuations flush first.
    await new Promise((r) => setTimeout(r, 50));
    listener?.({ type: "lup:activate" });
    await waitForOverlay(/1 page\(s\)/);
    // Fresh run re-stamped the tile a reshow would have left alone.
    expect(document.querySelector('[data-item-id="b"]')!.hasAttribute("data-lup-ranked")).toBe(true);

    window.history.pushState({}, "", "/");
  });

  it("a new sort after restore supersedes the old toast", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("must not fetch"); }));
    setGrid([
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ]);
    listener?.({ type: "lup:activate" });
    await waitForOverlay(/1 page\(s\)/);
    (document.querySelector(".lup-overlay-details") as HTMLButtonElement).click();
    expect(document.querySelector("#lup-overlay .lup-panel") as HTMLElement).not.toBeNull();

    indexMod.restore();
    await waitForOverlay(/Restored/);
    // Fresh sort after restore: exactly one overlay and one panel, fresh copy.
    listener?.({ type: "lup:activate" });
    await waitForOverlay(/Sorted 2 by unit price/);
    expect(document.querySelectorAll("#lup-overlay")).toHaveLength(1);
    expect(document.querySelectorAll("#lup-overlay .lup-panel")).toHaveLength(1);
  });
});

describe("grid scoping", () => {  it("ignores priced tiles outside the grid row (side rails)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("must not fetch"); }));
    document.body.innerHTML = `<div id="row">${[
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ].join("")}</div><div id="rail"><div data-item-id="rail1" aria-label="Price $9.00 $0.90/oz Rail Oil">r</div></div>`;
    listener?.({ type: "lup:activate" });
    const text = await waitForOverlay(/page\(s\)/);
    // Rail tile excluded from counts, untouched, left in place.
    expect(text).toBe("Sorted 2 by unit price · 0 moved to end · 1 group(s) · 1 page(s).");
    expect(gridOrder()).toEqual(["b", "a"]);
    const railTile = document.querySelector('[data-item-id="rail1"]')!;
    expect(railTile.hasAttribute("data-lup-ranked")).toBe(false);
    expect(railTile.parentElement!.id).toBe("rail");
    expect(document.querySelector("#rail .lup-badge")).toBeNull();
  });

  it("a carousel rail outnumbering the grid never wins the vote", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("must not fetch"); }));
    document.body.innerHTML = `<div id="row">${[
      pricedTile("a", "$6.00", "$0.50/oz", "Oil 12 oz"),
      pricedTile("b", "$4.80", "$0.40/oz", "Oil 12 oz"),
    ].join("")}</div><div data-testid="horizontal-scroller-Buy it again"><ul data-testid="carousel-container">
      <li data-slide="0"><div data-item-id="r1" aria-label="Price $1.00 $0.10/oz Rail Oil">r1</div></li>
      <li data-slide="1"><div data-item-id="r2" aria-label="Price $2.00 $0.20/oz Rail Oil">r2</div></li>
      <li data-slide="2"><div data-item-id="r3" aria-label="Price $3.00 $0.30/oz Rail Oil">r3</div></li>
    </ul></div>`;
    listener?.({ type: "lup:activate" });
    const text = await waitForOverlay(/page\(s\)/);
    expect(text).toBe("Sorted 2 by unit price · 0 moved to end · 1 group(s) · 1 page(s).");
    expect(gridOrder()).toEqual(["b", "a"]);
    for (const id of ["r1", "r2", "r3"]) {
      expect(document.querySelector(`[data-item-id="${id}"]`)!.hasAttribute("data-lup-ranked")).toBe(false);
    }
  });

  it("aborts honestly when only rail tiles exist", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("must not fetch"); });
    vi.stubGlobal("fetch", fetchMock);
    document.body.innerHTML = `<div data-testid="horizontal-scroller-Buy it again"><ul data-testid="carousel-container">
      <li data-slide="0"><div data-item-id="r1" aria-label="Price $1.00 $0.10/oz Rail Oil">r1</div></li>
    </ul></div>`;
    listener?.({ type: "lup:activate" });
    const text = await waitForOverlay(/nothing sorted|not identified/);
    expect(text).toBe("Results grid not identified — nothing sorted.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector('[data-item-id="r1"]')!.hasAttribute("data-lup-ranked")).toBe(false);
    expect(document.querySelectorAll(".lup-badge")).toHaveLength(0);
  });
});
