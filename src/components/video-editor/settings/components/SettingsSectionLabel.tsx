import React from "react";

export function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
			{children}
		</p>
	);
}
