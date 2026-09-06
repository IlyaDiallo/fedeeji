const crypto = require('crypto');
const { assertPublicCollection } = require('./internalCollections');

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
     * @param {string} params.collectiveId
     * @param {string} params.collection
     */
    async list({ collectiveId, collection }) {
        assertPublicCollection(collection);
        return await this.storage.read({ collectiveId, collection }) || [];
    }

    /**
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {string} params.id
     */
    async get({ collectiveId, collection, id }) {
        assertPublicCollection(collection);
        return await this.storage.read({ collectiveId, collection, id });
    }

    /**
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {any} params.data
     */
    async create({ collectiveId, collection, data }) {
        assertPublicCollection(collection);
        const id = crypto.randomUUID();
        const item = { ...data, id };

        await this.storage.write({ collectiveId, collection, id, data: item });

        await this.logService.log({
            collectiveId,
            action: 'CREATE',
            targetCollection: collection,
            targetId: id,
            details: { item }
        });

        return item;
    }

    /**
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {string} params.id
     * @param {any} params.data
     */
    async update({ collectiveId, collection, id, data }) {
        assertPublicCollection(collection);
        const previousData = await this.storage.read({
            collectiveId, collection, id
        });
        if (!previousData) {
            throw new Error('Élément introuvable');
        }

        const updatedItem = { ...previousData, ...data, id };
        await this.storage.write({
            collectiveId, collection, id, data: updatedItem
        });

        await this.logService.log({
            collectiveId,
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
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {string} params.id
     */
    async delete({ collectiveId, collection, id }) {
        assertPublicCollection(collection);
        const item = await this.storage.read({
            collectiveId, collection, id
        });
        if (!item) {
            throw new Error('Élément introuvable');
        }

        // Déplacer dans la corbeille avant suppression
        await this.trashService.moveToTrash({
            collectiveId,
            sourceCollection: collection,
            item
        });

        await this.storage.delete({ collectiveId, collection, id });

        await this.logService.log({
            collectiveId,
            action: 'DELETE',
            targetCollection: collection,
            targetId: id,
            details: { item }
        });
    }
}

module.exports = DataService;
