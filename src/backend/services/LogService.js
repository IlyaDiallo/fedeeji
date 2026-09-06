const crypto = require('crypto');

const SECRET_KEYS = new Set(['haWebhookId', 'haWebhookUrl', 'token', 'tokenHash', 'adminPassword']);
function redactSecrets(value) {
    if (Array.isArray(value)) return value.map(redactSecrets);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key, SECRET_KEYS.has(key) ? '[REDACTED]' : redactSecrets(item)
    ]));
}

class LogService {
    /**
     * @param {Object} params
     * @param {import('../storage/StorageAdapter')} params.storage
     */
    constructor({ storage }) {
        this.storage = storage;
        this.collection = 'logs';
    }

    /**
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.action
     * @param {string} params.targetCollection
     * @param {string} params.targetId
     * @param {any} params.details
     */
    async log({ collectiveId, action, targetCollection, targetId, details }) {
        const logEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            action,
            targetCollection,
            targetId,
            details: redactSecrets(details)
        };

        await this.storage.write({
            collectiveId, collection: this.collection, id: logEntry.id, data: logEntry
        });
    }

    async getLogs({ collectiveId }) {
        return redactSecrets(await this.storage.read({ collectiveId, collection: this.collection }) || []);
    }
}

module.exports = LogService;
