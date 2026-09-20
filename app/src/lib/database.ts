// Re-export from the platform-specific file so TypeScript can resolve '@/lib/database'.
// At runtime, Metro/bundler picks database.native.ts or database.web.ts automatically.
export * from './database.web';
