const fs = require('fs').promises;
const path = require('path');
const IllustrationService = require('./IllustrationService');

const DEFAULT_PRIMARY = '#5b55e7';
const DEFAULT_SECONDARY = '#08a88a';
const DEFAULT_TYPE_FR = 'groupe';
const DEFAULT_TYPE_EN = 'group';

class CollectiveService {
    constructor({ illustrationService } = {}) {
        const root = path.join(__dirname, '../../..');
        this.illustrationService = illustrationService
            || new IllustrationService();
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

    _colorError() {
        const error = new Error(
            'La couleur principale doit être au format #RRGGBB'
        );
        error.status = 400;
        return error;
    }

    _normalizeColor(value) {
        if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
            throw this._colorError();
        }
        return value.toLowerCase();
    }

    _hexToHsl(hex) {
        const value = parseInt(hex.slice(1), 16);
        const r = ((value >> 16) & 255) / 255;
        const g = ((value >> 8) & 255) / 255;
        const b = (value & 255) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lightness = (max + min) / 2;
        let hue = 0;
        let saturation = 0;
        if (max !== min) {
            const delta = max - min;
            saturation = lightness > 0.5
                ? delta / (2 - max - min)
                : delta / (max + min);
            if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
            else if (max === g) hue = (b - r) / delta + 2;
            else hue = (r - g) / delta + 4;
            hue /= 6;
        }
        return { h: hue * 360, s: saturation * 100, l: lightness * 100 };
    }

    _hslToHex({ h, s, l }) {
        const saturation = s / 100;
        const lightness = l / 100;
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const section = (((h % 360) + 360) % 360) / 60;
        const x = chroma * (1 - Math.abs((section % 2) - 1));
        let [r, g, b] = section < 1 ? [chroma, x, 0]
            : section < 2 ? [x, chroma, 0]
                : section < 3 ? [0, chroma, x]
                    : section < 4 ? [0, x, chroma]
                        : section < 5 ? [x, 0, chroma]
                            : [chroma, 0, x];
        const match = lightness - chroma / 2;
        const toHex = channel => Math.round((channel + match) * 255)
            .toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    _contrastColor(hex) {
        const value = parseInt(hex.slice(1), 16);
        const channels = [
            (value >> 16) & 255, (value >> 8) & 255, value & 255
        ].map(channel => {
            const normalized = channel / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        const luminance = 0.2126 * channels[0]
            + 0.7152 * channels[1] + 0.0722 * channels[2];
        return luminance > 0.43 ? '#17253f' : '#ffffff';
    }

    resolveTheme(primaryValue) {
        const primaryColor = this._normalizeColor(
            primaryValue || DEFAULT_PRIMARY
        );
        const hsl = this._hexToHsl(primaryColor);
        const secondaryColor = primaryColor === DEFAULT_PRIMARY
            ? DEFAULT_SECONDARY
            : this._hslToHex({
                h: hsl.h - 72,
                s: Math.min(82, Math.max(58, hsl.s + 10)),
                l: Math.min(54, Math.max(36, hsl.l - 8))
            });
        const primaryDark = primaryColor === DEFAULT_PRIMARY
            ? '#443dcc'
            : this._hslToHex({
                h: hsl.h,
                s: Math.min(88, Math.max(40, hsl.s)),
                l: Math.min(43, Math.max(25, hsl.l - 13))
            });
        return {
            primaryColor,
            secondaryColor,
            primaryDark,
            onPrimaryColor: this._contrastColor(primaryColor)
        };
    }

    _defaultTypeLabel(language) {
        return language === 'en' ? DEFAULT_TYPE_EN : DEFAULT_TYPE_FR;
    }

    _normalizeTypeLabel(value, language = 'fr') {
        const normalized = String(value || '')
            .trim()
            .replace(/\s+/g, ' ');
        if (!normalized) return this._defaultTypeLabel(language);
        if (
            normalized.length > 48
            || !/^[\p{L}\p{N}][\p{L}\p{N} '&’.-]*$/u.test(normalized)
        ) {
            const error = new Error(
                'Le type de collectif doit être un libellé simple de 48 caractères maximum'
            );
            error.status = 400;
            throw error;
        }
        return normalized;
    }

    _defaultLogoRecipe({ id, typeLabel }) {
        const normalized = String(typeLabel || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const name = /club|sport/.test(normalized)
            ? 'ball-football'
            : /ecole|school|formation/.test(normalized)
                ? 'school'
                : /famille|family|maison|home/.test(normalized)
                    ? 'home-heart'
                    : /residence|copro|habitat|cooperat/.test(normalized)
                        ? 'building-community'
                        : 'users-group';
        return this.illustrationService.normalizeRecipe({
            collection: 'tabler',
            name,
            style: 'doodle-v1',
            seed: this.illustrationService.seedFrom(
                `logo:${id}:${typeLabel}`
            )
        });
    }

    _normalizeLogoIllustration(value, { id, typeLabel }) {
        if (value === null) return null;
        if (value === undefined) {
            return this._defaultLogoRecipe({ id, typeLabel });
        }
        return this.illustrationService.normalizeRecipe(value, {
            fallbackSource: `logo:${id}:${typeLabel}`
        });
    }

    _withTheme(org) {
        return {
            ...org,
            typeLabel: this._normalizeTypeLabel(
                org.typeLabel, org.defaultLanguage
            ),
            ...this.resolveTheme(org.primaryColor)
        };
    }

    async getAll() {
        const orgs = await this._readOrgs();
        return orgs.map(org => this._withTheme(org));
    }

    async getById(id) {
        const orgs = await this._readOrgs();
        const org = orgs.find(item => item.id === id);
        return org ? this._withTheme(org) : undefined;
    }

    async update(id, data) {
        const orgs = await this._readOrgs();
        const index = orgs.findIndex(org => org.id === id);
        if (index === -1) {
            throw new Error('Collectif non trouvé');
        }

        const updated = { ...orgs[index], ...data };
        updated.typeLabel = this._normalizeTypeLabel(
            updated.typeLabel, updated.defaultLanguage
        );
        if (Object.hasOwn(data, 'logoIllustration')) {
            updated.logoIllustration = this._normalizeLogoIllustration(
                data.logoIllustration,
                { id, typeLabel: updated.typeLabel }
            );
        }
        Object.assign(updated, this.resolveTheme(updated.primaryColor));
        orgs[index] = updated;
        await this._writeOrgs(orgs);
        return updated;
    }

    async uploadLogo(id, file) {
        const logosDir = path.join(this.dataDir, 'logos');
        await fs.mkdir(logosDir, { recursive: true });

        const ext = path.extname(file.originalname).toLowerCase();
        const logoPath = path.join(logosDir, `${id}${ext}`);
        await fs.writeFile(logoPath, file.buffer);

        const logoUrl = `/api/logos/${id}${ext}`;
        await this.update(id, {
            logo: logoUrl,
            logoIllustration: null
        });
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
     * @param {string} [params.primaryColor]
     * @param {string} [params.typeLabel]
     * @param {Object} [params.logoIllustration]
     */
    async create({
        id, name, label, adminEmail, defaultLanguage,
        registrationPassword, contributionsEnabled, primaryColor,
        typeLabel, logoIllustration
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

        const language = defaultLanguage || 'fr';
        const safeTypeLabel = this._normalizeTypeLabel(
            typeLabel, language
        );
        const safeLogoIllustration = this._normalizeLogoIllustration(
            logoIllustration, { id, typeLabel: safeTypeLabel }
        );
        const theme = this.resolveTheme(primaryColor);

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
            typeLabel: safeTypeLabel,
            logoIllustration: safeLogoIllustration,
            adminEmail: adminEmail || '',
            defaultLanguage: language,
            registrationPassword: registrationPassword || '',
            contributionsEnabled: contributionsEnabled !== false,
            ...theme,
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
