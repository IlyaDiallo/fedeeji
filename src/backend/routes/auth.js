const express = require('express');

/**
 * @param {Object} params
 * @param {import('../services/AuthService')} params.authService
 * @param {import('../services/OrganizationService')} params.organizationService
 */
function createAuthRouter({ authService, organizationService, dataService }) {
    const router = express.Router();

    // Vérification du mot de passe d'enregistrement
    router.post('/verify-registration-password', async (req, res) => {
        try {
            const { orgId, password } = req.body;
            const org = await organizationService.getById(orgId);
            if (!org) throw new Error('Organisation non trouvée');
            if (!org.registrationPassword || org.registrationPassword !== password) {
                throw new Error('Mot de passe d\'enregistrement incorrect');
            }
            res.json({ success: true });
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Enregistrement d'un membre
    router.post('/register', async (req, res) => {
        try {
            const { orgId, password, memberData } = req.body;
            const org = await organizationService.getById(orgId);
            if (!org) throw new Error('Organisation non trouvée');
            if (!org.registrationPassword || org.registrationPassword !== password) {
                throw new Error('Mot de passe d\'enregistrement incorrect');
            }
            
            const safeData = {
                lastName: memberData.lastName,
                firstName: memberData.firstName,
                email: memberData.email,
                phone: memberData.phone,
                address: memberData.address,
                address2: memberData.address2,
                postalCode: memberData.postalCode,
                city: memberData.city,
                country: memberData.country,
                admin: false
            };
            
            const newMember = await dataService.create({
                organisationId: orgId,
                collection: 'members',
                data: safeData
            });
            
            res.status(201).json({ success: true, memberId: newMember.id });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Connexion superadmin
    router.post('/login', (req, res) => {
        try {
            const { password } = req.body;
            const result = authService.loginSuperadmin({
                password
            });
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Connexion admin (membre avec flag admin)
    router.post('/login/admin', async (req, res) => {
        try {
            const { orgId, email, password } = req.body;
            const result = await authService.loginAdmin({
                orgId, email, password
            });
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Connexion membre simple (email seul)
    router.post('/login/member', async (req, res) => {
        try {
            const { orgId, email } = req.body;
            const result = await authService.loginMember({
                orgId, email
            });
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Liste des organisations (publique)
    router.get('/organizations', async (req, res) => {
        try {
            const orgs = await organizationService.getAll();
            res.json(orgs);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}

module.exports = createAuthRouter;
