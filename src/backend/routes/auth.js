const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;

/**
 * @param {Object} params
 * @param {import('../services/AuthService')} params.authService
 * @param {import('../services/CollectiveService')} params.collectiveService
 */
function createAuthRouter({ authService, collectiveService, dataService }) {
    const router = express.Router();

    // Middleware superadmin (inline pour éviter circular deps)
    const requireSuperadmin = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = authService.verifyToken(token);
            if (decoded.role !== 'superadmin') {
                return res.status(403).json({ error: 'Accès interdit' });
            }
            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Token invalide' });
        }
    };

    // Vérification du mot de passe d'enregistrement
    router.post('/verify-registration-password', async (req, res) => {
        try {
            const { collectiveId, password } = req.body;
            const org = await collectiveService.getById(collectiveId);
            if (!org) throw new Error('Collectif non trouvé');
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
            const { collectiveId, password, memberData } = req.body;
            const org = await collectiveService.getById(collectiveId);
            if (!org) throw new Error('Collectif non trouvé');
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
                collectiveId: collectiveId,
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
            const { collectiveId, email, password } = req.body;
            const result = await authService.loginAdmin({
                collectiveId, email, password
            });
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Connexion membre simple (email seul)
    router.post('/login/member', async (req, res) => {
        try {
            const { collectiveId, email } = req.body;
            const result = await authService.loginMember({
                collectiveId, email
            });
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // Liste des collectifs (publique)
    router.get('/collectives', async (req, res) => {
        try {
            const orgs = await collectiveService.getAll();
            res.json(orgs);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Email de contact du superadmin (publique)
    router.get('/superadmin-email', (req, res) => {
        res.json({ email: SUPERADMIN_EMAIL || '' });
    });

    // Modification d'un collectif (superadmin)
    router.put(
        '/collectives/:id',
        async (req, res) => {
            try {
                const { id } = req.params;
                const { id: _id, ...data } = req.body;
                const updated = await collectiveService.update(id, data);
                res.json(updated);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    // Upload du logo (superadmin, 1 Mo max)
    const logoUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 1 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = (file.originalname || '')
                .split('.').pop().toLowerCase();
            if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
                .includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error(
                    'Format non supporté. Utilisez PNG, JPG, GIF, SVG ou WEBP'
                ));
            }
        }
    });

    router.post(
        '/collectives/:id/logo',
        logoUpload.single('file'),
        async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        error: 'Aucun fichier fourni'
                    });
                }
                const logoUrl = await collectiveService.uploadLogo(
                    req.params.id,
                    req.file
                );
                res.json({ logo: logoUrl });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    // Création d'un collectif (superadmin uniquement)
    router.post(
        '/collectives',
        requireSuperadmin,
        async (req, res) => {
            try {
                const { id, name, label, adminEmail, defaultLanguage,
                    registrationPassword } = req.body;

                if (!id || !name || !label) {
                    return res.status(400).json({
                        error: 'id, name et label sont obligatoires'
                    });
                }

                const org = await collectiveService.create({
                    id, name, label, adminEmail,
                    defaultLanguage, registrationPassword
                });
                res.status(201).json(org);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    // Suppression d'un collectif (superadmin uniquement)
    router.delete(
        '/collectives/:id',
        requireSuperadmin,
        async (req, res) => {
            try {
                await collectiveService.delete(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    return router;
}

module.exports = createAuthRouter;
