let sPorts = new Map<string, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener(function (port) {
    console.log("Accepting incoming connection from", port.name);
    sPorts.set(port.name, port);

    port.onDisconnect.addListener(function () {
        console.log("Port disconnected", port.name);
        sPorts.delete(port.name);
    });

    port.onMessage.addListener(function (msg: string) {
        console.debug(port.name, msg);
    });
});
