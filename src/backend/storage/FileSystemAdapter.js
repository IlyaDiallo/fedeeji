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

    async _getFilePath({ collectiveId, collection }) {
        const dir = path.join(this.basePath, collectiveId);
        await fs.mkdir(dir, { recursive: true });
        return path.join(dir, `${collection}.json`);
    }

    async _readAll({ collectiveId, collection }) {
        try {
            const filePath = await this._getFilePath({ collectiveId, collection });
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async _writeAll({ collectiveId, collection, data }) {
        const filePath = await this._getFilePath({ collectiveId, collection });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    async read({ collectiveId, collection, id }) {
        const allData = await this._readAll({ collectiveId, collection });
        if (id) {
            return allData.find((item) => item.id === id);
        }
        return allData;
    }

    async write({ collectiveId, collection, id, data }) {
        const allData = await this._readAll({ collectiveId, collection });
        if (id) {
            const index = allData.findIndex((item) => item.id === id);
            if (index !== -1) {
                allData[index] = data;
            } else {
                allData.push(data);
            }
            await this._writeAll({ collectiveId, collection, data: allData });
        } else {
            // Écriture en bloc
            await this._writeAll({ collectiveId, collection, data });
        }
    }

    async delete({ collectiveId, collection, id }) {
        if (!id) {
            // Supprimer toute la collection
            const filePath = await this._getFilePath({ collectiveId, collection });
            try {
                await fs.unlink(filePath);
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }
            return;
        }
        const allData = await this._readAll({ collectiveId, collection });
        const filteredData = allData.filter((item) => item.id !== id);
        await this._writeAll({ collectiveId, collection, data: filteredData });
    }
}

module.exports = FileSystemAdapter;
