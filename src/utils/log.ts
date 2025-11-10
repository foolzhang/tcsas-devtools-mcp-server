export default function log(...args: any[]) {
  console.error('[DEBUG]', new Date().toISOString(), '--->', ...args);
}