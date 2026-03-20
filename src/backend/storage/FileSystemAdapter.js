const fs = require('fs').promises;
const path = require('path');
const StorageAdapter = require('./StorageAdapter');

class FileSystemAdapter extends StorageAdapter {
    /**
     * @param {Object} params
     * @param {string} params.basePath
     */
    constructor({ basePath }) {
        super();
        this.basePath = basePath;
    }

    async _getFilePath({ organisationId, collection }) {
        const dir = path.join(this.basePath, organisationId);
        await fs.mkdir(dir, { recursive: true });
        return path.join(dir, `${collection}.json`);
    }

    async _readAll({ organisationId, collection }) {
        try {
            const filePath = await this._getFilePath({ organisationId, collection });
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async _writeAll({ organisationId, collection, data }) {
        const filePath = await this._getFilePath({ organisationId, collection });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    async read({ organisationId, collection, id }) {
        const allData = await this._readAll({ organisationId, collection });
        if (id) {
            return allData.find((item) => item.id === id);
        }
        return allData;
    }

    async write({ organisationId, collection, id, data }) {
        const allData = await this._readAll({ organisationId, collection });
        if (id) {
            const index = allData.findIndex((item) => item.id === id);
            if (index !== -1) {
                allData[index] = data;
            } else {
                allData.push(data);
            }
            await this._writeAll({ organisationId, collection, data: allData });
        } else {
            // Écriture en bloc
            await this._writeAll({ organisationId, collection, data });
        }
    }

    async delete({ organisationId, collection, id }) {
        if (!id) {
            // Supprimer toute la collection
            const filePath = await this._getFilePath({ organisationId, collection });
            try {
                await fs.unlink(filePath);
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }
            return;
        }
        const allData = await this._readAll({ organisationId, collection });
        const filteredData = allData.filter((item) => item.id !== id);
        await this._writeAll({ organisationId, collection, data: filteredData });
    }
}

module.exports = FileSystemAdapter;
