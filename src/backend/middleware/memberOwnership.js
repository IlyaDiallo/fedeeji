/**
 * Middleware : force le memberId du membre connecté et
 * vérifie la propriété d'une ressource existante.
 *
 * @param {Object} params
 * @param {import('../services/DataService')} params.dataService
 * @param {string} params.collection - Nom de la collection à vérifier
 * @param {Object} [params.options]
 * @param {boolean} [params.options.checkPastEvent=false] - Vérifier si l'événement est passé
 * @param {boolean} [params.options.allowNoteAccess=false] - Autoriser l'accès aux notes d'autrui
 */
function createMemberOwnership({ dataService, collection, options = {} }) {
    const { checkPastEvent = false, allowNoteAccess = false } = options;

    return async (req, res, next) => {
        if (req.user.role !== 'member') return next();

        // Forcer le memberId pour les créations
        if (req.body) {
            req.body.memberId = req.user.memberId;
        }

        // Vérification de propriété sur les opérations par ID
        const id = req.params.id;
        if (id) {
            const existing = await dataService.get({
                collectiveId: req.collectiveId,
                collection,
                id
            });
            if (!existing) {
                return res.status(404).json({ error: 'Non trouvé' });
            }

            const isOwner = existing.memberId === req.user.memberId;
            const isNoteAccess = allowNoteAccess && existing.type === 'note';

            if (!isOwner && !isNoteAccess) {
                return res.status(403).json({ error: 'Accès interdit' });
            }
        }

        // Vérification événement passé (inscriptions)
        if (checkPastEvent && (req.method === 'POST' || req.method === 'PUT')) {
            const body = req.body || {};
            const existingId = id;
            let existing = null;
            if (existingId) {
                existing = await dataService.get({
                    collectiveId: req.collectiveId,
                    collection,
                    id: existingId
                });
            }
            const eventId = body.eventId || existing?.eventId;
            if (eventId) {
                const evt = await dataService.get({
                    collectiveId: req.collectiveId,
                    collection: 'events',
                    id: eventId
                });
                if (evt) {
                    const evtDate =
                        body.occurrenceDate
                        || existing?.occurrenceDate
                        || evt.date;
                    if (evtDate) {
                        const today = new Date().toISOString().slice(0, 10);
                        if (evtDate < today) {
                            return res.status(403).json({
                                error: 'past_event_locked'
                            });
                        }
                    }
                }
            }
        }

        next();
    };
}

module.exports = createMemberOwnership;
