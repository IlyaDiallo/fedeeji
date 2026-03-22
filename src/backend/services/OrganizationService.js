const fs = require('fs').promises;
const path = require('path');

class OrganizationService {
    constructor() {
        const root = path.join(__dirname, '../../..');
        // Priorité au fichier dans /data, fallback à la racine
        this.filePath = path.join(root, 'data', 'organizations.json');
        this.fallbackPath = path.join(root, 'organizations.json');
    }

    async getAll() {
        // Chercher d'abord dans /data, puis à la racine
        for (const filePath of [this.filePath, this.fallbackPath]) {
            try {
                const data = await fs.readFile(filePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }
        return [];
    }

    async getById(id) {
        const orgs = await this.getAll();
        return orgs.find(org => org.id === id);
    }
}

module.exports = OrganizationService;
