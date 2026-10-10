import { describe, expect, it } from "vitest";
import { projectFileName, projectTitleFromPath, validateProjectBaseName } from "./projectNames";

describe("project file naming", () => {
	it("shows Untitled only without a saved path", () => {
		expect(projectFileName(null)).toBe("Untitled");
		expect(projectFileName("C:\\Projects\\Tutorial.captr")).toBe("Tutorial.captr");
		expect(projectFileName("/projects/Tutorial.captr")).toBe("Tutorial.captr");
	});
	it("keeps exact filename case and uses the base for metadata", () => {
		expect(projectFileName("C:\\Projects\\My DEMO.CAPTR")).toBe("My DEMO.CAPTR");
		expect(projectTitleFromPath("C:\\Projects\\My DEMO.CAPTR")).toBe("My DEMO");
	});
	it("accepts Unicode and spaces without doubling the extension", () => {
		expect(validateProjectBaseName("Tutorial 日本語.captr")).toBe("Tutorial 日本語");
		expect(validateProjectBaseName("Demo.CAPTR")).toBe("Demo");
		expect(validateProjectBaseName("Project 2")).toBe("Project 2");
	});
	it.each(["", " ", ".", "..", "CON", "CON.captr", "con.txt", "LPT1", "COM9", "NUL", "A/B", "A\\B", "A:B", "A?B", "A\u0000B", "Demo ", "Demo.", "Demo .captr", "Demo..captr"])(
		"rejects invalid filename %j without silently changing it", (name) => {
			expect(() => validateProjectBaseName(name)).toThrow();
		},
	);
});
