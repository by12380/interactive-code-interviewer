import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Use a stable dev port so the URL doesn't jump.
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3002"
    }
  }
});
