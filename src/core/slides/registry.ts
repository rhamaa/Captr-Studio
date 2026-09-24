import type { SlideModule, SlideType } from "./types";

export class SlideRegistry {
	private modules = new Map<SlideType, SlideModule<any>>();

	/**
	 * Registers a slide module. Throws if a module with the same type is already registered.
	 */
	register<TMeta = Record<string, unknown>>(module: SlideModule<TMeta>): void {
		if (this.modules.has(module.type)) {
			console.warn(`[SlideRegistry] Overwriting already registered slide module: ${module.type}`);
		}
		this.modules.set(module.type, module as SlideModule<any>);
	}

	/**
	 * Retrieves the slide module for the specified type.
	 */
	get<TMeta = Record<string, unknown>>(type: SlideType): SlideModule<TMeta> {
		const mod = this.modules.get(type);
		if (!mod) {
			throw new Error(`[SlideRegistry] No slide module registered for type: "${type}"`);
		}
		return mod as SlideModule<TMeta>;
	}

	/**
	 * Checks if a module is registered for the specified type.
	 */
	has(type: SlideType): boolean {
		return this.modules.has(type);
	}

	/**
	 * Returns all registered slide modules.
	 */
	getAll(): SlideModule<any>[] {
		return Array.from(this.modules.values());
	}

	/**
	 * Returns an array of registered slide types.
	 */
	getRegisteredTypes(): SlideType[] {
		return Array.from(this.modules.keys());
	}
}

export const slideRegistry = new SlideRegistry();
