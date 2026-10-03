import { expect, it } from "vitest";
import { ProjectSession } from "./projectSession";
it("invalidates asynchronous work on project changes and disposal",()=>{const s=new ProjectSession();const first=s.beginProject("one");expect(s.isCurrent(first,"one")).toBe(true);const next=s.beginProject("two");expect(next).toBeGreaterThan(first);expect(s.isCurrent(first,"one")).toBe(false);expect(s.isCurrent(next,"one")).toBe(false);s.dispose();expect(s.isCurrent(next,"two")).toBe(false);});
