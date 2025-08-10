import { readFileSync } from "fs";
import { pathToFileURL } from "url";
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
 * Dynamically import a TypeScript or JavaScript module
 */
async function importModule(filePath: string): Promise<any> {
  try {
    // Convert file path to file URL for proper import
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);

    // Return default export if available, otherwise return the entire module
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to import module at ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Read and parse drizzle configuration file into JSON format
 */
export async function parseDrizzleConfig(filePath: string): Promise<any> {
  try {
    const extension = filePath.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "ts":
      case "js":
      case "mts":
      case "mjs":
        return await importModule(filePath);

      case "toml":
        const tomlContent = readFileSync(filePath, "utf-8");
        return parseToml(tomlContent);

      case "json":
        const jsonContent = readFileSync(filePath, "utf-8");
        return JSON.parse(jsonContent);

      case "jsonc":
        const jsoncContent = readFileSync(filePath, "utf-8");
        return parseJsonc(jsoncContent);

      default:
        throw new Error(`Unsupported file extension: ${extension}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse drizzle config at ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Type-safe interface for drizzle database configuration
 */
export interface DrizzleDbConfig {
  driver: string;
  dbCredentials: {
    url?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | object;
    [key: string]: any;
  };
}

/**
 * Type-safe interface for drizzle configuration
 */
export interface DrizzleConfig {
  schema?: string | string[];
  out?: string;
  driver?: string;
  dbCredentials?: DrizzleDbConfig["dbCredentials"];
  breakpoints?: boolean;
  tablesFilter?: string | string[];
  schemaFilter?: string | string[];
  extensionsFilters?: string[];
  migrations?: {
    table?: string;
    schema?: string;
  };
  [key: string]: any;
}

/**
 * Parse drizzle config with type safety
 */
export async function parseDrizzleConfigTyped(
  filePath: string,
): Promise<DrizzleConfig> {
  const config = await parseDrizzleConfig(filePath);
  return config as DrizzleConfig;
}

/**
 * Parse drizzle config and convert to JSON string
 */
export async function parseDrizzleConfigAsJson(
  filePath: string,
  pretty = true,
): Promise<string> {
  const config = await parseDrizzleConfig(filePath);
  return JSON.stringify(config, null, pretty ? 2 : 0);
}
