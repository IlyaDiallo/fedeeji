const PROFILE_FIELDS = ['lastName', 'firstName', 'phone', 'address', 'address2',
    'postalCode', 'city', 'country', 'haBaseUrl', 'haWebhookId'];
const SECRET_KEYS = new Set(['password', 'currentPassword', 'passwordHash', 'adminPassword', 'token', 'tokenHash']);
function stripSecrets(value) {
    if (Array.isArray(value)) return value.map(stripSecrets);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !SECRET_KEYS.has(key))
        .map(([key, item]) => [key, stripSecrets(item)]));
}
function normalizeEmail(value) {
    if (typeof value !== 'string') throw new Error('Adresse email invalide');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@<>,;:"\\()[\]]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)) {
        throw new Error('Adresse email invalide');
    }
    return email;
}
function profileData(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Fiche invalide');
    const data = {};
    for (const key of PROFILE_FIELDS) {
        if (!Object.hasOwn(input, key) || input[key] === undefined) continue;
        if (typeof input[key] !== 'string' || input[key].length > 1000) throw new Error('Champ invalide');
        data[key] = input[key].trim();
    }
    return data;
}
module.exports = { stripSecrets, normalizeEmail, profileData };
