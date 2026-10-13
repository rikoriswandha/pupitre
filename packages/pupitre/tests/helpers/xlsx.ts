import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'

function checksum(bytes: Buffer): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Independent ZIP central-directory reader, deliberately not using the writer's CRC implementation. */
export function readXlsx(bytes: Buffer): Record<string, string> {
  const end = bytes.length - 22
  assert.equal(bytes.readUInt32LE(end), 0x06054b50)
  let offset = bytes.readUInt32LE(end + 16)
  const entries: Record<string, string> = {}
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50)
    assert.equal(bytes.readUInt16LE(offset + 10), 8)
    const compressedSize = bytes.readUInt32LE(offset + 20)
    const nameLength = bytes.readUInt16LE(offset + 28)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString()
    const local = bytes.readUInt32LE(offset + 42)
    assert.equal(bytes.readUInt32LE(local), 0x04034b50)
    const dataStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    const contents = inflateRawSync(bytes.subarray(dataStart, dataStart + compressedSize))
    assert.equal(contents.length, bytes.readUInt32LE(offset + 24))
    assert.equal(checksum(contents), bytes.readUInt32LE(offset + 16))
    const descriptor = dataStart + compressedSize
    assert.equal(bytes.readUInt32LE(descriptor), 0x08074b50)
    assert.equal(bytes.readUInt32LE(descriptor + 4), checksum(contents))
    assert.equal(bytes.readUInt32LE(descriptor + 8), compressedSize)
    assert.equal(bytes.readUInt32LE(descriptor + 12), contents.length)
    entries[name] = contents.toString()
    offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32)
  }
  assert.equal(offset, end)
  return entries
}
