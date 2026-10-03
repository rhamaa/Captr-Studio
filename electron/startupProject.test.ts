import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), show: vi.fn() }));
vi.mock("./ipc/project/manager", () => ({ loadProjectFromPath: mocks.load }));
vi.mock("electron", () => ({ dialog: { showErrorBox: mocks.show } }));
import { openStartupProject } from "./startupProject";
import { consumePendingProjectOpen } from "./pendingProjectOpen";
describe("startup project rejection", () => {
	beforeEach(() => vi.clearAllMocks());
	it("shows the compatibility explanation when file-association loading is rejected", async () => {
		const message =
			"Open this project using the previous version of Captr Studio. The original file has not been modified.";
		mocks.load.mockResolvedValue({ success: false, message });
		await openStartupProject("old.captr");
		expect(mocks.load).toHaveBeenCalledWith("old.captr");
		expect(mocks.show).toHaveBeenCalledWith("Unable to open project", message);
	});
	it("reports a thrown load error before continuing startup", async () => {
		mocks.load.mockRejectedValue(new Error("Unreadable bundle"));
		await openStartupProject("broken.captr");
		expect(mocks.show).toHaveBeenCalledWith("Unable to open project", "Unreadable bundle");
	});
	it("opens a supported project without an error dialog", async () => {
		const result = {
			success: true,
			project: { version: 2 },
			conversionToken: "cold-candidate",
			path: "record.captr",
		};
		mocks.load.mockResolvedValue(result);
		await openStartupProject("record.captr");
		expect(mocks.show).not.toHaveBeenCalled();
		expect(consumePendingProjectOpen()).toEqual({ result });
	});
});
