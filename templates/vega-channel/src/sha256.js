export function sha256(text) {
  const bytes = [];
  for (const character of text) {
    const point = character.codePointAt(0);
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800) bytes.push(0xc0 | point >> 6, 0x80 | point & 63);
    else if (point < 0x10000) bytes.push(0xe0 | point >> 12, 0x80 | point >> 6 & 63, 0x80 | point & 63);
    else bytes.push(0xf0 | point >> 18, 0x80 | point >> 12 & 63, 0x80 | point >> 6 & 63, 0x80 | point & 63);
  }
  const length = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(length * 8 / 0x100000000);
  const low = length * 8 >>> 0;
  for (const word of [high, low]) for (let shift = 24; shift >= 0; shift -= 8) bytes.push(word >>> shift & 255);
  const primes = [];
  for (let candidate = 2; primes.length < 64; candidate++) {
    if (primes.every(prime => candidate % prime !== 0)) primes.push(candidate);
  }
  const fractional = number => (number - Math.floor(number)) * 0x100000000 >>> 0;
  const constants = primes.map(prime => fractional(Math.cbrt(prime)));
  const state = primes.slice(0, 8).map(prime => fractional(Math.sqrt(prime)));
  const rotate = (word, bits) => word >>> bits | word << 32 - bits;
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = [];
    for (let index = 0; index < 16; index++) {
      const at = offset + index * 4;
      words.push((bytes[at] << 24 | bytes[at + 1] << 16 | bytes[at + 2] << 8 | bytes[at + 3]) >>> 0);
    }
    for (let index = 16; index < 64; index++) {
      const earlier = words[index - 15];
      const later = words[index - 2];
      words.push((words[index - 16] + (rotate(earlier, 7) ^ rotate(earlier, 18) ^ earlier >>> 3) +
        words[index - 7] + (rotate(later, 17) ^ rotate(later, 19) ^ later >>> 10)) >>> 0);
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const upper = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const first = (h + upper + (e & f ^ ~e & g) + constants[index] + words[index]) >>> 0;
      const lower = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const second = (lower + (a & b ^ a & c ^ b & c)) >>> 0;
      h = g; g = f; f = e; e = d + first >>> 0;
      d = c; c = b; b = a; a = first + second >>> 0;
    }
    for (const [index, word] of [a, b, c, d, e, f, g, h].entries()) state[index] = state[index] + word >>> 0;
  }
  return state.map(word => word.toString(16).padStart(8, '0')).join('');
}
