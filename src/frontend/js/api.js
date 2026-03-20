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

    isAuthenticated() {
        return !!this.token;
    }

    /** Rôle de l'utilisateur connecté */
    getRole() {
        return this.user?.role || null;
    }

    /** OrgId de l'utilisateur connecté (admin/member) */
    getUserOrgId() {
        return this.user?.orgId || null;
    }

    /** MemberId de l'utilisateur connecté */
    getMemberId() {
        return this.user?.memberId || null;
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
            const orgId = this.getUserOrgId();
            this.setToken(null);
            this.setUser(null);
            if (orgId) {
                window.location.href =
                    `/${orgId}/login`;
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
    async loginAdmin({ orgId, email, password }) {
        const res = await this.request(
            '/auth/login/admin',
            {
                method: 'POST',
                body: JSON.stringify({
                    orgId, email, password
                })
            }
        );
        this.setToken(res.token);
        this.setUser({
            role: res.role,
            orgId: res.orgId,
            memberId: res.memberId,
            memberName: res.memberName
        });
    }

    /** Connexion membre simple (email seul) */
    async loginMember({ orgId, email }) {
        const res = await this.request(
            '/auth/login/member',
            {
                method: 'POST',
                body: JSON.stringify({ orgId, email })
            }
        );
        this.setToken(res.token);
        this.setUser({
            role: res.role,
            orgId: res.orgId,
            memberId: res.memberId,
            memberName: res.memberName
        });
    }

    logout() {
        const orgId = this.getUserOrgId();
        this.setToken(null);
        this.setUser(null);
        if (orgId) {
            window.location.href = `/${orgId}/login`;
        } else {
            window.location.href = '/login';
        }
    }

    // --- API publique ---

    async getOrganizations() {
        return this.request('/auth/organizations');
    }

    // --- Profil membre ---

    async getMyProfile(orgId) {
        return this.request(
            `/api/${orgId}/members/me`
        );
    }

    async updateMyProfile(orgId, data) {
        return this.request(
            `/api/${orgId}/members/me`,
            {
                method: 'PUT',
                body: JSON.stringify(data)
            }
        );
    }

    // --- API protégée ---

    async get(orgId, collection) {
        return this.request(
            `/api/${orgId}/${collection}`
        );
    }

    async getById(orgId, collection, id) {
        return this.request(
            `/api/${orgId}/${collection}/${id}`
        );
    }

    async create(orgId, collection, data) {
        return this.request(
            `/api/${orgId}/${collection}`,
            {
                method: 'POST',
                body: JSON.stringify(data)
            }
        );
    }

    async update(orgId, collection, id, data) {
        return this.request(
            `/api/${orgId}/${collection}/${id}`,
            {
                method: 'PUT',
                body: JSON.stringify(data)
            }
        );
    }

    async delete(orgId, collection, id) {
        return this.request(
            `/api/${orgId}/${collection}/${id}`,
            { method: 'DELETE' }
        );
    }

    // --- Corbeille ---

    async getTrash(orgId) {
        return this.request(`/api/${orgId}/trash`);
    }

    async restoreFromTrash(orgId, trashId) {
        return this.request(
            `/api/${orgId}/trash/${trashId}/restore`,
            { method: 'POST' }
        );
    }

    async permanentDeleteFromTrash(orgId, trashId) {
        return this.request(
            `/api/${orgId}/trash/${trashId}`,
            { method: 'DELETE' }
        );
    }

    async emptyTrash(orgId) {
        return this.request(
            `/api/${orgId}/trash`,
            { method: 'DELETE' }
        );
    }

    /** Upload un fichier vers un endpoint */
    async uploadFile({ orgId, endpoint, file }) {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        if (this.token) {
            headers['Authorization'] =
                `Bearer ${this.token}`;
        }

        const response = await fetch(
            `/api/${orgId}/${endpoint}`,
            {
                method: 'POST',
                headers,
                body: formData
            }
        );

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
}

const api = new Api();
