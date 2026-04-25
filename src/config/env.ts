import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// env.ts lives at <root>/src/config/env.ts; project root is three levels up.
const rootDir = path.resolve(__dirname, '../../../');

// Load order (later wins):
// 1) .env (common defaults)
// 2) .env.{NODE_ENV} (environment-specific overrides)
const baseEnvPath = path.join(rootDir, '.env');
if (fs.existsSync(baseEnvPath)) {
	dotenv.config({ path: baseEnvPath, override: true });
} else {
	dotenv.config({ override: true });
}


// If NODE_ENV isn't set by the runtime (common on Windows), default to
// 'development' when an .env.development file exists.
const nodeEnv = process.env.NODE_ENV || (fs.existsSync(path.join(rootDir, '.env.development')) ? 'development' : undefined);
if (nodeEnv && !process.env.NODE_ENV) {
	process.env.NODE_ENV = nodeEnv;
}

if (nodeEnv) {
	const envSpecificPath = path.join(rootDir, `.env.${nodeEnv}`);
	if (fs.existsSync(envSpecificPath)) {
		dotenv.config({ path: envSpecificPath, override: true });
	}
}

export {};
