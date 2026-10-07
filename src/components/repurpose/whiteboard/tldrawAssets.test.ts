import { describe, it, expect } from "vitest";
import { getTldrawOfflineAssetUrls } from "./tldrawAssets";

describe("tldrawAssets", () => {
  it("returns local offline asset URLs without unpkg or remote CDN references", () => {
    const urls = getTldrawOfflineAssetUrls();
    expect(urls).toBeDefined();
    for (const [key, value] of Object.entries(urls)) {
      if (typeof value === "string") {
        expect(value).not.toContain("unpkg.com");
        expect(value).not.toContain("cdn.jsdelivr.net");
      }
    }
  });
});
