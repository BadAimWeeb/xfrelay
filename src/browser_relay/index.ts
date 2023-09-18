(async () => {
    let flag_disconnected = false;

    await new Promise<void>(resolve => {
        document.addEventListener('xfrelay_connect', () => {
            resolve();
        });
    });
    console.log("ctx_main <=> ctx_relay connection established");

    let rID = crypto.randomUUID();
    let sPort = chrome.runtime.connect({ name: rID });
    console.log("ctx_relay <=> ctx_sw connection established", rID);

    let reconnect = () => {
        console.log("ctx_relay <=> ctx_sw connection lost", rID);
        if (flag_disconnected) return;
        // retry connect
        sPort = chrome.runtime.connect({ name: rID });
        console.log("ctx_relay <=> ctx_sw connection re-established", rID);
        sPort.onDisconnect.addListener(reconnect);
    };

    sPort.onDisconnect.addListener(reconnect);

    document.addEventListener('xfrelay_disconnect', () => {
        sPort.postMessage([1, "disconnect"]);
        flag_disconnected = true;
        sPort.disconnect();
    });

    sPort.onMessage.addListener((msg: {
        data: string,
        qos: number
    }) => {
        let e = new CustomEvent('xfrelay_rlmain', { detail: msg });
        document.dispatchEvent(e);
    });

    document.addEventListener('xfrelay_mainrl', (e: any) => {
        let data = e.detail as string;
        console.debug("ctx_relay received data:", data);

        sPort.postMessage([0, data]);
    });
})();
