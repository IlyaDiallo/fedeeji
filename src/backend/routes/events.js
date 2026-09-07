const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const EventService = require('../services/EventService');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createEventsRouter({ dataService, eventService = new EventService({ dataService }), eventScheduler }) {
    const router = express.Router({ mergeParams: true });

    router.get('/alerts/active', requireRole('admin', 'member'), asyncHandler(async (req, res) => {
        res.json(eventScheduler ? await eventScheduler.active(req.collectiveId, req.user) : []);
    }));
    router.post('/:id/ack', requireRole('admin', 'member'), asyncHandler(async (req, res) => {
        if (!eventScheduler) return res.status(503).json({ error: 'Rappels indisponibles' });
        await eventScheduler.ack(req.collectiveId, req.body.deliveryId, req.user, req.params.id);
        res.json({ success: true });
    }));

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'events'
            });
            res.json(data.filter(event => EventService.visible(event, req.user)));
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
            if (!data || !EventService.visible(data, req.user)) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            res.json(data);
        }, 500)
    );

    router.post('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await eventService.save(req.collectiveId, null, req.body);
            res.status(201).json(data);
        })
    );

    router.put('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await eventService.save(req.collectiveId, req.params.id, req.body);
            res.json(data);
        })
    );

    router.delete('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await eventService.locked(req.collectiveId, req.params.id, () => dataService.delete({
                collectiveId: req.collectiveId,
                collection: 'events',
                id: req.params.id
            }));
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createEventsRouter;
