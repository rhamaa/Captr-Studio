let pending: Promise<unknown> = Promise.resolve();
let count = 0;
export function isProjectFileOperationPending(): boolean {
	return count > 0;
}

/** Serialize every operation that changes the active project's file or session. */
export function enqueueProjectFileOperation<T>(job: () => Promise<T>): Promise<T> {
	count++;
	const result = pending.then(job).finally(() => {
		count--;
	});
	pending = result.catch(() => undefined);
	return result;
}
