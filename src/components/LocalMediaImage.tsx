import type { ImgHTMLAttributes } from "react";
import { useLocalMediaUrl } from "@/hooks/useLocalMediaUrl";

export function LocalMediaImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
	const resolved = useLocalMediaUrl(src);
	return <img {...props} src={resolved} crossOrigin="anonymous" />;
}
