const express = require('express');
const { requireRole } = require('../middleware/auth');

/**
 * Recherche et import d'assets visuels pour un collectif.
 * @param {Object} params
 * @param {import('../services/AssetService')} params.assetService
 * @param {import('../services/IllustrationService')} params.illustrationService
 */
function createAssetsRouter({ assetService, illustrationService }) {
    const router = express.Router({ mergeParams: true });

    router.get('/illustrations', requireRole('admin'), (req, res) => {
        try {
            const items = illustrationService.search({
                query: req.query.q,
                lang: req.query.lang,
                limit: req.query.limit
            }).map(item => ({
                ...item,
                previewUrl: `/api/${req.collectiveId}/illustrations/`
                    + `${item.name}.svg?seed=${item.seed}`
            }));
            res.json({ items });
        } catch (error) {
            res.status(error.status || 400).json({ error: error.message });
        }
    });

    router.get('/search', requireRole('admin'), async (req, res) => {
        try {
            const result = await assetService.search({
                query: req.query.q,
                page: req.query.page,
                limit: req.query.limit,
                lang: req.query.lang
            });
            res.json(result);
        } catch (error) {
            res.status(error.status || 502).json({ error: error.message });
        }
    });

    router.post('/import', requireRole('admin'), async (req, res) => {
        try {
            const result = await assetService.importAsset({
                collectiveId: req.collectiveId,
                asset: req.body?.asset
            });
            res.status(201).json(result);
        } catch (error) {
            res.status(error.status || 502).json({ error: error.message });
        }
    });

    return router;
}

module.exports = createAssetsRouter;
