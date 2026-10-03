import React from "react";

export type CaptrLogoVariant = "icon" | "mark" | "horizontal";
export type CaptrLogoSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

export interface CaptrLogoProps {
	variant?: CaptrLogoVariant;
	size?: CaptrLogoSize;
	className?: string;
	animateGlow?: boolean;
}

const SIZE_MAP: Record<string, number> = {
	xs: 16,
	sm: 24,
	md: 32,
	lg: 48,
	xl: 64,
};

export const CaptrLogo: React.FC<CaptrLogoProps> = ({
	variant = "icon",
	size = "md",
	className = "",
	animateGlow = false,
}) => {
	const pixelSize = typeof size === "number" ? size : (SIZE_MAP[size] ?? 32);

	if (variant === "horizontal") {
		const height = pixelSize;
		const width = Math.round(pixelSize * 3.4);

		return (
			<svg
				width={width}
				height={height}
				viewBox="0 0 340 100"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={`select-none ${className}`}
				aria-label="Captr Studio"
			>
				<defs>
					<clipPath id="captr-h-play-clip">
						<path d="M 28 35.5 C 28 33.2 30.2 31.8 32.5 33.2 L 52.5 45.2 C 54.8 46.6 54.8 49.4 52.5 50.8 L 32.5 62.8 C 30.2 64.2 28 62.8 28 60.5 Z" />
					</clipPath>
				</defs>

				{/* Logo Mark Group (x: 0..100) */}
				<g transform="translate(0, 0)">
					{/* Viewfinder Frame Brackets */}
					<path
						d="M 17 35 L 17 24 C 17 18.5 20.5 15 26 15 L 37 15"
						stroke="currentColor"
						strokeWidth="6.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-[#344054] dark:text-[#E2E8F0]"
					/>
					<path
						d="M 63 15 L 74 15 C 79.5 15 83 18.5 83 24 L 83 35"
						stroke="currentColor"
						strokeWidth="6.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-[#344054] dark:text-[#E2E8F0]"
					/>
					<path
						d="M 17 65 L 17 76 C 17 81.5 20.5 85 26 85 L 37 85"
						stroke="currentColor"
						strokeWidth="6.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-[#344054] dark:text-[#E2E8F0]"
					/>
					<path
						d="M 63 85 L 74 85 C 79.5 85 83 81.5 83 76 L 83 65"
						stroke="currentColor"
						strokeWidth="6.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-[#344054] dark:text-[#E2E8F0]"
					/>

					{/* Play Symbol */}
					<g clipPath="url(#captr-h-play-clip)">
						<rect x="25" y="30" width="35" height="40" fill="#6FA8FF" />
						<path d="M 26 50 C 33 46 41 54 56 46 L 56 66 L 26 66 Z" fill="#A879F5" />
					</g>

					{/* Vertical Pastel Green Capsule */}
					<rect x="57" y="36.5" width="5.5" height="27" rx="2.75" fill="#8DDB9B" />

					{/* Waveform Bars */}
					<rect
						x="65"
						y="42"
						width="5"
						height="16"
						rx="2.5"
						fill="#A879F5"
						className={animateGlow ? "animate-pulse" : ""}
					/>
					<rect x="72.5" y="44.5" width="4.5" height="11" rx="2.25" fill="#A879F5" />
					<rect x="79.5" y="46.5" width="4" height="7" rx="2" fill="#A879F5" />
				</g>

				{/* Wordmark Typography */}
				<text
					x="106"
					y="64"
					fontFamily="'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
					fontSize="46"
					fontWeight="800"
					letterSpacing="-0.5"
					fill="currentColor"
					className="text-[#344054] dark:text-[#F5F6F8]"
				>
					Captr
				</text>
				<text
					x="224"
					y="64"
					fontFamily="'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
					fontSize="46"
					fontWeight="600"
					letterSpacing="-0.5"
					fill="#A879F5"
				>
					Studio
				</text>
			</svg>
		);
	}

	if (variant === "mark") {
		return (
			<svg
				width={pixelSize}
				height={pixelSize}
				viewBox="0 0 100 100"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={`select-none ${className}`}
				aria-label="Captr Mark"
			>
				<defs>
					<clipPath id="captr-m-play-clip">
						<path d="M 28 35.5 C 28 33.2 30.2 31.8 32.5 33.2 L 52.5 45.2 C 54.8 46.6 54.8 49.4 52.5 50.8 L 32.5 62.8 C 30.2 64.2 28 62.8 28 60.5 Z" />
					</clipPath>
				</defs>

				{/* Viewfinder Corners */}
				<path
					d="M 17 35 L 17 24 C 17 18.5 20.5 15 26 15 L 37 15"
					stroke="currentColor"
					strokeWidth="6.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-[#344054] dark:text-[#E2E8F0]"
				/>
				<path
					d="M 63 15 L 74 15 C 79.5 15 83 18.5 83 24 L 83 35"
					stroke="currentColor"
					strokeWidth="6.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-[#344054] dark:text-[#E2E8F0]"
				/>
				<path
					d="M 17 65 L 17 76 C 17 81.5 20.5 85 26 85 L 37 85"
					stroke="currentColor"
					strokeWidth="6.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-[#344054] dark:text-[#E2E8F0]"
				/>
				<path
					d="M 63 85 L 74 85 C 79.5 85 83 81.5 83 76 L 83 65"
					stroke="currentColor"
					strokeWidth="6.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-[#344054] dark:text-[#E2E8F0]"
				/>

				{/* Play Symbol */}
				<g clipPath="url(#captr-m-play-clip)">
					<rect x="25" y="30" width="35" height="40" fill="#6FA8FF" />
					<path d="M 26 50 C 33 46 41 54 56 46 L 56 66 L 26 66 Z" fill="#A879F5" />
				</g>

				{/* Vertical Pastel Green Capsule */}
				<rect x="57" y="36.5" width="5.5" height="27" rx="2.75" fill="#8DDB9B" />

				{/* Waveform Bars */}
				<rect
					x="65"
					y="42"
					width="5"
					height="16"
					rx="2.5"
					fill="#A879F5"
					className={animateGlow ? "animate-pulse" : ""}
				/>
				<rect x="72.5" y="44.5" width="4.5" height="11" rx="2.25" fill="#A879F5" />
				<rect x="79.5" y="46.5" width="4" height="7" rx="2" fill="#A879F5" />
			</svg>
		);
	}

	// Default: "icon" (Icon Mark with elegant soft container or standalone)
	return (
		<svg
			width={pixelSize}
			height={pixelSize}
			viewBox="0 0 100 100"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={`select-none ${className}`}
			aria-label="Captr Studio Icon"
		>
			<defs>
				<clipPath id="captr-i-play-clip">
					<path d="M 28 35.5 C 28 33.2 30.2 31.8 32.5 33.2 L 52.5 45.2 C 54.8 46.6 54.8 49.4 52.5 50.8 L 32.5 62.8 C 30.2 64.2 28 62.8 28 60.5 Z" />
				</clipPath>
				{animateGlow && (
					<radialGradient id="captr-i-glow" cx="50" cy="50" r="45" gradientUnits="userSpaceOnUse">
						<stop offset="0%" stopColor="#A879F5" stopOpacity="0.25" />
						<stop offset="60%" stopColor="#6FA8FF" stopOpacity="0.1" />
						<stop offset="100%" stopColor="#6FA8FF" stopOpacity="0" />
					</radialGradient>
				)}
			</defs>

			{/* Soft ambient glow if enabled */}
			{animateGlow && (
				<circle cx="50" cy="50" r="46" fill="url(#captr-i-glow)" className="animate-pulse" />
			)}

			{/* Viewfinder Frame Brackets */}
			<path
				d="M 17 35 L 17 24 C 17 18.5 20.5 15 26 15 L 37 15"
				stroke="currentColor"
				strokeWidth="6.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-[#344054] dark:text-[#E2E8F0]"
			/>
			<path
				d="M 63 15 L 74 15 C 79.5 15 83 18.5 83 24 L 83 35"
				stroke="currentColor"
				strokeWidth="6.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-[#344054] dark:text-[#E2E8F0]"
			/>
			<path
				d="M 17 65 L 17 76 C 17 81.5 20.5 85 26 85 L 37 85"
				stroke="currentColor"
				strokeWidth="6.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-[#344054] dark:text-[#E2E8F0]"
			/>
			<path
				d="M 63 85 L 74 85 C 79.5 85 83 81.5 83 76 L 83 65"
				stroke="currentColor"
				strokeWidth="6.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="text-[#344054] dark:text-[#E2E8F0]"
			/>

			{/* Play Symbol */}
			<g clipPath="url(#captr-i-play-clip)">
				<rect x="25" y="30" width="35" height="40" fill="#6FA8FF" />
				<path d="M 26 50 C 33 46 41 54 56 46 L 56 66 L 26 66 Z" fill="#A879F5" />
			</g>

			{/* Vertical Pastel Green Capsule */}
			<rect x="57" y="36.5" width="5.5" height="27" rx="2.75" fill="#8DDB9B" />

			{/* Waveform Bars */}
			<rect
				x="65"
				y="42"
				width="5"
				height="16"
				rx="2.5"
				fill="#A879F5"
				className={animateGlow ? "animate-pulse" : ""}
			/>
			<rect x="72.5" y="44.5" width="4.5" height="11" rx="2.25" fill="#A879F5" />
			<rect x="79.5" y="46.5" width="4" height="7" rx="2" fill="#A879F5" />
		</svg>
	);
};

/** @deprecated Use CaptrLogo instead */
export const RhamaaLogo = CaptrLogo;
/** @deprecated Use CaptrLogoVariant instead */
export type RhamaaLogoVariant = CaptrLogoVariant;
/** @deprecated Use CaptrLogoSize instead */
export type RhamaaLogoSize = CaptrLogoSize;
/** @deprecated Use CaptrLogoProps instead */
export type RhamaaLogoProps = CaptrLogoProps;

export default CaptrLogo;
