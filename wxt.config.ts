import { defineConfig } from "wxt";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  outDir: "dist", // default: ".output"
  srcDir: "src", // default: "."
  manifest: {
    permissions: ["webRequest", "storage", "tabs"],
    host_permissions: ["<all_urls>"],
  },
  vite: () => {
    process.env.VITE_VERSION = JSON.parse(
      fs.readFileSync("package.json", "utf-8"),
    ).version;

    return {
      plugins: [tailwindcss(), nodePolyfills()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
        },
      },
    };
  },
});
