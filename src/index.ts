// Node.js entry point.
// Exports all pure functions from core.ts plus address() which uses the `os` module.
// Browser bundlers (Vite/esbuild/webpack) are redirected to index.browser.ts
// via the "browser" field in package.json, which never imports `os`.
import { networkInterfaces as _getNetworkInterfaces } from 'os';

import {
  normalizeFamily,
  isLoopback,
  isPublic,
  isPrivate,
  loopback,
} from './core.js';

export {
  toBuffer,
  toString,
  isV4Format,
  isV6Format,
  fromPrefixLen,
  mask,
  cidr,
  subnet,
  cidrSubnet,
  not,
  or,
  isEqual,
  isLoopback,
  isPrivate,
  isPublic,
  loopback,
  toLong,
  fromLong,
  normalizeToLong,
} from './core.js';

export type { IPFamily, SubnetInfo } from './core.js';

/**
 * Return a network interface address.
 * - `name`: interface name, `'public'`, `'private'`, or `undefined` (any private)
 * - `family`: `'ipv4'` (default) or `'ipv6'`
 */
export function address(name?: string, family?: number | string): string {
  const ifaces = _getNetworkInterfaces();
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
