const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Un membre n'a accès qu'aux activités qui lui sont assignées.
 */
function isAssignedToMember(activity, memberId) {
    const assigned = activity.assignedMembers;
    if (!Array.isArray(assigned)) return false;
    return assigned.includes(memberId);
}

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createActivitiesRouter({ dataService }) {
    const router = express.Router({ mergeParams: true });

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            let data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'activities'
            });
            if (req.user.role === 'member') {
                data = data.filter(
                    a => isAssignedToMember(a, req.user.memberId)
                );
            }
            res.json(data);
        }, 500)
    );

    router.get('/:id',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'activities',
                id: req.params.id
            });
            if (!data) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            if (
                req.user.role === 'member'
                && !isAssignedToMember(data, req.user.memberId)
            ) {
                return res.status(403).json({ error: 'Accès refusé' });
            }
            res.json(data);
        }, 500)
    );

    router.post('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            if (!req.body.title) {
                return res.status(400).json({
                    error: 'Le titre est obligatoire'
                });
            }
            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'activities',
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
                collection: 'activities',
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
                collection: 'activities',
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createActivitiesRouter;
