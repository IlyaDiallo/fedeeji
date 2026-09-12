class StorageAdapter {
    /**
     * Lit une entité ou une liste d'entités
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {string} [params.id]
     * @returns {Promise<any>}
     */
    /** Atomically read/modify a collection. Callback mutates records and returns a result. */
    async mutate(params, callback) {
        throw new Error('Non implémenté');
    }

    async read({ collectiveId, collection, id }) {
        throw new Error('Non implémenté');
    }

    /**
     * Sauvegarde une ou plusieurs entités
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {string} [params.id]
     * @param {any} params.data
     * @returns {Promise<void>}
     */
    async write({ collectiveId, collection, id, data }) {
        throw new Error('Non implémenté');
    }

    /**
     * Supprime des données
     * @param {Object} params
     * @param {string} params.collectiveId
     * @param {string} params.collection
     * @param {string} [params.id]
     * @returns {Promise<void>}
     */
    async delete({ collectiveId, collection, id }) {
        throw new Error('Non implémenté');
    }
}

module.exports = StorageAdapter;
