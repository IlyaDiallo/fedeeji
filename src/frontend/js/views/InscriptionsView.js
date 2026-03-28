class InscriptionsView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(
            t("inscriptions") + " - " + t("brand")
        );
        this.inscriptions = [];
        this.members = [];
        this.events = [];
        this.orgId = params.orgId;
        this.isMember = api.getRole() === 'member';
    }

    // Retourne le badge Bootstrap correspondant à la réponse
    getResponseBadge(response) {
        const badges = {
            yes: 'bg-success',
            no: 'bg-danger',
            maybe: 'bg-warning text-dark'
        };
        const cls = badges[response] || 'bg-secondary';
        const label = t(response || 'no');
        return `<span class="badge ${cls}">${label}</span>`;
    }

    /** Vérifie si un événement ou une occurrence est passé */
    isEventPast(eventId, occurrenceDate) {
        const evt = this.events.find(
            e => e.id === eventId
        );
        if (!evt) return false;
        const dateToCheck = occurrenceDate || evt.date;
        if (!dateToCheck) return false;
        const today = window.RecurrenceUtils ? window.RecurrenceUtils.formatDateStr(new Date()) : new Date().toISOString().slice(0, 10);
        return dateToCheck < today;
    }

    async getHtml() {
        const addBtn = `
            <button class="btn btn-primary"
                id="btn-add-inscription">
                <i class="bi bi-plus-lg"></i>
                <span class="d-none d-md-inline"
                    data-i18n="add">
                    ${t("add")}</span>
            </button>`;

        const searchBar = this.isMember ? '' : `
            <div class="mb-3">
                <input type="text"
                    id="search-inscription"
                    class="form-control"
                    placeholder="${t("search_member")}">
            </div>`;

        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 data-i18n="inscriptions">
                    ${t("inscriptions")}</h2>
                ${addBtn}
            </div>
            ${searchBar}
            <div class="table-responsive">
                <table class="table table-striped
                    table-hover">
                    <thead>
                        <tr>
                            <th data-i18n="event">
                                ${t("event")}</th>
                            <th data-i18n="member">
                                ${t("member")}</th>
                            <th data-i18n="response">
                                ${t("response")}</th>
                            <th data-i18n="actions">
                                ${t("actions")}</th>
                        </tr>
                    </thead>
                    <tbody id="inscriptions-table-body">
                    </tbody>
                </table>
            </div>

            <!-- Modal -->
            <div class="modal fade"
                id="inscriptionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"
                                id="inscriptionModalTitle">
                                ${t("add_edit_inscription")}
                            </h5>
                            <button type="button"
                                class="btn-close"
                                data-bs-dismiss="modal">
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="inscription-form">
                                <input type="hidden"
                                    id="inscription-id">
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="event">
                                        ${t("event")}</label>
                                    <select
                                        class="form-select"
                                        id="inscription-eventId"
                                        required>
                                    </select>
                                </div>
                                <div class="mb-3" id="inscription-occurrence-container" style="display:none;">
                                    <label class="form-label"
                                        data-i18n="date">
                                        ${t("date")}</label>
                                    <select
                                        class="form-select"
                                        id="inscription-occurrenceDate">
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="member">
                                        ${t("member")}</label>
                                    <select
                                        class="form-select"
                                        id="inscription-memberId"
                                        required>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label"
                                        data-i18n="response">
                                        ${t("response")}
                                    </label>
                                    <select
                                        class="form-select"
                                        id="inscription-response"
                                        required>
                                        <option value="yes">
                                            ${t("yes")}
                                        </option>
                                        <option value="no">
                                            ${t("no")}
                                        </option>
                                        <option value="maybe">
                                            ${t("maybe")}
                                        </option>
                                    </select>
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
                                id="btn-save-inscription"
                                data-i18n="save">
                                ${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const promises = [
                api.get(this.orgId, 'inscriptions'),
                api.get(this.orgId, 'events')
            ];
            // Membre : pas d'accès à la liste des membres
            if (!this.isMember) {
                promises.push(
                    api.get(this.orgId, 'members')
                );
            }
            const results = await Promise.all(promises);
            this.inscriptions = results[0];
            this.events = results[1];
            this.members = this.isMember
                ? [] : results[2];
            this.renderTable();
            this.renderSelects();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderSelects() {
        const memberSelect = document.getElementById(
            'inscription-memberId'
        );
        const memberGroup = memberSelect
            .closest('.mb-3');

        if (this.isMember) {
            // Membre : cacher le sélecteur, forcer son id
            memberGroup.classList.add('d-none');
            memberSelect.innerHTML =
                `<option value="${api.getMemberId()}" `
                + `selected>—</option>`;
        } else {
            memberGroup.classList.remove('d-none');
            memberSelect.innerHTML =
                `<option value="">`
                + `${t("select_member")}</option>`;
            this.members.forEach(m => {
                memberSelect.innerHTML +=
                    `<option value="${m.id}">`
                    + `${m.lastName} ${m.firstName}`
                    + `</option>`;
            });
        }

        const eventSelect = document.getElementById(
            'inscription-eventId'
        );
        eventSelect.innerHTML =
            `<option value="">${t("select_event")}`
            + `</option>`;

        const today = window.RecurrenceUtils ? window.RecurrenceUtils.formatDateStr(new Date()) : new Date().toISOString().slice(0, 10);
        this.events.forEach(e => {
            // Membre : n'afficher que les événements futurs ou récurrents actifs
            if (this.isMember) {
                const isRecurrent = e.recurrence
                    && e.recurrence !== 'none';
                if (isRecurrent) {
                    if (e.recurrenceEndDate
                        && e.recurrenceEndDate < today) return;
                } else {
                    if (e.date && e.date < today) return;
                }
            }
            eventSelect.innerHTML +=
                `<option value="${e.id}">` +
                `${e.name} (${e.date})</option>`;
        });
    }

    renderTable(searchTerm = '') {
        const tbody = document.getElementById(
            'inscriptions-table-body'
        );
        tbody.innerHTML = '';

        const filtered = this.inscriptions.filter(p => {
            const member = this.members
                .find(m => m.id === p.memberId);
            const event = this.events
                .find(e => e.id === p.eventId);
            const searchString =
                `${member?.lastName} ${member?.firstName}`
                + ` ${event?.name}`.toLowerCase();
            return searchString
                .includes(searchTerm.toLowerCase());
        });

        filtered.forEach(p => {
            const member = this.members
                .find(m => m.id === p.memberId);
            const memberName = this.isMember
                ? (api.user?.memberName || '')
                : (member
                    ? `${member.lastName} `
                        + `${member.firstName}`
                    : 'Inconnu');

            const event = this.events
                .find(e => e.id === p.eventId);
            let eventName = event
                ? event.name : 'Inconnu';
                
            if (p.occurrenceDate) {
                eventName += ` (${p.occurrenceDate})`;
            }

            const isPast = this.isEventPast(p.eventId, p.occurrenceDate);
            const pastBadge = isPast
                ? ` <span class="badge bg-secondary">`
                    + `${t("past_event")}</span>`
                : '';

            // Membre : pas de modif sur événement passé
            const locked =
                this.isMember && isPast;

            let actionsHtml = '';
            if (!locked) {
                actionsHtml += `
                    <button class="btn btn-sm
                        btn-outline-primary btn-edit"
                        data-id="${p.id}"
                        title="${t("edit")}">
                        <i class="bi bi-pencil"></i>
                    </button>`;
            }
            if (!this.isMember) {
                actionsHtml += `
                    <button class="btn btn-sm
                        btn-outline-danger btn-delete"
                        data-id="${p.id}"
                        title="${t("delete")}">
                        <i class="bi bi-trash"></i>
                    </button>`;
            }

            const tr = document.createElement('tr');
            if (locked) {
                tr.classList.add('table-secondary');
            }
            tr.innerHTML = `
                <td>${eventName}${pastBadge}</td>
                <td>${memberName}</td>
                <td>${this.getResponseBadge(
                    p.response
                )}</td>
                <td>
                    <div class="btn-group-actions">
                        ${actionsHtml}
                    </div>
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
                    this.deleteInscription(id);
                });
            });
    }

    async init() {
        await this.loadData();

        this.modal = new bootstrap.Modal(
            document.getElementById('inscriptionModal')
        );

        document.getElementById('btn-add-inscription')
            .addEventListener('click', () => {
                this.openModal();
            });

        document.getElementById('btn-save-inscription')
            .addEventListener('click', () => {
                this.saveInscription();
            });

        const searchInput = document.getElementById(
            'search-inscription'
        );
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });
        }
        
        const eventSelect = document.getElementById('inscription-eventId');
        if (eventSelect) {
            eventSelect.addEventListener('change', (e) => {
                this.updateOccurrenceSelect(e.target.value);
            });
        }

        const urlParams = new URLSearchParams(window.location.search);
        const eventIdParam = urlParams.get('eventId');
        if (eventIdParam) {
            this.openModal();
            document.getElementById('inscription-eventId').value = eventIdParam;
            const dateParam = urlParams.get('date');
            this.updateOccurrenceSelect(eventIdParam, dateParam);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    updateOccurrenceSelect(eventId, selectedDate = null) {
        const container = document.getElementById('inscription-occurrence-container');
        const select = document.getElementById('inscription-occurrenceDate');
        
        if (!eventId) {
            container.style.display = 'none';
            select.innerHTML = '';
            return;
        }
        
        const event = this.events.find(e => e.id === eventId);
        if (!event || event.recurrence === 'none') {
            container.style.display = 'none';
            select.innerHTML = '';
            return;
        }
        
        // Générer les occurrences
        const occurrences = window.RecurrenceUtils ? window.RecurrenceUtils.generateOccurrences({ event }) : [];
        if (occurrences.length === 0) {
            container.style.display = 'none';
            select.innerHTML = '';
            return;
        }
        
        container.style.display = 'block';
        select.innerHTML = `<option value="" disabled selected>Sélectionner une date</option>`;
        
        const today = new Date().toISOString().slice(0, 10);
        
        occurrences.forEach(occ => {
            if (this.isMember && occ.occurrenceDate < today) return;
            if (occ.isCancelled) return;
            
            const selected = selectedDate === occ.occurrenceDate ? 'selected' : '';
            select.innerHTML += `<option value="${occ.occurrenceDate}" ${selected}>${occ.occurrenceDate}</option>`;
        });
    }

    openModal(id = null) {
        const form = document.getElementById(
            'inscription-form'
        );
        form.reset();
        document.getElementById('inscription-id')
            .value = '';

        if (id) {
            const p = this.inscriptions
                .find(x => x.id === id);
            if (p) {
                document.getElementById('inscription-id')
                    .value = p.id;
                document.getElementById(
                    'inscription-eventId'
                ).value = p.eventId || '';
                
                this.updateOccurrenceSelect(p.eventId, p.occurrenceDate);
                
                document.getElementById(
                    'inscription-memberId'
                ).value = p.memberId || '';
                document.getElementById(
                    'inscription-response'
                ).value = p.response || 'yes';
            }
        } else {
            document.getElementById('inscription-occurrence-container').style.display = 'none';
            document.getElementById('inscription-occurrenceDate').innerHTML = '';
        }
        this.modal.show();
    }

    async saveInscription() {
        const id = document.getElementById(
            'inscription-id'
        ).value;
        const data = {
            eventId: document.getElementById(
                'inscription-eventId'
            ).value,
            memberId: document.getElementById(
                'inscription-memberId'
            ).value,
            response: document.getElementById(
                'inscription-response'
            ).value
        };
        
        const occSelect = document.getElementById('inscription-occurrenceDate');
        const occContainer = document.getElementById('inscription-occurrence-container');
        if (occContainer.style.display !== 'none' && occSelect.value) {
            data.occurrenceDate = occSelect.value;
        } else {
            data.occurrenceDate = null;
        }

        if (!data.eventId || !data.memberId) {
            alert(
                `${t("select_event")} / ${t("select_member")}`
            );
            return;
        }

        try {
            if (id) {
                await api.update(
                    this.orgId, 'inscriptions', id, data
                );
            } else {
                await api.create(
                    this.orgId, 'inscriptions', data
                );
            }
            this.modal.hide();
            await this.loadData();
        } catch (error) {
            alert('Erreur lors de la sauvegarde: '
                + error.message);
        }
    }

    async deleteInscription(id) {
        if (confirm(t("confirm_delete"))) {
            try {
                await api.delete(
                    this.orgId, 'inscriptions', id
                );
                await this.loadData();
            } catch (error) {
                alert('Erreur lors de la suppression: '
                    + error.message);
            }
        }
    }
}
