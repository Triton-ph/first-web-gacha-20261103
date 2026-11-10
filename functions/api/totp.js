function base32ToBytes(base32) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleanStr = base32.toUpperCase().replace(/=+$/, "");
    let bits = 0, value = 0, output = [];
    for (let i = 0; i < cleanStr.length; i++) {
        const idx = alphabet.indexOf(cleanStr[i]);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(output);
}

async function generateHOTP(secretBytes, counter) {
    const counterBuffer = new ArrayBuffer(8);
    new DataView(counterBuffer).setBigUint64(0, BigInt(counter), false);
    const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: { name: "SHA-1" } }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, counterBuffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0x0f;
    const code = (((sigBytes[offset] & 0x7f) << 24) | ((sigBytes[offset + 1] & 0xff) << 16) | ((sigBytes[offset + 2] & 0xff) << 8) | (sigBytes[offset + 3] & 0xff)) % 1000000;
    return code.toString().padStart(6, "0");
}

export async function verifyTOTP(secretBase32, inputCode) {
    if (!secretBase32 || !inputCode) return false;
    const secretBytes = base32ToBytes(secretBase32);
    const currentCounter = Math.floor(Math.floor(Date.now() / 1000) / 30);
    for (let window = -1; window <= 1; window++) {
        const expectedCode = await generateHOTP(secretBytes, currentCounter + window);
        if (expectedCode === inputCode.trim()) return true;
    }
    return false;
}

export function generateRandomSecret(length = 16) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let secret = "";
    for (let i = 0; i < length; i++) secret += alphabet[bytes[i] % alphabet.length];
    return secret;
}