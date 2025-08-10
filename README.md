# Turbomigrate

A smart CLI tool that streamlines database migrations for **Cloudflare D1** databases using **Drizzle ORM**. Turbomigrate automatically discovers your configuration files, lets you select environments and databases interactively, and handles both local and remote migrations with ease.

## 🚀 Features

- **Auto-discovery**: Automatically finds your `wrangler.toml`/`wrangler.json` and `drizzle.config.ts`/`drizzle.config.js` files
- **Interactive CLI**: Guided prompts for environment, database, and migration selection  
- **Multi-environment support**: Seamlessly switch between development, staging, and production environments
- **Migration management**: Create new migrations on-the-fly or run existing ones
- **Local & Remote**: Run migrations locally for development or remotely against live databases
- **Smart sorting**: Migrations sorted by creation date with the newest highlighted

## 📦 Usage

### With Bun:
```bash
bunx turboenv
```
### With Pnpm:
```bash
pnpx turboenv
```
### With Npm:
```bash
npx turboenv
```

#### My worflow
I often find myself working in monorepos where I would add something like this to the roote `package.json`:
```json
{
    "scripts": {
	    "db:push": "bunx turbomigrate -d ./server"
    }
}
```

## Options
- `-l`, `--local`, run migration locally
- `-r`, `--remote`, run migration remote
If none is selected you will be prompted to select one
- `-d`, `--dir <string>`, select the the working director - defaults to the current dir



