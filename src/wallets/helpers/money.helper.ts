function money(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) throw new Error('Invalid money');
  return v;
}
function to2(n: number) {
  return n.toFixed(2);
}
