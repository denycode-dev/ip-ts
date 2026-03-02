import { networkInterfaces } from "os";
import { isIPv4, isIPv6 } from "net";
import * as ip from "../src/index";

describe("IP library for node.js", () => {
  // ─── toBuffer / toString ───────────────────────────────────────────────────

  describe("toBuffer()/toString() methods", () => {
    it("should convert to buffer IPv4 address", () => {
      const buf = ip.toBuffer("127.0.0.1");
      expect(buf.toString("hex")).toBe("7f000001");
      expect(ip.toString(buf)).toBe("127.0.0.1");
    });

    it("should convert to buffer IPv4 address in-place", () => {
      const buf = Buffer.alloc(128);
      const offset = 64;
      ip.toBuffer("127.0.0.1", buf, offset);
      expect(buf.toString("hex", offset, offset + 4)).toBe("7f000001");
      expect(ip.toString(buf, offset, 4)).toBe("127.0.0.1");
    });

    it("should convert to buffer IPv6 address", () => {
      const buf = ip.toBuffer("::1");
      expect(/(00){15,15}01/.test(buf.toString("hex"))).toBe(true);
      expect(ip.toString(buf)).toBe("::1");
      expect(ip.toString(ip.toBuffer("1::"))).toBe("1::");
      expect(ip.toString(ip.toBuffer("abcd::dcba"))).toBe("abcd::dcba");
    });

    it("should convert to buffer IPv6 address in-place", () => {
      const buf = Buffer.alloc(128);
      const offset = 64;
      ip.toBuffer("::1", buf, offset);
      expect(
        /(00){15,15}01/.test(buf.toString("hex", offset, offset + 16)),
      ).toBe(true);
      expect(ip.toString(buf, offset, 16)).toBe("::1");
      expect(ip.toString(ip.toBuffer("1::", buf, offset), offset, 16)).toBe(
        "1::",
      );
      expect(
        ip.toString(ip.toBuffer("abcd::dcba", buf, offset), offset, 16),
      ).toBe("abcd::dcba");
    });

    it("should convert to buffer IPv6 mapped IPv4 address", () => {
      let buf = ip.toBuffer("::ffff:127.0.0.1");
      expect(buf.toString("hex")).toBe("00000000000000000000ffff7f000001");
      expect(ip.toString(buf)).toBe("::ffff:7f00:1");

      buf = ip.toBuffer("ffff::127.0.0.1");
      expect(buf.toString("hex")).toBe("ffff000000000000000000007f000001");
      expect(ip.toString(buf)).toBe("ffff::7f00:1");

      buf = ip.toBuffer("0:0:0:0:0:ffff:127.0.0.1");
      expect(buf.toString("hex")).toBe("00000000000000000000ffff7f000001");
      expect(ip.toString(buf)).toBe("::ffff:7f00:1");
    });
  });

  // ─── fromPrefixLen ─────────────────────────────────────────────────────────

  describe("fromPrefixLen() method", () => {
    it("should create IPv4 mask", () => {
      expect(ip.fromPrefixLen(24)).toBe("255.255.255.0");
    });
    it("should create IPv6 mask", () => {
      expect(ip.fromPrefixLen(64)).toBe("ffff:ffff:ffff:ffff::");
    });
    it("should create IPv6 mask explicitly", () => {
      expect(ip.fromPrefixLen(24, "IPV6")).toBe("ffff:ff00::");
    });
  });

  // ─── not ───────────────────────────────────────────────────────────────────

  describe("not() method", () => {
    it("should reverse bits in address", () => {
      expect(ip.not("255.255.255.0")).toBe("0.0.0.255");
    });
  });

  // ─── or ────────────────────────────────────────────────────────────────────

  describe("or() method", () => {
    it("should or bits in ipv4 addresses", () => {
      expect(ip.or("0.0.0.255", "192.168.1.10")).toBe("192.168.1.255");
    });
    it("should or bits in ipv6 addresses", () => {
      expect(ip.or("::ff", "::abcd:dcba:abcd:dcba")).toBe(
        "::abcd:dcba:abcd:dcff",
      );
    });
    it("should or bits in mixed addresses", () => {
      expect(ip.or("0.0.0.255", "::abcd:dcba:abcd:dcba")).toBe(
        "::abcd:dcba:abcd:dcff",
      );
    });
  });

  // ─── mask ──────────────────────────────────────────────────────────────────

  describe("mask() method", () => {
    it("should mask bits in address", () => {
      expect(ip.mask("192.168.1.134", "255.255.255.0")).toBe("192.168.1.0");
      expect(ip.mask("192.168.1.134", "::ffff:ff00")).toBe("::ffff:c0a8:100");
    });

    it("should not leak data", () => {
      for (let i = 0; i < 10; i++) {
        expect(ip.mask("::1", "0.0.0.0")).toBe("::");
      }
    });
  });

  // ─── subnet ────────────────────────────────────────────────────────────────

  describe("subnet() method", () => {
    const ipv4Subnet = ip.subnet("192.168.1.134", "255.255.255.192");

    it("should compute ipv4 network address", () => {
      expect(ipv4Subnet.networkAddress).toBe("192.168.1.128");
    });
    it("should compute ipv4 network's first address", () => {
      expect(ipv4Subnet.firstAddress).toBe("192.168.1.129");
    });
    it("should compute ipv4 network's last address", () => {
      expect(ipv4Subnet.lastAddress).toBe("192.168.1.190");
    });
    it("should compute ipv4 broadcast address", () => {
      expect(ipv4Subnet.broadcastAddress).toBe("192.168.1.191");
    });
    it("should compute ipv4 subnet number of addresses", () => {
      expect(ipv4Subnet.length).toBe(64);
    });
    it("should compute ipv4 subnet number of addressable hosts", () => {
      expect(ipv4Subnet.numHosts).toBe(62);
    });
    it("should compute ipv4 subnet mask", () => {
      expect(ipv4Subnet.subnetMask).toBe("255.255.255.192");
    });
    it("should compute ipv4 subnet mask's length", () => {
      expect(ipv4Subnet.subnetMaskLength).toBe(26);
    });
    it("should know whether a subnet contains an address", () => {
      expect(ipv4Subnet.contains("192.168.1.180")).toBe(true);
    });
    it("should know whether a subnet does not contain an address", () => {
      expect(ipv4Subnet.contains("192.168.1.195")).toBe(false);
    });
  });

  describe("subnet() method with mask length 32", () => {
    const ipv4Subnet = ip.subnet("192.168.1.134", "255.255.255.255");

    it("should compute ipv4 network's first address", () => {
      expect(ipv4Subnet.firstAddress).toBe("192.168.1.134");
    });
    it("should compute ipv4 network's last address", () => {
      expect(ipv4Subnet.lastAddress).toBe("192.168.1.134");
    });
    it("should compute ipv4 subnet number of addressable hosts", () => {
      expect(ipv4Subnet.numHosts).toBe(1);
    });
  });

  describe("subnet() method with mask length 31", () => {
    const ipv4Subnet = ip.subnet("192.168.1.134", "255.255.255.254");

    it("should compute ipv4 network's first address", () => {
      expect(ipv4Subnet.firstAddress).toBe("192.168.1.134");
    });
    it("should compute ipv4 network's last address", () => {
      expect(ipv4Subnet.lastAddress).toBe("192.168.1.135");
    });
    it("should compute ipv4 subnet number of addressable hosts", () => {
      expect(ipv4Subnet.numHosts).toBe(2);
    });
  });

  // ─── cidrSubnet ────────────────────────────────────────────────────────────

  describe("cidrSubnet() method", () => {
    const ipv4Subnet = ip.cidrSubnet("192.168.1.134/26");

    it("should compute an ipv4 network address", () => {
      expect(ipv4Subnet.networkAddress).toBe("192.168.1.128");
    });
    it("should compute an ipv4 network's first address", () => {
      expect(ipv4Subnet.firstAddress).toBe("192.168.1.129");
    });
    it("should compute an ipv4 network's last address", () => {
      expect(ipv4Subnet.lastAddress).toBe("192.168.1.190");
    });
    it("should compute an ipv4 broadcast address", () => {
      expect(ipv4Subnet.broadcastAddress).toBe("192.168.1.191");
    });
    it("should compute an ipv4 subnet number of addresses", () => {
      expect(ipv4Subnet.length).toBe(64);
    });
    it("should compute an ipv4 subnet number of addressable hosts", () => {
      expect(ipv4Subnet.numHosts).toBe(62);
    });
    it("should compute an ipv4 subnet mask", () => {
      expect(ipv4Subnet.subnetMask).toBe("255.255.255.192");
    });
    it("should compute an ipv4 subnet mask's length", () => {
      expect(ipv4Subnet.subnetMaskLength).toBe(26);
    });
    it("should know whether a subnet contains an address", () => {
      expect(ipv4Subnet.contains("192.168.1.180")).toBe(true);
    });
    it("should know whether a subnet does not contain an address", () => {
      expect(ipv4Subnet.contains("192.168.1.195")).toBe(false);
    });
  });

  // ─── cidr ──────────────────────────────────────────────────────────────────

  describe("cidr() method", () => {
    it("should mask address in CIDR notation", () => {
      expect(ip.cidr("192.168.1.134/26")).toBe("192.168.1.128");
      expect(ip.cidr("2607:f0d0:1002:51::4/56")).toBe("2607:f0d0:1002::");
    });
  });

  // ─── isEqual ───────────────────────────────────────────────────────────────

  describe("isEqual() method", () => {
    it("should check if addresses are equal", () => {
      expect(ip.isEqual("127.0.0.1", "::7f00:1")).toBe(true);
      expect(ip.isEqual("127.0.0.1", "::7f00:2")).toBe(false);
      expect(ip.isEqual("127.0.0.1", "::ffff:7f00:1")).toBe(true);
      expect(ip.isEqual("127.0.0.1", "::ffaf:7f00:1")).toBe(false);
      expect(ip.isEqual("::ffff:127.0.0.1", "::ffff:127.0.0.1")).toBe(true);
      expect(ip.isEqual("::ffff:127.0.0.1", "127.0.0.1")).toBe(true);
    });
  });

  // ─── normalizeToLong ───────────────────────────────────────────────────────

  describe("normalizeIpv4() method", () => {
    it('should correctly normalize "127.0.0.1"', () => {
      expect(ip.normalizeToLong("127.0.0.1")).toBe(2130706433);
    });
    it('should correctly handle "127.1" as two parts', () => {
      expect(ip.normalizeToLong("127.1")).toBe(2130706433);
    });
    it('should correctly handle "127.0.1" as three parts', () => {
      expect(ip.normalizeToLong("127.0.1")).toBe(2130706433);
    });
    it('should correctly handle hexadecimal notation "0x7f.0x0.0x0.0x1"', () => {
      expect(ip.normalizeToLong("0x7f.0x0.0x0.0x1")).toBe(2130706433);
    });
    it('should correctly handle "0x7f000001" as a single part', () => {
      expect(ip.normalizeToLong("0x7f000001")).toBe(2130706433);
    });
    it('should correctly handle octal notation "010.0.0.01"', () => {
      expect(ip.normalizeToLong("010.0.0.01")).toBe(134217729);
    });
    it('should return -1 for an invalid address "256.100.50.25"', () => {
      expect(ip.normalizeToLong("256.100.50.25")).toBe(-1);
    });
    it('should return -1 for an address with invalid octal "019.0.0.1"', () => {
      expect(ip.normalizeToLong("019.0.0.1")).toBe(-1);
    });
    it('should return -1 for an address with invalid hex "0xGG.0.0.1"', () => {
      expect(ip.normalizeToLong("0xGG.0.0.1")).toBe(-1);
    });
    it("should return -1 for an empty string", () => {
      expect(ip.normalizeToLong("")).toBe(-1);
    });
    it('should return -1 for a string with too many parts "192.168.0.1.100"', () => {
      expect(ip.normalizeToLong("192.168.0.1.100")).toBe(-1);
    });
  });

  // ─── isPrivate ─────────────────────────────────────────────────────────────

  describe("isPrivate() method", () => {
    it("should check if an address is localhost", () => {
      expect(ip.isPrivate("127.0.0.1")).toBe(true);
    });
    it("should check if an address is from a 192.168.x.x network", () => {
      expect(ip.isPrivate("192.168.0.123")).toBe(true);
      expect(ip.isPrivate("192.168.122.123")).toBe(true);
      expect(ip.isPrivate("192.162.1.2")).toBe(false);
    });
    it("should check if an address is from a 172.16.x.x network", () => {
      expect(ip.isPrivate("172.16.0.5")).toBe(true);
      expect(ip.isPrivate("172.16.123.254")).toBe(true);
      expect(ip.isPrivate("171.16.0.5")).toBe(false);
      expect(ip.isPrivate("172.25.232.15")).toBe(true);
      expect(ip.isPrivate("172.15.0.5")).toBe(false);
      expect(ip.isPrivate("172.32.0.5")).toBe(false);
    });
    it("should check if an address is from a 169.254.x.x network", () => {
      expect(ip.isPrivate("169.254.2.3")).toBe(true);
      expect(ip.isPrivate("169.254.221.9")).toBe(true);
      expect(ip.isPrivate("168.254.2.3")).toBe(false);
    });
    it("should check if an address is from a 10.x.x.x network", () => {
      expect(ip.isPrivate("10.0.2.3")).toBe(true);
      expect(ip.isPrivate("10.1.23.45")).toBe(true);
      expect(ip.isPrivate("12.1.2.3")).toBe(false);
    });
    it("should check if an address is from a private IPv6 network", () => {
      expect(ip.isPrivate("fd12:3456:789a:1::1")).toBe(true);
      expect(ip.isPrivate("fe80::f2de:f1ff:fe3f:307e")).toBe(true);
      expect(ip.isPrivate("::ffff:10.100.1.42")).toBe(true);
      expect(ip.isPrivate("::FFFF:172.16.200.1")).toBe(true);
      expect(ip.isPrivate("::ffff:192.168.0.1")).toBe(true);
    });
    it("should check if an address is from the internet", () => {
      expect(ip.isPrivate("165.225.132.33")).toBe(false);
    });
    it("should check if an address is a loopback IPv6 address", () => {
      expect(ip.isPrivate("::")).toBe(true);
      expect(ip.isPrivate("::1")).toBe(true);
      expect(ip.isPrivate("fe80::1")).toBe(true);
    });
    it("should correctly identify hexadecimal IP addresses like '0x7f.1' as private", () => {
      expect(ip.isPrivate("0x7f.1")).toBe(true);
    });
  });

  // ─── loopback ──────────────────────────────────────────────────────────────

  describe("loopback() method", () => {
    describe("undefined", () => {
      it("should respond with 127.0.0.1", () => {
        expect(ip.loopback()).toBe("127.0.0.1");
      });
    });
    describe("ipv4", () => {
      it("should respond with 127.0.0.1", () => {
        expect(ip.loopback("ipv4")).toBe("127.0.0.1");
      });
    });
    describe("ipv6", () => {
      it("should respond with fe80::1", () => {
        expect(ip.loopback("ipv6")).toBe("fe80::1");
      });
    });
  });

  // ─── isLoopback ────────────────────────────────────────────────────────────

  describe("isLoopback() method", () => {
    it("127.0.0.1 should respond with true", () => {
      expect(ip.isLoopback("127.0.0.1")).toBe(true);
    });
    it("127.8.8.8 should respond with true", () => {
      expect(ip.isLoopback("127.8.8.8")).toBe(true);
    });
    it("8.8.8.8 should respond with false", () => {
      expect(ip.isLoopback("8.8.8.8")).toBe(false);
    });
    it("fe80::1 should respond with true", () => {
      expect(ip.isLoopback("fe80::1")).toBe(true);
    });
    it("::1 should respond with true", () => {
      expect(ip.isLoopback("::1")).toBe(true);
    });
    it(":: should respond with true", () => {
      expect(ip.isLoopback("::")).toBe(true);
    });
  });

  // ─── address ───────────────────────────────────────────────────────────────

  describe("address() method", () => {
    describe("undefined", () => {
      it("should respond with a private ip", () => {
        expect(ip.isPrivate(ip.address())).toBe(true);
      });
    });

    describe("private", () => {
      ([undefined, "ipv4", "ipv6"] as const).forEach((family) => {
        describe(family ?? "undefined", () => {
          it("should respond with a private ip", () => {
            expect(ip.isPrivate(ip.address("private", family))).toBe(true);
          });
        });
      });
    });

    const ifaces = networkInterfaces();
    Object.keys(ifaces).forEach((nic) => {
      describe(nic, () => {
        ([undefined, "ipv4"] as const).forEach((family) => {
          describe(family ?? "undefined", () => {
            it("should respond with an ipv4 address", () => {
              const addr = ip.address(nic, family);
              expect(!addr || isIPv4(addr)).toBe(true);
            });
          });
        });

        describe("ipv6", () => {
          it("should respond with an ipv6 address", () => {
            const addr = ip.address(nic, "ipv6");
            expect(!addr || isIPv6(addr)).toBe(true);
          });
        });
      });
    });
  });

  // ─── toLong / fromLong ─────────────────────────────────────────────────────

  describe("toLong() method", () => {
    it("should respond with a int", () => {
      expect(ip.toLong("127.0.0.1")).toBe(2130706433);
      expect(ip.toLong("255.255.255.255")).toBe(4294967295);
    });
  });

  describe("fromLong() method", () => {
    it("should respond with ipv4 address", () => {
      expect(ip.fromLong(2130706433)).toBe("127.0.0.1");
      expect(ip.fromLong(4294967295)).toBe("255.255.255.255");
    });
  });

  // ─── Alternate notations ───────────────────────────────────────────────────

  it('should return true for octal representation "0177.0.0.1"', () => {
    expect(ip.isLoopback("0177.0.0.1")).toBe(true);
  });
  it('should return true for octal representation "0177.0.1"', () => {
    expect(ip.isLoopback("0177.0.1")).toBe(true);
  });
  it('should return true for octal representation "0177.1"', () => {
    expect(ip.isLoopback("0177.1")).toBe(true);
  });
  it('should return true for hexadecimal representation "0x7f.0.0.1"', () => {
    expect(ip.isLoopback("0x7f.0.0.1")).toBe(true);
  });
  it('should return true for hexadecimal representation "0x7f.0.1"', () => {
    expect(ip.isLoopback("0x7f.0.1")).toBe(true);
  });
  it('should return true for hexadecimal representation "0x7f.1"', () => {
    expect(ip.isLoopback("0x7f.1")).toBe(true);
  });
  it('should return true for single long integer representation "2130706433"', () => {
    expect(ip.isLoopback("2130706433")).toBe(true);
  });
  it('should return false for "192.168.1.1"', () => {
    expect(ip.isLoopback("192.168.1.1")).toBe(false);
  });
});
