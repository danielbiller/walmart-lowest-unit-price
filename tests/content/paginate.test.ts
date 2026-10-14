// @vitest-environment jsdom
// paginate.ts uses DOMParser (needs a DOM environment), hence jsdom above
// instead of the workspace-default "node" environment (see vitest.config.ts).

import { describe, it, expect, vi, afterEach } from "vitest";
import { buildPageUrl, collectAllPages, collectPageRange, fetchPageTiles } from "../../src/content/paginate";

function tileHtml(ids: string[]): string {
  const tiles = ids
    .map((id) => `<div data-item-id="${id}"><span>Product ${id}</span></div>`)
    .join("");
  return `<!doctype html><html><body>${tiles}</body></html>`;
}

const NO_TILES_HTML = `<!doctype html><html><body><div>No results</div></body></html>`;

function makeResponse(html: string, ok = true): Response {
  return {
    ok,
    text: async () => html,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildPageUrl", () => {
  it("adds a page param when absent", () => {
    const result = buildPageUrl("https://www.walmart.com/search?q=paper+towels", 3);
    expect(result).toBe("https://www.walmart.com/search?q=paper+towels&page=3");
  });

  it("overwrites an existing page param", () => {
    const result = buildPageUrl("https://www.walmart.com/search?q=paper+towels&page=2", 5);
    expect(result).toBe("https://www.walmart.com/search?q=paper+towels&page=5");
  });

  it("preserves other existing query params", () => {
    const result = buildPageUrl("https://www.walmart.com/search?q=paper+towels&page=3", 5);
    const url = new URL(result);
    expect(url.searchParams.get("q")).toBe("paper towels");
    expect(url.searchParams.get("page")).toBe("5");
  });
});

describe("collectAllPages", () => {
  it("stops fetching once a page yields zero tiles", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const page = url.searchParams.get("page");
      if (page === "2") return makeResponse(tileHtml(["p2-1", "p2-2"]));
      if (page === "3") return makeResponse(tileHtml(["p3-1"]));
      if (page === "4") return makeResponse(NO_TILES_HTML);
      throw new Error(`unexpected page ${page}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectAllPages("https://www.walmart.com/search?q=towels", 5);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.pageTiles.map((pt) => pt.tile.id)).toEqual(["p2-1", "p2-2", "p3-1"]);
  });

  it("does not count a trailing empty page toward pagesFetched", async () => {
    // Reproduces the real bug: Walmart's page=N can genuinely return zero
    // tiles once past the real last page, but onProgress already fired for
    // that attempted page before the fetch resolved. pagesFetched must only
    // count pages that actually contributed tiles (here: just page 2).
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const page = url.searchParams.get("page");
      if (page === "2") return makeResponse(tileHtml(["p2-1"]));
      if (page === "3") return makeResponse(NO_TILES_HTML);
      throw new Error(`unexpected page ${page}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const progressCalls: number[] = [];
    const result = await collectAllPages("https://www.walmart.com/search?q=towels", 5, (pageIndex) =>
      progressCalls.push(pageIndex)
    );

    expect(progressCalls).toEqual([2, 3]);
    expect(result.pagesFetched).toBe(1);
    expect(result.pageTiles.map((pt) => pt.tile.id)).toEqual(["p2-1"]);
  });

  it("returns an empty result immediately when maxPages < 2", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectAllPages("https://www.walmart.com/search?q=towels", 1);

    expect(result).toEqual({ pageTiles: [], pagesFetched: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to an empty result without throwing when fetch rejects", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      collectAllPages("https://www.walmart.com/search?q=towels", 5)
    ).resolves.toEqual({ pageTiles: [], pagesFetched: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("collectPageRange", () => {
  it("starts at an arbitrary page and reports the last attempted page", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const page = new URL(String(input)).searchParams.get("page");
      if (page === "4") return makeResponse(tileHtml(["p4-1"]));
      return makeResponse(NO_TILES_HTML);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectPageRange("https://www.walmart.com/search?q=towels", 4, 8);

    expect(fetchMock).toHaveBeenCalledTimes(2); // page 4 tiles, page 5 empty -> stop
    expect(result.pageTiles.map((pt) => pt.tile.id)).toEqual(["p4-1"]);
    expect(result.pagesFetched).toBe(1);
    expect(result.lastAttempted).toBe(5);
  });

  it("returns empty without fetching when the range is inverted", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectPageRange("https://www.walmart.com/search?q=towels", 9, 8);

    expect(result).toEqual({ pageTiles: [], pagesFetched: 0, lastAttempted: 8 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchPageTiles grid scoping", () => {
  it("excludes side-rail tiles from fetched pages", async () => {
    const html = `<!doctype html><html><body>
      <div id="row">
        <div class="cell"><div data-item-id="g1" aria-label="Price $1.00 $0.10/oz T">g1</div></div>
        <div class="cell"><div data-item-id="g2" aria-label="Price $2.00 $0.20/oz T">g2</div></div>
      </div>
      <div id="rail"><div data-item-id="r1" aria-label="Price $9.00 $0.90/oz Rail">r1</div></div>
    </body></html>`;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => html }) as Response));

    const pageTiles = await fetchPageTiles("https://www.walmart.com/search?q=towels&page=2");

    expect(pageTiles.map((pt) => pt.tile.id).sort()).toEqual(["g1", "g2"]);
  });

  it("a carousel rail outnumbering the grid never wins the fetched vote", async () => {
    const html = `<!doctype html><html><body>
      <div id="row">
        <div class="cell"><div data-item-id="g1" aria-label="Price $1.00 $0.10/oz T">g1</div></div>
      </div>
      <div data-testid="horizontal-scroller-Buy it again"><ul data-testid="carousel-container">
        <li data-slide="0"><div data-item-id="r1" aria-label="Price $9.00 $0.90/oz Rail">r1</div></li>
        <li data-slide="1"><div data-item-id="r2" aria-label="Price $8.00 $0.80/oz Rail">r2</div></li>
      </ul></div>
    </body></html>`;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => html }) as Response));

    const pageTiles = await fetchPageTiles("https://www.walmart.com/search?q=towels&page=2");

    expect(pageTiles.map((pt) => pt.tile.id)).toEqual(["g1"]);
  });
});
