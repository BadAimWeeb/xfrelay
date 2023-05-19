(async () => {
    await new Promise<void>(resolve => {
        document.addEventListener('xfrelay_connect', () => {
            resolve();
        });
    });
    console.log("ctx_main <=> ctx_relay connection established");

    let rID = crypto.randomUUID();
    let sPort = chrome.runtime.connect({ name: rID });
    console.log("ctx_relay <=> ctx_sw connection established", rID);

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

        sPort.postMessage(data);
    });
})();
