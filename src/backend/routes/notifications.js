const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const NotificationService = require('../services/NotificationService');

/**
 * @param {Object} params
 * @param {import('../services/DataService')}                   params.dataService
 * @param {import('../services/ActionNotificationScheduler')}   params.scheduler
 */
function createNotificationsRouter({ dataService, scheduler }) {
    const router = express.Router({ mergeParams: true });

    /**
     * Envoie une notification de test vers le webhook HA du membre connecté.
     * POST /api/:collectiveId/notifications/test-ha
     */
    router.post('/test-ha',
        requireRole('member', 'admin'),
        asyncHandler(async (req, res) => {
            const memberId = req.user.memberId;
            if (!memberId) {
                return res.status(400).json({
                    error: 'Membre non identifié (superadmin non supporté)'
                });
            }

            const member = await dataService.get({
                collectiveId: req.collectiveId,
                collection: 'members',
                id: memberId
            });

            const webhookUrl = member?.haBaseUrl && member?.haWebhookId
                ? `${member.haBaseUrl.replace(/\/$/, '')}/api/webhook/${member.haWebhookId}`
                : member?.haWebhookUrl || null;

            if (!webhookUrl) {
                return res.status(400).json({
                    error: 'Aucun webhook HA configuré dans votre profil'
                });
            }

            const todayStr = new Date().toISOString().slice(0, 10);
            await NotificationService.send({
                webhookUrl,
                payload: {
                    action: 'Test Feddeeji',
                    status: 'due',
                    date: todayStr,
                    collective: req.collectiveId,
                    collectiveId: req.collectiveId,
                    description: 'Notification de test depuis Feddeeji ✅'
                }
            });

            res.json({ success: true });
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
            scheduler.checkAndNotify().catch(
                err => console.error('[HA trigger manuel] Erreur :', err)
            );
            res.json({ success: true, message: 'Check de notifications déclenché' });
        })
    );

    return router;
}

module.exports = createNotificationsRouter;
