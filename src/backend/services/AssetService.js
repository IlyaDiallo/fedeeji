const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const MAX_IMPORT_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/gif', 'gif']
]);

/**
 * Catalogue d'images distant et import local.
 *
 * La recherche s'appuie sur Wikimedia Commons (catalogue vaste, sans clé API).
 * Une image choisie est copiée dans le stockage du collectif : les activités
 * ne dépendent donc pas d'un hotlink permanent vers le fournisseur.
 */
class AssetService {
    constructor({ basePath, fetchImpl = global.fetch }) {
        this.basePath = basePath;
        this.fetch = fetchImpl;
        this.cache = new Map();
        this.cacheTtl = 10 * 60 * 1000;
    }

    _cleanText(value, maxLength = 300) {
        if (!value) return '';
        return String(value)
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;|&apos;/gi, "'")
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength);
    }

    _safeHttpUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol)
                ? url.toString() : '';
        } catch {
            return '';
        }
    }

    async _fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await this.fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Feddeeji/0.4 (Wikimedia asset browser)',
                    ...(options.headers || {})
                }
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    /** Recherche des images libres sur Wikimedia Commons. */
    async search({ query, page = 1, limit = 18, lang = 'fr' }) {
        const cleanQuery = this._cleanText(query, 100);
        if (cleanQuery.length < 2) {
            const error = new Error('Saisissez au moins 2 caractères');
            error.status = 400;
            throw error;
        }

        const safePage = Math.min(Math.max(Number(page) || 1, 1), 20);
        const safeLimit = Math.min(Math.max(Number(limit) || 18, 6), 24);
        const safeLang = lang === 'en' ? 'en' : 'fr';
        const cacheKey = `${safeLang}:${safePage}:${safeLimit}:${cleanQuery}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.at < this.cacheTtl) {
            return cached.value;
        }

        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            formatversion: '2',
            generator: 'search',
            gsrsearch: cleanQuery,
            gsrnamespace: '6',
            gsrlimit: String(safeLimit),
            gsroffset: String((safePage - 1) * safeLimit),
            prop: 'imageinfo',
            iiprop: 'url|mime|extmetadata',
            iiurlwidth: '960',
            uselang: safeLang,
            origin: '*'
        });

        let response;
        try {
            response = await this._fetchWithTimeout(
                `${COMMONS_API}?${params.toString()}`
            );
        } catch (error) {
            const wrapped = new Error(
                error.name === 'AbortError'
                    ? 'Le catalogue d’images ne répond pas'
                    : 'Catalogue d’images indisponible'
            );
            wrapped.status = 502;
            throw wrapped;
        }

        if (!response.ok) {
            const error = new Error('Catalogue d’images indisponible');
            error.status = 502;
            throw error;
        }

        const payload = await response.json();
        const pages = payload?.query?.pages || [];
        const items = pages.map(item => {
            const info = item.imageinfo?.[0];
            const metadata = info?.extmetadata || {};
            if (!info || !ALLOWED_IMAGE_TYPES.has(info.mime)) return null;

            const originalUrl = this._safeHttpUrl(info.url);
            const previewUrl = this._safeHttpUrl(info.thumburl || info.url);
            if (!originalUrl || !previewUrl) return null;

            return {
                id: String(item.pageid),
                title: this._cleanText(
                    item.title?.replace(/^File:/i, ''), 180
                ),
                thumbnailUrl: previewUrl,
                importUrl: previewUrl,
                originalUrl,
                sourceUrl: this._safeHttpUrl(info.descriptionurl),
                author: this._cleanText(
                    metadata.Artist?.value || metadata.Credit?.value,
                    180
                ),
                license: this._cleanText(
                    metadata.LicenseShortName?.value || 'Wikimedia Commons',
                    80
                ),
                licenseUrl: this._safeHttpUrl(
                    metadata.LicenseUrl?.value
                ),
                provider: 'Wikimedia Commons'
            };
        }).filter(Boolean);

        const result = {
            items,
            page: safePage,
            hasMore: Boolean(payload.continue)
        };
        this.cache.set(cacheKey, { at: Date.now(), value: result });
        if (this.cache.size > 100) {
            this.cache.delete(this.cache.keys().next().value);
        }
        return result;
    }

    /** Télécharge un résultat Wikimedia dans data/<collectif>/uploads. */
    async importAsset({ collectiveId, asset }) {
        if (!/^[a-zA-Z0-9_-]+$/.test(collectiveId || '')) {
            const error = new Error('Identifiant de collectif invalide');
            error.status = 400;
            throw error;
        }

        let remoteUrl;
        try {
            remoteUrl = new URL(asset?.importUrl || '');
        } catch {
            const error = new Error('Adresse d’image invalide');
            error.status = 400;
            throw error;
        }
        if (
            remoteUrl.protocol !== 'https:'
            || remoteUrl.hostname !== 'upload.wikimedia.org'
        ) {
            const error = new Error('Fournisseur d’image non autorisé');
            error.status = 400;
            throw error;
        }

        let response;
        try {
            response = await this._fetchWithTimeout(
                remoteUrl.toString(), { redirect: 'error' }, 12000
            );
        } catch (error) {
            const wrapped = new Error('Impossible de télécharger cette image');
            wrapped.status = 502;
            throw wrapped;
        }
        if (!response.ok) {
            const error = new Error('Impossible de télécharger cette image');
            error.status = 502;
            throw error;
        }

        const contentType = (response.headers.get('content-type') || '')
            .split(';')[0].trim().toLowerCase();
        const extension = ALLOWED_IMAGE_TYPES.get(contentType);
        if (!extension) {
            const error = new Error('Format d’image non pris en charge');
            error.status = 400;
            throw error;
        }

        const declaredSize = Number(response.headers.get('content-length'));
        if (declaredSize && declaredSize > MAX_IMPORT_SIZE) {
            const error = new Error('Image trop volumineuse (5 Mo maximum)');
            error.status = 413;
            throw error;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_IMPORT_SIZE) {
            const error = new Error('Image trop volumineuse (5 Mo maximum)');
            error.status = 413;
            throw error;
        }

        const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const directory = path.join(
            this.basePath, collectiveId, 'uploads'
        );
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, filename), buffer);

        return {
            path: `/api/${collectiveId}/activity-images/${filename}`,
            attribution: {
                title: this._cleanText(asset.title, 180),
                author: this._cleanText(asset.author, 180),
                license: this._cleanText(asset.license, 80),
                licenseUrl: this._safeHttpUrl(asset.licenseUrl),
                sourceUrl: this._safeHttpUrl(asset.sourceUrl),
                provider: 'Wikimedia Commons'
            }
        };
    }
}

module.exports = AssetService;
