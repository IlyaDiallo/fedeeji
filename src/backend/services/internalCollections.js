const NOTIFICATION_STATE = 'notification-state';

function isInternalCollection(collection) {
    return typeof collection === 'string' && collection.toLowerCase() === NOTIFICATION_STATE;
}

function assertPublicCollection(collection) {
    if (isInternalCollection(collection)) {
        throw new Error('Collection interne inaccessible');
    }
}

module.exports = { NOTIFICATION_STATE, isInternalCollection, assertPublicCollection };
