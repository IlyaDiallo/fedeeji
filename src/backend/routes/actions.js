const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 * @param {import('../services/IllustrationService')} params.illustrationService
 */
function createActionsRouter({ dataService, illustrationService }) {
    const router = express.Router({ mergeParams: true });

    const withValidatedIllustration = (body, required = false) => {
        const data = { ...body };
        if (required || Object.hasOwn(data, 'illustration')) {
            data.illustration = illustrationService.normalizeRecipe(
                data.illustration,
                { fallbackSource: data.name || 'action' }
            );
        }
        return data;
    };

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'actions'
            });
            res.json(data);
        }, 500)
    );

    router.get('/:id',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'actions',
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
            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'actions',
                data: withValidatedIllustration(req.body, true)
            });
            res.status(201).json(data);
        })
    );

    router.put('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: 'actions',
                id: req.params.id,
                data: withValidatedIllustration(req.body)
            });
            res.json(data);
        })
    );

    router.delete('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            await dataService.delete({
                collectiveId: req.collectiveId,
                collection: 'actions',
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createActionsRouter;
