class ScheduleView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("schedule") + " - " + t("brand"));
        this.events = [];
        this.orgId = params.orgId;
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="schedule">${t("schedule")}</h2>
            </div>
            
            <div class="row">
                <div class="col-md-12">
                    <div id="calendar" class="p-3 border rounded bg-white">
                        <!-- Calendrier ou liste interactive -->
                    </div>
                </div>
            </div>
        `;
    }

    async loadEvents() {
        try {
            this.events = await api.get(this.orgId, 'events');
            
            // Tri par date
            this.events.sort((a, b) => new Date(a.date) - new Date(b.date));
            this.renderSchedule();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderSchedule() {
        const container = document.getElementById('calendar');
        container.innerHTML = '';

        if (this.events.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun événement planifié.</p>';
            return;
        }

        const listGroup = document.createElement('div');
        listGroup.className = 'list-group';

        this.events.forEach(event => {
            const item = document.createElement('a');
            item.href = `/${this.orgId}/events`;
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-2 border rounded';
            item.setAttribute('data-link', '');
            
            const dateObj = new Date(event.date);
            const dateStr = dateObj.toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'fr-FR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const timeStr = event.time
                ? ` ⏰ ${event.time}` : '';
            const durationStr = event.duration
                ? ` ⏱️ ${event.duration} ${t(event.durationUnit || 'hours').toLowerCase()}`
                : '';

            item.innerHTML = `
                <div class="ms-2 me-auto">
                    <div class="fw-bold fs-5 text-primary">
                        ${event.name}</div>
                    <div class="text-muted">
                        <small>🗓️ ${dateStr}${timeStr}${durationStr}</small>
                    </div>
                    <div class="mt-2">
                        ${event.description || ''}</div>
                </div>
            `;
            listGroup.appendChild(item);
        });

        container.appendChild(listGroup);
    }

    async init() {
        await this.loadEvents();
    }
}
