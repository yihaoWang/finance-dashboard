// Find recent support / resistance from last N bars
export const supportResistance = (closes: number[], window = 20): { support: number; resistance: number } | null => {
  if (closes.length < window) return null;
  const recent = closes.slice(-window);
  return { support: Math.min(...recent), resistance: Math.max(...recent) };
};
