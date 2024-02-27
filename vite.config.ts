import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vitePluginExecute from "vite-plugin-execute";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        vitePluginExecute({
            args: ["../copy_manifest.mjs"]
        })
    ],
    build: {
        rollupOptions: {
            input: {
                browser_main: "src/browser_main/index.ts",
                browser_relay: "src/browser_relay/index.ts",
                service_worker: "src/service_worker/index.ts",
                popup_gui: "src/gui/main.tsx"
            },
            output: {
                dir: "dist",
                entryFileNames: (info) =>
                    info.name === "browser_main" ? "browser-main.js" :
                        info.name === "browser_relay" ? "browser-relay.js" :
                            info.name === "service_worker" ? "service-worker.js" :
                                info.name === "popup_gui" ? "popup-gui.js" :
                                    "assets/[name]-[hash].js"
            }
        },
        target: [
            'chrome89',
            'firefox89',
            'edge89',
            'opera75'
        ]
    }
})
