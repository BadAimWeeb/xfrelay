export function hexToUint8Array(hexString: string) {
    if (hexString.length % 2 !== 0) throw new Error("Invalid hex string");
    let result = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        result[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return result;
}

export function uint8arrayToHex(uint8array: Uint8Array) {
    let result = "";
    for (let i = 0; i < uint8array.length; i++) {
        result += uint8array[i].toString(16).padStart(2, "0");
    }
    return result;
}
