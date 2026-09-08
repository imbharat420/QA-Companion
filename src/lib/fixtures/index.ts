/**
 * FIXTURE BARREL — the mock adapter's entire data set.
 *
 * Star re-exports on purpose: a renamed or missing export in any fixture file
 * fails the build here instead of quietly resolving to `undefined` at runtime.
 */

export * from "./workspaces";
export * from "./suites";
export * from "./cases";
export * from "./runs";
export * from "./findings";
export * from "./accessibility";
export * from "./security";
export * from "./performance";
export * from "./visual";
export * from "./apiIntel";
export * from "./scripts";
export * from "./browser";
export * from "./agentScript";
