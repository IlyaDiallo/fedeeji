const express = require('express');
const AuthService = require('../services/AuthService');
const { requireRole } = require('../middleware/auth');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 * @param {import('../services/TrashService')} params.trashService
 * @param {import('../services/ImportService')} params.importService
 */
function createApiRouter({ dataService, trashService, importService }) {
    const router = express.Router({ mergeParams: true });

    // Middleware : vérifie que l'organisationId est présent
    router.use((req, res, next) => {
        if (!req.params.orgId) {
            return res.status(400).json({
                error: 'OrganisationId manquant dans l\'URL'
            });
        }
        req.organisationId = req.params.orgId;
        next();
    });

    // --- Corbeille (admin + superadmin) ---

    router.get('/trash',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await trashService.list({
                    organisationId: req.organisationId
                });
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.post('/trash/:trashId/restore',
        requireRole('admin'),
        async (req, res) => {
            try {
                const entry = await trashService.restore({
                    organisationId: req.organisationId,
                    trashId: req.params.trashId
                });
                res.json(entry);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.delete('/trash/:trashId',
        requireRole('admin'),
        async (req, res) => {
            try {
                await trashService.permanentDelete({
                    organisationId: req.organisationId,
                    trashId: req.params.trashId
                });
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.delete('/trash',
        requireRole('admin'),
        async (req, res) => {
            try {
                await trashService.empty({
                    organisationId: req.organisationId
                });
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // --- Cotisations : membres voient les leurs (lecture seule) ---

    router.get('/subscriptions',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                let data = await dataService.list({
                    organisationId: req.organisationId,
                    collection: 'subscriptions'
                });
                // Membre : ne voir que ses propres cotisations
                if (req.user.role === 'member') {
                    data = data.filter(
                        s => s.memberId === req.user.memberId
                    );
                }
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // --- Participations : membres peuvent gérer les leurs ---

    // --- Participations bulk (upsert) ---

    router.post('/participations/bulk',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                const { eventId, memberId, entries } = req.body;
                if (!eventId || !memberId || !Array.isArray(entries)) {
                    return res.status(400).json({
                        error: 'eventId, memberId et entries requis'
                    });
                }
                // Membre : forcer son propre memberId
                const effectiveMemberId = req.user.role === 'member'
                    ? req.user.memberId : memberId;

                const existing = await dataService.list({
                    organisationId: req.organisationId,
                    collection: 'participations'
                });

                const results = [];
                for (const entry of entries) {
                    const { occurrenceDate, response } = entry;
                    if (!occurrenceDate) continue;

                    // Chercher une participation existante
                    const found = existing.find(
                        p => p.eventId === eventId
                            && p.memberId === effectiveMemberId
                            && p.occurrenceDate === occurrenceDate
                    );

                    if (response === null) {
                        // Suppression si la participation existe
                        if (found) {
                            await dataService.delete({
                                organisationId: req.organisationId,
                                collection: 'participations',
                                id: found.id
                            });
                        }
                    } else if (found) {
                        // Mise à jour
                        const updated = await dataService.update({
                            organisationId: req.organisationId,
                            collection: 'participations',
                            id: found.id,
                            data: { response }
                        });
                        results.push(updated);
                    } else {
                        // Création
                        const created = await dataService.create({
                            organisationId: req.organisationId,
                            collection: 'participations',
                            data: {
                                eventId,
                                memberId: effectiveMemberId,
                                occurrenceDate,
                                response
                            }
                        });
                        results.push(created);
                    }
                }
                res.json({ success: true, count: results.length });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.get('/participations',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                let data = await dataService.list({
                    organisationId: req.organisationId,
                    collection: 'participations'
                });
                // Membre : ne voir que ses propres participations
                if (req.user.role === 'member') {
                    data = data.filter(
                        p => p.memberId === req.user.memberId
                    );
                }
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.get('/participations/:id',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                const data = await dataService.get({
                    organisationId: req.organisationId,
                    collection: 'participations',
                    id: req.params.id
                });
                if (!data) {
                    return res.status(404).json({
                        error: 'Non trouvé'
                    });
                }
                // Membre : vérifier que c'est sa participation
                if (
                    req.user.role === 'member'
                    && data.memberId !== req.user.memberId
                ) {
                    return res.status(403).json({
                        error: 'Accès interdit'
                    });
                }
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.post('/participations',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                const body = { ...req.body };
                // Membre : forcer son propre memberId
                if (req.user.role === 'member') {
                    body.memberId = req.user.memberId;
                    // Vérifier que l'événement n'est pas passé
                    if (body.eventId) {
                        const evt = await dataService.get({
                            organisationId: req.organisationId,
                            collection: 'events',
                            id: body.eventId
                        });
                        if (evt) {
                            const evtDate = body.occurrenceDate || evt.date;
                            if (evtDate) {
                                const today = new Date()
                                    .toISOString().slice(0, 10);
                                if (evtDate < today) {
                                    return res.status(403).json({
                                        error: 'past_event_locked'
                                    });
                                }
                            }
                        }
                    }
                }
                const data = await dataService.create({
                    organisationId: req.organisationId,
                    collection: 'participations',
                    data: body
                });
                res.status(201).json(data);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.put('/participations/:id',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                // Membre : vérifier que c'est sa participation
                if (req.user.role === 'member') {
                    const existing = await dataService.get({
                        organisationId: req.organisationId,
                        collection: 'participations',
                        id: req.params.id
                    });
                    if (
                        !existing
                        || existing.memberId
                            !== req.user.memberId
                    ) {
                        return res.status(403).json({
                            error: 'Accès interdit'
                        });
                    }
                    // Vérifier que l'événement n'est pas passé
                    const eventId =
                        existing.eventId || req.body.eventId;
                    if (eventId) {
                        const evt = await dataService.get({
                            organisationId: req.organisationId,
                            collection: 'events',
                            id: eventId
                        });
                        if (evt) {
                            const evtDate = existing.occurrenceDate || req.body.occurrenceDate || evt.date;
                            if (evtDate) {
                                const today = new Date()
                                    .toISOString().slice(0, 10);
                                if (evtDate < today) {
                                    return res.status(403).json({
                                        error: 'past_event_locked'
                                    });
                                }
                            }
                        }
                    }
                    req.body.memberId = req.user.memberId;
                }
                const data = await dataService.update({
                    organisationId: req.organisationId,
                    collection: 'participations',
                    id: req.params.id,
                    data: req.body
                });
                res.json(data);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.delete('/participations/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                await dataService.delete({
                    organisationId: req.organisationId,
                    collection: 'participations',
                    id: req.params.id
                });
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    // --- Événements : membres en lecture seule ---

    router.get('/events',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                const data = await dataService.list({
                    organisationId: req.organisationId,
                    collection: 'events'
                });
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.get('/events/:id',
        requireRole('admin', 'member'),
        async (req, res) => {
            try {
                const data = await dataService.get({
                    organisationId: req.organisationId,
                    collection: 'events',
                    id: req.params.id
                });
                if (!data) {
                    return res.status(404).json({
                        error: 'Non trouvé'
                    });
                }
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // --- Membres : accès à sa propre fiche (member) ---

    router.get('/members/me',
        requireRole('member'),
        async (req, res) => {
            try {
                const data = await dataService.get({
                    organisationId: req.organisationId,
                    collection: 'members',
                    id: req.user.memberId
                });
                if (!data) {
                    return res.status(404).json({
                        error: 'Non trouvé'
                    });
                }
                const { adminPassword, ...safe } = data;
                res.json(safe);
            } catch (error) {
                res.status(500).json({
                    error: error.message
                });
            }
        }
    );

    router.put('/members/me',
        requireRole('member'),
        async (req, res) => {
            try {
                const body = { ...req.body };
                // Champs interdits pour un membre
                delete body.admin;
                delete body.adminPassword;
                delete body.id;

                const data = await dataService.update({
                    organisationId: req.organisationId,
                    collection: 'members',
                    id: req.user.memberId,
                    data: body
                });
                const { adminPassword, ...safe } = data;
                res.json(safe);
            } catch (error) {
                res.status(400).json({
                    error: error.message
                });
            }
        }
    );

    // --- Membres : lecture spéciale (retirer adminPassword) ---

    router.get('/members',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await dataService.list({
                    organisationId: req.organisationId,
                    collection: 'members'
                });
                // Ne jamais exposer le hash du mot de passe
                const safe = data.map(m => {
                    const { adminPassword, ...rest } = m;
                    return rest;
                });
                res.json(safe);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.get('/members/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await dataService.get({
                    organisationId: req.organisationId,
                    collection: 'members',
                    id: req.params.id
                });
                if (!data) {
                    return res.status(404).json({
                        error: 'Non trouvé'
                    });
                }
                const { adminPassword, ...safe } = data;
                res.json(safe);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Création membre avec hash du mot de passe admin
    router.post('/members',
        requireRole('admin'),
        async (req, res) => {
            try {
                const body = { ...req.body };
                if (body.admin && body.adminPassword) {
                    body.adminPassword =
                        await AuthService.hashPassword(
                            body.adminPassword
                        );
                } else {
                    delete body.adminPassword;
                }
                const data = await dataService.create({
                    organisationId: req.organisationId,
                    collection: 'members',
                    data: body
                });
                const { adminPassword, ...safe } = data;
                res.status(201).json(safe);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    // Mise à jour membre avec hash si nouveau mot de passe
    router.put('/members/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                const body = { ...req.body };
                if (body.admin && body.adminPassword) {
                    body.adminPassword =
                        await AuthService.hashPassword(
                            body.adminPassword
                        );
                } else if (!body.admin) {
                    // Retirer le mot de passe si plus admin
                    body.adminPassword = undefined;
                } else {
                    // Admin sans nouveau mdp : garder l'ancien
                    delete body.adminPassword;
                }
                const data = await dataService.update({
                    organisationId: req.organisationId,
                    collection: 'members',
                    id: req.params.id,
                    data: body
                });
                const { adminPassword, ...safe } = data;
                res.json(safe);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.delete('/members/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                await dataService.delete({
                    organisationId: req.organisationId,
                    collection: 'members',
                    id: req.params.id
                });
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    // --- Événements : création/modification (admin) ---

    router.post('/events',
        requireRole('admin'),
        async (req, res) => {
            try {
                if (!req.body.date) {
                    return res.status(400).json({
                        error: 'La date est obligatoire'
                    });
                }
                const data = await dataService.create({
                    organisationId: req.organisationId,
                    collection: 'events',
                    data: req.body
                });
                res.status(201).json(data);
            } catch (error) {
                res.status(400).json({
                    error: error.message
                });
            }
        }
    );

    router.put('/events/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                if (!req.body.date) {
                    return res.status(400).json({
                        error: 'La date est obligatoire'
                    });
                }
                const data = await dataService.update({
                    organisationId: req.organisationId,
                    collection: 'events',
                    id: req.params.id,
                    data: req.body
                });
                res.json(data);
            } catch (error) {
                res.status(400).json({
                    error: error.message
                });
            }
        }
    );

    router.delete('/events/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                await dataService.delete({
                    organisationId: req.organisationId,
                    collection: 'events',
                    id: req.params.id
                });
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({
                    error: error.message
                });
            }
        }
    );

    // --- CRUD générique pour les autres collections ---
    // (admin + superadmin seulement)

    router.get('/:collection',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await dataService.list({
                    organisationId: req.organisationId,
                    collection: req.params.collection
                });
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.get('/:collection/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await dataService.get({
                    organisationId: req.organisationId,
                    collection: req.params.collection,
                    id: req.params.id
                });
                if (!data) {
                    return res.status(404).json({
                        error: 'Non trouvé'
                    });
                }
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    router.post('/:collection',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await dataService.create({
                    organisationId: req.organisationId,
                    collection: req.params.collection,
                    data: req.body
                });
                res.status(201).json(data);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.put('/:collection/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                const data = await dataService.update({
                    organisationId: req.organisationId,
                    collection: req.params.collection,
                    id: req.params.id,
                    data: req.body
                });
                res.json(data);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    router.delete('/:collection/:id',
        requireRole('admin'),
        async (req, res) => {
            try {
                await dataService.delete({
                    organisationId: req.organisationId,
                    collection: req.params.collection,
                    id: req.params.id
                });
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        }
    );

    return router;
}

module.exports = createApiRouter;
