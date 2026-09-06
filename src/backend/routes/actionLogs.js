const express = require('express');
const { requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const createMemberOwnership = require('../middleware/memberOwnership');

/**
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 */
function createActionLogsRouter({ dataService, progressService }) {
    const router = express.Router({ mergeParams: true });

    const memberOwnership = createMemberOwnership({
        dataService,
        collection: 'action-logs',
        options: { allowNoteAccess: true }
    });

    router.get('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const data = await dataService.list({
                collectiveId: req.collectiveId,
                collection: 'action-logs'
            });
            res.json(data);
        }, 500)
    );

    router.post('/',
        requireRole('admin', 'member'),
        asyncHandler(async (req, res) => {
            const body = { ...req.body };
            if (req.user.role === 'member') {
                body.memberId = req.user.memberId;
            }

            // Upsert pour les notes (unique par action+date)
            if (body.type === 'note') {
                const existingLogs = await dataService.list({
                    collectiveId: req.collectiveId,
                    collection: 'action-logs'
                });
                const existingNote = existingLogs.find(l =>
                    l.programmeId === body.programmeId
                    && l.type === 'note'
                    && l.date === body.date
                );
                if (existingNote) {
                    const data = await dataService.update({
                        collectiveId: req.collectiveId,
                        collection: 'action-logs',
                        id: existingNote.id,
                        data: body
                    });
                    return res.status(200).json(data);
                }
            }

            if ((!body.type || body.type === 'done') && progressService) {
                const result = await progressService.create({ collectiveId: req.collectiveId, data: body });
                return res.status(result.duplicate ? 200 : 201).json(result.data);
            }

            // Compatibilité pour les consommateurs sans service de progression injecté.
            if (body.type === 'done') {
                const existingLogs = await dataService.list({
                    collectiveId: req.collectiveId,
                    collection: 'action-logs'
                });
                const bodyState = body.state !== undefined
                    ? body.state : 1;
                const occDoneLogs = existingLogs
                    .filter(l =>
                        l.programmeId === body.programmeId
                        && l.type === 'done'
                        && l.date === body.date
                    )
                    .sort((a, b) =>
                        (b.timestamp || 0) - (a.timestamp || 0)
                    );
                if (occDoneLogs.length > 0) {
                    const latestState = occDoneLogs[0].state !== undefined
                        ? occDoneLogs[0].state : 1;
                    if (latestState === bodyState) {
                        return res.status(409).json({
                            error: 'Action already marked as done'
                        });
                    }
                }
            }

            const data = await dataService.create({
                collectiveId: req.collectiveId,
                collection: 'action-logs',
                data: body
            });
            res.status(201).json(data);
        })
    );

    router.put('/:id',
        requireRole('admin', 'member'),
        memberOwnership,
        asyncHandler(async (req, res) => {
            const data = progressService
                ? await progressService.change({ collectiveId: req.collectiveId, id: req.params.id, data: req.body })
                : await dataService.update({
                    collectiveId: req.collectiveId, collection: 'action-logs',
                    id: req.params.id, data: req.body
                });
            res.json(data);
        })
    );

    router.delete('/:id',
        requireRole('admin', 'member'),
        memberOwnership,
        asyncHandler(async (req, res) => {
            if (progressService) {
                await progressService.change({ collectiveId: req.collectiveId, id: req.params.id, remove: true });
            } else {
                await dataService.delete({
                    collectiveId: req.collectiveId, collection: 'action-logs', id: req.params.id
                });
            }
            res.json({ success: true });
        })
    );

    return router;
}

module.exports = createActionLogsRouter;
