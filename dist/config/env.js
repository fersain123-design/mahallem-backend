"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// env.ts lives at <root>/src/config/env.ts; project root is three levels up.
const rootDir = path_1.default.resolve(__dirname, '../../../');
// Load order (later wins):
// 1) .env (common defaults)
// 2) .env.{NODE_ENV} (environment-specific overrides)
const baseEnvPath = path_1.default.join(rootDir, '.env');
if (fs_1.default.existsSync(baseEnvPath)) {
    dotenv_1.default.config({ path: baseEnvPath, override: true });
}
else {
    dotenv_1.default.config({ override: true });
}
// If NODE_ENV isn't set by the runtime (common on Windows), default to
// 'development' when an .env.development file exists.
const nodeEnv = process.env.NODE_ENV || (fs_1.default.existsSync(path_1.default.join(rootDir, '.env.development')) ? 'development' : undefined);
if (nodeEnv && !process.env.NODE_ENV) {
    process.env.NODE_ENV = nodeEnv;
}
if (nodeEnv) {
    const envSpecificPath = path_1.default.join(rootDir, `.env.${nodeEnv}`);
    if (fs_1.default.existsSync(envSpecificPath)) {
        dotenv_1.default.config({ path: envSpecificPath, override: true });
    }
}
