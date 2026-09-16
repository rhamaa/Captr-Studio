import { useRef } from "react";
import { UploadSimple as Upload } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AnnotationRegion } from "../types";

export interface AnnotationMediaTabProps {
	annotation: AnnotationRegion;
	onContentChange: (content: string) => void;
	onLayerChange?: (changes: Partial<AnnotationRegion>) => void;
	t: (key: string, defaultVal?: string, params?: Record<string, string | number>) => string;
}

export function AnnotationMediaTab({
	annotation,
	onContentChange,
	t,
}: AnnotationMediaTabProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type
		const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
		if (!validTypes.includes(file.type)) {
			toast.error(t("annotations.invalidFileType"));
			return;
		}

		// Read file as data URL
		const reader = new FileReader();
		reader.onload = (e) => {
			const result = e.target?.result as string;
			if (result) {
				onContentChange(result);
			}
		};
		reader.readAsDataURL(file);

		// Reset input
		event.target.value = "";
	};

	return (
		<div className="mt-0 space-y-4">
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleImageUpload}
				accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
				className="hidden"
			/>
			<Button
				onClick={() => fileInputRef.current?.click()}
				variant="outline"
				className="w-full gap-2 bg-foreground/5 text-foreground border-foreground/10 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-all py-8"
			>
				<Upload className="w-5 h-5" />
				{t("annotations.uploadImage")}
			</Button>

			{annotation.content && annotation.content.startsWith("data:image") && (
				<div className="rounded-lg border border-foreground/10 overflow-hidden bg-foreground/5 p-2">
					<img
						src={annotation.content}
						alt="Uploaded annotation"
						className="w-full h-auto rounded-md"
					/>
				</div>
			)}

			<p className="text-xs text-muted-foreground/70 text-center leading-relaxed">
				{t("annotations.supportedFormats")}
			</p>
		</div>
	);
}
