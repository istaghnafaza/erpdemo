// =============================================================================
// API Layer — Barrel export
//
// All Supabase interactions go through here.
// Components and hooks ONLY import from this file or individual api/* files.
// Never import { supabase } directly into a component.
//
// MIGRATION PATH (Laravel):
//   1. Replace function bodies in api/*.ts with fetch() calls to Laravel
//   2. The { data, error } return shape stays the same
//   3. Components and hooks require zero changes
// =============================================================================

// Auth
export * from "./auth";

// Core entities
export * from "./tenants";
export * from "./branches";
export * from "./products";
export * from "./customers";

// Operations
export * from "./transactions";
export * from "./inventory";
export * from "./purchasing";
export * from "./sales-orders";

// Finance
export * from "./finance";
export * from "./receivables";
export * from "./payables";

// Analytics
export * from "./reports";

// Re-export client utilities for use in hooks
export { ok, fail, toApiError } from "./client";
