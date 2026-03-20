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
     * @param {string} params.organisationId
     * @param {string} params.action
     * @param {string} params.targetCollection
     * @param {string} params.targetId
     * @param {any} params.details
     */
    async log({ organisationId, action, targetCollection, targetId, details }) {
        const logEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            action,
            targetCollection,
            targetId,
            details
        };

        const logs = await this.storage.read({ organisationId, collection: this.collection }) || [];
        logs.push(logEntry);
        await this.storage.write({ organisationId, collection: this.collection, data: logs });
    }

    async getLogs({ organisationId }) {
        return await this.storage.read({ organisationId, collection: this.collection }) || [];
    }
}

module.exports = LogService;
