/** Small runtime guards shared by recording settings and project parsing. */
export function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isOptional<T>(
	value: unknown,
	guard: (candidate: unknown) => candidate is T,
): value is T | undefined {
	return value === undefined || guard(value);
}

export function isOptionalNullable<T>(
	value: unknown,
	guard: (candidate: unknown) => candidate is T,
): value is T | null | undefined {
	return value === undefined || value === null || guard(value);
}

export function isArrayOf<T>(
	value: unknown,
	guard: (candidate: unknown) => candidate is T,
): value is T[] {
	return Array.isArray(value) && value.every(guard);
}
