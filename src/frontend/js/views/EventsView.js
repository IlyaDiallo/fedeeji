class EventsView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("events") + " - " + t("brand"));
        this.events = [];
        this.orgId = params.orgId;
        this.isMember = api.getRole() === 'member';
    }

    // Formate la durée avec son unité pour l'affichage
    formatDuration(duration, durationUnit) {
        if (!duration) return '';
        const unitLabel = t(durationUnit || 'hours');
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
                                ${t("add_edit_member")}</h5>
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
                                    <label class="form-label"
                                        data-i18n="time">
                                        ${t("time")}</label>
                                    <input type="time"
                                        class="form-control"
                                        id="event-time" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="duration">
                                        ${t("duration")}</label>
                                    <div class="input-group">
                                        <input type="number"
                                            class="form-control"
                                            id="event-duration"
                                            min="1" required>
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

    async loadEvents() {
        try {
            this.events = await api.get(
                this.orgId, 'events'
            );
            this.renderTable();
        } catch (error) {
            alert('Erreur: ' + error.message);
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
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${event.name || ''}</td>
                <td>${event.date || ''}</td>
                <td>${event.time || ''}</td>
                <td class="d-none d-md-table-cell">
                    ${this.formatDuration(
                        event.duration,
                        event.durationUnit
                    )}</td>
                <td class="d-none d-lg-table-cell">
                    ${event.description || ''}</td>
                <td>
                    ${this.isMember ? '' : `
                    <div class="btn-group-actions">
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
                document.getElementById('event-time')
                    .value = event.time || '';
                document.getElementById('event-duration')
                    .value = event.duration || '';
                document.getElementById('event-durationUnit')
                    .value = event.durationUnit || 'hours';
                document.getElementById('event-description')
                    .value = event.description || '';
            }
        }
        this.modal.show();
    }

    async saveEvent() {
        const id =
            document.getElementById('event-id').value;
        const data = {
            name: document.getElementById(
                'event-name'
            ).value,
            date: document.getElementById(
                'event-date'
            ).value,
            time: document.getElementById(
                'event-time'
            ).value,
            duration: Number(document.getElementById(
                'event-duration'
            ).value),
            durationUnit: document.getElementById(
                'event-durationUnit'
            ).value,
            description: document.getElementById(
                'event-description'
            ).value
        };

        try {
            if (id) {
                await api.update(
                    this.orgId, 'events', id, data
                );
            } else {
                await api.create(
                    this.orgId, 'events', data
                );
            }
            this.modal.hide();
            await this.loadEvents();
        } catch (error) {
            alert('Erreur lors de la sauvegarde: '
                + error.message);
        }
    }

    async deleteEvent(id) {
        if (confirm(t("confirm_delete"))) {
            try {
                await api.delete(
                    this.orgId, 'events', id
                );
                await this.loadEvents();
            } catch (error) {
                alert('Erreur lors de la suppression: '
                    + error.message);
            }
        }
    }
}
