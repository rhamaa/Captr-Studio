import { describe, it, expect } from "vitest";
import { getTldrawOfflineAssetUrls } from "./tldrawAssets";

describe("tldrawAssets", () => {
  it("returns local offline asset URLs without unpkg or remote CDN references", () => {
    const urls = getTldrawOfflineAssetUrls();
    expect(urls).toBeDefined();

    let stringCount = 0;
    const checkRecursive = (obj: unknown) => {
      if (typeof obj === "string") {
        stringCount++;
        expect(obj).not.toContain("unpkg.com");
        expect(obj).not.toContain("cdn.jsdelivr.net");
      } else if (obj && typeof obj === "object") {
        for (const val of Object.values(obj)) {
          checkRecursive(val);
        }
      }
    };

    checkRecursive(urls);
    expect(stringCount).toBeGreaterThan(10);
  });
});

