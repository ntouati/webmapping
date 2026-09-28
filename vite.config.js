import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/webmapping/",
  plugins: [react()],
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
});