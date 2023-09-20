(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 5000)); // intentional delay

    console.log("ctx_main `require`:", window.require);
    try {
        window.require("MqttWebConfig"); // check if user is logged in
    } catch (e) {
        throw new Error("User is not logged in; will not establish tunnel.");
    }

    while (!window.require("LSPlatformMessengerConfig")) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
    }
    
    await new Promise<void>(resolve => setTimeout(resolve, 1000)); // intentional delay

    let realtimeFB = window.require("LSPlatformMessengerConfig").config.realtimeUnderylingTransport();
    document.addEventListener('xfrelay_rlmain', (e: any) => {
        realtimeFB.publish(e.detail.data, e.detail.qos);
    });

    window.addEventListener('unload', () => {
        document.dispatchEvent(new CustomEvent('xfrelay_disconnect'));
    });

    document.dispatchEvent(new CustomEvent('xfrelay_connect'));

    realtimeFB.subscribe((data: string) => {
        let e = new CustomEvent('xfrelay_mainrl', { detail: data });
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