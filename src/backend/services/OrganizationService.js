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

    async update(id, data) {
        const root = path.join(__dirname, '../../..');
        const filePath = path.join(root, 'data', 'organizations.json');
        let orgs = [];

        try {
            const dataContent = await fs.readFile(filePath, 'utf8');
            orgs = JSON.parse(dataContent);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        if (orgs.length === 0) {
            try {
                const fallbackContent = await fs.readFile(
                    this.fallbackPath, 'utf8'
                );
                orgs = JSON.parse(fallbackContent);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
        }

        const index = orgs.findIndex(org => org.id === id);
        if (index === -1) {
            throw new Error('Organisation non trouvée');
        }

        Object.assign(orgs[index], data);
        await fs.writeFile(
            filePath,
            JSON.stringify(orgs, null, 2),
            'utf8'
        );

        return orgs[index];
    }

    async uploadLogo(id, file) {
        const root = path.join(__dirname, '../../..');
        const logosDir = path.join(root, 'data', 'logos');
        await fs.mkdir(logosDir, { recursive: true });

        const ext = path.extname(file.originalname).toLowerCase();
        const logoPath = path.join(logosDir, `${id}${ext}`);

        await fs.writeFile(logoPath, file.buffer);

        const logoUrl = `/api/logos/${id}${ext}`;
        await this.update(id, { logo: logoUrl });

        return logoUrl;
    }
}

module.exports = OrganizationService;
