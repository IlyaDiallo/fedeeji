const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const createMemberOwnership = require('../middleware/memberOwnership');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createInscriptionsRouter({ dataService }) {
    const router = express.Router({ mergeParams: true });

    const memberOwnership = createMemberOwnership({
        dataService,
        collection: 'inscriptions',
        options: { checkPastEvent: true }
    });

    // --- Bulk upsert ---

    router.post('/bulk',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const { eventId, memberId, entries } = req.body;
            if (!eventId || !memberId || !Array.isArray(entries)) {
                return res.status(400).json({
                    error: 'eventId, memberId et entries requis'
                });
            }
            const effectiveMemberId = req.user.role === 'member'
                ? req.user.memberId : memberId;

            const existing = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'inscriptions'
            });

            const results = [];
            for (const entry of entries) {
                const { occurrenceDate, response } = entry;
                if (!occurrenceDate) continue;

                const found = existing.find(
                    p => p.eventId === eventId
                        && p.memberId === effectiveMemberId
                        && p.occurrenceDate === occurrenceDate
                );

                if (response === null) {
                    if (found) {
                        await dataService.delete({
                            collectiveId: req.collectiveId,
                            collection: 'inscriptions',
                            id: found.id
                        });
                    }
                } else if (found) {
                    const updated = await dataService.update({
                        collectiveId: req.collectiveId,
                        collection: 'inscriptions',
                        id: found.id,
                        data: { response }
                    });
                    results.push(updated);
                } else {
                    const created = await dataService.create({
                        collectiveId: req.collectiveId,
                        collection: 'inscriptions',
                        data: {
                            eventId,
                            memberId: effectiveMemberId,
                            occurrenceDate,
                            response
                        }
                    });
                    results.push(created);
                }
            }
            res.json({ success: true, count: results.length });
        })
    );

    // --- Liste (membre : filtrée) ---

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            let data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'inscriptions'
            });
            if (req.user.role === 'member') {
                data = data.filter(
                    p => p.memberId === req.user.memberId
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
                collection: 'inscriptions',
                id: req.params.id
            });
            if (!data) {
                return res.status(404).json({ error: 'Non trouvé' });
            }
            if (
                req.user.role === 'member'
                && data.memberId !== req.user.memberId
            ) {
                return res.status(403).json({ error: 'Accès interdit' });
            }
            res.json(data);
        }, 500)
    );

    router.post('/',
        requireRole('admin', 'member'),
        memberOwnership,
        asyncHandler(async (req, res) => {
            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'inscriptions',
                data: req.body
            });
            res.status(201).json(data);
        })
    );

    router.put('/:id',
        requireRole('admin', 'member'),
        memberOwnership,
        asyncHandler(async (req, res) => {
            const data = await dataService.update({
                collectiveId: req.collectiveId,
                collection: 'inscriptions',
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
                collection: 'inscriptions',
                id: req.params.id
            });
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createInscriptionsRouter;
