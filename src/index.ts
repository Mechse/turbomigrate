import { basename, join, resolve } from "path";
import { Command } from "commander";
import { existsSync, readdirSync, statSync } from "fs";
import {
  parseWranglerConfigTyped,
  type D1Database,
  type WranglerConfig,
} from "./utils/parse-wrangler-config.ts";
import { tryCatch } from "./utils/try-catch.ts";
import consola from "consola";
import pc from "picocolors";
import {
  parseDrizzleConfigTyped,
  type DrizzleConfig,
} from "./utils/parse-drizzle-config.ts";
import { execa } from "execa";
import yoctoSpinner from "yocto-spinner";
import { format } from "date-fns";

export const program = new Command();

program
  .name("turbomigrate")
  .description("Smarter drizzle migration for cloudflare d1 databases")
  .option("-l, --local", "run migration locally")
  .option("-r, --remote", "run migration remote")
  .option("-d, --dir <string>");

program.parse();
const { local, remote, dir } = program.opts();

// Resolve CWD
let resolvedWorkdir: string;
if (dir) {
  resolvedWorkdir = resolve(process.cwd(), dir);

  if (!existsSync(resolvedWorkdir)) {
    console.error(`Error: Working directory '${dir}' does not exist`);
    process.exit(1);
  }
} else {
  resolvedWorkdir = resolve(process.cwd());
}

if (local === undefined && remote === undefined) {
  const { data, error } = await tryCatch(
    consola.prompt(pc.yellow("Want to migrate locally or remotely?"), {
      type: "select",
      options: [
        {
          label: "local",
          value: "local",
        },
        {
          label: "remote",
          value: "remote",
        },
      ],
      initial: "local",
    }),
  );

  if (!data || error) {
    consola.error("Migration cancelled.");
    process.exit(1);
  }
}

// Look for wrangler configuration files
const wranglerConfigs = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];
const foundConfigs = wranglerConfigs.filter((config) =>
  existsSync(join(resolvedWorkdir, config)),
);

if (foundConfigs.length === 0) {
  console.error(
    `Error: No wrangler configuration file found in '${resolvedWorkdir}'`,
  );
  console.error(`Expected one of: ${wranglerConfigs.join(", ")}`);
  process.exit(1);
}

if (foundConfigs.length > 1) {
  console.warn(
    `Warning: Multiple wrangler config files found: ${foundConfigs.join(", ")}`,
  );
  console.log(`Using: ${foundConfigs[0]}`);
}

const configPath = join(resolvedWorkdir, foundConfigs?.at(0) ?? "");
let wranglerConfig: WranglerConfig;

try {
  wranglerConfig = parseWranglerConfigTyped(configPath);
} catch (error) {
  console.error(
    `Failed to parse wrangler config: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exit(1);
}

// Look for drizzle config file
const drizzleConfigs = ["drizzle.config.ts", "drizzle.config.js"];
const foundDrizzleConfig = drizzleConfigs.filter((config) =>
  existsSync(join(resolvedWorkdir, config)),
);

if (foundDrizzleConfig.length === 0) {
  console.error(
    `Error: No drizzle configuration file found in '${resolvedWorkdir}'`,
  );
  console.error(`Expected one of: ${drizzleConfigs.join(", ")}`);
  process.exit(1);
}

if (foundDrizzleConfig.length > 1) {
  console.warn(
    `Warning: Multiple drizzle config files found: ${foundDrizzleConfig.join(", ")}`,
  );
  console.log(`Using: ${foundDrizzleConfig[0]}`);
}

const drizzleConfigPath = join(
  resolvedWorkdir,
  foundDrizzleConfig?.at(0) ?? "",
);

let drizzleConfig: DrizzleConfig;

try {
  drizzleConfig = await parseDrizzleConfigTyped(drizzleConfigPath);
} catch (error) {
  console.error(
    `Failed to parse drizzle config: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exit(1);
}

// Select cloudflare/wrangler environment
const environments = Object.keys(wranglerConfig.env ?? {});
let selectedEnvironment: string | undefined = undefined;

if (environments.length === 1) {
  selectedEnvironment = environments[0] ?? "";
} else {
  const envChoices = environments.map((key) => ({
    label: `${key}`,
    value: key,
  }));

  const { data, error } = await tryCatch(
    consola.prompt(pc.yellow("Select an environment:"), {
      type: "select",
      options: envChoices,
      initial: environments.at(0),
    }),
  );

  if (!data || error) {
    consola.error("Migration cancelled.");
    process.exit(1);
  }

  selectedEnvironment = data;
}

// Select cloudflare/wrangler environment
let selectedDatabase: D1Database | undefined;
const databases = selectedEnvironment
  ? (wranglerConfig.env?.[selectedEnvironment ?? ""]?.[
      "d1_databases"
    ] as D1Database[])
  : (wranglerConfig?.["d1_databases"] as D1Database[]);

if (databases.length === 0) {
  console.error("No cloudflare d1 databases found/configured.");
  process.exit(1);
}
if (databases.length === 1) {
  selectedDatabase = databases[0];
} else {
  const dbChoices = databases.map((db) => ({
    label: `${db.database_name} - ${db.database_id?.slice(0, 6)}`,
    value: db.database_id ?? "",
  }));

  const { data, error } = await tryCatch(
    consola.prompt(pc.yellow("Select a database to migrate to:"), {
      type: "select",
      options: [...dbChoices],
      initial: "local",
    }),
  );

  if (!data || error) {
    consola.error("Migration cancelled.");
    process.exit(1);
  }

  selectedDatabase = databases.find((db) => db.database_id === data);
}

let foundDrizzleMigrationsFolder = existsSync(
  join(resolvedWorkdir, drizzleConfig.out ?? "drizzle"),
);

const { data: createNewMigration, error } = await tryCatch(
  consola.prompt(
    `Want to create a new migration?${!foundDrizzleMigrationsFolder ? " (Currently we can't locate any migrations)" : ""}`,
    {
      type: "confirm",
      initial: false,
    },
  ),
);

if (error) {
  consola.error("Migration cancelled.");
  process.exit(1);
}

if (createNewMigration) {
  const spinner = yoctoSpinner({ text: "Creating new migrations ..." });
  try {
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
    if (isInteractive) {
      spinner.stop();
      console.log(pc.blue("Running drizzle-kit generate..."));
    }
    await execa("bunx", ["drizzle-kit", "generate"], {
      cwd: resolvedWorkdir,
      stdio: isInteractive ? "inherit" : "pipe",
    });
    if (isInteractive) {
      console.log(pc.green("✓ New migration created"));
    } else {
      spinner.success("New migration created");
    }
  } catch {
    if (spinner.isSpinning) spinner.stop();
    console.error(pc.red("✗ Failed to create migration"));
    consola.error("Migration cancelled.");
    process.exit(1);
  }
}

foundDrizzleMigrationsFolder = existsSync(
  join(resolvedWorkdir, drizzleConfig.out ?? "drizzle"),
);

if (!foundDrizzleMigrationsFolder) {
  consola.error(
    "Migration cancelled: Was not able to locate migrations folder",
  );
  process.exit(1);
}

// Load all SQL files from migrations folder sorted by last modified date
let selectedMigration: string = "";
const migrationsFolder = join(resolvedWorkdir, drizzleConfig.out ?? "drizzle");
const allFiles = readdirSync(migrationsFolder);
const sqlFiles = allFiles.filter((file) => file.endsWith(".sql"));

if (sqlFiles.length === 0) {
  consola.warn("No SQL migration files found in the migrations folder.");
} else {
  // Get file stats and sort by last modified date (oldest first)
  const sqlFilesWithStats = sqlFiles
    .map((file) => {
      const filePath = join(migrationsFolder, file);
      const stats = statSync(filePath);
      return {
        name: file,
        path: filePath,
        mtime: stats.mtime,
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  console.log("Found SQL migration files (sorted by date):");

  const migrationChoices = sqlFilesWithStats.map((file, index) => ({
    label: `${index === 0 ? pc.magenta("NEWEST") : ""} ${file.name}  ${pc.gray(format(file.mtime, "HH:mm yyyy-MM-dd"))}`,
    value: file.path,
  }));

  const { data, error } = await tryCatch(
    consola.prompt(pc.yellow("Select a migration:"), {
      type: "select",
      options: migrationChoices,
      initial: sqlFilesWithStats.at(0)?.path,
    }),
  );

  if (!data || error) {
    consola.error("Migration cancelled.");
    process.exit(1);
  }

  selectedMigration = data;
}

const spinner = yoctoSpinner({ text: "Starting migration" }).start();

try {
  const migrationParams = [
    "wrangler",
    "d1",
    "execute",
    selectedDatabase?.database_name ?? "",
    local ? "--local" : "",
    remote ? "--remote" : "",
    ...(selectedEnvironment ? ["--env", selectedEnvironment] : []),
    "--file",
    selectedMigration,
  ].filter((prop) => prop != "");
  // console.log("PARAMS: ", migrationParams.join(" "));

  await execa("bunx", migrationParams, { cwd: resolvedWorkdir });
} catch (_err) {
  consola.error("Migration cancelled: ", _err);
  process.exit(1);
}

spinner.success(`Successfully migrated!`);
