const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

if (!SUPERADMIN_PASSWORD || !JWT_SECRET) {
    console.error(
        "ERREUR CRITIQUE: SUPERADMIN_PASSWORD et JWT_SECRET"
        + " doivent être définis dans les variables"
        + " d'environnement."
    );
    process.exit(1);
}

class AuthService {
    /**
     * @param {Object} params
     * @param {import('../storage/StorageAdapter')} params.storage
     */
    constructor({ storage }) {
        this.storage = storage;
    }

    /**
     * Connexion superadmin (mot de passe global)
     * @param {Object} params
     * @param {string} params.password
     */
    loginSuperadmin({ password }) {
        if (password !== SUPERADMIN_PASSWORD) {
            throw new Error('Mot de passe incorrect');
        }

        const token = jwt.sign(
            { role: 'superadmin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return { token, role: 'superadmin' };
    }

    /**
     * Connexion admin (membre avec flag admin + mot de passe)
     * @param {Object} params
     * @param {string} params.orgId
     * @param {string} params.email
     * @param {string} params.password
     */
    async loginAdmin({ orgId, email, password }) {
        const members = await this.storage.read({
            organisationId: orgId,
            collection: 'members'
        }) || [];

        const member = members.find(
            m => m.email?.toLowerCase() === email.toLowerCase()
        );

        if (!member) {
            throw new Error('Email introuvable');
        }

        if (!member.admin) {
            throw new Error('Ce membre n\'est pas administrateur');
        }

        if (!member.adminPassword) {
            throw new Error(
                'Aucun mot de passe admin configuré'
            );
        }

        const valid = await bcrypt.compare(
            password, member.adminPassword
        );
        if (!valid) {
            throw new Error('Mot de passe incorrect');
        }

        const token = jwt.sign(
            {
                role: 'admin',
                orgId,
                memberId: member.id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return {
            token,
            role: 'admin',
            orgId,
            memberId: member.id,
            memberName: `${member.firstName} ${member.lastName}`
        };
    }

    /**
     * Connexion membre simple (email seul, sans mot de passe)
     * @param {Object} params
     * @param {string} params.orgId
     * @param {string} params.email
     */
    async loginMember({ orgId, email }) {
        const members = await this.storage.read({
            organisationId: orgId,
            collection: 'members'
        }) || [];

        const member = members.find(
            m => m.email?.toLowerCase() === email.toLowerCase()
        );

        if (!member) {
            throw new Error('Email introuvable');
        }

        const token = jwt.sign(
            {
                role: 'member',
                orgId,
                memberId: member.id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return {
            token,
            role: 'member',
            orgId,
            memberId: member.id,
            memberName: `${member.firstName} ${member.lastName}`
        };
    }

    /**
     * Hash un mot de passe admin
     * @param {string} password
     */
    static async hashPassword(password) {
        return bcrypt.hash(password, 10);
    }

    verifyToken(token) {
        return jwt.verify(token, JWT_SECRET);
    }
}

module.exports = AuthService;
