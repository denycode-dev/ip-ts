import { networkInterfaces } from 'os';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IPFamily = 'ipv4' | 'ipv6';

export interface SubnetInfo {
  networkAddress: string;
  firstAddress: string;
  lastAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  subnetMaskLength: number;
  numHosts: number;
  length: number;
  contains(other: string): boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normalizeFamily(family?: number | string): IPFamily {
  if (family === 4) return 'ipv4';
  if (family === 6) return 'ipv6';
  return family ? (family as string).toLowerCase() as IPFamily : 'ipv4';
}

// ─── Buffer ↔ String conversion ───────────────────────────────────────────────

/**
 * Convert an IP address string to a Buffer.
 * Optionally write into an existing buffer at a given offset.
 */
export function toBuffer(ip: string, buff?: Buffer, offset?: number): Buffer {
  const off = offset !== undefined ? ~~offset : 0;
  let result: Buffer;

  if (isV4Format(ip)) {
    result = buff ?? Buffer.alloc(off + 4);
    let pos = off;
    for (const byte of ip.split('.')) {
      result[pos++] = parseInt(byte, 10) & 0xff;
    }
    return result;
  }

  if (isV6Format(ip)) {
    const sections = ip.split(':', 8);

    for (let i = 0; i < sections.length; i++) {
      if (isV4Format(sections[i])) {
        const v4buf = toBuffer(sections[i]);
        sections[i] = v4buf.subarray(0, 2).toString('hex');
        if (++i < 8) {
          sections.splice(i, 0, v4buf.subarray(2, 4).toString('hex'));
        }
      }
    }

    // Expand ::
    if (sections[0] === '') {
      while (sections.length < 8) sections.unshift('0');
    } else if (sections[sections.length - 1] === '') {
      while (sections.length < 8) sections.push('0');
    } else if (sections.length < 8) {
      let emptyIdx = 0;
      for (; emptyIdx < sections.length && sections[emptyIdx] !== ''; emptyIdx++);
      const toInsert = 9 - sections.length;
      sections.splice(emptyIdx, 1, ...Array(toInsert).fill('0'));
    }

    result = buff ?? Buffer.alloc(off + 16);
    let pos = off;
    for (const section of sections) {
      const word = parseInt(section, 16);
      result[pos++] = (word >> 8) & 0xff;
      result[pos++] = word & 0xff;
    }
    return result;
  }

  throw new Error(`Invalid ip address: ${ip}`);
}

/**
 * Convert a Buffer back to an IP address string.
 */
export function toString(buff: Buffer, offset = 0, length?: number): string {
  const len = length ?? buff.length - offset;

  if (len === 4) {
    const parts: number[] = [];
    for (let i = 0; i < 4; i++) parts.push(buff[offset + i]);
    return parts.join('.');
  }

  if (len === 16) {
    const parts: string[] = [];
    for (let i = 0; i < 16; i += 2) {
      parts.push(buff.readUInt16BE(offset + i).toString(16));
    }
    let result = parts.join(':');
    result = result.replace(/(^|:)0(:0)*:0(:|$)/, '$1::$3');
    result = result.replace(/:{3,4}/, '::');
    return result;
  }

  return '';
}

// ─── Format detection ─────────────────────────────────────────────────────────

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX =
  /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

export function isV4Format(ip: string): boolean {
  return IPV4_REGEX.test(ip);
}

export function isV6Format(ip: string): boolean {
  return IPV6_REGEX.test(ip);
}

// ─── Mask / CIDR utilities ───────────────────────────────────────────────────

/**
 * Create a subnet mask from a prefix length.
 */
export function fromPrefixLen(prefixlen: number, family?: number | string): string {
  const fam = prefixlen > 32 ? 'ipv6' : normalizeFamily(family);
  const len = fam === 'ipv6' ? 16 : 4;
  const buff = Buffer.alloc(len);

  let remaining = prefixlen;
  for (let i = 0; i < len; i++) {
    const bits = Math.min(remaining, 8);
    remaining -= bits;
    buff[i] = ~(0xff >> bits) & 0xff;
  }

  return toString(buff);
}

/**
 * Apply a subnet mask to an address.
 */
export function mask(addr: string, maskStr: string): string {
  const addrBuf = toBuffer(addr);
  const maskBuf = toBuffer(maskStr);
  const result = Buffer.alloc(Math.max(addrBuf.length, maskBuf.length));

  if (addrBuf.length === maskBuf.length) {
    for (let i = 0; i < addrBuf.length; i++) {
      result[i] = addrBuf[i] & maskBuf[i];
    }
  } else if (maskBuf.length === 4) {
    // IPv6 address, IPv4 mask → mask low 4 bytes
    for (let i = 0; i < maskBuf.length; i++) {
      result[i] = addrBuf[addrBuf.length - 4 + i] & maskBuf[i];
    }
  } else {
    // IPv6 mask, IPv4 address → embed as ::ffff:ipv4
    for (let i = 0; i < result.length - 6; i++) result[i] = 0;
    result[10] = 0xff;
    result[11] = 0xff;
    for (let i = 0; i < addrBuf.length; i++) {
      result[i + 12] = addrBuf[i] & maskBuf[i + 12];
    }
  }

  return toString(result);
}

/**
 * Return the network address for a CIDR string (e.g. "192.168.1.1/24").
 */
export function cidr(cidrString: string): string {
  const [addr, prefixStr] = cidrString.split('/');
  if (!prefixStr) throw new Error(`invalid CIDR subnet: ${cidrString}`);
  return mask(addr, fromPrefixLen(parseInt(prefixStr, 10)));
}

/**
 * Compute full subnet information from address + mask.
 */
export function subnet(addr: string, subnetMask: string): SubnetInfo {
  const networkAddress = toLong(mask(addr, subnetMask));
  const maskBuf = toBuffer(subnetMask);

  let maskLength = 0;
  for (const byte of maskBuf) {
    if (byte === 0xff) {
      maskLength += 8;
    } else {
      let octet = byte & 0xff;
      while (octet) {
        octet = (octet << 1) & 0xff;
        maskLength++;
      }
    }
  }

  const numberOfAddresses = 2 ** (32 - maskLength);

  return {
    networkAddress: fromLong(networkAddress),
    firstAddress:
      numberOfAddresses <= 2
        ? fromLong(networkAddress)
        : fromLong(networkAddress + 1),
    lastAddress:
      numberOfAddresses <= 2
        ? fromLong(networkAddress + numberOfAddresses - 1)
        : fromLong(networkAddress + numberOfAddresses - 2),
    broadcastAddress: fromLong(networkAddress + numberOfAddresses - 1),
    subnetMask,
    subnetMaskLength: maskLength,
    numHosts: numberOfAddresses <= 2 ? numberOfAddresses : numberOfAddresses - 2,
    length: numberOfAddresses,
    contains(other: string): boolean {
      return networkAddress === toLong(mask(other, subnetMask));
    },
  };
}

/**
 * Compute full subnet information from a CIDR string.
 */
export function cidrSubnet(cidrString: string): SubnetInfo {
  const [addr, prefixStr] = cidrString.split('/');
  if (!prefixStr) throw new Error(`invalid CIDR subnet: ${cidrString}`);
  return subnet(addr, fromPrefixLen(parseInt(prefixStr, 10)));
}

// ─── Bitwise operations ───────────────────────────────────────────────────────

/** Bitwise NOT of an IP address. */
export function not(addr: string): string {
  const buff = toBuffer(addr);
  for (let i = 0; i < buff.length; i++) buff[i] ^= 0xff;
  return toString(buff);
}

/** Bitwise OR of two IP addresses (supports mixed protocol). */
export function or(a: string, b: string): string {
  let bufA = toBuffer(a);
  let bufB = toBuffer(b);

  if (bufA.length === bufB.length) {
    for (let i = 0; i < bufA.length; i++) bufA[i] |= bufB[i];
    return toString(bufA);
  }

  // Ensure bufLong is the longer buffer
  let bufLong = bufA.length > bufB.length ? bufA : bufB;
  const bufShort = bufA.length > bufB.length ? bufB : bufA;
  bufLong = Buffer.from(bufLong); // avoid mutating original ref

  const offset = bufLong.length - bufShort.length;
  for (let i = offset; i < bufLong.length; i++) {
    bufLong[i] |= bufShort[i - offset];
  }

  return toString(bufLong);
}

/** Deep equality check for two IP addresses (supports mixed IPv4/IPv6). */
export function isEqual(a: string, b: string): boolean {
  let bufA = toBuffer(a);
  let bufB = toBuffer(b);

  if (bufA.length === bufB.length) {
    for (let i = 0; i < bufA.length; i++) {
      if (bufA[i] !== bufB[i]) return false;
    }
    return true;
  }

  // Ensure bufA is IPv4 (shorter)
  if (bufB.length === 4) {
    const tmp = bufB;
    bufB = bufA;
    bufA = tmp;
  }

  for (let i = 0; i < 10; i++) {
    if (bufB[i] !== 0) return false;
  }

  const word = bufB.readUInt16BE(10);
  if (word !== 0 && word !== 0xffff) return false;

  for (let i = 0; i < 4; i++) {
    if (bufA[i] !== bufB[i + 12]) return false;
  }

  return true;
}

// ─── Address classification ───────────────────────────────────────────────────

/** Returns true if the address is a loopback address. */
export function isLoopback(addr: string): boolean {
  // Plain long integer (no dots or colons) → convert to dotted decimal
  if (!/\./.test(addr) && !/:/.test(addr)) {
    addr = fromLong(Number(addr));
  }

  return (
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/.test(addr) ||
    /^0177\./.test(addr) ||
    /^0x7f\./i.test(addr) ||
    /^fe80::1$/i.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  );
}

/** Returns true if the address is a private (RFC 1918 / ULA) address. */
export function isPrivate(addr: string): boolean {
  if (isLoopback(addr)) return true;

  // For IPv4-only addresses, normalize first
  if (!isV6Format(addr)) {
    const ipl = normalizeToLong(addr);
    if (ipl < 0) throw new Error('invalid ipv4 address');
    addr = fromLong(ipl);
  }

  return (
    /^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^f[cd][0-9a-f]{2}:/i.test(addr) ||
    /^fe80:/i.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  );
}

/** Returns true if the address is a publicly routable address. */
export function isPublic(addr: string): boolean {
  return !isPrivate(addr);
}

// ─── Loopback & address resolution ───────────────────────────────────────────

/** Return the loopback address for the given IP family. */
export function loopback(family?: number | string): string {
  const fam = normalizeFamily(family);
  if (fam !== 'ipv4' && fam !== 'ipv6') {
    throw new Error('family must be ipv4 or ipv6');
  }
  return fam === 'ipv4' ? '127.0.0.1' : 'fe80::1';
}

/**
 * Return a network interface address.
 * - `name`: interface name, `'public'`, `'private'`, or `undefined` (any private)
 * - `family`: `'ipv4'` (default) or `'ipv6'`
 */
export function address(name?: string, family?: number | string): string {
  const ifaces = networkInterfaces();
  const fam = normalizeFamily(family);

  if (name && name !== 'private' && name !== 'public') {
    const iface = ifaces[name];
    if (!iface) return loopback(fam);
    const match = iface.filter((d) => normalizeFamily(d.family) === fam);
    return match.length ? match[0].address : loopback(fam);
  }

  const all = Object.values(ifaces)
    .flat()
    .filter((d): d is NonNullable<typeof d> => {
      if (!d) return false;
      if (normalizeFamily(d.family) !== fam) return false;
      if (isLoopback(d.address)) return false;
      if (!name) return true;
      return name === 'public' ? isPublic(d.address) : isPrivate(d.address);
    })
    .map((d) => d.address);

  return all.length ? all[0] : loopback(fam);
}

// ─── Long integer conversion ──────────────────────────────────────────────────

/** Convert a dotted-decimal IPv4 address to a 32-bit unsigned integer. */
export function toLong(ip: string): number {
  let ipl = 0;
  for (const octet of ip.split('.')) {
    ipl = (ipl << 8) + parseInt(octet, 10);
  }
  return ipl >>> 0;
}

/** Convert a 32-bit unsigned integer to a dotted-decimal IPv4 address. */
export function fromLong(ipl: number): string {
  return [
    (ipl >>> 24) & 255,
    (ipl >>> 16) & 255,
    (ipl >>> 8) & 255,
    ipl & 255,
  ].join('.');
}

/**
 * Normalize an IPv4 address (supports decimal, octal, hex, and compact notations)
 * and return it as a 32-bit unsigned long. Returns -1 on error.
 */
export function normalizeToLong(addr: string): number {
  const parts = addr.split('.').map((part) => {
    if (part.startsWith('0x') || part.startsWith('0X')) {
      const v = parseInt(part, 16);
      return Number.isNaN(v) ? NaN : v;
    }
    if (part.startsWith('0') && part !== '0' && /^[0-7]+$/.test(part)) {
      return parseInt(part, 8);
    }
    if (/^[1-9]\d*$/.test(part) || part === '0') {
      return parseInt(part, 10);
    }
    return NaN;
  });

  if (parts.some(Number.isNaN)) return -1;

  const n = parts.length;
  let val = 0;

  switch (n) {
    case 1:
      val = parts[0];
      break;
    case 2:
      if (parts[0] > 0xff || parts[1] > 0xffffff) return -1;
      val = (parts[0] << 24) | (parts[1] & 0xffffff);
      break;
    case 3:
      if (parts[0] > 0xff || parts[1] > 0xff || parts[2] > 0xffff) return -1;
      val = (parts[0] << 24) | (parts[1] << 16) | (parts[2] & 0xffff);
      break;
    case 4:
      if (parts.some((p) => p > 0xff)) return -1;
      val = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
      break;
    default:
      return -1;
  }

  return val >>> 0;
}
