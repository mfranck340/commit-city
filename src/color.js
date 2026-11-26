const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function parse(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

const toHex = (rgb) => '#' + rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');

/** Mix two hex colours. t=0 -> a, t=1 -> b */
export function mix(a, b, t) {
  const A = parse(a);
  const B = parse(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** amount > 0 lightens, amount < 0 darkens (range -1..1) */
export function shade(hex, amount) {
  return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount);
}
