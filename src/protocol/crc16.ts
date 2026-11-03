// CRC-16/CCITT-FALSE (polynomial 0x1021, initial value 0xFFFF).
// Every packet to and from the keyboard carries one of these at bytes 6-7.

const TABLE = (() => {
  const table = new Uint16Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    }
    table[i] = crc & 0xffff
  }
  return table
})()

export function crc16(data: Uint8Array, start = 0, end = data.length): number {
  let crc = 0xffff
  for (let i = start; i < end; i++) {
    crc = (TABLE[(data[i] ^ (crc >> 8)) & 0xff] ^ (crc << 8)) & 0xffff
  }
  return crc
}
