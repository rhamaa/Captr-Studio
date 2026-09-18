import type { PropertyKeyframe } from "../types";

export function KeyframeValueEditor({
	frame,
	disabled,
	onChange,
}: {
	frame: PropertyKeyframe;
	disabled?: boolean;
	onChange: (changes: Partial<PropertyKeyframe>) => void;
}) {
	const field = (
		label: string,
		value: number,
		update: (value: number) => void,
		min?: number,
		max?: number,
	) => (
		<label key={label} className="text-[10px] flex flex-col gap-1">
			{label}
			<input
				aria-label={label}
				disabled={disabled}
				type="number"
				step="0.05"
				min={min}
				max={max}
				className="w-16 bg-foreground/5 rounded px-1"
				value={value}
				onChange={(event) => {
					const next = event.target.valueAsNumber;
					if (Number.isFinite(next))
						update(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next)));
				}}
			/>
		</label>
	);
	const curve = frame.bezier ?? [0.42, 0, 0.58, 1];
	return (
		<div className="flex flex-wrap gap-2 py-1">
			{typeof frame.value === "number" ? (
				field(
					`${frame.property} value`,
					frame.value,
					(value) => onChange({ value }),
					frame.property === "opacity" || frame.property === "scale" ? 0 : undefined,
					frame.property === "opacity" ? 1 : undefined,
				)
			) : (
				<>
					{field("Position X", frame.value.x, (x) =>
						onChange({ value: { ...(frame.value as { x: number; y: number }), x } }),
					)}
					{field("Position Y", frame.value.y, (y) =>
						onChange({ value: { ...(frame.value as { x: number; y: number }), y } }),
					)}
				</>
			)}
			{frame.easing === "cubic-bezier" && (
				<>
					<svg aria-label="Easing curve" width="60" height="60" viewBox="0 0 100 100">
						<path
							d={`M 0 100 C ${curve[0] * 100} ${100 - curve[1] * 100}, ${curve[2] * 100} ${100 - curve[3] * 100}, 100 0`}
							fill="none"
							stroke="currentColor"
							strokeWidth="3"
						/>
					</svg>
					{curve.map((value, index) =>
						field(
							["Curve X1", "Curve Y1", "Curve X2", "Curve Y2"][index],
							value,
							(next) => {
								const bezier = [...curve] as [number, number, number, number];
								bezier[index] = next;
								onChange({ bezier });
							},
							index % 2 === 0 ? 0 : undefined,
							index % 2 === 0 ? 1 : undefined,
						),
					)}
				</>
			)}
		</div>
	);
}
