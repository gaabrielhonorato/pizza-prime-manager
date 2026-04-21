import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // lovable-tagger: apenas em desenvolvimento local (não necessário no build)
    mode === "development" && (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { componentTagger } = require("lovable-tagger");
        return componentTagger();
      } catch {
        return null;
      }
    })(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
