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
    ]
})
