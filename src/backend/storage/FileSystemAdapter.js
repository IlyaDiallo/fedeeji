const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const StorageAdapter = require('./StorageAdapter');

// Shared across adapters in this process, not across Node workers.
const mutations = new Map();

class FileSystemAdapter extends StorageAdapter {
    constructor({ basePath }) {
        super();
        this.basePath = path.resolve(basePath);
    }

    _path({ collectiveId, collection }) {
        for (const segment of [collectiveId, collection]) {
            if (typeof segment !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(segment)) {
                throw new Error('Identifiant de stockage invalide');
            }
        }
        return path.join(this.basePath, collectiveId, `${collection}.json`);
    }

    async _getFilePath(params) {
        const filePath = this._path(params);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        return filePath;
    }

    async _mutate(params, fn) {
        const key = this._path(params);
        const previous = mutations.get(key) || Promise.resolve();
        const pending = previous.catch(() => {}).then(fn);
        mutations.set(key, pending);
        try {
            return await pending;
        } finally {
            if (mutations.get(key) === pending) mutations.delete(key);
        }
    }

    async _readAll(params) {
        try {
            const data = await fs.readFile(this._path(params), 'utf8');
            const items = JSON.parse(data);
            if (!Array.isArray(items)) throw new Error('Collection de stockage invalide');
            return items;
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    }

    async _writeAll({ collectiveId, collection, data }) {
        const filePath = await this._getFilePath({ collectiveId, collection });
        const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
        try {
            // Same filesystem, restrictive permissions; readers see old or new JSON.
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 });
            await fs.rename(tempPath, filePath);
        } finally {
            await fs.unlink(tempPath).catch(error => {
                if (error.code !== 'ENOENT') throw error;
            });
        }
    }

    async read({ collectiveId, collection, id }) {
        const allData = await this._readAll({ collectiveId, collection });
        return id ? allData.find(item => item.id === id) : allData;
    }

    async write({ collectiveId, collection, id, data }) {
        return this._mutate({ collectiveId, collection }, async () => {
            if (!id) {
                if (!Array.isArray(data)) throw new Error('Collection de stockage invalide');
                return this._writeAll({ collectiveId, collection, data });
            }
            const allData = await this._readAll({ collectiveId, collection });
            const index = allData.findIndex(item => item.id === id);
            if (index === -1) allData.push(data);
            else allData[index] = data;
            await this._writeAll({ collectiveId, collection, data: allData });
        });
    }

    async delete({ collectiveId, collection, id }) {
        return this._mutate({ collectiveId, collection }, async () => {
            if (!id) {
                try {
                    await fs.unlink(this._path({ collectiveId, collection }));
                } catch (error) {
                    if (error.code !== 'ENOENT') throw error;
                }
                return;
            }
            const allData = await this._readAll({ collectiveId, collection });
            await this._writeAll({
                collectiveId, collection, data: allData.filter(item => item.id !== id)
            });
        });
    }
}

module.exports = FileSystemAdapter;
