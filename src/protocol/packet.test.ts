import { describe, expect, it } from 'vitest'
import { crc16 } from './crc16'
import { buildPacket, hasValidCrc } from './packet'

describe('crc16', () => {
  it('is CRC-16/CCITT-FALSE (the standard check value)', () => {
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0x29b1)
  })
})

describe('buildPacket', () => {
  it('puts the command, sub-command and data where the keyboard expects them', () => {
    const p = buildPacket(0x22, 1, Uint8Array.of(0xaa, 0xbb), { offset: 0x0138, length: 2 })
    expect(p.length).toBe(64)
    expect([...p.slice(0, 6)]).toEqual([0x22, 1, 0x38, 0x01, 2, 0])
    expect([...p.slice(8, 11)]).toEqual([0xaa, 0xbb, 0])
    expect(hasValidCrc(p)).toBe(true)
  })

  it('uses the wide header for big blocks: 24-bit offset in bytes 2–4, length in byte 5', () => {
    const p = buildPacket(0x27, 1, new Uint8Array(56), { offset: 0x012345, length: 56, wide: true })
    expect([...p.slice(2, 6)]).toEqual([0x45, 0x23, 0x01, 56])
    expect(hasValidCrc(p)).toBe(true)
  })

  it('stores the CRC little-endian in bytes 6–7, computed with those bytes zeroed', () => {
    const p = buildPacket(0x01, 0x08)
    const copy = p.slice()
    copy[6] = 0
    copy[7] = 0
    expect(p[6] | (p[7] << 8)).toBe(crc16(copy))
    p[9] ^= 1
    expect(hasValidCrc(p)).toBe(false)
  })
})
