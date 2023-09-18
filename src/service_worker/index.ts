let sPorts = new Map<string, chrome.runtime.Port>();

let messageQueue: [id: string, data: string][] = [];

chrome.runtime.onConnect.addListener(function (port) {
    console.log("Accepting incoming connection from", port.name);
    if (port.name === "GUI") {
        // RESERVED
    } else {
        sPorts.set(port.name, port);

        chrome.storage.session.set({
            status: {
                connected: false,
                activeTab: sPorts.size,
                activeFCAInstance: 0
            }
        });

        port.onDisconnect.addListener(function () {
            console.log("Port disconnected", port.name);
            sPorts.delete(port.name);

            chrome.storage.session.set({
                status: {
                    connected: false,
                    activeTab: sPorts.size,
                    activeFCAInstance: 0
                }
            });
        });

        port.onMessage.addListener(function (msg: string) {
            console.debug(port.name, msg);
        });
    }
});


