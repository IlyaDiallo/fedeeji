const crypto = require('crypto');
const { NOTIFICATION_STATE } = require('./internalCollections');
const { normalizeSettings } = require('./NotificationConfig');

/** Internal persistence only: never pass these objects through DataService/audit logs. */
class NotificationStateService {
    constructor({ storage, now = () => Date.now() }) {
        this.storage = storage;
        this.now = now;
    }

    async _read(collectiveId, id) {
        return this.storage.read({ collectiveId, collection: NOTIFICATION_STATE, id });
    }

    async _write(collectiveId, record) {
        await this.storage.write({
            collectiveId, collection: NOTIFICATION_STATE, id: record.id, data: record
        });
        return record;
    }

    async getSettings(collectiveId) {
        const record = await this._read(collectiveId, 'settings');
        return record?.settings || null;
    }

    async setSettings(collectiveId, settings) {
        const normalized = normalizeSettings(settings);
        await this._write(collectiveId, { id: 'settings', kind: 'settings', settings: normalized });
        return normalized;
    }

    static deliveryId({ actionId, occurrenceDate, step, memberId }) {
        const key = JSON.stringify([actionId, occurrenceDate, step, memberId]);
        return `delivery-${crypto.createHash('sha256').update(key).digest('hex')}`;
    }

    async listDeliveries(collectiveId) {
        return (await this._read(collectiveId) || []).filter(record => record.kind === 'delivery');
    }

    async saveDelivery(collectiveId, delivery) {
        return this._write(collectiveId, {
            ...delivery,
            id: NotificationStateService.deliveryId(delivery),
            kind: 'delivery'
        });
    }

    async issueToken(collectiveId, { actionId, occurrenceDate, step, memberId, revision }, ttlMs = 30 * 86400000) {
        if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 30 * 86400000) {
            throw new Error('Durée de validité du bouton invalide');
        }
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await this._write(collectiveId, {
            id: `token-${tokenHash}`, kind: 'token', tokenHash,
            actionId, occurrenceDate, step, memberId, revision,
            createdAt: this.now(), expiresAt: this.now() + ttlMs, revoked: false
        });
        return token;
    }

    async resolveToken(collectiveId, token) {
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const record = await this._read(collectiveId, `token-${tokenHash}`);
        if (!record || record.kind !== 'token' || record.revoked || record.expiresAt <= this.now()) return null;
        return record;
    }

    async revokeTokens(collectiveId, { actionId, occurrenceDate, step, memberId } = {}) {
        const records = await this._read(collectiveId) || [];
        for (const record of records) {
            if (record.kind !== 'token' || record.revoked
                || (actionId !== undefined && record.actionId !== actionId)
                || (occurrenceDate !== undefined && record.occurrenceDate !== occurrenceDate)
                || (step !== undefined && record.step !== step)
                || (memberId !== undefined && record.memberId !== memberId)) continue;
            await this._write(collectiveId, { ...record, revoked: true });
        }
    }

    async pruneTokens(collectiveId) {
        for (const record of await this._read(collectiveId) || []) {
            if (record.kind === 'token' && (record.revoked || record.expiresAt <= this.now())) {
                await this.storage.delete({ collectiveId, collection: NOTIFICATION_STATE, id: record.id });
            }
        }
    }

    async diagnostics(collectiveId) {
        // Explicit projection: no webhook URLs, capability tokens, hashes or arbitrary error bodies.
        return (await this.listDeliveries(collectiveId)).map(record => ({
            actionId: record.actionId, occurrenceDate: record.occurrenceDate,
            step: record.step, memberId: record.memberId,
            lastAttemptAt: record.lastAttemptAt ?? null,
            lastSuccessAt: record.lastSuccessAt ?? null,
            nextAttemptAt: record.nextAttemptAt ?? null,
            failures: record.failures || 0, active: record.active === true
        }));
    }
}

module.exports = NotificationStateService;
