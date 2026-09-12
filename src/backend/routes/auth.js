const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { createAuthRateLimit } = require('../middleware/authRateLimit');

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
    const limit = createAuthRateLimit();
    const emailLimit = limit({ name: 'email', ip: 20, email: 3, windowMs: 3600000, neutral: true });
    const confirmationLimit = limit({ name: 'confirm', ip: 30, windowMs: 15 * 60000 });
    const collectiveBody = async (req, res, next) => {
        if (typeof req.body?.collectiveId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(req.body.collectiveId)) {
            return res.status(400).json({ error: 'Collectif invalide' });
        }
        if (!await collectiveService.getById(req.body.collectiveId)) {
            return res.status(400).json({ error: 'Collectif invalide' });
        }
        next();
    };
    router.use((req, res, next) => {
        res.set('Cache-Control', 'no-store');
        req.body ||= {};
        next();
    });
    router.post('/password/request', emailLimit, collectiveBody, asyncHandler(async (req, res) => {
        res.json(await authService.requestPassword(req.body));
    }));
    router.post('/password/confirm', confirmationLimit, collectiveBody, asyncHandler(async (req, res) => {
        res.json(await authService.confirmPassword(req.body));
    }));
    router.post('/email/confirm', confirmationLimit, collectiveBody, asyncHandler(async (req, res) => {
        res.json(await authService.confirmEmail(req.body));
    }));

    // Middleware superadmin (inline pour éviter circular deps)
    const requireSuperadmin = async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = await authService.verifyToken(token);
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
    router.post('/verify-registration-password', limit({ name: 'registration-code', ip: 30, windowMs: 15 * 60000 }), collectiveBody, asyncHandler(async (req, res) => {
        const { collectiveId, password } = req.body;
        const org = await collectiveService.getById(collectiveId);
        if (!org) throw new Error('Collectif non trouvé');
        if (!org.registrationPassword || org.registrationPassword !== password) {
            throw new Error('Mot de passe d\'enregistrement incorrect');
        }
        res.json({ success: true });
    }, 401));

    // Enregistrement d'un membre
    router.post('/register', limit({ name: 'registration', ip: 20, email: 3, windowMs: 3600000, neutral: true }), collectiveBody, asyncHandler(async (req, res) => {
        const { collectiveId, password, memberData } = req.body;
        const org = await collectiveService.getById(collectiveId);
        if (!org) throw new Error('Collectif non trouvé');
        if (!org.registrationPassword || org.registrationPassword !== password) {
            throw new Error('Mot de passe d\'enregistrement incorrect');
        }

        if (!memberData || typeof memberData !== 'object' || Array.isArray(memberData)) throw new Error('Fiche invalide');
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

        try {
            await dataService.create({ collectiveId, collection: 'members', data: safeData });
        } catch (error) {
            // Existing identity must never be overwritten or exposed by registration.
            if (error.message !== 'Adresse email indisponible') throw error;
        }
        await authService.requestPassword({ collectiveId, email: safeData.email, lang: req.body.lang });
        res.status(201).json({ success: true });
    }));

    // Connexion superadmin
    router.post('/login', limit({ name: 'superadmin', ip: 10, windowMs: 15 * 60000 }), asyncHandler((req, res) => {
        const { password } = req.body;
        const result = authService.loginSuperadmin({ password });
        res.json(result);
    }, 401));

    router.post('/login/collective', limit({ name: 'login', ip: 50, email: 10, windowMs: 15 * 60000 }),
        collectiveBody, asyncHandler(async (req, res) => {
            res.json(await authService.loginCollective(req.body));
        }, 401));

    router.all(['/login/admin', '/login/member'], (req, res) => {
        res.status(410).json({ error: 'Utilisez la connexion email et mot de passe' });
    });

    // Liste des collectifs (publique)
    router.get('/collectives', asyncHandler(async (req, res) => {
        const orgs = await collectiveService.getAll();
        let superadmin = false;
        try {
            const token = req.headers.authorization?.replace(/^Bearer /, '');
            superadmin = !!token && (await authService.verifyToken(token)).role === 'superadmin';
        } catch { /* Public theme listing remains available without authentication. */ }
        res.json(superadmin ? orgs : orgs.map(org => {
            const { registrationPassword, ...publicOrg } = org;
            return publicOrg;
        }));
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
