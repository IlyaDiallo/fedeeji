const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AuthStateService = require('./AuthStateService');
const { stripSecrets, normalizeEmail, profileData } = require('./memberSecurity');

const queues = new Map();
const AUTH_SCHEMA = 1;
const GENERIC_ERROR = 'Email ou mot de passe incorrect';

class AuthService {
    constructor({ storage, emailService, now = () => Date.now(),
        jwtSecret = process.env.JWT_SECRET, superadminPassword = process.env.SUPERADMIN_PASSWORD }) {
        if (!jwtSecret || !superadminPassword) throw new Error('JWT_SECRET et SUPERADMIN_PASSWORD requis');
        this.storage = storage;
        this.state = new AuthStateService({ storage });
        this.emailService = emailService;
        this.now = now;
        this.jwtSecret = jwtSecret;
        this.superadminPassword = superadminPassword;
        this.dummyHash = bcrypt.hash('not-a-user-password', 10);
    }

    // Mono-process deployment. Shared by all instances using the same storage directory.
    async exclusive(collectiveId, fn) {
        const key = `${this.storage.basePath || ''}:${collectiveId}`;
        const previous = queues.get(key) || Promise.resolve();
        const pending = previous.catch(() => {}).then(fn);
        queues.set(key, pending);
        try { return await pending; }
        finally { if (queues.get(key) === pending) queues.delete(key); }
    }

    async migrate(collectiveId) {
        return this.exclusive(collectiveId, async () => {
            for (const row of await this.state.read(collectiveId) || []) {
                if (row.pendingMember) await this.projectMember(collectiveId, row);
            }
            const members = await this.storage.read({ collectiveId, collection: 'members' }) || [];
            const report = [];
            await this.state.mutate(collectiveId, rows => {
                for (const member of members) {
                    let row = rows.find(r => r.id === member.id);
                    if (!row) {
                        let email = null;
                        try { email = normalizeEmail(member.email); } catch { /* reported below */ }
                        const legacyHash = typeof member.adminPassword === 'string'
                            && /^\$2[aby]\$(0[4-9]|1[0-4])\$[./A-Za-z0-9]{53}$/.test(member.adminPassword)
                            ? member.adminPassword : null;
                        row = { id: member.id, email, passwordHash: legacyHash,
                            version: crypto.randomUUID(), disabled: false };
                        rows.push(row);
                    }
                }
                for (const row of rows) {
                    if (!members.some(m => m.id === row.id)) {
                        row.disabled = true;
                        row.passwordHash = null;
                        row.links = {};
                    }
                }
                this.refreshBlocked(rows);
                for (const row of rows) {
                    if (row.blocked && !row.disabled) report.push({ memberId: row.id, reason: 'email-invalid-or-duplicate' });
                }
            });
            // Private identity is committed first; replay repairs a crash before projection.
            const identities = await this.state.read(collectiveId);
            await this.storage.mutate({ collectiveId, collection: 'members' }, records => {
                for (let i = 0; i < records.length; i++) {
                    const row = identities.find(r => r.id === records[i].id);
                    records[i] = stripSecrets(records[i]);
                    if (row?.email) records[i].email = row.email;
                }
            });
            for (const collection of ['logs', 'trash']) {
                await this.storage.mutate({ collectiveId, collection }, records => {
                    for (let i = 0; i < records.length; i++) records[i] = stripSecrets(records[i]);
                });
            }
            return report;
        });
    }

    assertUnique(rows, email, memberId) {
        if (rows.some(row => row.id !== memberId && !row.disabled && row.email === email)) {
            throw new Error('Adresse email indisponible');
        }
    }

    reserveMail(row) {
        row.mailTimes = (row.mailTimes || []).filter(time => time > this.now() - 3600000);
        if (row.mailTimes.length >= 3) return false;
        row.mailTimes.push(this.now());
        return true;
    }

    refreshBlocked(rows) {
        for (const row of rows) row.blocked = !row.email || rows.some(other => other.id !== row.id
            && !other.disabled && other.email === row.email);
    }

    async projectMember(collectiveId, row) {
        await this.storage.write({ collectiveId, collection: 'members', id: row.id, data: row.pendingMember });
        await this.state.mutate(collectiveId, rows => { delete rows.find(r => r.id === row.id).pendingMember; });
    }

    async createMember({ collectiveId, data }) {
        const email = normalizeEmail(data?.email);
        const member = { ...profileData(data), id: crypto.randomUUID(), email, admin: data.admin === true };
        return this.exclusive(collectiveId, async () => {
            const row = { id: member.id, email, passwordHash: null, version: crypto.randomUUID(),
                disabled: false, blocked: false, pendingMember: member };
            await this.state.mutate(collectiveId, rows => {
                this.assertUnique(rows, email);
                rows.push(row);
            });
            await this.projectMember(collectiveId, row);
            return member;
        });
    }

    async memberView(collectiveId, member) {
        if (!member) return member;
        const row = await this.state.read(collectiveId, member.id);
        const pending = row?.links?.email;
        return { ...stripSecrets(member), ...(pending?.expiresAt > this.now() ? { pendingEmail: pending.newEmail } : {}) };
    }

    async updateMember({ collectiveId, id, data, actor }) {
        return this.exclusive(collectiveId, async () => {
            const member = await this.storage.read({ collectiveId, collection: 'members', id });
            if (!member) throw new Error('Élément introuvable');
            const changes = profileData(data);
            const privileged = actor && ['admin', 'superadmin'].includes(actor.role);
            if (!actor || (!privileged && actor.memberId !== id)) throw new Error('Accès interdit');
            if (actor.role !== 'superadmin' && actor.collectiveId !== collectiveId) throw new Error('Accès interdit');
            if (privileged && Object.hasOwn(data, 'admin')) changes.admin = data.admin === true;
            let message;
            let oldEmail;
            let projection;
            await this.state.mutate(collectiveId, async rows => {
                const row = rows.find(r => r.id === id && !r.disabled);
                if (!row) throw new Error('Identité indisponible');
                const email = Object.hasOwn(data, 'email') ? normalizeEmail(data.email) : row.email;
                if (email !== row.email) {
                    this.assertUnique(rows, email, id);
                    if (actor.memberId === id && actor.role !== 'superadmin') {
                        if (typeof data.currentPassword !== 'string' || Buffer.byteLength(data.currentPassword) > 1024
                            || !row.passwordHash || !await bcrypt.compare(data.currentPassword, row.passwordHash)) {
                            throw new Error('Mot de passe actuel incorrect');
                        }
                    }
                    if (!this.reserveMail(row)) throw new Error('Trop de demandes email. Réessayez dans une heure.');
                    const { token, record } = this.makeLink({ newEmail: email });
                    row.links = { ...row.links, email: record };
                    message = { collectiveId, to: email, purpose: 'email', token, lang: data.lang };
                    oldEmail = row.email;
                }
                if (Object.hasOwn(changes, 'admin') && changes.admin !== member.admin) {
                    row.version = crypto.randomUUID();
                }
                row.pendingMember = { ...stripSecrets(member), ...changes, email: row.email || member.email };
                projection = row;
            });
            await this.projectMember(collectiveId, projection);
            if (message) {
                void this.deliver(message);
                if (oldEmail) void this.deliver({ to: oldEmail, lang: data.lang }, true);
            }
            return this.memberView(collectiveId, { ...member, ...changes });
        });
    }

    async confirmEmail({ collectiveId, token }) {
        const hash = AuthService.tokenHash(token);
        return this.exclusive(collectiveId, async () => {
            const members = await this.storage.read({ collectiveId, collection: 'members' }) || [];
            const identity = await this.state.mutate(collectiveId, rows => {
                const row = rows.find(r => !r.disabled && r.links?.email?.tokenHash === hash
                    && r.links.email.expiresAt > this.now() && members.some(m => m.id === r.id));
                if (!row) throw new Error('Lien invalide ou expiré');
                this.assertUnique(rows, row.links.email.newEmail, row.id);
                row.email = row.links.email.newEmail;
                row.pendingMember = { ...stripSecrets(members.find(m => m.id === row.id)), email: row.email };
                row.links = {};
                row.version = crypto.randomUUID();
                this.refreshBlocked(rows);
                return row;
            });
            await this.projectMember(collectiveId, identity);
            return { success: true };
        });
    }

    async deleteMember({ collectiveId, id, remove }) {
        return this.exclusive(collectiveId, async () => {
            await this.state.mutate(collectiveId, rows => {
                const row = rows.find(r => r.id === id);
                if (row) {
                    Object.assign(row, { disabled: true, passwordHash: null, version: crypto.randomUUID(), links: {} });
                    delete row.pendingMember;
                }
                this.refreshBlocked(rows);
            });
            return remove();
        });
    }

    async restoreMember({ collectiveId, item }) {
        return this.exclusive(collectiveId, async () => {
            const member = { ...stripSecrets(item), email: normalizeEmail(item.email) };
            const existing = await this.storage.read({ collectiveId, collection: 'members', id: member.id });
            if (existing) throw new Error('Ce membre existe déjà');
            let restored;
            await this.state.mutate(collectiveId, rows => {
                this.assertUnique(rows, member.email, member.id);
                const row = rows.find(r => r.id === member.id);
                const fresh = { id: member.id, email: member.email, passwordHash: null,
                    version: crypto.randomUUID(), disabled: false, blocked: false, links: {}, pendingMember: member };
                if (row) Object.assign(row, fresh); else rows.push(fresh);
                restored = row || fresh;
                this.refreshBlocked(rows);
            });
            await this.projectMember(collectiveId, restored);
            return member;
        });
    }

    loginSuperadmin({ password }) {
        if (typeof password !== 'string' || password !== this.superadminPassword) throw new Error('Mot de passe incorrect');
        return { token: jwt.sign({ role: 'superadmin' }, this.jwtSecret, { expiresIn: '24h' }), role: 'superadmin' };
    }

    static validatePassword(password) {
        if (typeof password !== 'string' || [...password].length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
            throw new Error('Le mot de passe doit contenir au moins 12 caractères et au plus 72 octets UTF-8');
        }
    }

    static tokenHash(token) {
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Lien invalide ou expiré');
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    makeLink(extra = {}) {
        const token = crypto.randomBytes(32).toString('base64url');
        return { token, record: { tokenHash: AuthService.tokenHash(token), expiresAt: this.now() + 30 * 60000, ...extra } };
    }

    async deliver(message, notice = false) {
        try {
            if (!this.emailService) throw new Error('SMTP indisponible');
            await this.emailService[notice ? 'sendNotice' : 'sendLink'](message);
            return true;
        } catch {
            // Never log SMTP errors (can contain addresses, credentials or message URLs).
            console.error('Échec envoi email authentification ; vérifier SMTP et la délivrabilité.');
            return false;
        }
    }

    async requestPassword({ collectiveId, email, lang }) {
        let normalized;
        try { normalized = normalizeEmail(email); } catch { return { success: true }; }
        const message = await this.exclusive(collectiveId, async () => {
            const members = await this.storage.read({ collectiveId, collection: 'members' }) || [];
            return this.state.mutate(collectiveId, rows => {
                const matches = rows.filter(r => !r.disabled && !r.blocked && r.email === normalized);
                if (matches.length !== 1 || !members.some(m => m.id === matches[0].id)) return null;
                const row = matches[0];
                if (!this.reserveMail(row)) return null;
                const { token, record } = this.makeLink();
                row.links = { ...row.links, password: record };
                return { collectiveId, to: row.email, purpose: 'password', token, lang };
            });
        });
        // Respond independently of SMTP latency, with delivery errors handled and redacted.
        if (message) void this.deliver(message);
        return { success: true };
    }

    async confirmPassword({ collectiveId, token, password }) {
        const hash = AuthService.tokenHash(token);
        AuthService.validatePassword(password);
        const passwordHash = await AuthService.hashPassword(password);
        return this.exclusive(collectiveId, async () => {
            const members = await this.storage.read({ collectiveId, collection: 'members' }) || [];
            await this.state.mutate(collectiveId, rows => {
                const row = rows.find(r => !r.disabled && !r.blocked && r.links?.password?.tokenHash === hash
                    && r.links.password.expiresAt > this.now() && members.some(m => m.id === r.id));
                if (!row) throw new Error('Lien invalide ou expiré');
                row.passwordHash = passwordHash;
                row.version = crypto.randomUUID();
                row.links = {};
            });
            return { success: true };
        });
    }

    static hashPassword(password) { return bcrypt.hash(password, 10); }
    async loginCollective({ collectiveId, email, password }) {
        let normalized;
        try { normalized = normalizeEmail(email); } catch { normalized = null; }
        if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) throw new Error(GENERIC_ERROR);
        // Serialize against password reset / deletion / email changes until token issuance.
        return this.exclusive(collectiveId, async () => {
            const rows = await this.state.read(collectiveId) || [];
            const matches = rows.filter(r => !r.disabled && !r.blocked && r.email === normalized);
            const row = matches.length === 1 ? matches[0] : null;
            const valid = await bcrypt.compare(password, row?.passwordHash || await this.dummyHash);
            const stored = row && await this.storage.read({ collectiveId, collection: 'members', id: row.id });
            const member = stored && (row.pendingMember || stored);
            if (!row?.passwordHash || !valid || !member) throw new Error(GENERIC_ERROR);
            const role = member.admin === true ? 'admin' : 'member';
            const token = jwt.sign({ role, collectiveId, memberId: row.id, authSchema: AUTH_SCHEMA,
                version: row.version }, this.jwtSecret, { expiresIn: '24h' });
            return { token, role, collectiveId, memberId: row.id,
                memberName: `${member.firstName || ''} ${member.lastName || ''}`.trim() };
        });
    }

    async verifyToken(token) {
        const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
        if (decoded.role === 'superadmin') return decoded;
        if (decoded.authSchema !== AUTH_SCHEMA || !['member', 'admin'].includes(decoded.role)
            || typeof decoded.collectiveId !== 'string' || typeof decoded.memberId !== 'string') throw new Error('Session invalide');
        const row = await this.state.read(decoded.collectiveId, decoded.memberId);
        const stored = await this.storage.read({ collectiveId: decoded.collectiveId, collection: 'members', id: decoded.memberId });
        const member = stored && (row?.pendingMember || stored);
        if (!row || row.disabled || row.blocked || !row.passwordHash || row.version !== decoded.version
            || !member || decoded.role !== (member.admin === true ? 'admin' : 'member')) throw new Error('Session expirée');
        return decoded;
    }
}
module.exports = AuthService;
