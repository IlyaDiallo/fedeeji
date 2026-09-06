const express = require('express');

function createNotificationCallbacksRouter({ collectiveService, notificationState, progressService, now = () => Date.now() }) {
    const router = express.Router();
    let windowStart = now();
    let requests = 0;
    router.post('/ack', async (req, res) => {
        // Global bounded limiter also works behind a proxy without trusting spoofable headers.
        if (now() - windowStart >= 60000) { windowStart = now(); requests = 0; }
        if (++requests > 120) return res.status(429).json({ error: 'Réessayer plus tard' });
        const token = req.body?.token;
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
            return res.status(400).json({ error: 'Bouton invalide' });
        }
        try {
            for (const collective of await collectiveService.getAll()) {
                const record = await notificationState.resolveToken(collective.id, token);
                if (!record) continue;
                const settings = await notificationState.getSettings(collective.id);
                if (!settings) return res.status(409).json({ error: 'Notifications non configurées' });
                const parts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: settings.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
                }).formatToParts(new Date(now()));
                const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
                await progressService.create({
                    collectiveId: collective.id, capability: { token }, data: {
                        programmeId: record.actionId, occurrenceDate: record.occurrenceDate,
                        date: `${values.year}-${values.month}-${values.day}`,
                        state: record.step, memberId: record.memberId, type: 'done'
                    }
                });
                return res.json({ success: true });
            }
            // Same response for unknown, expired or already processed buttons; no enumeration.
            return res.status(409).json({ error: 'Bouton expiré ou déjà traité' });
        } catch {
            return res.status(409).json({ error: 'Étape non validée : actualisez Feddeeji' });
        }
    });
    return router;
}
module.exports = createNotificationCallbacksRouter;
