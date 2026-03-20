const crypto = require('crypto');

class DataService {
    /**
     * @param {Object} params
     * @param {import('../storage/StorageAdapter')} params.storage
     * @param {import('./TrashService')} params.trashService
     * @param {import('./LogService')} params.logService
     */
    constructor({ storage, trashService, logService }) {
        this.storage = storage;
        this.trashService = trashService;
        this.logService = logService;
    }

    /**
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     */
    async list({ organisationId, collection }) {
        return await this.storage.read({ organisationId, collection }) || [];
    }

    /**
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {string} params.id
     */
    async get({ organisationId, collection, id }) {
        return await this.storage.read({ organisationId, collection, id });
    }

    /**
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {any} params.data
     */
    async create({ organisationId, collection, data }) {
        const id = crypto.randomUUID();
        const item = { ...data, id };

        await this.storage.write({ organisationId, collection, id, data: item });

        await this.logService.log({
            organisationId,
            action: 'CREATE',
            targetCollection: collection,
            targetId: id,
            details: { item }
        });

        return item;
    }

    /**
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {string} params.id
     * @param {any} params.data
     */
    async update({ organisationId, collection, id, data }) {
        const previousData = await this.storage.read({
            organisationId, collection, id
        });
        if (!previousData) {
            throw new Error('Élément introuvable');
        }

        const updatedItem = { ...previousData, ...data, id };
        await this.storage.write({
            organisationId, collection, id, data: updatedItem
        });

        await this.logService.log({
            organisationId,
            action: 'UPDATE',
            targetCollection: collection,
            targetId: id,
            details: { previousData, updatedItem }
        });

        return updatedItem;
    }

    /**
     * Supprime un élément en le déplaçant dans la corbeille
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {string} params.id
     */
    async delete({ organisationId, collection, id }) {
        const item = await this.storage.read({
            organisationId, collection, id
        });
        if (!item) {
            throw new Error('Élément introuvable');
        }

        // Déplacer dans la corbeille avant suppression
        await this.trashService.moveToTrash({
            organisationId,
            sourceCollection: collection,
            item
        });

        await this.storage.delete({ organisationId, collection, id });

        await this.logService.log({
            organisationId,
            action: 'DELETE',
            targetCollection: collection,
            targetId: id,
            details: { item }
        });
    }
}

module.exports = DataService;
