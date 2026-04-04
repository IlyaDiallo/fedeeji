class EventsView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("events") + " - " + t("brand"));
        this.events = [];
    }

    // Formate la durée avec son unité pour l'affichage
    formatDuration(duration, durationUnit) {
        if (!duration) return '';
        const unitLabel = t(durationUnit || 'hours', duration);
        return `${duration} ${unitLabel.toLowerCase()}`;
    }

    async getHtml() {
        const addBtn = this.isMember ? '' : `
            <button class="btn btn-primary"
                id="btn-add-event">
                <i class="bi bi-plus-lg"></i>
                <span class="d-none d-md-inline"
                    data-i18n="add">
                    ${t("add")}</span>
            </button>`;

        const searchBar = this.isMember ? '' : `
            <div class="mb-3">
                <input type="text" id="search-event"
                    class="form-control"
                    placeholder="${t("search_member")}">
            </div>`;

        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="events">${t("events")}</h2>
                ${addBtn}
            </div>
            ${searchBar}
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>${t("name")}</th>
                            <th data-i18n="date">
                                ${t("date")}</th>
                            <th data-i18n="time">
                                ${t("time")}</th>
                            <th data-i18n="duration"
                                class="d-none d-md-table-cell">
                                ${t("duration")}</th>
                            <th class="d-none d-lg-table-cell">
                                Description</th>
                            <th data-i18n="actions">
                                ${t("actions")}</th>
                        </tr>
                    </thead>
                    <tbody id="events-table-body">
                    </tbody>
                </table>
            </div>

            <!-- Modal -->
            <div class="modal fade" id="eventModal"
                tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="eventModalTitle">
                                ${t("add_edit_event")}</h5>
                            <button type="button"
                                class="btn-close"
                                data-bs-dismiss="modal">
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="event-form">
                                <input type="hidden"
                                    id="event-id">
                                <div class="mb-3">
                                    <label class="form-label">
                                        ${t("name")}</label>
                                    <input type="text"
                                        class="form-control"
                                        id="event-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="date">
                                        ${t("date")}</label>
                                    <input type="date"
                                        class="form-control"
                                        id="event-date" required>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input"
                                            type="radio" name="event-allDay"
                                            id="event-allDay-yes" value="yes"
                                            checked>
                                        <label class="form-check-label"
                                            for="event-allDay-yes">
                                            ${t("all_day")}</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input"
                                            type="radio" name="event-allDay"
                                            id="event-allDay-no" value="no">
                                        <label class="form-check-label"
                                            for="event-allDay-no">
                                            ${t("time_and_duration")}</label>
                                    </div>
                                </div>
                                <div id="event-time-duration-container"
                                    style="display:none;">
                                    <div class="mb-3">
                                        <label class="form-label"
                                            data-i18n="time">
                                            ${t("time")}</label>
                                        <input type="time"
                                            class="form-control"
                                            id="event-time">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"
                                            data-i18n="duration">
                                            ${t("duration")}</label>
                                        <div class="input-group">
                                            <input type="number"
                                                class="form-control"
                                                id="event-duration"
                                                min="1">
                                            <select
                                                class="form-select"
                                                id="event-durationUnit"
                                                style="max-width:140px">
                                                <option value="minutes">
                                                    ${t("minutes")}
                                                </option>
                                                <option value="hours"
                                                    selected>
                                                    ${t("hours")}
                                                </option>
                                                <option value="days">
                                                    ${t("days")}
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="recurrence">
                                        ${t("recurrence")}</label>
                                    <select
                                        class="form-select"
                                        id="event-recurrence">
                                        <option value="none">
                                            ${t("recurrence_none")}
                                        </option>
                                        <option value="weekly">
                                            ${t("recurrence_weekly")}
                                        </option>
                                        <option value="biweekly">
                                            ${t("recurrence_biweekly")}
                                        </option>
                                        <option value="monthly">
                                            ${t("recurrence_monthly")}
                                        </option>
                                    </select>
                                </div>
                                <div class="mb-3" id="event-recurrence-days-container" style="display:none;">
                                    <label class="form-label" data-i18n="recurrence_days">${t("recurrence_days")}</label>
                                    <div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-1" value="1">
                                            <label class="form-check-label" for="rec-day-1" data-i18n="day_1">${t("day_1")}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-2" value="2">
                                            <label class="form-check-label" for="rec-day-2" data-i18n="day_2">${t("day_2")}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-3" value="3">
                                            <label class="form-check-label" for="rec-day-3" data-i18n="day_3">${t("day_3")}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-4" value="4">
                                            <label class="form-check-label" for="rec-day-4" data-i18n="day_4">${t("day_4")}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-5" value="5">
                                            <label class="form-check-label" for="rec-day-5" data-i18n="day_5">${t("day_5")}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-6" value="6">
                                            <label class="form-check-label" for="rec-day-6" data-i18n="day_6">${t("day_6")}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input recurrence-day" type="checkbox" id="rec-day-0" value="0">
                                            <label class="form-check-label" for="rec-day-0" data-i18n="day_0">${t("day_0")}</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3" id="event-recurrence-monthly-type-container" style="display:none;">
                                    <label class="form-label" data-i18n="monthly_type">${t("monthly_type")}</label>
                                    <select class="form-select" id="event-monthlyType">
                                        <option value="date" data-i18n="monthly_type_date">${t("monthly_type_date")}</option>
                                        <option value="first_day" data-i18n="monthly_type_first">${t("monthly_type_first")}</option>
                                        <option value="last_day" data-i18n="monthly_type_last">${t("monthly_type_last")}</option>
                                        <option value="nth_weekday" data-i18n="monthly_type_weekday">${t("monthly_type_weekday")}</option>
                                    </select>
                                </div>
                                <div class="mb-3" id="event-recurrence-end-container" style="display:none;">
                                    <label class="form-label"
                                        data-i18n="recurrence_end_date">
                                        ${t("recurrence_end_date")}</label>
                                    <input type="date"
                                        class="form-control"
                                        id="event-recurrenceEndDate">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">
                                        Description</label>
                                    <textarea
                                        class="form-control"
                                        id="event-description">
                                    </textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                class="btn btn-secondary"
                                data-bs-dismiss="modal"
                                data-i18n="cancel">
                                ${t("cancel")}</button>
                            <button type="button"
                                class="btn btn-primary"
                                id="btn-save-event"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Affiche ou masque les champs heure+durée selon le radio sélectionné
    toggleAllDay() {
        const isAllDay = document.getElementById(
            'event-allDay-yes'
        ).checked;
        const container = document.getElementById(
            'event-time-duration-container'
        );
        container.style.display = isAllDay
            ? 'none' : 'block';
        const timeInput = document.getElementById('event-time');
        const durationInput = document.getElementById('event-duration');
        if (isAllDay) {
            timeInput.removeAttribute('required');
            durationInput.removeAttribute('required');
        } else {
            timeInput.setAttribute('required', '');
            durationInput.setAttribute('required', '');
        }
    }

    async loadEvents() {
        try {
            this.events = await api.get(
                this.collectiveId, 'events'
            );
            this.renderTable();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    renderTable(searchTerm = '') {
        const tbody = document.getElementById(
            'events-table-body'
        );
        tbody.innerHTML = '';

        const filtered = this.events.filter(e =>
            e.name?.toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
            e.description?.toLowerCase()
                .includes(searchTerm.toLowerCase())
        );

        filtered.forEach(event => {
            // Rétrocompatibilité : si allDay n'est pas défini, on regarde si time est renseigné
            const isAllDay = event.allDay !== undefined
                ? event.allDay : !event.time;
            const timeDisplay = isAllDay
                ? t("all_day")
                : (event.time || '');
            const durationDisplay = isAllDay
                ? ''
                : this.formatDuration(
                    event.duration, event.durationUnit
                );
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${event.name || ''}</td>
                <td>${event.date || ''}</td>
                <td>${timeDisplay}</td>
                <td class="d-none d-md-table-cell">
                    ${durationDisplay}</td>
                <td class="d-none d-lg-table-cell">
                    ${event.description || ''}</td>
                <td>
                    ${this.isMember ? `
                    <div class="btn-group-actions">
                        ${(event.recurrence && event.recurrence !== 'none') ? `
                        <a href="/${this.collectiveId}/events/${event.id}/inscription-schedule" class="btn btn-sm btn-outline-primary" data-link title="${t("plan_inscriptions")}">
                            <i class="bi bi-calendar-check"></i>
                        </a>` : ''}
                        <a href="/${this.collectiveId}/inscriptions?eventId=${event.id}" class="btn btn-sm btn-outline-success" data-link title="${t("inscriptions")}">
                            <i class="bi bi-calendar-plus"></i>
                        </a>
                    </div>
                    ` : `
                    <div class="btn-group-actions">
                        ${(event.recurrence && event.recurrence !== 'none') ? `
                        <a href="/${this.collectiveId}/events/${event.id}/inscription-schedule" class="btn btn-sm btn-outline-info" data-link title="${t("plan_inscriptions")}">
                            <i class="bi bi-calendar-check"></i>
                        </a>` : ''}
                        <button class="btn btn-sm
                            btn-outline-primary btn-edit"
                            data-id="${event.id}"
                            title="${t("edit")}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm
                            btn-outline-danger btn-delete"
                            data-id="${event.id}"
                            title="${t("delete")}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>`}
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id =
                        e.target.closest('button').dataset.id;
                    this.openModal(id);
                });
            });

        document.querySelectorAll('.btn-delete')
            .forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id =
                        e.target.closest('button').dataset.id;
                    this.deleteEvent(id);
                });
            });
    }

    async init() {
        await this.loadEvents();

        const searchInput =
            document.getElementById('search-event');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });
        }

        if (this.isMember) {
            return;
        }

        this.modal = new bootstrap.Modal(
            document.getElementById('eventModal')
        );

        document.getElementById('btn-add-event')
            .addEventListener('click', () => {
                this.openModal();
            });

        document.getElementById('btn-save-event')
            .addEventListener('click', () => {
                this.saveEvent();
            });

        // Gestion du toggle "toute la journée" / "heure + durée"
        document.querySelectorAll(
            'input[name="event-allDay"]'
        ).forEach(radio => {
            radio.addEventListener('change', () => {
                this.toggleAllDay();
            });
        });

        const recurrenceSelect = document.getElementById('event-recurrence');
        if (recurrenceSelect) {
            recurrenceSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                document.getElementById('event-recurrence-end-container').style.display = val !== 'none' ? 'block' : 'none';
                document.getElementById('event-recurrence-days-container').style.display = (val === 'weekly' || val === 'biweekly') ? 'block' : 'none';
                document.getElementById('event-recurrence-monthly-type-container').style.display = val === 'monthly' ? 'block' : 'none';
            });
        }
        
        const dateInput = document.getElementById('event-date');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                if (!e.target.value) return;
                const dateObj = new Date(`${e.target.value}T12:00:00`);
                const day = dateObj.getDay();
                const anyChecked = Array.from(document.querySelectorAll('.recurrence-day')).some(cb => cb.checked);
                if (!anyChecked) {
                    const cb = document.getElementById(`rec-day-${day}`);
                    if (cb) cb.checked = true;
                }
            });
        }
    }

    openModal(id = null) {
        const form = document.getElementById('event-form');
        form.reset();
        document.getElementById('event-id').value = '';

        if (id) {
            const event = this.events
                .find(e => e.id === id);
            if (event) {
                document.getElementById('event-id')
                    .value = event.id;
                document.getElementById('event-name')
                    .value = event.name || '';
                document.getElementById('event-date')
                    .value = event.date || '';

                // Rétrocompatibilité : si allDay n'est pas défini, on regarde si time est renseigné
                const isAllDay = event.allDay !== undefined
                    ? event.allDay : !event.time;
                document.getElementById('event-allDay-yes')
                    .checked = isAllDay;
                document.getElementById('event-allDay-no')
                    .checked = !isAllDay;
                this.toggleAllDay();

                document.getElementById('event-time')
                    .value = event.time || '';
                document.getElementById('event-duration')
                    .value = event.duration || '';
                document.getElementById('event-durationUnit')
                    .value = event.durationUnit || 'hours';
                document.getElementById('event-recurrence')
                    .value = event.recurrence || 'none';
                document.getElementById('event-recurrenceEndDate')
                    .value = event.recurrenceEndDate || '';
                
                document.querySelectorAll('.recurrence-day').forEach(cb => {
                    cb.checked = event.recurrenceDays
                        ? event.recurrenceDays.includes(
                            parseInt(cb.value)
                        ) : false;
                });
                
                document.getElementById('event-monthlyType')
                    .value = event.monthlyType || 'date';
                
                document.getElementById('event-description')
                    .value = event.description || '';
                    
                const val = event.recurrence || 'none';
                document.getElementById(
                    'event-recurrence-end-container'
                ).style.display =
                    val !== 'none' ? 'block' : 'none';
                document.getElementById(
                    'event-recurrence-days-container'
                ).style.display =
                    (val === 'weekly' || val === 'biweekly')
                        ? 'block' : 'none';
                document.getElementById(
                    'event-recurrence-monthly-type-container'
                ).style.display =
                    val === 'monthly' ? 'block' : 'none';
            }
        } else {
            document.getElementById('event-allDay-yes')
                .checked = true;
            document.getElementById('event-allDay-no')
                .checked = false;
            this.toggleAllDay();
            document.getElementById('event-recurrence')
                .value = 'none';
            document.getElementById(
                'event-recurrence-end-container'
            ).style.display = 'none';
            document.getElementById(
                'event-recurrence-days-container'
            ).style.display = 'none';
            document.getElementById(
                'event-recurrence-monthly-type-container'
            ).style.display = 'none';
            document.getElementById('event-monthlyType')
                .value = 'date';
            document.querySelectorAll('.recurrence-day')
                .forEach(cb => cb.checked = false);
        }
        this.modal.show();
    }

    async saveEvent() {
        const form = document.getElementById('event-form');
        if (!form.reportValidity()) return;

        const id =
            document.getElementById('event-id').value;
        const isAllDay = document.getElementById(
            'event-allDay-yes'
        ).checked;
        const data = {
            name: document.getElementById(
                'event-name'
            ).value,
            date: document.getElementById(
                'event-date'
            ).value,
            allDay: isAllDay,
            time: isAllDay ? '' : document.getElementById(
                'event-time'
            ).value,
            duration: isAllDay ? null : Number(
                document.getElementById(
                    'event-duration'
                ).value
            ),
            durationUnit: isAllDay ? null :
                document.getElementById(
                    'event-durationUnit'
                ).value,
            recurrence: document.getElementById(
                'event-recurrence'
            ).value,
            recurrenceEndDate: document.getElementById(
                'event-recurrenceEndDate'
            ).value || null,
            recurrenceDays: Array.from(
                document.querySelectorAll(
                    '.recurrence-day:checked'
                )
            ).map(cb => parseInt(cb.value)),
            monthlyType: document.getElementById(
                'event-monthlyType'
            ).value,
            description: document.getElementById(
                'event-description'
            ).value
        };

        try {
            if (id) {
                await api.update(
                    this.collectiveId, 'events', id, data
                );
            } else {
                await api.create(
                    this.collectiveId, 'events', data
                );
            }
            this.modal.hide();
            await this.loadEvents();
        } catch (error) {
            alert(t("error_save") + ': '
                + error.message);
        }
    }

    async deleteEvent(id) {
        if (confirm(t("confirm_delete"))) {
            try {
                await api.delete(
                    this.collectiveId, 'events', id
                );
                await this.loadEvents();
            } catch (error) {
                alert(t("error_delete") + ': '
                    + error.message);
            }
        }
    }
}
