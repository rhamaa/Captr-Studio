import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/I18nContext.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import "./index.css";

document.documentElement.dataset.platform = /mac/i.test(navigator.platform) ? "macos" : "other";

class ErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
	constructor(props: { children: React.ReactNode }) {
		super(props);
		this.state = { hasError: false, error: null, errorInfo: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("[REACT-ERROR-BOUNDARY]", error, errorInfo?.componentStack);
		this.setState({ errorInfo });
	}

	render() {
		if (this.state.hasError) {
			return (
				<div style={{ padding: 24, color: "#f87171", background: "#0d0f17", height: "100vh", fontFamily: "monospace", overflow: "auto" }}>
					<h2 style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>⚠️ Runtime Rendering Error</h2>
					<pre style={{ whiteSpace: "pre-wrap", color: "#fca5a5", fontSize: 13, background: "rgba(255,255,255,0.05)", padding: 12, borderRadius: 8 }}>
						{this.state.error?.message}
						{"\n"}
						{this.state.error?.stack}
					</pre>
					{this.state.errorInfo?.componentStack && (
						<pre style={{ whiteSpace: "pre-wrap", color: "#94a3b8", fontSize: 11, marginTop: 12 }}>
							{this.state.errorInfo.componentStack}
						</pre>
					)}
				</div>
			);
		}
		return this.props.children;
	}
}

window.addEventListener("error", (e) => {
	console.error("[WINDOW-ERROR]", e.message, e.filename, e.lineno, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
	console.error("[WINDOW-UNHANDLED-REJECTION]", e.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ErrorBoundary>
			<ThemeProvider>
				<I18nProvider>
					<App />
				</I18nProvider>
			</ThemeProvider>
		</ErrorBoundary>
	</React.StrictMode>,
);
