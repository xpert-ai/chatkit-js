export function safeRandomUUID(): string {
  const cryptoRef = globalThis.crypto

  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID()
  }

  if (typeof cryptoRef?.getRandomValues === "function") {
    const bytes = new Uint8Array(16)
    cryptoRef.getRandomValues(bytes)

    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")
  }

  return `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`
}
