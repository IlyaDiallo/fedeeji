class StorageAdapter {
    /**
     * Lit une entité ou une liste d'entités
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {string} [params.id]
     * @returns {Promise<any>}
     */
    async read({ organisationId, collection, id }) {
        throw new Error('Non implémenté');
    }

    /**
     * Sauvegarde une ou plusieurs entités
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {string} [params.id]
     * @param {any} params.data
     * @returns {Promise<void>}
     */
    async write({ organisationId, collection, id, data }) {
        throw new Error('Non implémenté');
    }

    /**
     * Supprime des données
     * @param {Object} params
     * @param {string} params.organisationId
     * @param {string} params.collection
     * @param {string} [params.id]
     * @returns {Promise<void>}
     */
    async delete({ organisationId, collection, id }) {
        throw new Error('Non implémenté');
    }
}

module.exports = StorageAdapter;
