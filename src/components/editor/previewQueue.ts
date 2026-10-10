/** One queue per renderer lifetime. Disposed seeks cannot paint or report errors. */
export class PreviewQueue<Request, Frame> {
	private active = true;
	private working = false;
	private pending: { request: Request; continuousPlayback: boolean } | undefined;
	constructor(
		private readonly render: (request: Request) => Promise<Frame>,
		private readonly paint: (frame: Frame) => void,
		private readonly report: (error: unknown) => void,
	) {}
	request(request: Request, options: { continuousPlayback?: boolean } = {}) {
		if (!this.active) return;
		this.pending = {
			request,
			continuousPlayback: options.continuousPlayback ?? false,
		};
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
				const pending = this.pending;
				this.pending = undefined;
				try {
					const frame = await this.render(pending.request);
					if (this.active && (pending.continuousPlayback || this.pending === undefined))
						this.paint(frame);
				} catch (error) {
					if (this.active && this.pending === undefined) this.report(error);
				}
			}
		} finally {
			this.working = false;
		}
	}
}
