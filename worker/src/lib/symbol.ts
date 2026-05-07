const PATTERN = /^[A-Z0-9]{4,6}$/;

export const validateSymbol = (input: string): string => {
  const upper = input.toUpperCase();
  if (!PATTERN.test(upper)) {
    throw new Error('invalid_symbol');
  }
  return upper;
};
