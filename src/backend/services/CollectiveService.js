const fs = require('fs').promises;
const path = require('path');

class CollectiveService {
    constructor() {
        const root = path.join(__dirname, '../../..');
        this.dataDir = path.join(root, 'data');
        // Priorité au fichier dans /data, fallback à la racine
        this.filePath = path.join(this.dataDir, 'collectives.json');
        this.fallbackPath = path.join(root, 'collectives.json');
    }

    /**
     * Lit la liste des collectifs depuis le fichier principal ou le fallback.
     * @returns {Promise<Array>}
     */
    async _readOrgs() {
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

    /**
     * Écrit la liste des collectifs dans le fichier principal.
     * @param {Array} orgs
     */
    async _writeOrgs(orgs) {
        await fs.writeFile(
            this.filePath,
            JSON.stringify(orgs, null, 2),
            'utf8'
        );
    }

    async getAll() {
        return this._readOrgs();
    }

    async getById(id) {
        const orgs = await this._readOrgs();
        return orgs.find(org => org.id === id);
    }

    async update(id, data) {
        const orgs = await this._readOrgs();
        const index = orgs.findIndex(org => org.id === id);
        if (index === -1) {
            throw new Error('Collectif non trouvé');
        }

        Object.assign(orgs[index], data);
        await this._writeOrgs(orgs);
        return orgs[index];
    }

    async uploadLogo(id, file) {
        const logosDir = path.join(this.dataDir, 'logos');
        await fs.mkdir(logosDir, { recursive: true });

        const ext = path.extname(file.originalname).toLowerCase();
        const logoPath = path.join(logosDir, `${id}${ext}`);
        await fs.writeFile(logoPath, file.buffer);

        const logoUrl = `/api/logos/${id}${ext}`;
        await this.update(id, { logo: logoUrl });
        return logoUrl;
    }

    /**
     * Crée un nouveau collectif
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.name
     * @param {string} params.label
     * @param {string} [params.adminEmail]
     * @param {string} [params.defaultLanguage]
     * @param {string} [params.registrationPassword]
     * @param {boolean} [params.contributionsEnabled]
     */
    async create({
        id, name, label, adminEmail, defaultLanguage,
        registrationPassword, contributionsEnabled
    }) {
        const dataDir = path.join(this.dataDir, id);

        // Vérifier si l'ID existe déjà
        const existing = await this._readOrgs();
        if (existing.find(org => org.id === id)) {
            throw new Error('Un collectif avec cet ID existe déjà');
        }

        // Valider l'ID (slug valide)
        if (!/^[a-z0-9-]+$/.test(id)) {
            throw new Error(
                'L\'ID doit contenir uniquement des lettres '
                + 'minuscules, chiffres et tirets'
            );
        }

        // Créer le dossier de données
        await fs.mkdir(dataDir, { recursive: true });

        // Initialiser les fichiers de données
        const collections = [
            'members.json', 'events.json',
            'contributions.json', 'inscriptions.json'
        ];
        for (const col of collections) {
            await fs.writeFile(
                path.join(dataDir, col),
                JSON.stringify([]),
                'utf8'
            );
        }

        const newOrg = {
            id, name, label,
            adminEmail: adminEmail || '',
            defaultLanguage: defaultLanguage || 'fr',
            registrationPassword: registrationPassword || '',
            contributionsEnabled: contributionsEnabled !== false,
            createdAt: new Date().toISOString()
        };

        existing.push(newOrg);
        await this._writeOrgs(existing);
        return newOrg;
    }

    /**
     * Supprime un collectif
     * @param {string} id
     */
    async delete(id) {
        const orgs = await this._readOrgs();
        const index = orgs.findIndex(org => org.id === id);
        if (index === -1) {
            throw new Error('Collectif non trouvé');
        }

        orgs.splice(index, 1);
        await this._writeOrgs(orgs);

        // Supprimer le dossier de données
        const dataDir = path.join(this.dataDir, id);
        try {
            await fs.rm(dataDir, { recursive: true, force: true });
        } catch (error) {
            console.error(
                `Erreur suppression dossier ${id}:`, error
            );
        }

        // Supprimer les logos associés
        const logosDir = path.join(this.dataDir, 'logos');
        try {
            const logoFiles = await fs.readdir(logosDir);
            for (const file of logoFiles) {
                if (file.startsWith(id)) {
                    await fs.unlink(path.join(logosDir, file));
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(
                    `Erreur suppression logos ${id}:`, error
                );
            }
        }

        return { success: true };
    }
}

module.exports = CollectiveService;
