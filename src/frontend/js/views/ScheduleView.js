class ScheduleView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("schedule") + " - " + t("brand"));
        this.events = [];
        this.orgId = params.orgId;
        this.isMember = api.getRole() === 'member';
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
            this.renderSchedule();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderSchedule() {
        const container = document.getElementById('calendar');
        container.innerHTML = '';

        if (this.events.length === 0) {
            container.innerHTML = `<p class="text-muted">Aucun événement planifié.</p>`;
            return;
        }

        const now = new Date();
        const futureEvents = [];
        
        this.events.forEach(event => {
            const occurrences = window.RecurrenceUtils ? window.RecurrenceUtils.generateOccurrences({ event, startDate: now }) : [event];
            
            if (occurrences && occurrences.length > 0) {
                const todayStr = window.RecurrenceUtils ? window.RecurrenceUtils.formatDateStr(now) : now.toISOString().slice(0, 10);
                const futureOccurrences = occurrences.filter(occ => occ.occurrenceDate >= todayStr);
                
                if (futureOccurrences.length > 0) {
                    futureEvents.push({
                        event: event,
                        occurrences: futureOccurrences,
                        nextDate: futureOccurrences[0].occurrenceDate
                    });
                }
            }
        });

        futureEvents.sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));

        if (futureEvents.length === 0) {
            container.innerHTML = `<p class="text-muted">Aucun événement planifié.</p>`;
            return;
        }

        const listGroup = document.createElement('div');
        listGroup.className = 'list-group border-0';

        futureEvents.forEach(item => {
            const event = item.event;
            const occurrences = item.occurrences;
            const isRecurrent = event.recurrence && event.recurrence !== 'none';
            const stackContainer = document.createElement('div');
            stackContainer.className = 'event-stack-container';
            
            const firstOcc = occurrences[0];
            const dateObj = new Date(firstOcc.occurrenceDate);
            const dateStr = dateObj.toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'fr-FR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            // Rétrocompatibilité : si allDay n'est pas défini, on regarde si time est renseigné
            const isAllDay = event.allDay !== undefined
                ? event.allDay : !event.time;
            const timeStr = isAllDay
                ? ` 📅 ${t("all_day")}`
                : (event.time ? ` ⏰ ${event.time}` : '');
            const durationStr = isAllDay
                ? ''
                : (event.duration
                    ? ` ⏱️ ${event.duration} ${t(event.durationUnit || 'hours').toLowerCase()}`
                    : '');
            
            let recurrenceStr = '';
            if (isRecurrent) {
                const recLabels = {
                    'weekly': t('recurrence_weekly'),
                    'biweekly': t('recurrence_biweekly'),
                    'monthly': t('recurrence_monthly')
                };
                recurrenceStr = ` 🔄 ${recLabels[event.recurrence] || ''}`;
            }
            
            let cancelledClass = firstOcc.isCancelled ? 'occurrence-cancelled' : '';
            let cancelledLabel = firstOcc.isCancelled ? ` <span class="badge bg-danger ms-2">${t("occurrence_cancelled")}</span>` : '';

            let toggleCancelBtn = '';
            if (!this.isMember) {
                toggleCancelBtn = `
                    <button class="btn btn-sm ms-2 ${firstOcc.isCancelled ? 'btn-outline-success' : 'btn-outline-danger'} btn-toggle-cancel"
                        data-event-id="${event.id}"
                        data-date="${firstOcc.occurrenceDate}"
                        title="${t('cancel_occurrence')}">
                        <i class="bi bi-${firstOcc.isCancelled ? 'arrow-counterclockwise' : 'x-circle'}"></i>
                    </button>`;
            }

            const headerHtml = `
                <div class="list-group-item event-stack-header ${isRecurrent ? 'has-recurrence' : ''} border rounded" data-id="${event.id}">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div class="ms-2 me-auto ${cancelledClass}">
                            <div class="fw-bold fs-5 text-primary d-flex align-items-center">
                                ${event.name}${cancelledLabel}
                            </div>
                            <div class="text-muted mt-1">
                                <small>🗓️ ${dateStr}${timeStr}${durationStr}${recurrenceStr}</small>
                            </div>
                            <div class="mt-2 text-dark">
                                ${event.description || ''}
                            </div>
                        </div>
                        <div class="d-flex align-items-center">
                            ${toggleCancelBtn}
                            ${isRecurrent && occurrences.length > 1 ? `
                            <button class="btn btn-sm btn-outline-secondary ms-2 btn-toggle-stack" title="${t("expand_stack")}">
                                <i class="bi bi-chevron-down"></i>
                            </button>
                            ` : `
                            <a href="/${this.orgId}/participations?eventId=${event.id}&date=${firstOcc.occurrenceDate}" class="btn btn-sm btn-outline-success ms-2" data-link title="${t("participations")}">
                                <i class="bi bi-calendar-plus"></i>
                            </a>
                            `}
                        </div>
                    </div>
                </div>
            `;
            
            stackContainer.innerHTML = headerHtml;

            if (isRecurrent && occurrences.length > 1) {
                const body = document.createElement('div');
                body.className = 'event-stack-body list-group';
                
                for (let i = 1; i < occurrences.length; i++) {
                    const occ = occurrences[i];
                    const occDateObj = new Date(occ.occurrenceDate);
                    const occDateStr = occDateObj.toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'fr-FR', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    });
                    
                    let occCancelledClass = occ.isCancelled ? 'occurrence-cancelled' : '';
                    let occCancelledLabel = occ.isCancelled ? ` <span class="badge bg-danger ms-2">${t("occurrence_cancelled")}</span>` : '';

                    let toggleCancelBtnOcc = '';
                    if (!this.isMember) {
                        toggleCancelBtnOcc = `
                            <button class="btn btn-sm ms-2 ${occ.isCancelled ? 'btn-outline-success' : 'btn-outline-danger'} btn-toggle-cancel"
                                data-event-id="${event.id}"
                                data-date="${occ.occurrenceDate}"
                                title="${t('cancel_occurrence')}">
                                <i class="bi bi-${occ.isCancelled ? 'arrow-counterclockwise' : 'x-circle'}"></i>
                            </button>`;
                    }

                    const occItem = document.createElement('div');
                    occItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center mb-1 rounded bg-light border';
                    occItem.innerHTML = `
                        <div class="ms-2 me-auto ${occCancelledClass}">
                            <div class="fw-bold text-secondary d-flex align-items-center">
                                ${event.name}${occCancelledLabel}
                            </div>
                            <div class="text-muted mt-1">
                                <small>🗓️ ${occDateStr}${timeStr}</small>
                            </div>
                        </div>
                        <div class="d-flex align-items-center">
                            ${toggleCancelBtnOcc}
                            <a href="/${this.orgId}/participations?eventId=${event.id}&date=${occ.occurrenceDate}" class="btn btn-sm btn-outline-success ms-2" data-link title="${t("participations")}">
                                <i class="bi bi-calendar-plus"></i>
                            </a>
                        </div>
                    `;
                    body.appendChild(occItem);
                }
                
                stackContainer.appendChild(body);
            }

            listGroup.appendChild(stackContainer);
        });

        container.appendChild(listGroup);

        document.querySelectorAll('.btn-toggle-cancel').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const eventId = btn.getAttribute('data-event-id');
                const date = btn.getAttribute('data-date');
                await this.toggleCancelDate(eventId, date);
            });
        });

        document.querySelectorAll('.btn-toggle-stack').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const header = e.target.closest('.event-stack-header');
                const container = header.parentElement;
                const body = container.querySelector('.event-stack-body');
                const icon = btn.querySelector('i');
                
                if (body) {
                    body.classList.toggle('show');
                    if (body.classList.contains('show')) {
                        icon.classList.replace('bi-chevron-down', 'bi-chevron-up');
                        btn.title = t("collapse_stack");
                    } else {
                        icon.classList.replace('bi-chevron-up', 'bi-chevron-down');
                        btn.title = t("expand_stack");
                    }
                }
            });
        });
    }

    async toggleCancelDate(eventId, date) {
        try {
            const event = this.events.find(e => e.id === eventId);
            if (!event) return;

            const cancelledDates = event.cancelledDates || [];
            if (cancelledDates.includes(date)) {
                event.cancelledDates = cancelledDates.filter(d => d !== date);
            } else {
                event.cancelledDates = [...cancelledDates, date];
            }

            await api.update(this.orgId, 'events', eventId, { cancelledDates: event.cancelledDates });
            await this.loadEvents();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    async init() {
        await this.loadEvents();
    }
}
