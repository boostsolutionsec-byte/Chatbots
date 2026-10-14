import type { Store } from '../types.js';
import { MemoryStore } from './memory.js';
import { SupabaseStore } from './supabase.js';

export { MemoryStore, SupabaseStore };

/** SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → Supabase; si no, memoria. */
export function createStore(env: NodeJS.ProcessEnv = process.env): Store {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return new SupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return new MemoryStore();
}
