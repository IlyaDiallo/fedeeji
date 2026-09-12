const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const FileSystemAdapter = require('../src/backend/storage/FileSystemAdapter');
const AuthService = require('../src/backend/services/AuthService');
async function fixture(run) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'feddeeji-auth-'));
    try {
        const storage = new FileSystemAdapter({ basePath: dir });
        const sent = [];
        const clock = { value: Date.now() };
        const auth = new AuthService({ storage, jwtSecret: 'test-secret-not-production',
            superadminPassword: 'super-test', now: () => clock.value,
            emailService: { async sendLink(message) { sent.push(message); }, async sendNotice() {} } });
        const putMembers = (data, collectiveId = 'demo') => storage.write({ collectiveId, collection: 'members', data });
        await run({ storage, auth, sent, clock, putMembers });
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
}
module.exports = { fixture };
