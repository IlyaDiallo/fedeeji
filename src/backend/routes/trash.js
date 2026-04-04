const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @param {Object} params
 * @param {import('../services/TrashService')} params.trashService
 */
function createTrashRouter({ trashService }) {
    const router = express.Router({ mergeParams: true });

    router.get('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await trashService.list({
                collectiveId: req.collectiveId
            });
            res.json(data);
        }, 500)
    );

    router.post('/:trashId/restore',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const entry = await trashService.restore({
                collectiveId: req.collectiveId,
                trashId: req.params.trashId
            });
            res.json(entry);
        })
    );

    router.delete('/:trashId',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await trashService.permanentDelete({
                collectiveId: req.collectiveId,
                trashId: req.params.trashId
            });
            res.json({ success: true });
        })
    );

    router.delete('/',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await trashService.empty({
                collectiveId: req.collectiveId
            });
            res.json({ success: true });
        }, 500)
    );

    return router;
}

module.exports = createTrashRouter;
