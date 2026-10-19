/** Parse a CSS hex color or {r,g,b} in 0–1 to straight byte RGB. No gamma conversion. */
export function parseColor(input) {
  if (typeof input === 'string') {
    let hex = input.trim();
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return null;
    const n = Number.parseInt(hex, 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  if (Array.isArray(input) && input.length >= 3) {
    return [Number(input[0]), Number(input[1]), Number(input[2])];
  }
  if (input && typeof input === 'object' && 'r' in input) {
    return [Number(input.r), Number(input.g), Number(input.b)];
  }
  return null;
}

export function rgbToHex(r, g, b) {
  const channel = (value) => {
    const byte = Math.round(clampByte(value) * 255);
    return byte.toString(16).padStart(2, '0');
  };
  return '#' + channel(r) + channel(g) + channel(b);
}

function clampByte(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
