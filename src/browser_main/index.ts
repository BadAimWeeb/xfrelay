function generateOfflineThreadingID() {
    let h = 4194303n;
    let max_num = 9223372036854775807n;

    let r = crypto.getRandomValues(new Uint32Array(2));
    let r0 = BigInt(r[0]);
    let r1 = BigInt(r[1]);
    let fullR = (r0 << 32n) | r1;

    let time = BigInt(Date.now());
    let timeShifted = time << 22n;

    let otid = ((fullR & h) | timeShifted) & max_num;

    return otid.toString();
}

(async () => {
    for (let retry = 0; retry < 120; retry++) {
        // Wait till full require code is loaded.

        if ("require" in window) break;
        await new Promise<void>(resolve => setTimeout(resolve, 1000));
    }

    console.log("ctx_main `require`:", window.require);
    for (let retry = 0; retry < 10; retry++) {
        try {
            window.require("MqttWebConfig"); // check if user is logged in AND config is loaded in 10 seconds
        } catch (e) {
            if (retry >= 9) throw new Error("User is not logged in; will not establish tunnel.");
            await new Promise<void>(resolve => setTimeout(resolve, 1000));
        }
    }

    while (!window.require("LSPlatformMessengerConfig")) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
    }

    await new Promise<void>(resolve => setTimeout(resolve, 1000)); // intentional delay

    let realtimeFB = window.require("LSPlatformMessengerConfig").config.realtimeUnderylingTransport();
    document.addEventListener('xfrelay_rlmain', (e: any) => {
        if (e.detail.type === "data") {
            console.log(
                e.detail,
                realtimeFB.publish(e.detail.data, e.detail.qos)
            );
        }

        if (e.detail.type === "custom") {
            switch (e.detail.data) {
                case "currentUserID":
                    let fbID = window.require("MqttWebConfig").fbid;
                    let ev = new CustomEvent('xfrelay_mainrl', {
                        detail: {
                            type: "custom",
                            qos: e.detail.qos,
                            data: fbID
                        }
                    });
                    document.dispatchEvent(ev);
                    break;
                case "serverAppID":
                    let serverID = window.require('ServerAppID').app_id;
                    let ev2 = new CustomEvent('xfrelay_mainrl', {
                        detail: {
                            type: "custom",
                            qos: e.detail.qos,
                            data: serverID
                        }
                    });
                    document.dispatchEvent(ev2);
                    break;
                case "lsVersion":
                    let lsVersion = window.require('LSVersion');
                    let ev3 = new CustomEvent('xfrelay_mainrl', {
                        detail: {
                            type: "custom",
                            qos: e.detail.qos,
                            data: lsVersion
                        }
                    });
                    document.dispatchEvent(ev3);
                    break;
            }
        }

        if (e.detail.type === "http") {
            let packet = JSON.parse(e.detail.data) as {
                url: string,
                method: string,
                headers: { [key: string]: string },
                body: string
            }

            fetch(e.detail.data.url, {
                method: packet.method,
                headers: packet.headers,
                body: packet.body,
                credentials: "same-origin"
            }).then(async (res) => {
                let body = await res.text();
                let ev = new CustomEvent('xfrelay_mainrl', {
                    detail: {
                        type: "http",
                        qos: e.detail.qos,
                        data: JSON.stringify({
                            success: true,
                            status: res.status,
                            headers: Array.from(res.headers.entries()),
                            body
                        })
                    }
                });
                document.dispatchEvent(ev);
            }).catch((e) => {
                let ev = new CustomEvent('xfrelay_mainrl', {
                    detail: {
                        type: "http",
                        qos: e.detail.qos,
                        data: JSON.stringify({
                            success: false,
                            error: e.toString()
                        })
                    }
                });
                document.dispatchEvent(ev);
            });
        }

        if (e.detail.type === "upload") {
            let packet = e.detail.data as {
                filename: string,
                data: number[],
                mime: string
            };

            let file = new File([Uint8Array.from(packet.data)], packet.filename, {
                type: packet.mime
            });

            // another hacky api, nice
            // btw, it is: 
            //     0: onUploadStart, 1: onUploadProgress, 2: func return attachmentID (2nd param), 3: setupS2SLogging? (no, void 0 is OK), 
            //     4: is voice clip (no), 5: array of file data, 6: offline threading ID, 7: unknown (keep it void 0), 8: unknown (keep it void 0), 
            //     9: waveform data (in case of voice clip, ?), 10: nonce (keep it void 0), 11: string(actor? prob user ID)
            window.require("MWPComposerMediaUploadUtil").startUpload(void 0, void 0, (_otid: string, attachmentID: number) => {
                let ev = new CustomEvent('xfrelay_mainrl', {
                    detail: {
                        type: "upload",
                        qos: e.detail.qos,
                        data: attachmentID.toString()
                    }
                });
                document.dispatchEvent(ev);
            }, void 0, false, [file], [generateOfflineThreadingID()], void 0, void 0, void 0, void 0, window.require("MqttWebConfig").fbid);
            // why the fuck doesn't we also hack otid function then? idk.
        }
    });

    window.addEventListener('unload', () => {
        document.dispatchEvent(new CustomEvent('xfrelay_disconnect'));
    });

    document.dispatchEvent(new CustomEvent('xfrelay_connect'));

    realtimeFB.subscribe((data: string) => {
        let e = new CustomEvent('xfrelay_mainrl', {
            detail: {
                type: "data",
                data
            }
        });
        document.dispatchEvent(e);
    });

    let injectedNotice = document.createElement('div');
    injectedNotice.style.position = 'fixed';
    injectedNotice.style.top = '4px';
    injectedNotice.style.left = '4px';
    injectedNotice.style.zIndex = "999999";
    injectedNotice.style.color = "#0a0";
    injectedNotice.style.fontWeight = "bold";
    injectedNotice.style.fontSize = "16px";
    injectedNotice.style.fontFamily = "monospace";
    injectedNotice.style.textShadow = "0 0 4px #777";
    injectedNotice.style.pointerEvents = "none";

    injectedNotice.innerText = "XFRelay INJECTED";
    document.body.appendChild(injectedNotice);
})();