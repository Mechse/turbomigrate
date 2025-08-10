import { defineConfig } from "tsup";
export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	target: "node18",
	format: ["esm"], // or ["esm","cjs"] if you need both
	splitting: false,
	sourcemap: true,
	clean: true,
	banner: { js: "#!/usr/bin/env bun" }, // inject shebang in built file
});
