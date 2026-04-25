"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../config/env");
const db_1 = __importDefault(require("../config/db"));
const passwordUtils_1 = require("../utils/passwordUtils");
function requireEnv(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value.trim();
}
async function main() {
    const email = requireEnv('ADMIN_EMAIL');
    const password = requireEnv('ADMIN_PASSWORD');
    const name = (process.env.ADMIN_NAME || 'Admin').trim();
    const passwordHash = await (0, passwordUtils_1.hashPassword)(password);
    const existing = await db_1.default.user.findUnique({ where: { email } });
    if (!existing) {
        await db_1.default.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: 'ADMIN',
            },
        });
        console.log(`✓ Created admin user: ${email}`);
        return;
    }
    await db_1.default.user.update({
        where: { email },
        data: {
            name,
            passwordHash,
            role: 'ADMIN',
        },
    });
    console.log(`✓ Updated admin user: ${email}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await db_1.default.$disconnect();
});
