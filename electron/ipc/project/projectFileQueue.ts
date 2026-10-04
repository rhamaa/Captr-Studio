let pending: Promise<unknown> = Promise.resolve();

/** Serialize every operation that changes the active project's file or session. */
export function enqueueProjectFileOperation<T>(job: () => Promise<T>): Promise<T> {
	const result = pending.then(job);
	pending = result.catch(() => undefined);
	return result;
}
