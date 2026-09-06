const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const NotificationService = require('../services/NotificationService');
const { buildWebhookUrl, recipientIds } = require('../services/NotificationConfig');

/**
 * @param {Object} params
 * @param {import('../services/DataService')}                   params.dataService
 * @param {import('../services/ActionNotificationScheduler')}   params.scheduler
 */
function createNotificationsRouter({ dataService, scheduler, notificationState }) {
    const router = express.Router({ mergeParams: true });

    router.get('/settings', requireRole('admin'), asyncHandler(async (req, res) => {
        res.json(await notificationState.getSettings(req.collectiveId));
    }));
    router.put('/settings', requireRole('admin'), asyncHandler(async (req, res) => {
        res.json(await notificationState.setSettings(req.collectiveId, req.body));
    }));
    router.get('/diagnostics', requireRole('admin'), asyncHandler(async (req, res) => {
        const [deliveries, actions, members, settings] = await Promise.all([
            notificationState.diagnostics(req.collectiveId),
            dataService.list({ collectiveId: req.collectiveId, collection: 'actions' }),
            dataService.list({ collectiveId: req.collectiveId, collection: 'members' }),
            notificationState.getSettings(req.collectiveId)
        ]);
        const warnings = [];
        if (!settings) warnings.push({ code: 'settings_missing' });
        for (const action of actions.filter(a => a.alert?.enabled)) {
            const ids = recipientIds(action);
            if (!ids.length) warnings.push({ actionId: action.id, code: 'recipients_missing' });
            for (const memberId of ids) {
                const url = buildWebhookUrl(members.find(m => m.id === memberId));
                let configured = false;
                try { configured = !!url && !!settings?.allowedOrigins.includes(new URL(url).origin); } catch {}
                if (!configured) warnings.push({ actionId: action.id, memberId, code: 'webhook_missing_or_disallowed' });
            }
        }
        res.json({ deliveries, warnings });
    }));

    /**
     * Envoie une notification de test vers le webhook HA du membre connecté.
     * POST /api/:collectiveId/notifications/test-ha
     */
    router.post('/test-ha',
        requireRole('member', 'admin'),
        asyncHandler(async (req, res) => {
            const memberId = ['admin', 'superadmin'].includes(req.user.role) && req.body?.memberId
                ? req.body.memberId : req.user.memberId;
            if (!memberId) {
                return res.status(400).json({
                    error: 'Sélectionner un membre à tester'
                });
            }

            const member = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: memberId
            });

            const webhookUrl = buildWebhookUrl(member);
            const settings = await notificationState.getSettings(req.collectiveId);

            if (!webhookUrl) {
                return res.status(400).json({
                    error: 'Aucun webhook HA configuré dans votre profil'
                });
            }

            const todayStr = new Date().toISOString().slice(0, 10);
            await NotificationService.send({
                webhookUrl, settings,
                payload: {
                    version: 1, type: 'test', notificationId: 'feddeeji-test',
                    action: 'Test Feddeeji',
                    status: 'due',
                    date: todayStr,
                    collective: req.collectiveId,
                    collectiveId: req.collectiveId,
                    description: 'Notification de test depuis Feddeeji ✅'
                }
            });

            res.json({ success: true, message: 'Webhook accepté par HA ; vérifier le téléphone' });
        })
    );

    /**
     * Déclenche un check immédiat des notifications (admin uniquement).
     * POST /api/:collectiveId/notifications/trigger
     */
    router.post('/trigger',
        requireRole('admin'),
        asyncHandler(async (req, res) => {
            if (!scheduler) {
                return res.status(503).json({ error: 'Scheduler non disponible' });
            }
            // Exécution asynchrone : ne bloque pas la réponse
            scheduler.checkAndNotify(req.collectiveId).catch(
                () => console.error('[HA trigger manuel] Échec du contrôle')
            );
            res.json({ success: true, message: 'Check de notifications déclenché' });
        })
    );

    return router;
}

module.exports = createNotificationsRouter;
