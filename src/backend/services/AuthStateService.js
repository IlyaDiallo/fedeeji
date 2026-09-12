const { AUTH_STATE } = require('./internalCollections');

/** Private authentication data. Never use DataService, audit or trash for these records. */
class AuthStateService {
    constructor({ storage }) { this.storage = storage; }
    read(collectiveId, id) {
        return this.storage.read({ collectiveId, collection: AUTH_STATE, id });
    }
    mutate(collectiveId, callback) {
        return this.storage.mutate({ collectiveId, collection: AUTH_STATE }, callback);
    }
}
module.exports = AuthStateService;
