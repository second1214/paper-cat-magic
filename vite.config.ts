import { defineConfig } from "vite";

// CrazyGames 版（--mode crazygames）は、JS もフォルダに入れず index.html と同じ所に置く（平らな構成）
export default defineConfig(({ mode }) => ({ base: "./", build: { assetsDir: mode === "crazygames" ? "" : "assets" } }));
