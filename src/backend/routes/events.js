const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createEventsRouter({ dataService }) {
    const router = express.Router({ mergeParams: true });

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'events'
            });
            res.json(data);
        }, 500)
    );

    router.get('/:id',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'events',
                id: req.params.id
            });
            if (!data) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            res.json(data);
        }, 500)
    );

    router.post('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            if (!req.body.date) {
                return res.status(400).json({
                    error: 'La date est obligatoire'
                });
            }
            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'events',
                data: req.body
            });
            res.status(201).json(data);
        })
    );

    router.put('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: 'events',
                id: req.params.id,
                data: req.body
            });
            res.json(data);
        })
    );

    router.delete('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await dataService.delete({
                collectiveId: req.collectiveId,
                collection: 'events',
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createEventsRouter;
