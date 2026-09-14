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
		const width = Math.round(pixelSize * (600 / 140));

		return (
			<svg
				width={width}
				height={height}
				viewBox="0 0 600 140"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={`select-none ${className}`}
				aria-label="Captr Studio"
			>
				<defs>
					<linearGradient
						id="captr-h-bg"
						x1="16"
						y1="10"
						x2="124"
						y2="120"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#131927" />
						<stop offset="50%" stopColor="#0D121E" />
						<stop offset="100%" stopColor="#070A10" />
					</linearGradient>
					<linearGradient
						id="captr-h-rim"
						x1="10"
						y1="10"
						x2="120"
						y2="120"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#818CF8" stopOpacity="0.8" />
						<stop offset="50%" stopColor="#06B6D4" stopOpacity="0.4" />
						<stop offset="100%" stopColor="#38BDF8" stopOpacity="0.6" />
					</linearGradient>
					<linearGradient
						id="captr-h-c-arc"
						x1="20"
						y1="20"
						x2="110"
						y2="110"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#A78BFA" />
						<stop offset="40%" stopColor="#6366F1" />
						<stop offset="85%" stopColor="#06B6D4" />
						<stop offset="100%" stopColor="#38BDF8" />
					</linearGradient>
					<radialGradient
						id="captr-h-rec-glow"
						cx="72"
						cy="70"
						r="22"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#FF3358" stopOpacity="0.95" />
						<stop offset="50%" stopColor="#F43F5E" stopOpacity="0.6" />
						<stop offset="100%" stopColor="#FF3358" stopOpacity="0" />
					</radialGradient>
					<linearGradient
						id="captr-h-text-grad"
						x1="156"
						y1="90"
						x2="330"
						y2="105"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#67E8F9" />
						<stop offset="50%" stopColor="#818CF8" />
						<stop offset="100%" stopColor="#C084FC" />
					</linearGradient>
				</defs>

				{/* Squircle App Icon Frame */}
				<g transform="translate(10, 10)">
					<rect
						x="0"
						y="0"
						width="120"
						height="120"
						rx="28"
						fill="url(#captr-h-bg)"
						stroke="url(#captr-h-rim)"
						strokeWidth="2"
					/>
					{/* Subtle Viewfinder Frame Lines */}
					<path
						d="M16 28 V16 H28"
						stroke="#818CF8"
						strokeWidth="1.5"
						strokeLinecap="round"
						opacity="0.4"
					/>
					<path
						d="M104 28 V16 H92"
						stroke="#818CF8"
						strokeWidth="1.5"
						strokeLinecap="round"
						opacity="0.4"
					/>
					<path
						d="M16 92 V104 H28"
						stroke="#818CF8"
						strokeWidth="1.5"
						strokeLinecap="round"
						opacity="0.4"
					/>
					<path
						d="M104 92 V104 H92"
						stroke="#818CF8"
						strokeWidth="1.5"
						strokeLinecap="round"
						opacity="0.4"
					/>

					{/* Scaled C Aperture Glyph */}
					<g transform="translate(18, 18) scale(0.165)">
						<path
							d="M340 148 C305 116 250 102 195 120 C130 142 84 204 84 276 C84 348 130 410 195 432 C250 450 305 436 340 404"
							fill="none"
							stroke="url(#captr-h-c-arc)"
							strokeWidth="50"
							strokeLinecap="round"
						/>
						{/* Luminous Rec Aperture Core */}
						<circle
							cx="280"
							cy="276"
							r="42"
							fill="url(#captr-h-rec-glow)"
							className={animateGlow ? "animate-pulse" : ""}
						/>
						<circle
							cx="280"
							cy="276"
							r="28"
							stroke="#FFFFFF"
							strokeWidth="3"
							strokeDasharray="12 10"
							opacity="0.5"
						/>
						<circle
							cx="280"
							cy="276"
							r="16"
							fill="#FF3358"
							stroke="#FFFFFF"
							strokeWidth="3"
						/>
					</g>
				</g>

				{/* Wordmark Typography */}
				<text
					x="154"
					y="72"
					fontFamily="'Inter', system-ui, -apple-system, sans-serif"
					fontSize="44"
					fontWeight="800"
					letterSpacing="2.5"
					fill="#F8FAFC"
				>
					CAPTR
				</text>
				<text
					x="156"
					y="106"
					fontFamily="'Inter', system-ui, -apple-system, sans-serif"
					fontSize="18"
					fontWeight="700"
					letterSpacing="6.5"
					fill="url(#captr-h-text-grad)"
				>
					STUDIO
				</text>
				{/* Glowing Rec Indicator Beacon */}
				<circle
					cx="410"
					cy="98"
					r="4.5"
					fill="#FF3358"
					className={animateGlow ? "animate-ping" : ""}
				/>
				<circle cx="410" cy="98" r="4" fill="#FF3358" />
			</svg>
		);
	}

	if (variant === "mark") {
		return (
			<svg
				width={pixelSize}
				height={pixelSize}
				viewBox="0 0 512 512"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={`select-none ${className}`}
				aria-label="Captr Mark"
			>
				<defs>
					<linearGradient
						id="captr-m-arc"
						x1="80"
						y1="80"
						x2="430"
						y2="430"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#A78BFA" />
						<stop offset="30%" stopColor="#818CF8" />
						<stop offset="65%" stopColor="#4F46E5" />
						<stop offset="90%" stopColor="#06B6D4" />
						<stop offset="100%" stopColor="#38BDF8" />
					</linearGradient>
					<radialGradient
						id="captr-m-glow"
						cx="280"
						cy="256"
						r="90"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0%" stopColor="#FF3358" stopOpacity="0.95" />
						<stop offset="50%" stopColor="#F43F5E" stopOpacity="0.5" />
						<stop offset="100%" stopColor="#FF3358" stopOpacity="0" />
					</radialGradient>
				</defs>
				{/* The 'C' Aperture Geometry */}
				<path
					d="M360 128 C310 88 238 74 168 98 C88 126 32 202 32 288 C32 374 88 450 168 478 C238 502 310 488 360 448"
					fill="none"
					stroke="url(#captr-m-arc)"
					strokeWidth="56"
					strokeLinecap="round"
				/>
				{/* Radiant Recording Lens */}
				<circle
					cx="288"
					cy="288"
					r="82"
					fill="url(#captr-m-glow)"
					className={animateGlow ? "animate-pulse" : ""}
				/>
				<circle
					cx="288"
					cy="288"
					r="54"
					stroke="#FFFFFF"
					strokeWidth="5"
					strokeDasharray="18 16"
					opacity="0.5"
				/>
				<circle cx="288" cy="288" r="32" fill="#FF3358" stroke="#FFFFFF" strokeWidth="6" />
				{/* Specular Sparkle */}
				<path
					d="M420 100 Q420 120 400 120 Q420 120 420 140 Q420 120 440 120 Q420 120 420 100 Z"
					fill="#38BDF8"
					opacity="0.95"
				/>
			</svg>
		);
	}

	// Default: "icon" with macOS-style Squircle & Obsidian Glass Container
	return (
		<svg
			width={pixelSize}
			height={pixelSize}
			viewBox="0 0 512 512"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={`select-none ${className}`}
			aria-label="Captr Studio Icon"
		>
			<defs>
				{/* Deep Obsidian Radial/Linear Background */}
				<linearGradient
					id="captr-i-bg"
					x1="40"
					y1="30"
					x2="472"
					y2="482"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#141C2E" />
					<stop offset="45%" stopColor="#0B101D" />
					<stop offset="100%" stopColor="#05080E" />
				</linearGradient>
				{/* Specular Dual-Tone Border */}
				<linearGradient
					id="captr-i-border"
					x1="24"
					y1="24"
					x2="488"
					y2="488"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#A78BFA" stopOpacity="0.85" />
					<stop offset="35%" stopColor="#818CF8" stopOpacity="0.4" />
					<stop offset="70%" stopColor="#06B6D4" stopOpacity="0.6" />
					<stop offset="100%" stopColor="#38BDF8" stopOpacity="0.8" />
				</linearGradient>
				{/* Ambient Internal Glow */}
				<radialGradient
					id="captr-i-ambient"
					cx="256"
					cy="140"
					r="340"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
					<stop offset="50%" stopColor="#06B6D4" stopOpacity="0.08" />
					<stop offset="100%" stopColor="#0B101D" stopOpacity="0" />
				</radialGradient>
				{/* Luminous Aperture Curve */}
				<linearGradient
					id="captr-i-c-arc"
					x1="100"
					y1="100"
					x2="400"
					y2="400"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#C4B5FD" />
					<stop offset="25%" stopColor="#818CF8" />
					<stop offset="60%" stopColor="#4F46E5" />
					<stop offset="90%" stopColor="#06B6D4" />
					<stop offset="100%" stopColor="#38BDF8" />
				</linearGradient>
				{/* Rec Aura */}
				<radialGradient
					id="captr-i-rec-glow"
					cx="280"
					cy="268"
					r="85"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#FF3358" stopOpacity="0.95" />
					<stop offset="45%" stopColor="#F43F5E" stopOpacity="0.6" />
					<stop offset="100%" stopColor="#FF3358" stopOpacity="0" />
				</radialGradient>
			</defs>

			{/* Squircle Body */}
			<rect
				x="24"
				y="24"
				width="464"
				height="464"
				rx="108"
				fill="url(#captr-i-bg)"
				stroke="url(#captr-i-border)"
				strokeWidth="3.5"
			/>
			<rect x="24" y="24" width="464" height="464" rx="108" fill="url(#captr-i-ambient)" />

			{/* Screen Studio Style Camera Viewfinder Brackets */}
			<path
				d="M68 112 V68 H112"
				stroke="#818CF8"
				strokeWidth="3"
				strokeLinecap="round"
				opacity="0.45"
			/>
			<path
				d="M444 112 V68 H400"
				stroke="#818CF8"
				strokeWidth="3"
				strokeLinecap="round"
				opacity="0.45"
			/>
			<path
				d="M68 400 V444 H112"
				stroke="#818CF8"
				strokeWidth="3"
				strokeLinecap="round"
				opacity="0.45"
			/>
			<path
				d="M444 400 V444 H400"
				stroke="#818CF8"
				strokeWidth="3"
				strokeLinecap="round"
				opacity="0.45"
			/>

			{/* The 'C' Aperture Geometry */}
			<path
				d="M344 154 C300 118 240 106 182 126 C116 148 70 208 70 278 C70 348 116 408 182 430 C240 450 300 438 344 402"
				fill="none"
				stroke="url(#captr-i-c-arc)"
				strokeWidth="46"
				strokeLinecap="round"
			/>

			{/* The Glowing Recording Beacon Core */}
			<circle
				cx="280"
				cy="278"
				r="72"
				fill="url(#captr-i-rec-glow)"
				className={animateGlow ? "animate-pulse" : ""}
			/>
			<circle
				cx="280"
				cy="278"
				r="46"
				stroke="#FFFFFF"
				strokeWidth="4.5"
				strokeDasharray="15 13"
				opacity="0.5"
			/>
			<circle cx="280" cy="278" r="26" fill="#FF3358" stroke="#FFFFFF" strokeWidth="4" />
			<circle
				cx="280"
				cy="278"
				r="38"
				stroke="#FFFFFF"
				strokeWidth="1.5"
				strokeDasharray="6 12"
				opacity="0.35"
			/>

			{/* Luminous Specular Sparkle */}
			<path
				d="M402 96 Q402 112 386 112 Q402 112 402 128 Q402 112 418 112 Q402 112 402 96 Z"
				fill="#38BDF8"
				opacity="0.95"
			/>
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
