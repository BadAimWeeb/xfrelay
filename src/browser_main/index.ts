(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 1000)); // intentional delay

    console.log("ctx_main `require`:", window.require);
    try {
        window.require("MqttWebConfig"); // check if user is logged in
    } catch (e) {
        throw new Error("User is not logged in; will not establish tunnel.");
    }

    await new Promise<void>(resolve => setTimeout(resolve, 1000)); // intentional delay
    while (!window.require("LSPlatformMessengerConfig")) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
    }

    let realtimeFB = window.require("LSPlatformMessengerConfig").config.realtimeUnderylingTransport();
    document.addEventListener('xfrelay_rlmain', (e: any) => {
        realtimeFB.publish(e.detail.data, e.detail.qos);
    });

    document.dispatchEvent(new CustomEvent('xfrelay_connect'));

    realtimeFB.subscribe((data: string) => {
        let e = new CustomEvent('xfrelay_mainrl', { detail: data });
        document.dispatchEvent(e);
    });
})();