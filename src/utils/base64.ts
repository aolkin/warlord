export function base64ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  let base64 = ""
  const encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

  const bytes = new Uint8Array(arrayBuffer)
  const byteLength = bytes.byteLength
  const byteRemainder = byteLength % 3
  const mainLength = byteLength - byteRemainder

  let a, b, c, d
  let chunk

  // Main loop deals with bytes in chunks of 3
  for (let i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63 // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + "=="
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + "="
  }

  return base64
}

/* \
|*|
|*|  Base64 / binary data / UTF-8 strings utilities
|*|
|*|  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Base64_encoding_and_decoding
|*|
\ */

/* Array of bytes to Base64 string decoding */

function b64ToUint6(nChr: number): number {
  return nChr > 64 && nChr < 91
    ? nChr - 65
    : nChr > 96 && nChr < 123
      ? nChr - 71
      : nChr > 47 && nChr < 58
        ? nChr + 4
        : nChr === 43
          ? 62
          : nChr === 47
            ? 63
            : 0
}

export function base64DecToArr(sBase64: string, nBlocksSize?: number): Uint8Array {
  const
    sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, "")
  const nInLen = sB64Enc.length
  const nOutLen = (nBlocksSize !== undefined && nBlocksSize !== 0)
    ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize
    : nInLen * 3 + 1 >> 2
  const taBytes = new Uint8Array(nOutLen)

  for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
    nMod4 = nInIdx & 3
    nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 6 * (3 - nMod4)
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
        taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255
      }
      nUint24 = 0
    }
  }

  return taBytes
}

/* Base64 string to array encoding */
function uint6ToB64(nUint6: number): number {
  return nUint6 < 26
    ? nUint6 + 65
    : nUint6 < 52
      ? nUint6 + 71
      : nUint6 < 62
        ? nUint6 - 4
        : nUint6 === 62
          ? 43
          : nUint6 === 63
            ? 47
            : 65
}

export function base64EncArr(aBytes: Uint8Array): string {
  let nMod3 = 2; let sB64Enc = ""

  for (let nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
    nMod3 = nIdx % 3
    if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n" }
    nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24)
    if (nMod3 === 2 || aBytes.length - nIdx === 1) {
      sB64Enc += String.fromCodePoint(uint6ToB64(nUint24 >>> 18 & 63), uint6ToB64(nUint24 >>> 12 & 63), uint6ToB64(nUint24 >>> 6 & 63), uint6ToB64(nUint24 & 63))
      nUint24 = 0
    }
  }

  return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) + (nMod3 === 2 ? "" : nMod3 === 1 ? "=" : "==")
}

/* UTF-8 array to DOMString and vice versa */
function UTF8ArrToStr(aBytes: Uint8Array): string {
  let sView = ""

  for (var nPart, nLen = aBytes.length, nIdx = 0; nIdx < nLen; nIdx++) {
    nPart = aBytes[nIdx]
    sView += String.fromCodePoint(
      nPart > 251 && nPart < 254 && nIdx + 5 < nLen /* six bytes */
        /* (nPart - 252 << 30) may be not so safe in ECMAScript! So...: */
        ? (nPart - 252) * 1073741824 + (aBytes[++nIdx] - 128 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
        : nPart > 247 && nPart < 252 && nIdx + 4 < nLen /* five bytes */
          ? (nPart - 248 << 24) + (aBytes[++nIdx] - 128 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
          : nPart > 239 && nPart < 248 && nIdx + 3 < nLen /* four bytes */
            ? (nPart - 240 << 18) + (aBytes[++nIdx] - 128 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
            : nPart > 223 && nPart < 240 && nIdx + 2 < nLen /* three bytes */
              ? (nPart - 224 << 12) + (aBytes[++nIdx] - 128 << 6) + aBytes[++nIdx] - 128
              : nPart > 191 && nPart < 224 && nIdx + 1 < nLen /* two bytes */
                ? (nPart - 192 << 6) + aBytes[++nIdx] - 128
                : nPart /* nPart < 127 ? */ /* one byte */
    )
  }

  return sView
}

function strToUTF8Arr(sDOMStr: string): Uint8Array {
  const nStrLen = sDOMStr.length
  let nArrLen = 0

  /* mapping... */

  for (let nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
    const nChr = sDOMStr.codePointAt(nMapIdx) ?? 0

    if (nChr > 65536) {
      nMapIdx++
    }

    nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6
  }

  const aBytes = new Uint8Array(nArrLen)

  /* transcription... */

  for (let nIdx = 0, nChrIdx = 0; nIdx < nArrLen; nChrIdx++) {
    const nChr = sDOMStr.codePointAt(nChrIdx) ?? 0
    if (nChr < 128) {
      /* one byte */
      aBytes[nIdx++] = nChr
    } else if (nChr < 0x800) {
      /* two bytes */
      aBytes[nIdx++] = 192 + (nChr >>> 6)
      aBytes[nIdx++] = 128 + (nChr & 63)
    } else if (nChr < 0x10000) {
      /* three bytes */
      aBytes[nIdx++] = 224 + (nChr >>> 12)
      aBytes[nIdx++] = 128 + (nChr >>> 6 & 63)
      aBytes[nIdx++] = 128 + (nChr & 63)
    } else if (nChr < 0x200000) {
      /* four bytes */
      aBytes[nIdx++] = 240 + (nChr >>> 18)
      aBytes[nIdx++] = 128 + (nChr >>> 12 & 63)
      aBytes[nIdx++] = 128 + (nChr >>> 6 & 63)
      aBytes[nIdx++] = 128 + (nChr & 63)
      nChrIdx++
    } else if (nChr < 0x4000000) {
      /* five bytes */
      aBytes[nIdx++] = 248 + (nChr >>> 24)
      aBytes[nIdx++] = 128 + (nChr >>> 18 & 63)
      aBytes[nIdx++] = 128 + (nChr >>> 12 & 63)
      aBytes[nIdx++] = 128 + (nChr >>> 6 & 63)
      aBytes[nIdx++] = 128 + (nChr & 63)
      nChrIdx++
    } else /* if (nChr <= 0x7fffffff) */ {
      /* six bytes */
      aBytes[nIdx++] = 252 + (nChr >>> 30)
      aBytes[nIdx++] = 128 + (nChr >>> 24 & 63)
      aBytes[nIdx++] = 128 + (nChr >>> 18 & 63)
      aBytes[nIdx++] = 128 + (nChr >>> 12 & 63)
      aBytes[nIdx++] = 128 + (nChr >>> 6 & 63)
      aBytes[nIdx++] = 128 + (nChr & 63)
      nChrIdx++
    }
  }

  return aBytes
}

export async function compressAndEncode(stringified: string): Promise<string | undefined> {
  // @ts-expect-error
  if (window.CompressionStream !== undefined) {
    const stringStream = new ReadableStream({
      start(controller) {
        const array = strToUTF8Arr(stringified)
        controller.enqueue(array.buffer)
        controller.close()
      }
    })
    // @ts-expect-error
    const compressedStream = stringStream.pipeThrough(new CompressionStream("gzip"))
    const reader = compressedStream.getReader()
    const result = { value: new Uint8Array(0), done: false }
    let read
    while (!(read = await reader.read() as { value: Uint8Array, done: boolean }).done) {
      const newValue = new Uint8Array(result.value.length + read.value.length)
      newValue.set(result.value)
      newValue.set(read.value, result.value.length)
      result.done = read.done
      result.value = newValue
    }
    return base64ArrayBuffer(result.value)
  }
}

export async function decodeAndDecompress(encoded: string): Promise<string | undefined> {
  const binArray = base64DecToArr(encoded)
  // @ts-expect-error
  if (window.DecompressionStream === undefined) {
    throw new Error("Unable to decompress, DecompressionStream API missing")
  }
  const binStream = new ReadableStream({
    start(controller) {
      controller.enqueue(binArray.buffer)
      controller.close()
    }
  })
  // @ts-expect-error
  const compressedStream = binStream.pipeThrough(new DecompressionStream("gzip"))
  const reader = compressedStream.getReader()
  const result = { value: "", done: false }
  let read
  while (!(read = await reader.read() as { value: Uint8Array, done: boolean }).done) {
    result.done = read.done
    result.value += UTF8ArrToStr(read.value)
  }
  return result.value
}
