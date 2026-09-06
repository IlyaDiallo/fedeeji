const crypto = require('crypto');
const tabler = require('@iconify-json/tabler/icons.json');

const COLLECTION = 'tabler';
const STYLE = 'doodle-v1';
const DEFAULT_ICON = 'clipboard-check';
const DEFAULT_PRIMARY = '#5b55e7';
const DEFAULT_SECONDARY = '#08a88a';
const MAX_RESULTS = 60;

const FEATURED = [
    'clipboard-check', 'wash', 'vacuum-cleaner', 'trash', 'recycle',
    'window', 'tools-kitchen-2', 'garden-cart', 'shopping-cart', 'tool',
    'package-import', 'truck-delivery', 'mail', 'file-text', 'calendar-event',
    'heart-handshake', 'first-aid-kit', 'bike', 'car', 'school'
];

const SYNONYMS = {
    // Français
    lessive: ['wash', 'shirt', 'hanger'],
    linge: ['wash', 'shirt', 'hanger'],
    laver: ['wash', 'droplet', 'soap'],
    lavage: ['wash', 'droplet', 'soap'],
    aspirateur: ['vacuum-cleaner'],
    aspirer: ['vacuum-cleaner'],
    menage: ['vacuum-cleaner', 'sparkles', 'brush'],
    nettoyer: ['sparkles', 'wash', 'brush'],
    nettoyage: ['sparkles', 'wash', 'brush'],
    vitre: ['window'],
    vitres: ['window'],
    fenetre: ['window'],
    poubelle: ['trash'],
    dechet: ['trash', 'recycle'],
    dechets: ['trash', 'recycle'],
    recyclage: ['recycle'],
    recycler: ['recycle'],
    verre: ['bottle', 'glass'],
    cuisine: ['tools-kitchen-2', 'cooker'],
    cuisiner: ['tools-kitchen-2', 'cooker'],
    repas: ['tools-kitchen-2', 'bowl-spoon'],
    vaisselle: ['tools-kitchen-2', 'wash'],
    jardin: ['garden-cart', 'plant'],
    jardinage: ['garden-cart', 'plant', 'shovel'],
    arroser: ['watering-can', 'droplet'],
    courses: ['shopping-cart', 'shopping-bag'],
    achat: ['shopping-cart', 'shopping-bag'],
    bricolage: ['tool', 'tools', 'hammer'],
    reparer: ['tool', 'tools', 'hammer'],
    maintenance: ['tool', 'tools', 'settings'],
    reception: ['package-import', 'clipboard-check'],
    livraison: ['truck-delivery', 'package-import'],
    colis: ['package', 'box'],
    administratif: ['file-text', 'clipboard-text'],
    document: ['file-text', 'files'],
    courrier: ['mail'],
    email: ['mail'],
    soin: ['first-aid-kit', 'heart'],
    sante: ['first-aid-kit', 'heart-rate-monitor'],
    transport: ['bus', 'car', 'bike'],
    voiture: ['car'],
    velo: ['bike'],
    evenement: ['calendar-event'],
    reunion: ['users-group', 'calendar-event'],
    accueil: ['heart-handshake', 'door-enter'],
    stock: ['packages', 'building-warehouse'],
    inventaire: ['clipboard-list', 'packages'],
    rangement: ['books', 'box'],
    securite: ['shield-check'],
    association: ['users-group', 'heart-handshake', 'building-community'],
    club: ['users-group', 'ball-football', 'friends'],
    groupe: ['users-group', 'friends', 'heart-handshake'],
    equipe: ['users-group', 'friends'],
    famille: ['home-heart', 'home', 'friends'],
    ecole: ['school', 'building-community'],
    residence: ['building-community', 'building-estate', 'home'],
    cooperative: ['building-community', 'heart-handshake'],
    fermer: ['lock'],
    ouvrir: ['door-enter'],
    cle: ['key'],
    // English task vocabulary and useful aliases
    laundry: ['wash', 'shirt', 'hanger'],
    cleaning: ['sparkles', 'vacuum-cleaner', 'brush'],
    vacuum: ['vacuum-cleaner'],
    garbage: ['trash'],
    rubbish: ['trash'],
    waste: ['trash', 'recycle'],
    cooking: ['tools-kitchen-2', 'cooker'],
    gardening: ['garden-cart', 'plant', 'shovel'],
    groceries: ['shopping-cart', 'shopping-bag'],
    repair: ['tool', 'tools', 'hammer'],
    delivery: ['truck-delivery', 'package-import'],
    meeting: ['users-group', 'calendar-event'],
    welcome: ['heart-handshake', 'door-enter'],
    healthcare: ['first-aid-kit', 'heart'],
    paperwork: ['file-text', 'clipboard-text'],
    group: ['users-group', 'friends'],
    team: ['users-group', 'friends'],
    family: ['home-heart', 'home'],
    school: ['school', 'building-community']
};

const LOCAL_LABELS = {
    fr: {
        'clipboard-check': 'Liste de tâches', wash: 'Lessive',
        'vacuum-cleaner': 'Aspirateur', trash: 'Déchets', recycle: 'Recyclage',
        window: 'Fenêtres', 'tools-kitchen-2': 'Cuisine',
        'garden-cart': 'Jardinage', 'shopping-cart': 'Courses', tool: 'Outils',
        'package-import': 'Réception', 'truck-delivery': 'Livraison',
        mail: 'Courrier', 'file-text': 'Documents',
        'calendar-event': 'Événement', 'heart-handshake': 'Accueil',
        'first-aid-kit': 'Premiers soins', bike: 'Vélo', car: 'Voiture',
        school: 'Formation', 'users-group': 'Groupe',
        friends: 'Communauté', 'ball-football': 'Club sportif',
        'home-heart': 'Foyer', 'building-community': 'Association',
        'building-estate': 'Résidence'
    },
    en: {
        'clipboard-check': 'Task list', wash: 'Laundry',
        'vacuum-cleaner': 'Vacuuming', trash: 'Waste', recycle: 'Recycling',
        window: 'Windows', 'tools-kitchen-2': 'Cooking',
        'garden-cart': 'Gardening', 'shopping-cart': 'Shopping', tool: 'Tools',
        'package-import': 'Receiving', 'truck-delivery': 'Delivery',
        mail: 'Mail', 'file-text': 'Documents',
        'calendar-event': 'Event', 'heart-handshake': 'Welcome',
        'first-aid-kit': 'First aid', bike: 'Bike', car: 'Car',
        school: 'Training', 'users-group': 'Group',
        friends: 'Community', 'ball-football': 'Sports club',
        'home-heart': 'Home', 'building-community': 'Organisation',
        'building-estate': 'Residence'
    }
};

class IllustrationService {
    constructor() {
        this.icons = tabler.icons || {};
        this.iconNames = Object.keys(this.icons).filter(name =>
            !name.startsWith('brand-')
            && !name.endsWith('-filled')
            && !name.endsWith('-off')
        );
        this.renderCache = new Map();
    }

    normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    seedFrom(value) {
        const digest = crypto.createHash('sha256')
            .update(String(value || DEFAULT_ICON))
            .digest();
        return digest.readUInt32BE(0) % 1000000;
    }

    hasIcon(name) {
        return typeof name === 'string'
            && /^[a-z0-9-]+$/.test(name)
            && Boolean(this.icons[name]);
    }

    _label(name, lang) {
        const safeLang = lang === 'en' ? 'en' : 'fr';
        return LOCAL_LABELS[safeLang][name]
            || name.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
    }

    _expandedTerms(query) {
        const normalized = this.normalizeText(query);
        if (!normalized) return [];
        const terms = new Set(
            normalized.split(' ').filter(term => term.length >= 2)
        );
        for (const [key, values] of Object.entries(SYNONYMS)) {
            if (normalized.includes(key)) {
                values.forEach(value => terms.add(value));
            }
        }
        return [...terms];
    }

    _score(name, terms, query) {
        const normalizedName = name.replace(/-/g, ' ');
        let score = 0;
        for (const term of terms) {
            const normalizedTerm = term.replace(/-/g, ' ');
            if (normalizedName === normalizedTerm) score = Math.max(score, 160);
            else if (name === term) score = Math.max(score, 155);
            else if (name.startsWith(`${term}-`)) score = Math.max(score, 115);
            else if (name.split('-').includes(term)) score = Math.max(score, 90);
            else if (normalizedName.includes(normalizedTerm)) {
                score = Math.max(score, 55);
            }
        }
        const directSynonyms = SYNONYMS[query] || [];
        const preferredIndex = directSynonyms.indexOf(name);
        if (preferredIndex >= 0) score += 240 - preferredIndex;
        if (name.includes('-off') || name.includes('-filled')) score -= 100;
        return score;
    }

    search({ query = '', lang = 'fr', limit = 30 } = {}) {
        const safeLimit = Math.min(Math.max(Number(limit) || 30, 6), MAX_RESULTS);
        const normalized = this.normalizeText(query);
        const terms = this._expandedTerms(query);
        let names;

        if (!terms.length) {
            names = FEATURED.filter(name => this.hasIcon(name));
        } else {
            names = this.iconNames
                .map(name => ({
                    name,
                    score: this._score(name, terms, normalized)
                }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score
                    || a.name.length - b.name.length
                    || a.name.localeCompare(b.name))
                .slice(0, safeLimit)
                .map(item => item.name);
        }

        return names.slice(0, safeLimit).map(name => ({
            name,
            label: this._label(name, lang),
            collection: COLLECTION,
            style: STYLE,
            seed: this.seedFrom(`${normalized}:${name}`)
        }));
    }

    normalizeRecipe(recipe, { fallbackSource = '' } = {}) {
        if (recipe === undefined || recipe === null) {
            return {
                collection: COLLECTION,
                name: DEFAULT_ICON,
                style: STYLE,
                seed: this.seedFrom(fallbackSource || DEFAULT_ICON)
            };
        }
        if (typeof recipe !== 'object' || Array.isArray(recipe)) {
            throw this._validationError('Recette d’illustration invalide');
        }
        const collection = recipe.collection || COLLECTION;
        const style = recipe.style || STYLE;
        const name = recipe.name;
        const numericSeed = Number(recipe.seed);
        if (collection !== COLLECTION) {
            throw this._validationError('Collection d’illustrations inconnue');
        }
        if (style !== STYLE) {
            throw this._validationError('Style d’illustration inconnu');
        }
        if (!this.hasIcon(name)) {
            throw this._validationError('Illustration inconnue');
        }
        if (
            !Number.isInteger(numericSeed)
            || numericSeed < 0
            || numericSeed > 999999
        ) {
            throw this._validationError('Graine d’illustration invalide');
        }
        return { collection, name, style, seed: numericSeed };
    }

    _validationError(message) {
        const error = new Error(message);
        error.status = 400;
        return error;
    }

    _random(seed) {
        let state = (seed >>> 0) || 1;
        return () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 0x100000000;
        };
    }

    _blobPath(seed) {
        const random = this._random(seed);
        const jitter = amount => Math.round((random() - 0.5) * amount);
        return [
            `M ${92 + jitter(24)} ${105 + jitter(24)}`,
            `C ${151 + jitter(35)} ${35 + jitter(25)},`,
            `${342 + jitter(40)} ${37 + jitter(25)},`,
            `${423 + jitter(24)} ${111 + jitter(30)}`,
            `C ${483 + jitter(25)} ${178 + jitter(35)},`,
            `${469 + jitter(30)} ${337 + jitter(35)},`,
            `${392 + jitter(30)} ${414 + jitter(28)}`,
            `C ${308 + jitter(35)} ${478 + jitter(24)},`,
            `${148 + jitter(35)} ${461 + jitter(30)},`,
            `${75 + jitter(26)} ${374 + jitter(35)}`,
            `C ${19 + jitter(28)} ${294 + jitter(35)},`,
            `${31 + jitter(25)} ${174 + jitter(30)},`,
            `${92 + jitter(24)} ${105 + jitter(24)} Z`
        ].join(' ');
    }

    _assertSafeBody(body) {
        if (
            typeof body !== 'string'
            || /<(script|image|foreignObject|a|use|style|iframe)\b/i.test(body)
            || /\s(on\w+|href|xlink:href)\s*=/i.test(body)
            || /url\s*\(/i.test(body)
        ) {
            throw new Error('Contenu SVG du catalogue invalide');
        }
    }

    render({ recipe, primaryColor, secondaryColor, compact = false }) {
        const safeRecipe = this.normalizeRecipe(recipe);
        const primary = /^#[0-9a-f]{6}$/i.test(primaryColor || '')
            ? primaryColor.toLowerCase() : DEFAULT_PRIMARY;
        const secondary = /^#[0-9a-f]{6}$/i.test(secondaryColor || '')
            ? secondaryColor.toLowerCase() : DEFAULT_SECONDARY;
        const isCompact = compact === true || compact === 'true';
        const key = [
            safeRecipe.name, safeRecipe.style, safeRecipe.seed,
            primary, secondary, isCompact ? 'compact' : 'cover'
        ].join(':');
        if (this.renderCache.has(key)) return this.renderCache.get(key);

        const body = this.icons[safeRecipe.name].body;
        this._assertSafeBody(body);
        const filterScale = isCompact ? 0.8 : 1.8;
        const iconX = isCompact ? 104 : 96;
        const iconY = isCompact ? 104 : 96;
        const iconScale = isCompact ? 12.66 : 13.33;
        const blob = this._blobPath(safeRecipe.seed);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><filter id="w" x="-12%" y="-12%" width="124%" height="124%">
<feTurbulence type="fractalNoise" baseFrequency=".018 .024" numOctaves="1" seed="${safeRecipe.seed % 997}" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="${filterScale}" xChannelSelector="R" yChannelSelector="G"/>
</filter></defs>
<path d="${blob}" fill="${secondary}" opacity=".16"/>
<g transform="translate(${iconX + 3} ${iconY + 2}) scale(${iconScale})" color="${secondary}" opacity=".24">${body}</g>
<g transform="translate(${iconX} ${iconY}) scale(${iconScale})" color="${primary}" filter="url(#w)">${body}</g>
</svg>`;
        const result = {
            svg,
            etag: `"${crypto.createHash('sha256').update(svg).digest('hex').slice(0, 24)}"`
        };
        this.renderCache.set(key, result);
        if (this.renderCache.size > 300) {
            this.renderCache.delete(this.renderCache.keys().next().value);
        }
        return result;
    }
}

IllustrationService.COLLECTION = COLLECTION;
IllustrationService.STYLE = STYLE;
IllustrationService.DEFAULT_ICON = DEFAULT_ICON;
IllustrationService.DEFAULT_PRIMARY = DEFAULT_PRIMARY;
IllustrationService.DEFAULT_SECONDARY = DEFAULT_SECONDARY;

module.exports = IllustrationService;
