import type { ClipVisualSettings } from "@/core/timeline/types";

export function ClipVisualControls({
	value,
	onChange,
}: {
	value?: ClipVisualSettings;
	onChange: (value: ClipVisualSettings | undefined) => void;
}) {
	const s = value ?? {},
		crop = s.crop ?? { left: 0, right: 0, top: 0, bottom: 0 };
	return (
		<section className="project-component-animations" aria-label="Placement visual settings">
			<div className="story-edit-actions">
				<h3>Crop, mask &amp; color</h3>
				<button type="button" onClick={() => onChange(undefined)}>
					Reset visuals
				</button>
			</div>
			<div className="project-component-animation-row">
				{(["left", "right", "top", "bottom"] as const).map((edge) => {
					const opposite = {
						left: "right",
						right: "left",
						top: "bottom",
						bottom: "top",
					} as const;
					return (
						<label key={edge}>
							Crop {edge} <span>{Math.round(crop[edge] * 100)}%</span>
							<input
								aria-label={`Crop ${edge}`}
								type="range"
								min={0}
								max={Math.max(0, 99 - Math.round(crop[opposite[edge]] * 100))}
								value={crop[edge] * 100}
								onChange={(e) =>
									onChange({
										...s,
										crop: { ...crop, [edge]: e.target.valueAsNumber / 100 },
									})
								}
							/>
						</label>
					);
				})}
				<label>
					Mask
					<select
						value={s.mask ?? "none"}
						onChange={(e) =>
							onChange({
								...s,
								mask:
									e.target.value === "none"
										? undefined
										: (e.target.value as ClipVisualSettings["mask"]),
							})
						}
					>
						<option value="none">None</option>
						<option value="rectangle">Rectangle</option>
						<option value="ellipse">Ellipse</option>
					</select>
				</label>
				{s.mask && (
					<label>
						Mask inset {Math.round((s.maskInset ?? 0) * 100)}%
						<input
							type="range"
							min={0}
							max={49}
							value={(s.maskInset ?? 0) * 100}
							onChange={(e) =>
								onChange({ ...s, maskInset: e.target.valueAsNumber / 100 })
							}
						/>
					</label>
				)}
				{(["brightness", "contrast", "saturation"] as const).map((key) => (
					<label key={key}>
						{key} {Math.round((s[key] ?? 1) * 100)}%
						<input
							aria-label={`Clip ${key}`}
							type="range"
							min={0}
							max={300}
							value={(s[key] ?? 1) * 100}
							onChange={(e) =>
								onChange({ ...s, [key]: e.target.valueAsNumber / 100 })
							}
						/>
					</label>
				))}
			</div>
		</section>
	);
}
