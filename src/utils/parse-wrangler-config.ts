import { readFileSync } from "fs";
import { parse as parseToml } from "@iarna/toml";

/**
 * Parse JSONC (JSON with Comments) by removing comments and parsing as JSON
 */
function parseJsonc(content: string): any {
	// Remove single-line comments (// ...)
	let cleaned = content.replace(/\/\/.*$/gm, "");

	// Remove multi-line comments (/* ... */)
	cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");

	// Remove trailing commas before } or ]
	cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

	return JSON.parse(cleaned);
}

/**
 * Read and parse wrangler configuration file into JSON format
 */
export function parseWranglerConfig(filePath: string): any {
	try {
		const content = readFileSync(filePath, "utf-8");
		const extension = filePath.split(".").pop()?.toLowerCase();

		switch (extension) {
			case "toml":
				return parseToml(content);

			case "json":
				return JSON.parse(content);

			case "jsonc":
				return parseJsonc(content);

			default:
				throw new Error(`Unsupported file extension: ${extension}`);
		}
	} catch (error) {
		throw new Error(
			`Failed to parse wrangler config at ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Type-safe interface for common wrangler config properties
 */

export interface D1Database {
	binding: string;
	database_name: string;
	database_id?: string;
}
export interface WranglerConfig {
	name?: string;
	main?: string;
	compatibility_date?: string;
	compatibility_flags?: string[];
	env?: Record<string, Record<string, any>>;
	d1_databases?: D1Database[];
	[key: string]: any;
}

/**
 * Parse wrangler config with type safety
 */
export function parseWranglerConfigTyped(filePath: string): WranglerConfig {
	return parseWranglerConfig(filePath) as WranglerConfig;
}
