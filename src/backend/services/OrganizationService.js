const fs = require('fs').promises;
const path = require('path');

class OrganizationService {
    constructor() {
        this.filePath = path.join(__dirname, '../../../organizations.json');
    }

    async getAll() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async getById(id) {
        const orgs = await this.getAll();
        return orgs.find(org => org.id === id);
    }
}

module.exports = OrganizationService;
