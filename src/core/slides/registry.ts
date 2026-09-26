import type { SlideData, SlideModule, SlideType } from "./types";

export class SlideRegistry {
	private modules = new Map<SlideType, SlideModule>();

	/**
	 * Registers a slide module. Throws if a module with the same type is already registered.
	 */
	register<TType extends SlideType>(module: SlideModule<TType>): void {
		if (this.modules.has(module.type)) {
			console.warn(`[SlideRegistry] Overwriting already registered slide module: ${module.type}`);
		}
		this.modules.set(module.type, module as unknown as SlideModule);
	}

	/**
	 * Retrieves the slide module for the specified type.
	 */
	get<TType extends SlideType>(type: TType): SlideModule<TType> {
		const mod = this.modules.get(type);
		if (!mod) {
			throw new Error(`[SlideRegistry] No slide module registered for type: "${type}"`);
		}
		return mod as unknown as SlideModule<TType>;
	}

	/** Creates a slide with metadata from the module registered for its type. */
	createSlide<TType extends SlideType>(
		type: TType,
		fields: Omit<SlideData<TType>, "type" | "meta">,
	): SlideData<TType> {
		return {
			...fields,
			type,
			meta: this.get(type).createDefaultMeta(),
		} as SlideData<TType>;
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
	getAll(): SlideModule[] {
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
