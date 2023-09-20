import { hexToUint8Array } from "./utils";
import { connect, Session as ProtoV2dSession } from "@badaimweeb/js-protov2d";
import { DTSocketClient } from "@badaimweeb/js-dtsocket";
import type { API } from "xfrelay_server";

import base85 from "base85";
import { Buffer } from "buffer";

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

        let buf = Buffer.from(new Uint8Array(encrypted));
        let encryptedHex = base85.encode(buf, "z85");
        console.log(buf, encryptedHex);

        dt.emit("data", id, [...iv, ...encryptedHex]);
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
            if (port.name !== "GUI" && dt) dt.p.unregisterInputTab(port.name);

            chrome.storage.session.set({
                status: {
                    connected: connection && connection.connected,
                    activeTab: sPorts.size,
                    activeFCAInstance: 0
                }
            });
        });

        port.onMessage.addListener(function (msg: string) {
            console.debug("Received message from", port.name, msg);
            messageQueue.push([port.name, msg]);
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
                publicKey: {
                    type: "hash",
                    hash: config.relayServerAddress?.split("!")[1] ?? ""
                }
            });
            break;
        } catch {
            // retry after 15s
            await new Promise<void>(resolve => setTimeout(resolve, 15000));
        }
    }

    if (connection) {
        currentEncryptionKey = await SubtleCrypto.importKey("raw", hexToUint8Array(config.encryptionKey ?? ""), "AES-CBC", false, ["encrypt", "decrypt"]);
        //AES.utils.hex.toBytes(config.encryptionKey ?? "");
        dt = new DTSocketClient<API>(connection);
        if (!await dt.p.registerInput(config.accountID)) {
            throw new Error("Failed to register input");
        }

        await dt.p.registerInputTab([...sPorts.keys()]);

        chrome.storage.session.set({
            status: {
                connected: connection && connection.connected,
                activeTab: sPorts.size,
                activeFCAInstance: 0
            }
        });

        let updateResume = (newConn: ProtoV2dSession) => {
            connection = newConn;
            chrome.storage.local.get("config", async (result) => {
                await dt!.p.registerInput(result.config?.accountID);
                await dt!.p.registerInputTab([...sPorts.keys()]);
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
            if (!connection) haltLoop.abort();
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
    dt?.p.registerInputTab([...sPorts.keys()]);
}, 15000);

