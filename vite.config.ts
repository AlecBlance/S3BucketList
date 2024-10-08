import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: "./index.html",
        background: "src/background.ts",
      },
      output: {
        entryFileNames: ({ name }) => {
          console.log("🛠 Building: ", name);
          return name === "background"
            ? "background.js"
            : "assets/[name]-[hash].js";
        },
      },
    },
  },
});
