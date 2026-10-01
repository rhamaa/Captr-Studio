import { describe, expect, it } from "vitest";
import { slideRegistry } from "@/core/slides/registry";
import "@/slides";

describe("available slide modules", () => {
	it("registers Record without retired Video/Motion modules", () => {
		expect(slideRegistry.getRegisteredTypes()).toEqual(["record"]);
	});
});
