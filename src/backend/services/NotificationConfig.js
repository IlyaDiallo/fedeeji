const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_DELAY_MINUTES = 366 * 24 * 60;
const REPEAT_MS = 10 * 60 * 1000;

function invalid(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function object(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw invalid(`${name} : objet attendu`);
    }
}

function time(value, name) {
    if (typeof value !== 'string' || !TIME.test(value)) {
        throw invalid(`${name} : heure HH:mm attendue`);
    }
    return value;
}

function normalizeSettings(value) {
    object(value, 'Notifications');
    if (typeof value.timeZone !== 'string') throw invalid('Fuseau horaire requis');
    try {
        new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format();
    } catch {
        throw invalid('Fuseau horaire IANA invalide');
    }
    const quietStart = time(value.quietStart, 'Début du silence');
    const quietEnd = time(value.quietEnd, 'Fin du silence');
    if (quietStart === quietEnd) throw invalid('La plage silencieuse doit avoir une durée');
    if (!Array.isArray(value.allowedOrigins) || !value.allowedOrigins.length) {
        throw invalid('Au moins une origine Home Assistant autorisée est requise');
    }
    const allowedOrigins = [...new Set(value.allowedOrigins.map(origin => {
        let url;
        try { url = new URL(origin); } catch { throw invalid('Origine HA invalide'); }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
            || url.pathname !== '/' || url.search || url.hash) {
            throw invalid('Origine HA attendue sans chemin ni identifiants');
        }
        return url.origin;
    }))];
    const insecureTlsOrigins = value.insecureTlsOrigins || [];
    if (!Array.isArray(insecureTlsOrigins) || insecureTlsOrigins.some(origin =>
        typeof origin !== 'string' || !origin.startsWith('https://')
        || !allowedOrigins.includes(origin))) {
        throw invalid('Les exceptions TLS doivent être des origines HTTPS autorisées');
    }
    return {
        version: 1, timeZone: value.timeZone, quietStart, quietEnd,
        allowedOrigins, insecureTlsOrigins: [...new Set(insecureTlsOrigins)]
    };
}

/** Missing configuration remains opt-out. Never silently enable historical actions. */
function normalizeAlert(value, { states = [], memberId, members = [] } = {}) {
    if (value == null) return { enabled: false };
    object(value, 'Alerte');
    if (typeof value.enabled !== 'boolean') throw invalid('Activation de l’alerte invalide');
    if (!value.enabled) return { enabled: false };
    if (!Array.isArray(states) || states.some(s => typeof s !== 'string' || !s.trim())) {
        throw invalid('Étapes invalides');
    }
    const initialTime = time(value.initialTime, 'Heure de l’alerte');
    if (!['responsible', 'selected'].includes(value.recipientMode)) {
        throw invalid('Choisir le responsable ou une liste de destinataires');
    }
    const ids = value.recipientMode === 'responsible' ? [memberId] : value.memberIds;
    if (!Array.isArray(ids) || !ids.length || ids.some(id =>
        typeof id !== 'string' || !members.some(member => member.id === id))) {
        throw invalid('Destinataires absents ou étrangers au collectif');
    }
    // states are intermediate labels; the implicit final state needs a delay too.
    if (!Array.isArray(value.stepDelayMinutes) || value.stepDelayMinutes.length !== states.length
        || value.stepDelayMinutes.some(n => !Number.isSafeInteger(n) || n < 0 || n > MAX_DELAY_MINUTES)) {
        throw invalid('Un délai entier de 0 à 527040 minutes est requis par étape suivante');
    }
    return {
        version: 1, enabled: true, initialTime, recipientMode: value.recipientMode,
        memberIds: value.recipientMode === 'selected' ? [...new Set(ids)] : [],
        stepDelayMinutes: [...value.stepDelayMinutes]
    };
}

function recipientIds(action) {
    if (!action.alert?.enabled) return [];
    return action.alert.recipientMode === 'responsible'
        ? (action.memberId ? [action.memberId] : [])
        : [...new Set(action.alert.memberIds || [])];
}

function buildWebhookUrl(member) {
    if (member?.haBaseUrl && member?.haWebhookId) {
        return `${member.haBaseUrl.replace(/\/$/, '')}/api/webhook/${encodeURIComponent(member.haWebhookId)}`;
    }
    return member?.haWebhookUrl || null;
}

module.exports = {
    normalizeSettings, normalizeAlert, recipientIds, buildWebhookUrl,
    invalid, REPEAT_MS, MAX_DELAY_MINUTES
};
