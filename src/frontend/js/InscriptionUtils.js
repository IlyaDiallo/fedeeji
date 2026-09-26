class InscriptionUtils {
    static today() { return new Date().toISOString().slice(0, 10); }

    static isRecurrent(event) { return !!event.recurrence && event.recurrence !== 'none'; }

    static isActive(series, date = this.today()) {
        return (series?.periods || []).some(p => p.startsOn <= date && (!p.endsBefore || date < p.endsBefore));
    }

    static resolve({ event, inscriptions, memberId, date }) {
        if (event.type === 'individual' || (event.cancelledDates || []).includes(date)) return null;
        const relevant = inscriptions.filter(i => i.eventId === event.id && i.memberId === memberId);
        const explicit = relevant.find(i => i.scope !== 'series' && (i.occurrenceDate || event.date) === date);
        if (explicit) return explicit.response;
        if (this.isRecurrent(event) && relevant.some(i => i.scope === 'series' && this.isActive(i, date))) return 'yes';
        return null;
    }
}
if (typeof window !== 'undefined') window.InscriptionUtils = InscriptionUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = InscriptionUtils;
