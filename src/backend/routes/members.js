const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const AuthService = require('../services/AuthService');

/**
 * Retire le champ adminPassword d'un objet membre.
 */
function sanitizeMember(member) {
    const { adminPassword, ...safe } = member;
    return safe;
}

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createMembersRouter({ dataService }) {
    const router = express.Router({ mergeParams: true });

    // --- Accès membre à sa propre fiche ---

    router.get('/me',
        requireRole('member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: req.user.memberId
            });
            if (!data) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            res.json(sanitizeMember(data));
        }, 500)
    );

    router.put('/me',
        requireRole('member'),
        asyncHandler(async (req, res) => {
            const body = { ...req.body };
            // Champs interdits pour un membre
            delete body.admin;
            delete body.adminPassword;
            delete body.id;

            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: req.user.memberId,
                data: body
            });
            res.json(sanitizeMember(data));
        })
    );

    // --- Admin : liste (sans adminPassword) ---

    router.get('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'members'
            });
            res.json(data.map(sanitizeMember));
        }, 500)
    );

    router.get('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: req.params.id
            });
            if (!data) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            res.json(sanitizeMember(data));
        }, 500)
    );

    // Création avec hash du mot de passe admin
    router.post('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const body = { ...req.body };
            if (body.admin && body.adminPassword) {
                body.adminPassword =
                    await AuthService.hashPassword(body.adminPassword);
            } else {
                delete body.adminPassword;
            }
            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'members',
                data: body
            });
            res.status(201).json(sanitizeMember(data));
        })
    );

    // Mise à jour avec hash si nouveau mot de passe
    router.put('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const body = { ...req.body };
            if (body.admin && body.adminPassword) {
                body.adminPassword =
                    await AuthService.hashPassword(body.adminPassword);
            } else if (!body.admin) {
                body.adminPassword = undefined;
            } else {
                delete body.adminPassword;
            }
            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: req.params.id,
                data: body
            });
            res.json(sanitizeMember(data));
        })
    );

    router.delete('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await dataService.delete({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createMembersRouter;
