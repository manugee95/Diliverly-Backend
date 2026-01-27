export const generateVerificationCode = (length = 6): string => {
  const n = Math.floor(Math.random() * 10 ** length);
  return n.toString().padStart(length, '0');
};
