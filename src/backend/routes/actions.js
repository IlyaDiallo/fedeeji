const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { normalizeAlert } = require('../services/NotificationConfig');
const ActionProgressService = require('../services/ActionProgressService');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 * @param {import('../services/IllustrationService')} params.illustrationService
 */
function createActionsRouter({ dataService, illustrationService, notificationState, progressService }) {
    const locked = (req, run) => progressService
        ? progressService.locked(req.collectiveId, req.params.id, run) : run();
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

    const validateAlert = async (req, data, previous = {}) => {
        const merged = { ...previous, ...data };
        if (Object.hasOwn(data, 'alert') || merged.alert?.enabled) {
            const members = await dataService.list({
                collectiveId: req.collectiveId, collection: 'members'
            });
            data.alert = normalizeAlert(merged.alert, {
                states: merged.states, memberId: merged.memberId, members
            });
            if (data.alert.enabled && notificationState && !await notificationState.getSettings(req.collectiveId)) {
                throw new Error('Configurer le fuseau, le silence et les origines HA dans Membres avant activation');
            }
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
                data: await validateAlert(req, withValidatedIllustration(req.body, true))
            });
            res.status(201).json(data);
        })
    );

    router.put('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => locked(req, async () => {
            const previous = await dataService.get({
                collectiveId: req.collectiveId, collection: 'actions', id: req.params.id
            });
            if (!previous) return res.status(404).json({ error: 'Non trouvé' });
            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: 'actions',
                id: req.params.id,
                data: await validateAlert(req, withValidatedIllustration(req.body), previous)
            });
            if (notificationState && ActionProgressService.context(previous, [], previous.date).revision
                !== ActionProgressService.context(data, [], data.date).revision) {
                await notificationState.revokeTokens(req.collectiveId, { actionId: req.params.id });
            }
            res.json(data);
        }))
    );

    router.delete('/:id',
        requireRole('admin'),
        asyncHandler(async (req, res) => locked(req, async () => {
            await dataService.delete({
                collectiveId: req.collectiveId,
                collection: 'actions',
                id: req.params.id
            });
            if (notificationState) await notificationState.revokeTokens(req.collectiveId, { actionId: req.params.id });
            res.json({ success: true });
        }))
    );

    return router;
}

module.exports = createActionsRouter;
