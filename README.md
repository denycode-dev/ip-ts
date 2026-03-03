<div align="center">

<br />

```
  ___ ____       _____ ____
 |_ _|  _ \     |_   _/ ___|
  | || |_) |_____| | \___ \
  | ||  __/_____| |  ___) |
 |___|_|        |_| |____/
```

### A modern, type-safe IP address utility library for Node.js

# node-ip-ts

<!-- Package Info -->
[![npm version](https://img.shields.io/npm/v/node-ip-ts?color=0ea5e9&style=flat-square)](https://www.npmjs.com/package/node-ip-ts)
[![npm downloads](https://img.shields.io/npm/dw/node-ip-ts?color=0ea5e9&style=flat-square)](https://www.npmjs.com/package/node-ip-ts)
[![license](https://img.shields.io/npm/l/node-ip-ts?color=0ea5e9&style=flat-square)](./LICENSE)

<!-- Tech Quality -->
[![TypeScript](https://img.shields.io/npm/types/node-ip-ts?style=flat-square)](https://www.npmjs.com/package/node-ip-ts)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)](./package.json)

<!-- Security -->
[![Snyk Security](https://snyk.io/test/github/denycode-dev/ip-ts/badge.svg?style=flat-square)](https://snyk.io/test/github/denycode-dev/ip-ts)
[![Socket Security](https://badge.socket.dev/npm/package/node-ip-ts)](https://socket.dev/npm/package/node-ip-ts)

<br />

**node-ip-ts** is a full TypeScript rewrite of the popular [`ip`](https://www.npmjs.com/package/ip) package —  
rebuilt from the ground up with strict types, ES Modules, and zero external dependencies.

[Installation](#installation) · [Quick Start](#quick-start) · [API Reference](#api-reference) · [Contributing](#contributing)

<br />

</div>

---

## Why node-ip-ts?

The original `ip` package has millions of weekly downloads but ships no TypeScript types and only supports CommonJS. **node-ip-ts** solves that:

| | `ip` | `node-ip-ts` |
|---|:---:|:---:|
| TypeScript support | ❌ | ✅ |
| ES Module support | ❌ | ✅ |
| CommonJS support | ✅ | ✅ |
| Type declarations | ❌ | ✅ |
| Strict null checks | ❌ | ✅ |
| External dependencies | 0 | 0 |
| API compatibility | — | ✅ drop-in |

---

## Browser Compatibility

All functions **except `address()`** work in both Node.js and browser/bundler environments (Vite, webpack, esbuild, etc.).

| Function | Node.js | Browser |
|---|:---:|:---:|
| All IP/subnet/bitwise functions | ✅ | ✅ |
| `loopback()` | ✅ | ✅ |
| `address()` | ✅ | ❌ (uses `os` module) |

If you need an IP in a browser context, obtain it server-side and pass it to the client, or use `loopback()` as a fallback.

---

## Installation

```bash
# npm
npm install node-ip-ts

# pnpm
pnpm add node-ip-ts

# yarn
yarn add node-ip-ts
```

> **Requirements:** Node.js ≥ 16

---

## Quick Start

### ESM / TypeScript

```ts
import * as ip from 'node-ip-ts';

// Address classification
ip.isPrivate('192.168.1.1');   // true
ip.isPublic('8.8.8.8');        // true
ip.isLoopback('127.0.0.1');    // true

// Subnet operations
ip.cidr('192.168.1.134/26');   // '192.168.1.128'
const subnet = ip.cidrSubnet('192.168.1.134/26');
subnet.contains('192.168.1.180');  // true

// Conversion
ip.toLong('255.255.255.255');  // 4294967295
ip.fromLong(4294967295);       // '255.255.255.255'
```

### Named imports (tree-shakeable)

```ts
import { isPrivate, cidrSubnet, toLong } from 'node-ip-ts';
```

### CommonJS

```js
const ip = require('node-ip-ts');
ip.isPrivate('10.0.0.1'); // true
```

---

## API Reference

### Address Classification

#### `isPrivate(addr: string): boolean`

Returns `true` if the address falls within any private/reserved range:
- `10.0.0.0/8` — RFC 1918
- `172.16.0.0/12` — RFC 1918
- `192.168.0.0/16` — RFC 1918
- `169.254.0.0/16` — link-local
- `fc00::/7` — IPv6 ULA
- `fe80::/10` — IPv6 link-local
- `::1`, `::` — loopback

```ts
ip.isPrivate('192.168.0.1');           // true
ip.isPrivate('10.0.0.1');              // true
ip.isPrivate('fd12:3456:789a:1::1');   // true  (IPv6 ULA)
ip.isPrivate('::ffff:192.168.0.1');    // true  (IPv4-mapped IPv6)
ip.isPrivate('8.8.8.8');               // false
```

#### `isPublic(addr: string): boolean`

Inverse of `isPrivate`. Returns `true` for publicly routable addresses.

```ts
ip.isPublic('1.1.1.1');      // true
ip.isPublic('10.0.0.1');     // false
```

#### `isLoopback(addr: string): boolean`

Returns `true` for loopback addresses. Supports dotted-decimal, octal, hexadecimal, and long-integer notation.

```ts
ip.isLoopback('127.0.0.1');    // true
ip.isLoopback('::1');          // true
ip.isLoopback('0x7f.0.0.1');   // true  (hex notation)
ip.isLoopback('0177.0.0.1');   // true  (octal notation)
ip.isLoopback('2130706433');   // true  (integer notation)
ip.isLoopback('8.8.8.8');      // false
```

#### `isV4Format(ip: string): boolean`

```ts
ip.isV4Format('192.168.0.1');  // true
ip.isV4Format('::1');          // false
```

#### `isV6Format(ip: string): boolean`

```ts
ip.isV6Format('::1');                   // true
ip.isV6Format('::ffff:192.168.0.1');    // true
ip.isV6Format('192.168.0.1');           // false
```

---

### Subnet & CIDR

#### `cidr(cidrString: string): string`

Returns the network address for a given CIDR string.

```ts
ip.cidr('192.168.1.134/26');        // '192.168.1.128'
ip.cidr('2607:f0d0:1002:51::4/56'); // '2607:f0d0:1002::'
```

#### `cidrSubnet(cidrString: string): SubnetInfo`

Returns a full `SubnetInfo` object for a given CIDR string.

```ts
const s = ip.cidrSubnet('192.168.1.134/26');

s.networkAddress;    // '192.168.1.128'
s.firstAddress;      // '192.168.1.129'
s.lastAddress;       // '192.168.1.190'
s.broadcastAddress;  // '192.168.1.191'
s.subnetMask;        // '255.255.255.192'
s.subnetMaskLength;  // 26
s.numHosts;          // 62
s.length;            // 64
s.contains('192.168.1.150'); // true
s.contains('192.168.1.200'); // false
```

#### `subnet(addr: string, mask: string): SubnetInfo`

Same as `cidrSubnet` but takes address and mask separately.

```ts
const s = ip.subnet('192.168.1.134', '255.255.255.192');
```

#### `mask(addr: string, mask: string): string`

Applies a subnet mask to an address via bitwise AND.

```ts
ip.mask('192.168.1.134', '255.255.255.0');  // '192.168.1.0'
ip.mask('192.168.1.134', '::ffff:ff00');    // '::ffff:c0a8:100'
```

#### `fromPrefixLen(prefixlen: number, family?: string | number): string`

Converts a prefix length to a subnet mask string.

```ts
ip.fromPrefixLen(24);         // '255.255.255.0'
ip.fromPrefixLen(64);         // 'ffff:ffff:ffff:ffff::'  (auto-detects IPv6)
ip.fromPrefixLen(24, 'ipv6'); // 'ffff:ff00::'
```

---

### Bitwise Operations

#### `not(addr: string): string`

Bitwise NOT — useful for computing wildcard masks.

```ts
ip.not('255.255.255.0');  // '0.0.0.255'
```

#### `or(a: string, b: string): string`

Bitwise OR. Supports same-protocol and mixed IPv4/IPv6 inputs.

```ts
ip.or('0.0.0.255', '192.168.1.10');           // '192.168.1.255'
ip.or('::ff', '::abcd:dcba:abcd:dcba');        // '::abcd:dcba:abcd:dcff'
ip.or('0.0.0.255', '::abcd:dcba:abcd:dcba');   // '::abcd:dcba:abcd:dcff'
```

#### `isEqual(a: string, b: string): boolean`

Deep equality check, IPv4/IPv6 aware (e.g. `127.0.0.1` equals `::ffff:7f00:1`).

```ts
ip.isEqual('127.0.0.1', '::ffff:127.0.0.1');  // true
ip.isEqual('127.0.0.1', '::7f00:1');           // true
ip.isEqual('127.0.0.1', '::7f00:2');           // false
```

---

### Buffer Conversion

#### `toBuffer(ip: string, buff?: Buffer, offset?: number): Buffer`

Converts an IP string to a raw `Buffer` (4 bytes for IPv4, 16 for IPv6). Optionally writes into an existing buffer at a given offset.

```ts
ip.toBuffer('127.0.0.1');
// <Buffer 7f 00 00 01>

const buf = Buffer.alloc(128);
ip.toBuffer('127.0.0.1', buf, 64);
// writes 4 bytes into buf at offset 64
```

#### `toString(buff: Buffer, offset?: number, length?: number): string`

Converts a `Buffer` back to an IP address string.

```ts
ip.toString(Buffer.from('7f000001', 'hex'));  // '127.0.0.1'
ip.toString(buf, 64, 4);                      // '127.0.0.1'
```

---

### Long Integer Conversion

#### `toLong(ip: string): number`

Converts a dotted-decimal IPv4 address to an unsigned 32-bit integer.

```ts
ip.toLong('127.0.0.1');        // 2130706433
ip.toLong('255.255.255.255');  // 4294967295
```

#### `fromLong(ipl: number): string`

Converts an unsigned 32-bit integer back to dotted-decimal.

```ts
ip.fromLong(2130706433);  // '127.0.0.1'
ip.fromLong(4294967295);  // '255.255.255.255'
```

#### `normalizeToLong(addr: string): number`

Normalizes an IPv4 address in any notation (decimal, octal, hex, compact) to an unsigned long. Returns `-1` on invalid input.

```ts
ip.normalizeToLong('127.0.0.1');       // 2130706433  (standard)
ip.normalizeToLong('0x7f.0x0.0x0.1'); // 2130706433  (hex)
ip.normalizeToLong('0177.0.0.01');     // 2130706433  (octal)
ip.normalizeToLong('0x7f000001');      // 2130706433  (single hex)
ip.normalizeToLong('127.1');           // 2130706433  (compact)
ip.normalizeToLong('256.0.0.1');       // -1          (invalid)
```

---

### Network Interface

#### `address(name?: string, family?: string | number): string`

> ⚠️ **Node.js only.** This function uses the `os` module which is not available in browsers.  
> Calling it in a browser environment will throw a descriptive error. All other functions work in both environments.

Returns an IP address from the current machine's network interfaces.

```ts
ip.address();             // first private IPv4 address, e.g. '192.168.1.42'
ip.address('public');     // first public IPv4 address
ip.address('private');    // first private IPv4 address
ip.address('eth0');       // first IPv4 address on eth0
ip.address('eth0', 6);   // first IPv6 address on eth0
```

Falls back to `loopback()` if no matching interface is found.

#### `loopback(family?: string | number): string`

Returns the loopback address for the given IP family.

```ts
ip.loopback();       // '127.0.0.1'
ip.loopback('ipv4'); // '127.0.0.1'
ip.loopback('ipv6'); // 'fe80::1'
```

---

### Types

```ts
import type { IPFamily, SubnetInfo } from 'node-ip-ts';

type IPFamily = 'ipv4' | 'ipv6';

interface SubnetInfo {
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
```

---

## Project Structure

```
node-ip-ts/
├── src/
│   └── index.ts          # Single source file — all named exports
├── dist/
│   ├── esm/              # ES Module build (.js + .js.map)
│   ├── cjs/              # CommonJS build (.js + .js.map)
│   └── types/            # Type declarations (.d.ts + .d.ts.map)
├── __tests__/
│   └── ip.test.ts        # Jest test suite
├── tsconfig.esm.json
├── tsconfig.cjs.json
├── tsconfig.types.json
└── package.json
```

---

## Contributing

Contributions are welcome! Here's how to get started:

```bash
# Clone the repo
git clone https://github.com/denycode-dev/ip-ts.git
cd node-ip-ts

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

### Guidelines

- All changes must pass the existing test suite (`npm test`)
- New features must include corresponding tests
- Code must pass TypeScript strict mode
- Keep zero external runtime dependencies

### Reporting Issues

Please [open an issue](https://github.com/denycode-dev/ip-ts/issues/new) with a minimal reproduction case.

---

## Migration from `ip`

**node-ip-ts** is designed to be a drop-in replacement. Simply swap your import:

```diff
- const ip = require('ip');
+ const ip = require('node-ip-ts');
```

Or for TypeScript / ESM:

```ts
import * as ip from 'node-ip-ts';
```

All function names and behaviours are identical to the original library.

---

## License

[MIT](./LICENSE) © Deni Irawan Nugraha

---

<div align="center">
  <sub>If this library saved you time, consider giving it a ⭐ on GitHub.</sub>
</div>
