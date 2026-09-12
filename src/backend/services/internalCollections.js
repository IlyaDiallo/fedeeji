const NOTIFICATION_STATE = 'notification-state';
const AUTH_STATE = 'auth-state';

function isInternalCollection(collection) {
    return typeof collection === 'string'
        && [NOTIFICATION_STATE, AUTH_STATE].includes(collection.toLowerCase());
}

function assertPublicCollection(collection) {
    if (isInternalCollection(collection)) {
        throw new Error('Collection interne inaccessible');
    }
}

module.exports = { NOTIFICATION_STATE, AUTH_STATE, isInternalCollection, assertPublicCollection };
