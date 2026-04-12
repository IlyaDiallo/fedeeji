/**
 * Utilitaires partagés pour la normalisation et le traitement des actions.
 */
class ActionUtils {
    static DEFAULT_DURATION_UNIT = 'minutes';

    /**
     * Normalise une action en convertissant les anciens formats
     * (scheduleMode=frequency, biweekly) vers le modèle récurrence unifié.
     * @param {Object} rawAction - Action brute depuis l'API
     * @param {string} [fallbackDate] - Date de repli si aucune date n'est définie
     * @returns {Object} Action normalisée (copie, pas de mutation)
     */
    static normalize(rawAction, fallbackDate = null) {
        const action = { ...rawAction };

        if (action.scheduleMode === 'frequency') {
            const unitMap = { days: 'daily', weeks: 'weekly' };
            action.recurrence = unitMap[action.frequencyUnit] || 'monthly';
            action.recurrenceInterval = action.frequencyValue || 1;
            action.date = action.startDate || action.date || fallbackDate;
        } else if (action.recurrence === 'biweekly') {
            action.recurrence = 'weekly';
            action.recurrenceInterval = 2;
        }

        return action;
    }

    /**
     * Cherche le nom d'un membre dans une liste.
     * @param {string} memberId
     * @param {Array} members
     * @returns {string} Nom formaté entre parenthèses, ou chaîne vide
     */
    static getMemberName(memberId, members) {
        if (!memberId) return '';
        const m = members.find(member => member.id === memberId);
        if (!m) return '';
        return `(${m.firstName || ''} ${m.lastName || ''})`.trim();
    }
}
