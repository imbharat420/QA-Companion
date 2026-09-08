/**
 * THE STORE BARREL.
 *
 * Import stores and selector hooks from "@/store" — never reach into a store
 * file directly, so a slice can be split or renamed without touching pages.
 *
 * The contract for consumers: subscribe through a narrow selector hook
 * (`useAgentStatus()`), not the store itself (`useAgentStore()`). A component
 * that subscribes to a whole store re-renders on every unrelated field change,
 * and the agent stream mutates state dozens of times a second.
 */

export * from "./settingsStore";
export * from "./uiStore";
export * from "./agentStore";
export * from "./projectsStore";
export * from "./filtersStore";
