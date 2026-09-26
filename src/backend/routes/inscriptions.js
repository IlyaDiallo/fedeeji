const express = require('express');
const { requireRole } = require('../middleware/auth');
// Preserve domain status codes (ownership/not-found/past occurrence).
const asyncHandler = (handler, fallback = 400) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(error => res.status(error.status || fallback).json({ error: error.message }));
const EventService = require('../services/EventService');
const InscriptionService = require('../services/InscriptionService');

function createInscriptionsRouter({ dataService, eventService = new EventService({ dataService }) }) {
    const router = express.Router({ mergeParams: true });
    const service = new InscriptionService({ dataService, eventService });
    const params = req => ({ collectiveId: req.collectiveId, collection: 'inscriptions' });
    const memberId = req => req.user.role === 'member' ? req.user.memberId : req.body.memberId;
    const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
    const owned = async req => {
        const record = await dataService.get({ ...params(req), id: req.params.id });
        if (!record) fail('Non trouvé', 404);
        if (req.user.role === 'member' && record.memberId !== req.user.memberId) fail('Accès interdit', 403);
        return record;
    };
    const rejectSeriesFields = body => {
        if ('scope' in body || 'periods' in body) fail('Utilisez la route d’inscription à la série');
    };

    router.put('/series', requireRole('admin', 'member'), asyncHandler(async (req, res) => {
        res.json(await service.setSeries(req.collectiveId, { ...req.body, memberId: memberId(req) }));
    }));

    router.post('/bulk', requireRole('admin', 'member'), asyncHandler(async (req, res) => {
        rejectSeriesFields(req.body);
        const { eventId, entries } = req.body;
        const effectiveMemberId = memberId(req);
        if (!eventId || !effectiveMemberId || !Array.isArray(entries)) fail('eventId, memberId et entries requis');
        await eventService.locked(req.collectiveId, eventId, async () => {
            const event = await service.context(req.collectiveId, eventId, effectiveMemberId);
            // Validate the whole batch before writing anything; last value wins for repeated dates.
            const changes = new Map();
            for (const entry of entries) {
                if (!entry || typeof entry !== 'object') fail('Entrée invalide');
                rejectSeriesFields(entry);
                if (!entry.occurrenceDate) fail('Date requise');
                changes.set(service.validateEntry(event, entry, req.user), entry.response);
            }
            const existing = await dataService.list(params(req));
            for (const [date, response] of changes) {
                const matches = existing.filter(i => i.scope !== 'series' && i.eventId === eventId
                    && i.memberId === effectiveMemberId && (i.occurrenceDate || event.date) === date);
                const found = matches[0];
                if (response === null) {
                    for (const item of matches) await dataService.delete({ ...params(req), id: item.id });
                } else {
                    const data = { eventId, memberId: effectiveMemberId, occurrenceDate: date, response };
                    if (found) await dataService.update({ ...params(req), id: found.id, data });
                    else await dataService.create({ ...params(req), data });
                    for (const duplicate of matches.slice(1)) await dataService.delete({ ...params(req), id: duplicate.id });
                }
            }
            res.json({ success: true, count: changes.size });
        });
    }));

    router.get('/', requireRole('admin', 'member'), asyncHandler(async (req, res) => {
        const data = await dataService.list(params(req));
        res.json(req.user.role === 'member' ? data.filter(i => i.memberId === req.user.memberId) : data);
    }, 500));
    router.get('/:id', requireRole('admin', 'member'), asyncHandler(async (req, res) => res.json(await owned(req)), 500));

    const save = async (req, res) => {
        rejectSeriesFields(req.body);
        const previous = req.params.id ? await owned(req) : null;
        if (previous?.scope === 'series') fail('Utilisez la route d’inscription à la série');
        const eventId = req.body.eventId || previous?.eventId;
        // Keep identity immutable during edits, avoiding cross-event lock races.
        if (previous && ((req.body.eventId && req.body.eventId !== previous.eventId)
            || (req.user.role !== 'member' && req.body.memberId && req.body.memberId !== previous.memberId))) {
            fail('Créez une nouvelle inscription pour changer d’événement ou de membre');
        }
        const effectiveMemberId = req.user.role === 'member' ? req.user.memberId : req.body.memberId || previous?.memberId;
        await eventService.locked(req.collectiveId, eventId, async () => {
            if (previous) await owned(req);
            const event = await service.context(req.collectiveId, eventId, effectiveMemberId);
            if (previous) service.validateEntry(event, previous, req.user);
            const input = { ...previous, ...req.body };
            if (input.response === null) fail('Réponse requise');
            const date = service.validateEntry(event, input, req.user);
            const existing = await dataService.list(params(req));
            const matches = existing.filter(i => i.scope !== 'series' && i.eventId === eventId
                && i.memberId === effectiveMemberId && (i.occurrenceDate || event.date) === date);
            if (previous && matches.some(i => i.id !== previous.id)) fail('Une réponse existe déjà pour cette date');
            const target = previous || matches[0];
            const data = { eventId, memberId: effectiveMemberId, occurrenceDate: date, response: input.response };
            const result = target ? await dataService.update({ ...params(req), id: target.id, data })
                : await dataService.create({ ...params(req), data });
            res.status(target ? 200 : 201).json(result);
        });
    };
    router.post('/', requireRole('admin', 'member'), asyncHandler(save));
    router.put('/:id', requireRole('admin', 'member'), asyncHandler(save));
    router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
        const previous = await owned(req);
        await eventService.locked(req.collectiveId, previous.eventId, async () => {
            const current = await owned(req);
            if (current.scope === 'series') fail('Clôturez l’inscription à la série');
            await dataService.delete({ ...params(req), id: current.id });
            res.json({ success: true });
        });
    }));
    return router;
}
module.exports = createInscriptionsRouter;
