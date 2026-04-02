const crypto = require('crypto');

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
            details
        };

        const logs = await this.storage.read({ collectiveId, collection: this.collection }) || [];
        logs.push(logEntry);
        await this.storage.write({ collectiveId, collection: this.collection, data: logs });
    }

    async getLogs({ collectiveId }) {
        return await this.storage.read({ collectiveId, collection: this.collection }) || [];
    }
}

module.exports = LogService;
