import { Info } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function HelpPopover({ label, children, className }: {label: string; children: ReactNode; className?: string}) {
	return <Popover>
		<PopoverTrigger asChild>
			<button type="button" aria-label={label} title={label} className={cn("captr-help-trigger", className)}>
				<Info size={16} aria-hidden="true" />
			</button>
		</PopoverTrigger>
		<PopoverContent className="max-w-[calc(100vw-24px)] p-3 text-xs leading-relaxed" side="top" align="end" aria-label={label}>
			{children}
		</PopoverContent>
	</Popover>;
}
