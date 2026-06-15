const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Journal des réalisations d'activités.
 * Un membre n'enregistre/consulte que ses propres réalisations ;
 * l'admin voit toutes celles du collectif.
 *
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createActivityHistoryRouter({ dataService }) {
    const router = express.Router({ mergeParams: true });

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            let data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'activity-history'
            });
            if (req.user.role === 'member') {
                data = data.filter(
                    e => e.memberId === req.user.memberId
                );
            }
            if (req.query.activityId) {
                data = data.filter(
                    e => e.activityId === req.query.activityId
                );
            }
            res.json(data);
        }, 500)
    );

    router.post('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const body = { ...req.body };
            if (!body.activityId) {
                return res.status(400).json({
                    error: 'activityId est obligatoire'
                });
            }
            // Un membre ne peut enregistrer que pour lui-même
            if (req.user.role === 'member') {
                body.memberId = req.user.memberId;
            }
            body.date = body.date || new Date().toISOString();

            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'activity-history',
                data: body
            });
            res.status(201).json(data);
        })
    );

    router.delete('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await dataService.delete({
                collectiveId: req.collectiveId,
                collection: 'activity-history',
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createActivityHistoryRouter;
