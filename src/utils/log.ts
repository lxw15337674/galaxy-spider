export const log = (message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
  const now = new Date().toLocaleString();
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️',
  };
  console.log(`[${now}] ${icons[type]} ${message}`);
};
