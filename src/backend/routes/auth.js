const express = require('express');

/**
 * @param {Object} params
 * @param {import('../services/AuthService')} params.authService
 * @param {import('../services/OrganizationService')} params.organizationService
 */
function createAuthRouter({ authService, organizationService }) {
    const router = express.Router();

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
