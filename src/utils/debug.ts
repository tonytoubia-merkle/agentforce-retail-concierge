/** Debug logging — only outputs when VITE_DEBUG is truthy or in development mode. */
const isDebug = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

export function debug(tag: string, ...args: unknown[]): void {
  if (isDebug) console.log(`[${tag}]`, ...args);
}

export function debugWarn(tag: string, ...args: unknown[]): void {
  if (isDebug) console.warn(`[${tag}]`, ...args);
}
