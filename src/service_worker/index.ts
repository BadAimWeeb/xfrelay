import { hexToUint8Array } from "./utils";
import { connect, Session as ProtoV2dSession } from "@badaimweeb/js-protov2d";
import { DTSocketClient } from "@badaimweeb/js-dtsocket";
import type { API } from "xfrelay_server";

import base85 from "base85";
import { Buffer } from "buffer";

import { Zstd } from "@hpcc-js/wasm/zstd";

const SubtleCrypto = crypto.subtle;

let sPorts = new Map<string, chrome.runtime.Port>();
let currentEncryptionKey: CryptoKey | null = null;

let messageQueue: [id: string, data: string][] = [];
let connection: Awaited<ReturnType<typeof connect>> | null = null;
let dt: DTSocketClient<API> | null = null;

let isMessageQueueProcessing = false;
let processMessageQueue = async () => {
    if (!currentEncryptionKey || !dt) return;
    if (isMessageQueueProcessing) return;
    isMessageQueueProcessing = true;

    while (messageQueue.length > 0) {
        let [id, data] = messageQueue.shift()!;
        let packedData = new TextEncoder().encode(data);
        let iv = crypto.getRandomValues(new Uint8Array(16));

        let encrypted = await SubtleCrypto.encrypt({
            name: "AES-CBC",
            iv
        }, currentEncryptionKey, packedData);

        let buf = Buffer.from([...iv, ...new Uint8Array(encrypted)]);
        let encryptedHex = base85.encode(buf, "z85");

        dt.emit("data", id, encryptedHex);
    }
    isMessageQueueProcessing = false;
}

chrome.runtime.onConnect.addListener(function (port) {
    console.log("Accepting incoming connection from", port.name);
    if (port.name === "GUI") {
        // RESERVED
    } else {
        sPorts.set(port.name, port);

        chrome.storage.session.set({
            status: {
                connected: connection && connection.connected,
                activeTab: sPorts.size,
                activeFCAInstance: 0
            }
        });

        port.onDisconnect.addListener(function () {
            console.log("Port disconnected", port.name);
            sPorts.delete(port.name);
            if (port.name !== "GUI" && dt) dt.p.unregisterInputTab(port.name).catch(() => { });

            chrome.storage.session.set({
                status: {
                    connected: connection && connection.connected,
                    activeTab: sPorts.size,
                    activeFCAInstance: 0
                }
            });
        });

        port.onMessage.addListener(function (msg: {
            type: "data" | "custom",
            qos?: number
            data: string
        }) {
            if (msg.type === "data") {
                messageQueue.push([port.name, msg.data]);
            } else if (msg.type === "custom") {
                // immediately send back
                dt?.emit("specificData", msg.qos, msg.data);
            }

            processMessageQueue();
        });
    }
});

let haltLoop = new AbortController();
async function connectWithConfig(config: {
    relayServerAddress: string,
    accountID: string,
    encryptionKey: string
}, abortController: AbortController) {
    for (; ;) {
        if (abortController.signal.aborted) return;

        chrome.storage.session.set({
            status: {
                connected: connection && connection.connected,
                activeTab: sPorts.size,
                activeFCAInstance: 0
            }
        });

        try {
            connection = await connect({
                url: (config.relayServerAddress ?? "").split("!")[0],
                publicKeys: [{
                    type: "hash",
                    value: config.relayServerAddress?.split("!")[1] ?? ""
                }],
                disableWASM: true // we could get away with this
            });
            break;
        } catch {
            // retry after 15s
            await new Promise<void>(resolve => setTimeout(resolve, 15000));
        }
    }

    if (connection) {
        currentEncryptionKey = await SubtleCrypto.importKey("raw", hexToUint8Array(config.encryptionKey ?? ""), "AES-CBC", false, ["encrypt", "decrypt"]);
        dt = new DTSocketClient<API>(connection);
        if (!await dt.p.registerInput(config.accountID)) {
            throw new Error("Failed to register input");
        }

        await dt.p.registerInputTab([...sPorts.keys()]);

        dt.on("requestSpecificData", async (id, data, nonce) => {
            let qos = Math.random();

            let port = sPorts.get(id);
            if (port) {
                port.postMessage({
                    type: "custom",
                    qos,
                    data
                });

                async function handleReturnMessage(data: {
                    type: "data" | "custom",
                    qos?: number,
                    data: string
                }) {
                    if (data.type === "custom" && data.qos === qos) {
                        port!.onMessage.removeListener(handleReturnMessage);

                        let packedData = new TextEncoder().encode(data.data);
                        let iv = crypto.getRandomValues(new Uint8Array(16));

                        let encrypted = await SubtleCrypto.encrypt({
                            name: "AES-CBC",
                            iv
                        }, currentEncryptionKey, packedData);

                        let buf = Buffer.from([...iv, ...new Uint8Array(encrypted)]);
                        let encryptedHex = base85.encode(buf, "z85");

                        dt!.emit("specificData", nonce, encryptedHex);
                    }
                }

                port.onMessage.addListener(handleReturnMessage);
            }
        });

        dt.on("injData", async (qos, data, tabID) => {
            let port: chrome.runtime.Port;
            if (tabID) {
                port = sPorts.get(tabID);
            } else {
                // pick random (unintendended behavior)
                port = [...sPorts.values()][Math.floor(Math.random() * sPorts.size)];
            }

            if (port) {
                let buf = Uint8Array.from([...base85.decode(data, "z85") as Buffer]);
                let iv = buf.slice(0, 16);
                let encrypted = buf.slice(16);

                let decrypted = await SubtleCrypto.decrypt({
                    name: "AES-CBC",
                    iv
                }, currentEncryptionKey, encrypted);

                let decoded = new TextDecoder().decode(decrypted);

                port.postMessage({
                    type: "data",
                    qos,
                    data: decoded
                });
            }
        });

        dt.on("httpInjData", async (data, nonce, tabID) => {
            let port: chrome.runtime.Port;
            if (tabID) {
                port = sPorts.get(tabID);
            } else {
                // pick random (unintendended behavior)
                port = [...sPorts.values()][Math.floor(Math.random() * sPorts.size)];
            }

            let qos = Math.random();

            if (!port) return;

            let buf = Uint8Array.from([...base85.decode(data, "z85") as Buffer]);
            let iv = buf.slice(0, 16);
            let encrypted = buf.slice(16);

            let decrypted = await SubtleCrypto.decrypt({
                name: "AES-CBC",
                iv
            }, currentEncryptionKey, encrypted);

            let decoded = new TextDecoder().decode(decrypted);

            port.postMessage({
                type: "http",
                qos,
                data: decoded
            });

            async function handleReturnMessage(data: {
                type: "data" | "custom" | "http",
                qos?: number,
                data: string
            }) {
                if (data.type === "http" && data.qos === qos) {
                    port!.onMessage.removeListener(handleReturnMessage);

                    let packedData = new TextEncoder().encode(data.data);
                    let iv = crypto.getRandomValues(new Uint8Array(16));

                    let encrypted = await SubtleCrypto.encrypt({
                        name: "AES-CBC",
                        iv
                    }, currentEncryptionKey, packedData);

                    let buf = Buffer.from([...iv, ...new Uint8Array(encrypted)]);
                    let encryptedHex = base85.encode(buf, "z85");

                    // it's inverse. i know. it's a mess.
                    dt!.emit("specificData", encryptedHex, nonce);
                }
            }

            port.onMessage.addListener(handleReturnMessage);
        });

        dt.on("uploadAttachmentData", async (data, nonce, tabID) => {
            let port: chrome.runtime.Port;
            if (tabID) {
                port = sPorts.get(tabID);
            } else {
                // pick random (unintendended behavior)
                port = [...sPorts.values()][Math.floor(Math.random() * sPorts.size)];
            }

            let eBuf = Uint8Array.from([...base85.decode(data, "z85") as Buffer]);
            let iv = eBuf.slice(0, 16);
            let encrypted = eBuf.slice(16);

            let decrypted = await SubtleCrypto.decrypt({
                name: "AES-CBC",
                iv
            }, currentEncryptionKey, encrypted);

            let buf = new Uint8Array(decrypted);

            if (!port) return;

            let qos = Math.random();

            // Figuring out compression/mime algorithm based on first byte
            let uncompressed: Uint8Array;
            let mime = "";
            switch (buf[0]) {
                case 0x00: // Uncompressed
                    uncompressed = buf.slice(1);
                    break;
                case 0x01: // zstd
                    const zstd = await Zstd.load();
                    uncompressed = zstd.decompress(buf.slice(1));
                    break;
                case 0x7F: // Uncompressed with mime hack
                    let mimeLength = buf[1];
                    mime = new TextDecoder().decode(buf.slice(2, 2 + mimeLength));
                    uncompressed = buf.slice(2 + mimeLength);
                    break;
                case 0x80: // zstd with mime hack
                    const zstd2 = await Zstd.load();
                    let uc = zstd2.decompress(buf.slice(1));
                    let mimeLength2 = uc[0];
                    mime = new TextDecoder().decode(uc.slice(1, 1 + mimeLength2));
                    uncompressed = uc.slice(1 + mimeLength2);
                    break;
                default:
                    console.error(`received unknown compression algorithm: ${buf[0]}`);
                    throw new Error("Unknown compression algorithm");
            }

            // This is a hack to get back file name (we'll definitely refactor this code later on after upgrading relay server).
            let filenameLength = uncompressed[0] // maximum file name length is 255;
            let filename = new TextDecoder().decode(uncompressed.slice(1, 1 + filenameLength));

            port.postMessage({
                type: "upload",
                qos,
                data: {
                    filename,
                    data: Array.from(uncompressed.slice(1 + filenameLength)),
                    mime
                }
            });

            async function handleReturnMessage(data: {
                type: "data" | "custom" | "http" | "upload",
                qos?: number,
                data: string
            }) {
                if (data.type === "upload" && data.qos === qos) {
                    port!.onMessage.removeListener(handleReturnMessage);

                    let packedData = new TextEncoder().encode(data.data);
                    let iv = crypto.getRandomValues(new Uint8Array(16));

                    let encrypted = await SubtleCrypto.encrypt({
                        name: "AES-CBC",
                        iv
                    }, currentEncryptionKey, packedData);

                    let buf = Buffer.from([...iv, ...new Uint8Array(encrypted)]);
                    let encryptedHex = base85.encode(buf, "z85");

                    // it's inversed. i know. it's a mess.
                    dt!.emit("uploadAttachmentResponse", encryptedHex, nonce);
                }
            }

            port.onMessage.addListener(handleReturnMessage);
        });

        chrome.storage.session.set({
            status: {
                connected: connection && connection.connected,
                activeTab: sPorts.size,
                activeFCAInstance: 0
            }
        });

        let disconnected = () => {
            chrome.storage.session.set({
                status: {
                    connected: false,
                    activeTab: sPorts.size,
                    activeFCAInstance: 0
                }
            });
        }
        connection.on("disconnected", disconnected);

        let connected = () => {
            chrome.storage.session.set({
                status: {
                    connected: true,
                    activeTab: sPorts.size,
                    activeFCAInstance: 0
                }
            });
        }
        connection.on("connected", connected);

        let updateResume = (newConn: ProtoV2dSession) => {
            connection?.off("disconnected", disconnected);
            connection?.off("connected", connected);

            connection = newConn;
            chrome.storage.local.get("config", async (result) => {
                try {
                    await dt!.p.registerInput(result.config?.accountID);
                    await dt!.p.registerInputTab([...sPorts.keys()]);
                } catch { }
            });

            connection.once("resumeFailed", updateResume);
        }

        connection.once("resumeFailed", updateResume);
    }
}

chrome.storage.local.get("config", async (result) => {
    if (
        result.config &&
        result.config.relayServerAddress &&
        result.config.accountID &&
        result.config.encryptionKey
    ) {
        await connectWithConfig(result.config, haltLoop);
    }
});

chrome.storage.local.onChanged.addListener(async (changes) => {
    if (changes.config) {
        if (changes.config.newValue?.encryptionKey !== changes.config.oldValue?.encryptionKey)
            currentEncryptionKey = await SubtleCrypto.importKey("raw", hexToUint8Array(changes.config.newValue.encryptionKey ?? ""), "AES-CBC", false, ["encrypt", "decrypt"]);

        if (changes.config.newValue?.relayServerAddress !== changes.config.oldValue?.relayServerAddress) {
            if (!connection) {
                haltLoop.abort();
            } else {
                connection.close("changed relay server address");
                if (dt) {
                    dt.removeAllListeners();
                    dt = null;
                }
            }

            haltLoop = new AbortController();
            if (
                changes.config.newValue &&
                changes.config.newValue.relayServerAddress &&
                changes.config.newValue.accountID &&
                changes.config.newValue.encryptionKey
            ) {
                connectWithConfig(changes.config.newValue, haltLoop);
            }
        }
    }
});

setInterval(() => {
    // keep-alive
    dt?.p.registerInputTab([...sPorts.keys()]).catch(() => { });
}, 5000);

