// Browser entry point — zero Node.js built-in dependencies.
// Vite/esbuild/webpack use this file instead of index.ts via
// the "browser" field in package.json, avoiding any import of `os`.

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
 * Not available in browser environments.
 * Obtain the IP server-side and pass it to the client, or use `loopback()` as a fallback.
 */
export function address(_name?: string, _family?: number | string): string {
  throw new Error(
    '[node-ip-ts] ip.address() uses the Node.js `os` module and cannot run in a browser. ' +
      'Use ip.loopback() as a fallback, or pass the IP from the server.',
  );
}
