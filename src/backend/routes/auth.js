const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;

/**
 * @param {Object} params
 * @param {import('../services/AuthService')} params.authService
 * @param {import('../services/CollectiveService')} params.collectiveService
 * @param {import('../services/IllustrationService')} params.illustrationService
 */
function createAuthRouter({
    authService, collectiveService, dataService, illustrationService
}) {
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
    router.post('/verify-registration-password', asyncHandler(async (req, res) => {
        const { collectiveId, password } = req.body;
        const org = await collectiveService.getById(collectiveId);
        if (!org) throw new Error('Collectif non trouvé');
        if (!org.registrationPassword || org.registrationPassword !== password) {
            throw new Error('Mot de passe d\'enregistrement incorrect');
        }
        res.json({ success: true });
    }, 401));

    // Enregistrement d'un membre
    router.post('/register', asyncHandler(async (req, res) => {
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
    }));

    // Connexion superadmin
    router.post('/login', asyncHandler((req, res) => {
        const { password } = req.body;
        const result = authService.loginSuperadmin({ password });
        res.json(result);
    }, 401));

    // Connexion admin (membre avec flag admin)
    router.post('/login/admin', asyncHandler(async (req, res) => {
        const { collectiveId, email, password } = req.body;
        const result = await authService.loginAdmin({
            collectiveId, email, password
        });
        res.json(result);
    }, 401));

    // Connexion membre simple (email seul)
    router.post('/login/member', asyncHandler(async (req, res) => {
        const { collectiveId, email } = req.body;
        const result = await authService.loginMember({
            collectiveId, email
        });
        res.json(result);
    }, 401));

    // Liste des collectifs (publique)
    router.get('/collectives', asyncHandler(async (req, res) => {
        const orgs = await collectiveService.getAll();
        res.json(orgs);
    }, 500));

    // Email de contact du superadmin (publique)
    router.get('/superadmin-email', (req, res) => {
        res.json({ email: SUPERADMIN_EMAIL || '' });
    });

    // Catalogue local pour le choix du logo (superadmin)
    router.get('/illustrations', requireSuperadmin, (req, res) => {
        try {
            const theme = collectiveService.resolveTheme(req.query.color);
            const items = illustrationService.search({
                query: req.query.q,
                lang: req.query.lang,
                limit: req.query.limit
            }).map(item => ({
                ...item,
                previewUrl: '/api/illustrations/'
                    + `${item.name}.svg?seed=${item.seed}`
                    + `&color=${encodeURIComponent(theme.primaryColor)}`
            }));
            res.json({ items });
        } catch (error) {
            res.status(error.status || 400).json({ error: error.message });
        }
    });

    // Modification d'un collectif (superadmin)
    router.put(
        '/collectives/:id',
        requireSuperadmin,
        asyncHandler(async (req, res) => {
            const { id } = req.params;
            const allowedFields = [
                'name', 'label', 'adminEmail', 'defaultLanguage',
                'registrationPassword', 'contributionsEnabled',
                'primaryColor', 'typeLabel', 'logoIllustration'
            ];
            const data = Object.fromEntries(
                allowedFields
                    .filter(key => Object.hasOwn(req.body, key))
                    .map(key => [key, req.body[key]])
            );
            const updated = await collectiveService.update(id, data);
            res.json(updated);
        })
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
        requireSuperadmin,
        logoUpload.single('file'),
        asyncHandler(async (req, res) => {
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
        })
    );

    // Création d'un collectif (superadmin uniquement)
    router.post(
        '/collectives',
        requireSuperadmin,
        asyncHandler(async (req, res) => {
            const { id, name, label, adminEmail, defaultLanguage,
                registrationPassword, contributionsEnabled,
                primaryColor, typeLabel, logoIllustration } = req.body;

            if (!id || !name || !label) {
                return res.status(400).json({
                    error: 'id, name et label sont obligatoires'
                });
            }

            const org = await collectiveService.create({
                id, name, label, adminEmail,
                defaultLanguage, registrationPassword,
                contributionsEnabled, primaryColor,
                typeLabel, logoIllustration
            });
            res.status(201).json(org);
        })
    );

    // Suppression d'un collectif (superadmin uniquement)
    router.delete(
        '/collectives/:id',
        requireSuperadmin,
        asyncHandler(async (req, res) => {
            await collectiveService.delete(req.params.id);
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createAuthRouter;
