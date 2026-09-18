import { useEffect, useState } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";

export function useLocalMediaUrl(path: string | null | undefined): string | undefined {
	const [url, setUrl] = useState<string>();
	useEffect(() => {
		let disposed = false;
		let revoke = () => {};
		setUrl(undefined);
		if (path) void resolveMediaElementSource(path).then(source => {
			if (disposed) { source.revoke(); return; }
			revoke = source.revoke; setUrl(source.src);
		}).catch(() => {});
		return () => { disposed = true; revoke(); };
	}, [path]);
	return url;
}
