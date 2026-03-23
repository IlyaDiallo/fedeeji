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

    /**
     * Crée une nouvelle organisation
     * @param {Object} params
     * @param {string} params.id - Identifiant unique (slug)
     * @param {string} params.name - Nom complet
     * @param {string} params.label - Label court
     * @param {string} [params.adminEmail] - Email admin
     * @param {string} [params.defaultLanguage] - Langue par défaut
     * @param {string} [params.registrationPassword] - Mot de passe inscription
     */
    async create({ id, name, label, adminEmail, defaultLanguage, registrationPassword }) {
        const root = path.join(__dirname, '../../..');
        const filePath = path.join(root, 'data', 'organizations.json');
        const dataDir = path.join(root, 'data', id);

        // Vérifier si l'ID existe déjà
        const existing = await this.getAll();
        if (existing.find(org => org.id === id)) {
            throw new Error('Une organisation avec cet ID existe déjà');
        }

        // Valider l'ID (slug valide)
        if (!/^[a-z0-9-]+$/.test(id)) {
            throw new Error(
                'L\'ID doit contenir uniquement des lettres minuscules, '
                + 'chiffres et tirets'
            );
        }

        // Créer le dossier de données
        await fs.mkdir(dataDir, { recursive: true });

        // Initialiser les fichiers de données
        const collections = [
            'members.json', 'events.json', 'subscriptions.json',
            'participations.json'
        ];
        for (const col of collections) {
            await fs.writeFile(
                path.join(dataDir, col),
                JSON.stringify([]),
                'utf8'
            );
        }

        // Lire les organisations existantes
        let orgs = [];
        try {
            const content = await fs.readFile(filePath, 'utf8');
            orgs = JSON.parse(content);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        const newOrg = {
            id,
            name,
            label,
            adminEmail: adminEmail || '',
            defaultLanguage: defaultLanguage || 'fr',
            registrationPassword: registrationPassword || '',
            createdAt: new Date().toISOString()
        };

        orgs.push(newOrg);
        await fs.writeFile(filePath, JSON.stringify(orgs, null, 2), 'utf8');

        return newOrg;
    }

    /**
     * Supprime une organisation
     * @param {string} id
     */
    async delete(id) {
        const root = path.join(__dirname, '../../..');
        const filePath = path.join(root, 'data', 'organizations.json');
        const dataDir = path.join(root, 'data', id);
        const logosDir = path.join(root, 'data', 'logos');

        // Lire les organisations existantes
        let orgs = [];
        try {
            const content = await fs.readFile(filePath, 'utf8');
            orgs = JSON.parse(content);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        const index = orgs.findIndex(org => org.id === id);
        if (index === -1) {
            throw new Error('Organisation non trouvée');
        }

        // Supprimer l'organisation de la liste
        orgs.splice(index, 1);
        await fs.writeFile(filePath, JSON.stringify(orgs, null, 2), 'utf8');

        // Supprimer le dossier de données
        try {
            await fs.rm(dataDir, { recursive: true, force: true });
        } catch (error) {
            console.error(`Erreur suppression dossier ${id}:`, error);
        }

        // Supprimer les logos associés
        try {
            const logoFiles = await fs.readdir(logosDir);
            for (const file of logoFiles) {
                if (file.startsWith(id)) {
                    await fs.unlink(path.join(logosDir, file));
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Erreur suppression logos ${id}:`, error);
            }
        }

        return { success: true };
    }
}

module.exports = OrganizationService;
