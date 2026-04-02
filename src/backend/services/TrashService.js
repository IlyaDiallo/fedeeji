const crypto = require('crypto');

class TrashService {
    /**
     * @param {Object} params
     * @param {import('../storage/StorageAdapter')} params.storage
     */
    constructor({ storage }) {
        this.storage = storage;
        this.collection = 'trash';
    }

    /**
     * Déplace un élément dans la corbeille
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.sourceCollection
     * @param {any} params.item
     */
    async moveToTrash({ collectiveId, sourceCollection, item }) {
        const trashEntry = {
            id: crypto.randomUUID(),
            sourceCollection,
            item,
            deletedAt: Date.now()
        };
        const entries = await this.storage.read({
            collectiveId, collection: this.collection
        }) || [];
        entries.push(trashEntry);
        await this.storage.write({
            collectiveId, collection: this.collection, data: entries
        });
        return trashEntry;
    }

    /**
     * Liste le contenu de la corbeille
     * @param {Object} params
     * @param {string} params.collectiveId
     */
    async list({ collectiveId }) {
        return await this.storage.read({
            collectiveId, collection: this.collection
        }) || [];
    }

    /**
     * Restaure un élément depuis la corbeille
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.trashId
     */
    async restore({ collectiveId, trashId }) {
        const entries = await this.storage.read({
            collectiveId, collection: this.collection
        }) || [];
        const entry = entries.find(e => e.id === trashId);
        if (!entry) {
            throw new Error('Élément introuvable dans la corbeille');
        }

        // Restaurer dans la collection d'origine
        await this.storage.write({
            collectiveId,
            collection: entry.sourceCollection,
            id: entry.item.id,
            data: entry.item
        });

        // Retirer de la corbeille
        const remaining = entries.filter(e => e.id !== trashId);
        await this.storage.write({
            collectiveId, collection: this.collection, data: remaining
        });
        return entry;
    }

    /**
     * Supprime définitivement un élément de la corbeille
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.trashId
     */
    async permanentDelete({ collectiveId, trashId }) {
        const entries = await this.storage.read({
            collectiveId, collection: this.collection
        }) || [];
        const remaining = entries.filter(e => e.id !== trashId);
        if (remaining.length === entries.length) {
            throw new Error('Élément introuvable dans la corbeille');
        }
        await this.storage.write({
            collectiveId, collection: this.collection, data: remaining
        });
    }

    /**
     * Vide la corbeille
     * @param {Object} params
     * @param {string} params.collectiveId
     */
    async empty({ collectiveId }) {
        await this.storage.write({
            collectiveId, collection: this.collection, data: []
        });
    }
}

module.exports = TrashService;
