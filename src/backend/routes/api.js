const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const createTrashRouter = require('./trash');
const createMembersRouter = require('./members');
const createInscriptionsRouter = require('./inscriptions');
const createActionsRouter = require('./actions');
const createActionLogsRouter = require('./actionLogs');
const createEventsRouter = require('./events');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 * @param {import('../services/TrashService')} params.trashService
 */
function createApiRouter({ dataService, trashService }) {
    const router = express.Router({ mergeParams: true });

    // Middleware : vérifie que le collectiveId est présent
    router.use((req, res, next) => {
        if (!req.params.collectiveId) {
            return res.status(400).json({
                error: 'CollectiveId manquant dans l\'URL'
            });
        }
        req.collectiveId = req.params.collectiveId;
        next();
    });

    // --- Sous-routeurs par domaine ---

    router.use('/trash', createTrashRouter({ trashService }));

    router.use('/members', createMembersRouter({ dataService }));

    router.use(
        '/inscriptions',
        createInscriptionsRouter({ dataService })
    );

    router.use('/actions', createActionsRouter({ dataService }));

    router.use(
        '/action-logs',
        createActionLogsRouter({ dataService })
    );

    router.use('/events', createEventsRouter({ dataService }));

    // --- Contributions : membres voient les leurs ---

    router.get('/contributions',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            let data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'contributions'
            });
            if (req.user.role === 'member') {
                data = data.filter(
                    s => s.memberId === req.user.memberId
                );
            }
            res.json(data);
        }, 500)
    );

    // --- CRUD générique pour les autres collections ---

    router.get('/:collection',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: req.params.collection
            });
            res.json(data);
        }, 500)
    );

    router.get('/:collection/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.get({
                collectiveId: req.collectiveId,
                collection: req.params.collection,
                id: req.params.id
            });
            if (!data) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            res.json(data);
        }, 500)
    );

    router.post('/:collection',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: req.params.collection,
                data: req.body
            });
            res.status(201).json(data);
        })
    );

    router.put('/:collection/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: req.params.collection,
                id: req.params.id,
                data: req.body
            });
            res.json(data);
        })
    );

    router.delete('/:collection/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await dataService.delete({
                collectiveId: req.collectiveId,
                collection: req.params.collection,
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createApiRouter;
