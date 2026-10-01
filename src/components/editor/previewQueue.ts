/** One queue per renderer lifetime. Disposed seeks cannot paint or report errors. */
export class PreviewQueue<Request, Frame> {
	private active = true;
	private working = false;
	private pending: Request | undefined;
	constructor(
		private readonly render: (request: Request) => Promise<Frame>,
		private readonly paint: (frame: Frame) => void,
		private readonly report: (error: unknown) => void,
	) {}
	request(request: Request) {
		if (!this.active) return;
		this.pending = request;
		if (!this.working) void this.pump();
	}
	dispose() {
		this.active = false;
		this.pending = undefined;
	}
	private async pump() {
		this.working = true;
		try {
			while (this.active && this.pending !== undefined) {
				const request = this.pending;
				this.pending = undefined;
				try {
					const frame = await this.render(request);
					if (this.active && this.pending === undefined) this.paint(frame);
				} catch (error) {
					if (this.active && this.pending === undefined) this.report(error);
				}
			}
		} finally {
			this.working = false;
		}
	}
}
