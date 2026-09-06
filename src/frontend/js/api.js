class Api {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(
            localStorage.getItem('user') || 'null'
        );
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    setUser(user) {
        this.user = user;
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }

    /**
     * Décode le payload d'un JWT sans vérifier la signature.
     * @returns {Object|null}
     */
    _decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            const json = atob(
                payload.replace(/-/g, '+').replace(/_/g, '/')
            );
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    isAuthenticated() {
        if (!this.token) return false;

        // Un token expiré ou malformé doit être considéré comme
        // déconnecté, sinon l'app croit l'utilisateur authentifié
        // et le bloque hors des pages de connexion.
        const decoded = this._decodeToken(this.token);
        const isValid = decoded
            && (!decoded.exp || decoded.exp * 1000 > Date.now());

        if (!isValid) {
            this.setToken(null);
            this.setUser(null);
            return false;
        }
        return true;
    }

    /** Rôle de l'utilisateur connecté */
    getRole() {
        return this.user?.role || null;
    }

    /** OrgId de l'utilisateur connecté (admin/member) */
    getUserOrgId() {
        return this.user?.collectiveId || null;
    }

    /** MemberId de l'utilisateur connecté */
    getMemberId() {
        return this.user?.memberId || null;
    }

    /**
     * Identité stable de l'utilisateur connecté, utilisée pour
     * vérifier qu'on revient à la page mémorisée seulement si
     * c'est bien le même utilisateur qui se reconnecte.
     * @returns {string|null}
     */
    getUserKey() {
        if (!this.user) return null;
        if (this.user.role === 'superadmin') return 'superadmin';
        return `${this.user.collectiveId}:${this.user.memberId}`;
    }

    /**
     * Mémorise la page courante et l'utilisateur courant afin d'y
     * revenir après reconnexion (logout volontaire ou session
     * expirée). À appeler avant d'effacer le token/utilisateur.
     */
    rememberCurrentPage() {
        // Ne pas mémoriser une page de login
        if (/\/login$|\/register$|^\/login$/.test(
            window.location.pathname
        )) {
            return;
        }
        localStorage.setItem('redirectAfterLogin', JSON.stringify({
            path: window.location.pathname,
            user: this.getUserKey()
        }));
    }

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] =
                `Bearer ${this.token}`;
        }

        const response = await fetch(endpoint, {
            ...options,
            headers
        });

        if (
            response.status === 401
            && endpoint !== '/auth/login'
            && endpoint !== '/auth/login/admin'
            && endpoint !== '/auth/login/member'
        ) {
            const collectiveId = this.getUserOrgId();
            this.rememberCurrentPage();
            this.setToken(null);
            this.setUser(null);
            if (collectiveId) {
                window.location.href =
                    `/${collectiveId}/login`;
            } else {
                window.location.href = '/login';
            }
            throw new Error('Non autorisé');
        }

        if (!response.ok) {
            const error = await response.json()
                .catch(() => ({}));
            throw new Error(
                error.error
                || `Erreur HTTP: ${response.status}`
            );
        }

        return response.json();
    }

    // --- Méthodes d'authentification ---

    async verifyRegistrationPassword(collectiveId, password) {
        return this.request('/auth/verify-registration-password', {
            method: 'POST',
            body: JSON.stringify({ collectiveId, password })
        });
    }

    async registerMember({ collectiveId, password, memberData }) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ collectiveId, password, memberData })
        });
    }

    /** Connexion superadmin */
    async login(password) {
        const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        this.setToken(res.token);
        this.setUser({ role: res.role });
    }

    /** Connexion admin (membre avec flag admin) */
    async loginAdmin({ collectiveId, email, password }) {
        const res = await this.request(
            '/auth/login/admin',
            {
                method: 'POST',
                body: JSON.stringify({
                    collectiveId, email, password
                })
            }
        );
        this.setToken(res.token);
        this.setUser({
            role: res.role,
            collectiveId: res.collectiveId,
            memberId: res.memberId,
            memberName: res.memberName
        });
    }

    /** Connexion membre simple (email seul) */
    async loginMember({ collectiveId, email }) {
        const res = await this.request(
            '/auth/login/member',
            {
                method: 'POST',
                body: JSON.stringify({ collectiveId, email })
            }
        );
        this.setToken(res.token);
        this.setUser({
            role: res.role,
            collectiveId: res.collectiveId,
            memberId: res.memberId,
            memberName: res.memberName
        });
    }

    logout() {
        const collectiveId = this.getUserOrgId();
        // Mémoriser la page courante : si le même utilisateur se
        // reconnecte, il y reviendra automatiquement.
        this.rememberCurrentPage();
        this.setToken(null);
        this.setUser(null);
        if (collectiveId) {
            window.location.href = `/${collectiveId}/login`;
        } else {
            window.location.href = '/login';
        }
    }

    // --- API publique ---

    /** Version de l'application (depuis package.json côté serveur) */
    async getVersion() {
        return this.request('/api/version');
    }

    async getCollectives() {
        return this.request('/auth/collectives');
    }

    async getSuperadminEmail() {
        return this.request('/auth/superadmin-email');
    }

    // --- Profil membre ---

    async getMyProfile(collectiveId) {
        return this.request(
            `/api/${collectiveId}/members/me`
        );
    }

    async updateMyProfile(collectiveId, data) {
        return this.request(
            `/api/${collectiveId}/members/me`,
            {
                method: 'PUT',
                body: JSON.stringify(data)
            }
        );
    }

    // --- API protégée ---

    async get(collectiveId, collection) {
        return this.request(
            `/api/${collectiveId}/${collection}`
        );
    }

    async getById(collectiveId, collection, id) {
        return this.request(
            `/api/${collectiveId}/${collection}/${id}`
        );
    }

    async create(collectiveId, collection, data) {
        return this.request(
            `/api/${collectiveId}/${collection}`,
            {
                method: 'POST',
                body: JSON.stringify(data)
            }
        );
    }

    async update(collectiveId, collection, id, data) {
        return this.request(
            `/api/${collectiveId}/${collection}/${id}`,
            {
                method: 'PUT',
                body: JSON.stringify(data)
            }
        );
    }

    async delete(collectiveId, collection, id) {
        return this.request(
            `/api/${collectiveId}/${collection}/${id}`,
            { method: 'DELETE' }
        );
    }

    // --- Corbeille ---

    async getTrash(collectiveId) {
        return this.request(`/api/${collectiveId}/trash`);
    }

    async restoreFromTrash(collectiveId, trashId) {
        return this.request(
            `/api/${collectiveId}/trash/${trashId}/restore`,
            { method: 'POST' }
        );
    }

    async permanentDeleteFromTrash(collectiveId, trashId) {
        return this.request(
            `/api/${collectiveId}/trash/${trashId}`,
            { method: 'DELETE' }
        );
    }

    async emptyTrash(collectiveId) {
        return this.request(
            `/api/${collectiveId}/trash`,
            { method: 'DELETE' }
        );
    }

    /** Envoi d'un FormData avec authentification */
    async _fetchFormData(url, formData) {
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        const response = await fetch(url, {
            method: 'POST', headers, body: formData
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(
                error.error || `Erreur HTTP: ${response.status}`
            );
        }
        return response.json();
    }

    /** Upload un fichier vers un endpoint */
    async uploadFile({ collectiveId, endpoint, file }) {
        const formData = new FormData();
        formData.append('file', file);
        return this._fetchFormData(
            `/api/${collectiveId}/${endpoint}`, formData
        );
    }

    // --- Catalogue d'assets visuels ---

    async searchIllustrations(collectiveId, {
        query = '', lang = 'fr', limit = 30
    } = {}) {
        const params = new URLSearchParams({
            q: query, lang, limit: String(limit)
        });
        return this.request(
            `/api/${collectiveId}/assets/illustrations?${params.toString()}`
        );
    }

    async searchAssets(collectiveId, { query, page = 1, lang = 'fr' }) {
        const params = new URLSearchParams({
            q: query, page: String(page), lang
        });
        return this.request(
            `/api/${collectiveId}/assets/search?${params.toString()}`
        );
    }

    async importAsset(collectiveId, asset) {
        return this.request(
            `/api/${collectiveId}/assets/import`,
            {
                method: 'POST',
                body: JSON.stringify({ asset })
            }
        );
    }

    // --- Notifications Home Assistant ---

    /** Envoie une notification de test vers le webhook HA du membre connecté. */
    async getNotificationSettings(collectiveId) {
        return this.request(`/api/${collectiveId}/notifications/settings`);
    }

    async saveNotificationSettings(collectiveId, settings) {
        return this.request(`/api/${collectiveId}/notifications/settings`, {
            method: 'PUT', body: JSON.stringify(settings)
        });
    }

    async getNotificationDiagnostics(collectiveId) {
        return this.request(`/api/${collectiveId}/notifications/diagnostics`);
    }

    async testHaNotification(collectiveId, memberId) {
        return this.request(
            `/api/${collectiveId}/notifications/test-ha`,
            { method: 'POST', body: JSON.stringify(memberId ? { memberId } : {}) }
        );
    }

    /** Déclenche un check immédiat des notifications (admin). */
    async triggerNotifications(collectiveId) {
        return this.request(
            `/api/${collectiveId}/notifications/trigger`,
            { method: 'POST' }
        );
    }

    /** Catalogue local pour choisir le logo d'un collectif (superadmin). */
    async searchCollectiveLogos({
        query = '', lang = 'fr', limit = 36, color = '#5b55e7'
    } = {}) {
        const params = new URLSearchParams({
            q: query,
            lang,
            limit: String(limit),
            color
        });
        return this.request(
            `/auth/illustrations?${params.toString()}`
        );
    }

    /** Modifier un collectif (superadmin) */
    async updateCollective(id, data) {
        return this.request(
            `/auth/collectives/${id}`,
            {
                method: 'PUT',
                body: JSON.stringify(data)
            }
        );
    }

    /** Créer un collectif (superadmin) */
    async createCollective(data) {
        return this.request(
            '/auth/collectives',
            {
                method: 'POST',
                body: JSON.stringify(data)
            }
        );
    }

    /** Supprimer un collectif (superadmin) */
    async deleteCollective(id) {
        return this.request(
            `/auth/collectives/${id}`,
            { method: 'DELETE' }
        );
    }

    /** Upload le logo d'un collectif (superadmin) */
    async uploadOrgLogo(id, file) {
        const formData = new FormData();
        formData.append('file', file);
        return this._fetchFormData(
            `/auth/collectives/${id}/logo`, formData
        );
    }
}

const api = new Api();
