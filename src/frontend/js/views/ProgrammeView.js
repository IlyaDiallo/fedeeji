class ProgrammeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("programme") + " - " + t("brand"));
        this.collectiveId = params.collectiveId;
        this.isMember = api.getRole() === 'member';
        this.events = [];
        this.actions = [];
        this.actionLogs = [];
        this.members = [];
        this.viewMode = 'list';
        this.currentDate = new Date();
    }

    async getHtml() {
        const addBtn = this.isMember ? '' : `
            <button class="btn btn-primary"
                id="btn-add-action">
                <i class="bi bi-plus-circle"></i>
                <span class="d-none d-md-inline">
                    ${t("add_action") || "Ajouter une action"}</span>
            </button>`;

        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="programme">${t("programme")}</h2>
                <div>
                    ${addBtn}
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center mb-3">
                <ul class="nav nav-tabs mb-0 border-bottom-0" id="programme-tabs">
                    <li class="nav-item">
                        <a class="nav-link active" href="#" data-tab="all">${t("all")}</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#" data-tab="events">${t("events")}</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#" data-tab="actions">${t("actions_label")}</a>
                    </li>
                </ul>
                
                <div class="btn-group" role="group">
                    <input type="radio" class="btn-check" name="view-mode" id="view-list" value="list" autocomplete="off" checked>
                    <label class="btn btn-outline-secondary btn-sm" for="view-list" title="Liste"><i class="bi bi-list-ul"></i></label>

                    <input type="radio" class="btn-check" name="view-mode" id="view-week" value="week" autocomplete="off">
                    <label class="btn btn-outline-secondary btn-sm" for="view-week" title="Semaine"><i class="bi bi-calendar-week"></i></label>

                    <input type="radio" class="btn-check" name="view-mode" id="view-month" value="month" autocomplete="off">
                    <label class="btn btn-outline-secondary btn-sm" for="view-month" title="Mois"><i class="bi bi-calendar-month"></i></label>
                </div>
            </div>

            <div id="calendar-nav" class="d-flex justify-content-between align-items-center mb-3 d-none">
                <button class="btn btn-outline-secondary btn-sm" id="btn-prev-cal"><i class="bi bi-chevron-left"></i></button>
                <h5 id="calendar-label" class="mb-0"></h5>
                <button class="btn btn-outline-secondary btn-sm" id="btn-next-cal"><i class="bi bi-chevron-right"></i></button>
            </div>

            <div id="programme-list" class="list-group border-0">
            </div>

            <div id="programme-calendar" class="d-none">
            </div>

            <!-- Modal action -->
            <div class="modal fade" id="actionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="actionModalTitle">${t("schedule_action_title")}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="action-form">
                                <input type="hidden" id="action-id">
                                <div class="mb-3" id="action-type-container">
                                    <label class="form-label fw-bold">Quand ?</label>
                                    <div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input" type="radio" name="action-executionType" id="exec-type-scheduled" value="scheduled" checked>
                                            <label class="form-check-label" for="exec-type-scheduled" data-i18n="scheduled">${t("scheduled") || "Programmée"}</label>
                                        </div>
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input" type="radio" name="action-executionType" id="exec-type-now" value="now">
                                            <label class="form-check-label" for="exec-type-now" data-i18n="now">${t("now") || "Maintenant"}</label>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3" id="action-template-container">
                                    <label class="form-label">${t("template")}</label>
                                    <select class="form-select" id="action-template-select"></select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">${t("name")}</label>
                                    <input type="text" class="form-control" id="action-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" data-i18n="intermediate_states">${t("intermediate_states") || "États intermédiaires (séparés par des virgules)"}</label>
                                    <input type="text" class="form-control" id="action-states" placeholder="ex: En cours, Vérifié">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" id="action-description"></textarea>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label" id="action-date-label">${t("date")}</label>
                                        <input type="date" class="form-control" id="action-date" required>
                                    </div>
                                    <div class="col-md-6 mb-3" id="action-recurrenceEndDate-container" style="display:none;">
                                        <label class="form-label">${t("recurrence_end_date")}</label>
                                        <input type="date" class="form-control" id="action-recurrenceEndDate">
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="action-allDay" id="action-allDay-yes" value="yes" checked>
                                        <label class="form-check-label" for="action-allDay-yes">${t("all_day")}</label>
                                    </div>
                                    <div class="form-check form-check-inline">
                                        <input class="form-check-input" type="radio" name="action-allDay" id="action-allDay-no" value="no">
                                        <label class="form-check-label" for="action-allDay-no">${t("time_and_duration")}</label>
                                    </div>
                                </div>
                                <div id="action-time-duration" style="display:none;">
                                    <div class="mb-3">
                                        <label class="form-label">${t("time")}</label>
                                        <input type="time" class="form-control" id="action-time">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">${t("duration")}</label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="action-duration" min="1">
                                            <select class="form-select" id="action-durationUnit" style="max-width:140px">
                                                <option value="minutes">${t("minutes")}</option>
                                                <option value="hours" selected>${t("hours")}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div class="mb-3" id="action-recurrence-main-container">
                                    <label class="form-label" data-i18n="recurrence">${t("recurrence")}</label>
                                    <div class="input-group">
                                        <span class="input-group-text" id="action-recurrence-label">${t("every")}</span>
                                        <input type="number" class="form-control" id="action-recurrenceInterval" min="1" value="1" style="max-width: 80px;">
                                        <select class="form-select" id="action-recurrence">
                                            <option value="none">${t("recurrence_none")}</option>
                                            <option value="daily">${t("days")}</option>
                                            <option value="weekly">${t("weeks")}</option>
                                            <option value="monthly">${t("months_unit")}</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3" id="action-recurrence-days-container" style="display:none;">
                                    <label class="form-label">${t("recurrence_days")}</label>
                                    <div>
                                        ${[1,2,3,4,5,6,0].map(d => `
                                        <div class="form-check form-check-inline">
                                            <input class="form-check-input action-recurrence-day" type="checkbox" id="action-rec-day-${d}" value="${d}">
                                            <label class="form-check-label" for="action-rec-day-${d}">${t("day_" + d)}</label>
                                        </div>`).join('')}
                                    </div>
                                </div>
                                <div class="mb-3" id="action-monthly-type-container" style="display:none;">
                                    <label class="form-label">${t("monthly_type")}</label>
                                    <select class="form-select" id="action-monthlyType">
                                        <option value="date">${t("monthly_type_date")}</option>
                                        <option value="first_day">${t("monthly_type_first")}</option>
                                        <option value="last_day">${t("monthly_type_last")}</option>
                                        <option value="nth_weekday">${t("monthly_type_weekday")}</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3" id="action-window-main-container">
                                    <label class="form-label" data-i18n="window_days">${t("window_days")}</label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" id="action-windowDays" min="0" value="0">
                                        <span class="input-group-text">${t("days_before")}</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" data-i18n="cancel">${t("cancel")}</button>
                            <button type="button" class="btn btn-primary" id="btn-save-action" data-i18n="save">${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal log (Fait !) -->
            <div class="modal fade" id="logModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="logModalTitle">${t("mark_done")}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="log-form">
                                <input type="hidden" id="log-id">
                                <input type="hidden" id="log-actionId">
                                <input type="hidden" id="log-type" value="done">
                                <input type="hidden" id="log-occurrence-date">
                                <div class="mb-3" id="log-state-container" style="display:none;">
                                    <label class="form-label" data-i18n="target_state">${t("target_state") || "État cible"}</label>
                                    <select class="form-select" id="log-state"></select>
                                </div>
                                <div id="log-window-info" class="d-none"></div>
                                <div id="log-existing-notes" class="mb-3 d-none">
                                    <!-- Container pour afficher les notes existantes -->
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">${t("date")}</label>
                                    <input type="date" class="form-control" id="log-date" required>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">${t("time")}</label>
                                        <input type="time" class="form-control" id="log-time">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">${t("duration")}</label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="log-duration" min="1">
                                            <select class="form-select" id="log-durationUnit" style="max-width:120px">
                                                <option value="minutes">${t("minutes")}</option>
                                                <option value="hours">${t("hours")}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">${t("notes")}</label>
                                    <textarea class="form-control" id="log-notes" rows="2"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-danger d-none" id="btn-delete-log">${t("delete")}</button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t("cancel")}</button>
                            <button type="button" class="btn btn-success" id="btn-save-log">${t("save")}</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal historique -->
            <div class="modal fade" id="historyModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="historyModalTitle">${t("history")}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="history-body">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t("close")}</button>
                        </div>
                    </div>
                </div>
            </div>

        `;
    }

    // --- Chargement des données ---

    async loadData() {
        try {
            const [events, actions, actionLogs] = await Promise.all([
                api.get(this.collectiveId, 'events'),
                api.get(this.collectiveId, 'actions'),
                api.get(this.collectiveId, 'action-logs')
            ]);
            this.events = events || [];
            this.actions = actions || [];
            this.actionLogs = actionLogs || [];
            if (!this.isMember) {
                this.members = await api.get(this.collectiveId, 'members');
            }
        } catch (error) {
            this.events = [];
            this.actions = [];
            this.actionLogs = [];
            this.members = [];
        }
        this.renderContent();
    }

    // --- Rendu de la liste unifiée ---

    renderContent(filter = 'all') {
        const activeTab = document.querySelector('#programme-tabs a.active');
        const currentFilter = activeTab ? activeTab.dataset.tab : filter;
        
        if (this.viewMode === 'list') {
            document.getElementById('programme-list').classList.remove('d-none');
            document.getElementById('programme-calendar').classList.add('d-none');
            document.getElementById('calendar-nav').classList.add('d-none');
            this.renderList(currentFilter);
        } else {
            document.getElementById('programme-list').classList.add('d-none');
            document.getElementById('programme-calendar').classList.remove('d-none');
            document.getElementById('calendar-nav').classList.remove('d-none');
            this.renderCalendar(currentFilter);
        }
    }

    renderList(filter = 'all') {
        const container = document.getElementById('programme-list');
        container.innerHTML = '';

        const items = [];
        const now = new Date();
        const todayStr = RecurrenceUtils.formatDateStr(now);
        const locale = i18n.lang === 'en' ? 'en-US' : 'fr-FR';

        // Événements
        if (filter === 'all' || filter === 'events') {
            this.events.forEach(event => {
                const occurrences = window.RecurrenceUtils
                    ? RecurrenceUtils.generateOccurrences({ event, startDate: now })
                    : [event];
                const future = (occurrences || []).filter(o => o.occurrenceDate >= todayStr);
                if (future.length > 0) {
                    items.push({
                        type: 'event',
                        data: event,
                        nextDate: future[0].occurrenceDate,
                        occurrence: future[0]
                    });
                }
            });
        }

        // Actions
        if (filter === 'all' || filter === 'actions') {
            this.actions.forEach(rawAction => {
                const action = { ...rawAction };
                if (action.scheduleMode === 'frequency') {
                    if (action.frequencyUnit === 'days') {
                        action.recurrence = 'daily';
                        action.recurrenceInterval = action.frequencyValue || 1;
                    } else if (action.frequencyUnit === 'weeks') {
                        action.recurrence = 'weekly';
                        action.recurrenceInterval = action.frequencyValue || 1;
                    } else {
                        action.recurrence = 'monthly';
                        action.recurrenceInterval = action.frequencyValue || 1;
                    }
                    action.date = action.startDate || action.date || todayStr;
                } else if (action.recurrence === 'biweekly') {
                    action.recurrence = 'weekly';
                    action.recurrenceInterval = 2;
                }

                const logs = this.actionLogs
                    .filter(l => l.programmeId === action.id)
                    .sort((a, b) => b.date.localeCompare(a.date));
                
                // Pour le calcul des récurrences, on ne considère que les "done" terminés
                const allDoneLogs = logs.filter(l => !l.type || l.type === 'done');
                const maxState = (action.states && action.states.length > 0) ? action.states.length + 1 : 1;
                const fullDoneLogs = allDoneLogs.filter(l => {
                    // Ancien log sans état : considéré comme complètement fait
                    if (l.state == null) return true;
                    return l.state === maxState;
                });
                const lastLog = fullDoneLogs.length > 0 ? fullDoneLogs[0] : null;

                let generateFrom = action.date || todayStr;
                if (lastLog) {
                    generateFrom = lastLog.date;
                }

                const occurrences = window.RecurrenceUtils 
                    ? RecurrenceUtils.generateOccurrences({
                        event: action,
                        startDate: new Date(`${generateFrom}T12:00:00`)
                    }) : [action];

                let targetOccurrence = null;
                if (lastLog) {
                    targetOccurrence = occurrences.find(o => o.occurrenceDate > lastLog.date);
                    if (!targetOccurrence && occurrences.length > 0) {
                        const lastOcc = occurrences[occurrences.length - 1];
                        if (lastOcc.occurrenceDate >= todayStr) {
                            targetOccurrence = lastOcc;
                        }
                    }
                } else {
                    targetOccurrence = occurrences[0];
                }

                if (targetOccurrence) {
                    const occDateStr = targetOccurrence.occurrenceDate;
                    
                    // Trouver s'il y a des notes pour cette occurrence spécifique
                    const targetNotes = logs.filter(l => l.type === 'note' && l.date === occDateStr);

                    const occDateObj = new Date(`${occDateStr}T12:00:00`);
                    const windowStartObj = new Date(occDateObj);
                    windowStartObj.setDate(windowStartObj.getDate() - (action.windowDays || 0));
                    const windowStartStr = RecurrenceUtils.formatDateStr(windowStartObj);

                    let status;
                    if (todayStr > occDateStr) {
                        status = 'overdue';
                    } else if (todayStr >= windowStartStr) {
                        status = 'due';
                    } else {
                        status = 'ok';
                    }

                    const occDoneLogs = allDoneLogs
                        .filter(l => l.date === occDateStr)
                        .sort((a, b) =>
                            (b.timestamp || 0) - (a.timestamp || 0)
                            || (b.state || 0) - (a.state || 0)
                        );
                    const latestStateLog = occDoneLogs.length > 0
                        ? occDoneLogs[0] : null;
                    const currentState = latestStateLog
                        ? (latestStateLog.state == null ? maxState : latestStateLog.state)
                        : 0;

                    items.push({
                        type: 'action',
                        data: action,
                        nextDate: occDateStr,
                        occurrence: targetOccurrence,
                        status: status,
                        lastLog: lastLog,
                        targetNotes: targetNotes,
                        currentState: currentState,
                        windowStartStr: windowStartStr
                    });
                }
            });
        }

        // Tri par prochaine date
        items.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

        this.lastRenderedItems = items;

        if (items.length === 0) {
            container.innerHTML = `<p class="text-muted">${t("no_programme_items")}</p>`;
            return;
        }

        items.forEach(item => {
            const el = this.renderItem(item, locale);
            container.appendChild(el);
        });

        this.bindItemEvents();
    }

    renderItem(item, locale) {
        const div = document.createElement('div');
        div.className = 'list-group-item border rounded mb-2';

        if (item.type === 'event') {
            div.innerHTML = this.renderEventItem(item, locale);
        } else {
            div.innerHTML = this.renderActionItem(item, locale);
        }
        return div;
    }

    renderEventItem(item, locale) {
        const event = item.data;
        const occ = item.occurrence;
        const dateStr = new Date(occ.occurrenceDate).toLocaleDateString(locale, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const isAllDay = event.allDay !== undefined ? event.allDay : !event.time;
        const timeStr = isAllDay ? '' : ` ⏰ ${event.time || ''}`;
        const isRecurrent = event.recurrence && event.recurrence !== 'none';
        const cancelledLabel = occ.isCancelled ? ` <span class="badge bg-danger ms-1">${t("occurrence_cancelled")}</span>` : '';

        const inscLink = isRecurrent
            ? `<a href="/${this.collectiveId}/events/${event.id}/inscription-schedule" class="btn btn-sm btn-outline-primary" data-link title="${t("plan_inscriptions")}"><i class="bi bi-calendar-check"></i></a>`
            : `<a href="/${this.collectiveId}/inscriptions?eventId=${event.id}&date=${occ.occurrenceDate}" class="btn btn-sm btn-outline-success" data-link title="${t("inscriptions")}"><i class="bi bi-calendar-plus"></i></a>`;

        return `
            <div class="d-flex w-100 flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                <div class="ms-2 me-auto">
                    <div class="fw-bold text-primary d-flex align-items-center">
                        <span class="badge bg-info me-2">📅 ${t("event")}</span>
                        ${event.name}${cancelledLabel}
                    </div>
                    <div class="text-muted mt-1">
                        <small>🗓️ ${dateStr}${timeStr}</small>
                    </div>
                    ${event.description ? `<div class="mt-1 text-dark small">${event.description}</div>` : ''}
                </div>
                <div class="d-flex align-items-center flex-wrap justify-content-end gap-1 mt-2 mt-sm-0 align-self-end align-self-sm-auto">
                    ${inscLink}
                </div>
            </div>`;
    }

    renderActionItem(item, locale) {
        const action = item.data;
        const occ = item.occurrence;
        const status = item.status;
        const lastLog = item.lastLog;
        const targetNotes = item.targetNotes || [];
        const currentState = item.currentState || 0;
        const states = action.states || [];
        const maxState = states.length > 0 ? states.length + 1 : 1;
        
        const dateStr = new Date(occ.occurrenceDate).toLocaleDateString(locale, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const isAllDay = action.allDay !== undefined ? action.allDay : !action.time;
        const timeStr = isAllDay ? '' : ` ⏰ ${action.time || ''}`;
        const cancelledLabel = occ.isCancelled ? ` <span class="badge bg-danger ms-1">${t("occurrence_cancelled")}</span>` : '';

        let statusBadge;
        if (status === 'overdue') {
            statusBadge = `<span class="badge bg-danger ms-2">🔴 ${t("overdue")}</span>`;
        } else if (status === 'due') {
            statusBadge = `<span class="badge bg-warning text-dark ms-2">🟡 ${t("due_now")}</span>`;
        } else {
            statusBadge = `<span class="badge bg-success ms-2">🟢 ${t("status_ok")}</span>`;
        }

        let stateBadge = '';
        if (states.length > 0) {
            let stateName = "À faire";
            if (currentState > 0 && currentState < maxState) {
                stateName = states[currentState - 1];
            } else if (currentState === maxState) {
                stateName = t("done") || "Fait";
            }
            stateBadge = `<span class="badge bg-secondary ms-2">${stateName}</span>`;
        }

        const lastLogStr = lastLog
            ? `✅ ${t("last_done")} ${lastLog.date} ${this.getMemberName(lastLog.memberId)}`
            : `⚠️ ${t("never_done")}`;
            
        const notesStr = targetNotes.length > 0
            ? `<span class="badge bg-info text-dark ms-2"><i class="bi bi-card-text"></i> ${targetNotes.length} ${t("note")}</span>`
            : '';

        const canDo = status === 'due' || status === 'overdue';
        const isDone = currentState >= maxState;
        const nextState = currentState + 1;
        let nextStateName = "✅";
        if (states.length > 0 && nextState <= states.length) {
            nextStateName = states[nextState - 1];
        } else if (states.length > 0) {
            nextStateName = t("done") || "Fait";
        }

        let doneBtn;
        if (isDone) {
            // Déjà fait → consulter/éditer le log existant
            doneBtn = `<button class="btn btn-sm btn-outline-success btn-edit-log"
                data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-check-circle-fill"></i></button>`;
        } else if (canDo) {
            // Dans la fenêtre, pas encore fait → marquer comme fait
            doneBtn = `<button class="btn btn-sm btn-success btn-mark-done"
                data-id="${action.id}" title="${t("mark_done")}">
                ${nextStateName}</button>`;
        } else {
            // Hors fenêtre → éditer instructions et heure/durée
            doneBtn = `<button class="btn btn-sm btn-outline-secondary btn-edit-future"
                data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-pencil-square"></i></button>`;
        }

        const noteBtn = canDo
            ? `<button class="btn btn-sm btn-outline-info btn-add-note"
                data-id="${action.id}" title="${t("add_note")}">📝</button>`
            : '';

        const adminBtns = this.isMember ? '' : `
            <button class="btn btn-sm btn-outline-primary btn-edit-action" data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger btn-delete-action" data-id="${action.id}" title="${t("delete")}">
                <i class="bi bi-trash"></i>
            </button>`;

        let recurrenceStr = '';
        if (action.recurrence && action.recurrence !== 'none') {
            const interval = action.recurrenceInterval || 1;
            if (interval === 1) {
                const everyMap = { 'daily': 'every_day', 'weekly': 'every_week', 'monthly': 'every_month' };
                recurrenceStr = `🔄 ${t(everyMap[action.recurrence] || 'every_day')} &nbsp;|&nbsp; `;
            } else {
                const unitMap = { 'daily': 'days', 'weekly': 'weeks', 'monthly': 'months_unit' };
                const everyKey = action.recurrence === 'weekly' ? 'every_fem' : 'every';
                recurrenceStr = `🔄 ${t(everyKey)} ${interval} ${t(unitMap[action.recurrence] || 'days', interval).toLowerCase()} &nbsp;|&nbsp; `;
            }
        }

        return `
            <div class="d-flex w-100 flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                <div class="ms-2 me-auto">
                    <div class="fw-bold d-flex align-items-center flex-wrap">
                        <span class="badge bg-warning text-dark me-2">🔧 ${t("action_label")}</span>
                        ${action.name}${cancelledLabel}
                        ${statusBadge}
                        ${stateBadge}
                        ${notesStr}
                    </div>
                    <div class="text-muted mt-1">
                        <small>
                            ${recurrenceStr}
                            📅 ${t("deadline")} ${dateStr}${timeStr}
                            ${action.windowDays > 0 ? `&nbsp;|&nbsp; 🪟 ${t("window")} ${action.windowDays}${t("days_short")}` : ''}
                        </small>
                    </div>
                    ${action.description ? `<div class="mt-1 text-dark small">${action.description}</div>` : ''}
                    ${targetNotes.length > 0 ? `<div class="mt-1 small text-info">
                        ${targetNotes.map(n =>
                            `<div><i class="bi bi-card-text"></i> ${n.notes}</div>`
                        ).join('')}
                    </div>` : ''}
                    <div class="mt-1 small ${lastLog ? 'text-success' : 'text-muted'}">
                        ${lastLogStr}
                    </div>
                </div>
                <div class="d-flex align-items-center flex-wrap justify-content-end gap-1 mt-2 mt-sm-0 align-self-end align-self-sm-auto">
                    ${doneBtn}
                    ${noteBtn}
                    <button class="btn btn-sm btn-outline-secondary btn-history" data-id="${action.id}" title="${t("history")}">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    ${adminBtns}
                </div>
            </div>`;
    }

    renderCalendar(filter = 'all') {
        const container = document.getElementById('programme-calendar');
        container.innerHTML = '';
        
        // Calculate dates
        let startCal, endCal;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const date = this.currentDate.getDate();
        
        if (this.viewMode === 'month') {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
            startCal = new Date(firstDay);
            let dayOfWeek = startCal.getDay();
            let diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startCal.setDate(startCal.getDate() - diff);
            
            endCal = new Date(lastDay);
            dayOfWeek = endCal.getDay();
            diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
            endCal.setDate(endCal.getDate() + diff);
            
            const monthName = firstDay.toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'fr-FR', { month: 'long', year: 'numeric' });
            document.getElementById('calendar-label').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        } else {
            startCal = new Date(year, month, date);
            let dayOfWeek = startCal.getDay();
            let diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startCal.setDate(startCal.getDate() - diff);
            
            endCal = new Date(startCal);
            endCal.setDate(endCal.getDate() + 6);
            
            const startStr = startCal.toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
            const endStr = endCal.toLocaleDateString(i18n.lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
            document.getElementById('calendar-label').textContent = `${startStr} - ${endStr}`;
        }
        
        const items = [];
        const startStr = RecurrenceUtils.formatDateStr(startCal);
        const endStr = RecurrenceUtils.formatDateStr(endCal);
        
        // Evènements
        if (filter === 'all' || filter === 'events') {
            this.events.forEach(event => {
                const occurrences = window.RecurrenceUtils 
                    ? RecurrenceUtils.generateOccurrences({ event, startDate: new Date(`${event.date || startStr}T12:00:00`), maxOccurrences: 200 }) 
                    : [event];
                
                occurrences.forEach(occ => {
                    if (occ.occurrenceDate >= startStr && occ.occurrenceDate <= endStr) {
                        items.push({
                            type: 'event',
                            data: event,
                            date: occ.occurrenceDate,
                            occurrence: occ
                        });
                    }
                });
            });
        }
        
        // Actions
        if (filter === 'all' || filter === 'actions') {
            this.actions.forEach(rawAction => {
                const action = { ...rawAction };
                if (action.scheduleMode === 'frequency') {
                    if (action.frequencyUnit === 'days') {
                        action.recurrence = 'daily';
                        action.recurrenceInterval = action.frequencyValue || 1;
                    } else if (action.frequencyUnit === 'weeks') {
                        action.recurrence = 'weekly';
                        action.recurrenceInterval = action.frequencyValue || 1;
                    } else {
                        action.recurrence = 'monthly';
                        action.recurrenceInterval = action.frequencyValue || 1;
                    }
                    action.date = action.startDate || action.date || startStr;
                } else if (action.recurrence === 'biweekly') {
                    action.recurrence = 'weekly';
                    action.recurrenceInterval = 2;
                }

                const logs = this.actionLogs
                    .filter(l => l.programmeId === action.id)
                    .sort((a, b) => b.date.localeCompare(a.date));
                const allDoneLogs = logs.filter(l => !l.type || l.type === 'done');
                const maxState = (action.states && action.states.length > 0) ? action.states.length + 1 : 1;
                const fullDoneLogs = allDoneLogs.filter(l => {
                    // Ancien log sans état : considéré comme complètement fait
                    if (l.state == null) return true;
                    return l.state === maxState;
                });
                const lastLog = fullDoneLogs.length > 0 ? fullDoneLogs[0] : null;

                let generateFrom = action.date || startStr;
                if (lastLog) {
                    generateFrom = lastLog.date;
                }
                
                const occurrences = window.RecurrenceUtils 
                    ? RecurrenceUtils.generateOccurrences({
                        event: action,
                        startDate: new Date(`${generateFrom}T12:00:00`),
                        maxOccurrences: 200
                    }) : [action];

                occurrences.forEach(occ => {
                    if (occ.occurrenceDate >= startStr && occ.occurrenceDate <= endStr) {
                        const targetNotes = logs.filter(l => l.type === 'note' && l.date === occ.occurrenceDate);
                        
                        const occDoneLogs = allDoneLogs
                            .filter(l => l.date === occ.occurrenceDate)
                            .sort((a, b) =>
                                (b.timestamp || 0) - (a.timestamp || 0)
                                || (b.state || 0) - (a.state || 0)
                            );
                        const latestStateLog = occDoneLogs.length > 0
                            ? occDoneLogs[0] : null;
                        const currentState = latestStateLog
                            ? (latestStateLog.state == null ? maxState : latestStateLog.state)
                            : 0;
                        const isDone = currentState === maxState;

                        items.push({
                            type: 'action',
                            data: action,
                            date: occ.occurrenceDate,
                            occurrence: occ,
                            lastLog: lastLog,
                            targetNotes: targetNotes,
                            currentState: currentState,
                            isDone: isDone
                        });
                    }
                });
            });
        }
        
        // Build map date -> items
        const map = {};
        items.forEach(it => {
            if (!map[it.date]) map[it.date] = [];
            map[it.date].push(it);
        });
        
        // Generate grid HTML
        const dayHeaders = [
            t("day_1"), t("day_2"), t("day_3"), 
            t("day_4"), t("day_5"), t("day_6"), 
            t("day_0")
        ];
        
        let html = `<table class="table table-bordered table-fixed calendar-grid">
            <thead>
                <tr>${dayHeaders.map(d => `<th class="text-center w-14">${d}</th>`).join('')}</tr>
            </thead>
            <tbody>`;
            
        let curr = new Date(startCal);
        const todayStr = RecurrenceUtils.formatDateStr(new Date());
        
        while (curr <= endCal) {
            html += `<tr>`;
            for (let i=0; i<7; i++) {
                const dateStr = RecurrenceUtils.formatDateStr(curr);
                const dayNum = curr.getDate();
                const isToday = dateStr === todayStr;
                const isCurrentMonth = curr.getMonth() === month;
                
                let cellClass = "calendar-cell p-1";
                if (!isCurrentMonth && this.viewMode === 'month') cellClass += " bg-light text-muted";
                if (isToday) cellClass += " bg-warning-subtle";
                
                html += `<td class="${cellClass}" style="vertical-align: top; height: ${this.viewMode === 'month' ? '120px' : '300px'};">
                    <div class="d-flex justify-content-start mb-1 align-items-baseline">
                        <span class="calendar-cell-day-label small text-muted me-1 fw-bold">${dayHeaders[i]}</span>
                        <span class="fw-bold ${isToday ? 'text-danger' : ''}">${dayNum}</span>
                    </div>
                    <div class="calendar-items overflow-auto" style="max-height: ${this.viewMode === 'month' ? '90px' : '270px'};">`;
                
                const dayItems = map[dateStr] || [];
                // Sort by time
                dayItems.sort((a,b) => {
                    const ta = a.data.time || '';
                    const tb = b.data.time || '';
                    return ta.localeCompare(tb);
                });
                
                dayItems.forEach(it => {
                    if (it.type === 'event') {
                        const isCancelled = it.occurrence.isCancelled;
                        html += `<div class="p-1 mb-1 rounded small border bg-info-subtle ${isCancelled ? 'text-decoration-line-through text-muted' : ''}" title="${it.data.name}">
                            <strong>${it.data.time || ''}</strong> ${it.data.name}
                        </div>`;
                    } else {
                        const hasNotes = it.targetNotes && it.targetNotes.length > 0;
                        const notesIcon = hasNotes ? `<i class="bi bi-card-text text-info ms-1" title="${it.targetNotes.length} ${t("instructions").toLowerCase()}"></i>` : '';
                        const isDone = it.isDone;
                        const bgClass = isDone ? 'bg-success-subtle' : (it.currentState > 0 ? 'bg-info-subtle' : 'bg-warning-subtle');
                        
                        let stateIndicator = '';
                        if (isDone) {
                            stateIndicator = '<i class="bi bi-check-circle-fill text-success"></i> ';
                        } else if (it.currentState > 0) {
                            stateIndicator = '<i class="bi bi-arrow-right-circle text-info"></i> ';
                        }
                        
                        html += `<div class="p-1 mb-1 rounded small border ${bgClass} action-item-cal d-flex justify-content-between align-items-center" data-id="${it.data.id}" data-date="${dateStr}" role="button" title="${it.data.name}">
                            <div>
                                ${stateIndicator}
                                <strong>${it.data.time || ''}</strong> ${it.data.name} ${notesIcon}
                            </div>
                            <button class="btn btn-sm btn-link ${isDone ? 'text-success' : 'text-info'} p-0 ms-1 btn-add-note-cal" data-id="${it.data.id}" data-date="${dateStr}" title="${t("add_note")}"><i class="bi bi-pencil-square"></i></button>
                        </div>`;
                    }
                });
                
                html += `</div></td>`;
                curr.setDate(curr.getDate() + 1);
            }
            html += `</tr>`;
        }
        
        html += `</tbody></table>`;
        container.innerHTML = html;
        
        // Add CSS
        if (!document.getElementById('calendar-grid-style')) {
            const style = document.createElement('style');
            style.id = 'calendar-grid-style';
            style.innerHTML = `
                .w-14 { width: 14.28%; }
                .calendar-grid { table-layout: fixed; width: 100%; }
                .action-item-cal:hover { filter: brightness(0.95); cursor: pointer; }
                .calendar-items::-webkit-scrollbar { width: 4px; }
                .calendar-items::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
                @media (max-width: 767.98px) {
                    .calendar-grid thead { display: none; }
                    .calendar-grid, .calendar-grid tbody, .calendar-grid tr, .calendar-grid td { display: block; width: 100%; }
                    .calendar-grid td { height: auto !important; min-height: 100px; border-bottom: 1px solid #dee2e6; }
                    .calendar-items { max-height: none !important; }
                    .calendar-cell-day-label { display: inline-block !important; text-transform: capitalize; }
                }
                @media (min-width: 768px) {
                    .calendar-cell-day-label { display: none !important; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Bind events on calendar items
        container.querySelectorAll('.action-item-cal').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.btn-add-note-cal')) return;
                const actionId = el.dataset.id;
                const date = el.dataset.date;
                this.openLogModal(actionId, 'done', date);
            });
        });

        container.querySelectorAll('.btn-add-note-cal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionId = btn.dataset.id;
                const date = btn.dataset.date;
                this.openLogModal(actionId, 'note', date);
            });
        });
    }

    getMemberName(memberId) {
        if (!memberId) return '';
        const m = this.members.find(m => m.id === memberId);
        if (!m) return '';
        return `(${m.firstName || ''} ${m.lastName || ''})`.trim();
    }

    // --- Événements d'interface ---

    bindItemEvents() {
        document.querySelectorAll('.btn-mark-done').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.id;
                const itemData = this.lastRenderedItems?.find(i => i.data.id === actionId);
                const defaultDate = itemData ? itemData.nextDate : null;
                this.openLogModal(actionId, 'done', defaultDate);
            });
        });

        // Déjà fait → éditer le log existant
        document.querySelectorAll('.btn-edit-log').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.id;
                const itemData = this.lastRenderedItems?.find(i => i.data.id === actionId);
                const defaultDate = itemData ? itemData.nextDate : null;
                this.openLogModal(actionId, 'done', defaultDate);
            });
        });

        // Hors fenêtre → éditer instructions et heure/durée
        document.querySelectorAll('.btn-edit-future').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.id;
                const itemData = this.lastRenderedItems?.find(i => i.data.id === actionId);
                const defaultDate = itemData ? itemData.nextDate : null;
                this.openLogModal(actionId, 'note', defaultDate);
            });
        });

        document.querySelectorAll('.btn-add-note').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.id;
                const itemData = this.lastRenderedItems?.find(i => i.data.id === actionId);
                const defaultDate = itemData ? itemData.nextDate : null;
                this.openLogModal(actionId, 'note', defaultDate);
            });
        });

        document.querySelectorAll('.btn-history').forEach(btn => {
            btn.addEventListener('click', () => this.openHistoryModal(btn.dataset.id));
        });

        document.querySelectorAll('.btn-edit-action').forEach(btn => {
            btn.addEventListener('click', () => this.openActionModal(btn.dataset.id));
        });

        document.querySelectorAll('.btn-delete-action').forEach(btn => {
            btn.addEventListener('click', () => this.deleteAction(btn.dataset.id));
        });
    }

    // --- Onglets ---

    initTabs() {
        document.querySelectorAll('#programme-tabs a').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('#programme-tabs a').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderContent(tab.dataset.tab);
            });
        });
    }

    // --- Modal action (CRUD) ---

    toggleActionAllDay() {
        const isAllDay = document.getElementById('action-allDay-yes').checked;
        document.getElementById('action-time-duration').style.display = isAllDay ? 'none' : 'block';
    }

    toggleExecutionType() {
        const isNow = document.getElementById('exec-type-now')?.checked;
        const recContainer = document.getElementById('action-recurrence-main-container');
        const windowContainer = document.getElementById('action-window-main-container');
        
        if (isNow) {
            if (recContainer) recContainer.style.display = 'none';
            if (windowContainer) windowContainer.style.display = 'none';
            
            const today = new Date();
            const dateStr = window.RecurrenceUtils ? RecurrenceUtils.formatDateStr(today) : today.toISOString().split('T')[0];
            const timeStr = today.toTimeString().slice(0, 5);
            
            document.getElementById('action-date').value = dateStr;
            document.getElementById('action-time').value = timeStr;
            document.getElementById('action-allDay-no').checked = true;
            this.toggleActionAllDay();
        } else {
            if (recContainer) recContainer.style.display = 'block';
            if (windowContainer) windowContainer.style.display = 'block';
        }
    }

    openActionModal(id = null) {
        const form = document.getElementById('action-form');
        form.reset();
        document.getElementById('action-id').value = '';
        
        const titleEl = document.getElementById('actionModalTitle');
        const templateContainer = document.getElementById('action-template-container');
        const typeContainer = document.getElementById('action-type-container');
        
        if (id) {
            titleEl.textContent = t("edit_action_title");
            templateContainer.style.display = 'none';
            if (typeContainer) typeContainer.style.display = 'none';
        } else {
            titleEl.textContent = t("add_action") || "Ajouter une action";
            templateContainer.style.display = 'block';
            if (typeContainer) {
                typeContainer.style.display = 'block';
                document.getElementById('exec-type-scheduled').checked = true;
            }
            
            const templateSelect = document.getElementById('action-template-select');
            const seenNames = new Set();
            const uniqueActions = this.actions.filter(a => {
                const name = a.name ? a.name.trim().toLowerCase() : '';
                if (!name || seenNames.has(name)) return false;
                seenNames.add(name);
                return true;
            });
            uniqueActions.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            templateSelect.innerHTML = `<option value="">${t("no_template")}</option>` + 
                uniqueActions.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        }
        
        this.toggleActionAllDay();
        this.toggleExecutionType();

        document.getElementById('action-recurrence').value = 'none';
        document.getElementById('action-recurrenceEndDate-container').style.display = 'none';
        document.getElementById('action-recurrence').classList.add('rounded-start');
        document.getElementById('action-recurrenceInterval').value = '1';
        document.getElementById('action-recurrenceInterval').style.display = 'none';
        document.getElementById('action-recurrence-label').style.display = 'none';
        document.getElementById('action-recurrence-days-container').style.display = 'none';
        document.getElementById('action-monthly-type-container').style.display = 'none';
        document.querySelectorAll('.action-recurrence-day').forEach(cb => cb.checked = false);

        if (id) {
            const action = this.actions.find(a => a.id === id);
            if (!action) return;

            document.getElementById('action-id').value = action.id;
            document.getElementById('action-name').value = action.name || '';
            document.getElementById('action-states').value = (action.states || []).join(', ');
            document.getElementById('action-description').value = action.description || '';
            document.getElementById('action-date').value = action.date || action.startDate || '';
            document.getElementById('action-recurrenceEndDate').value = action.recurrenceEndDate || '';
            document.getElementById('action-windowDays').value = action.windowDays || 0;

            const isAllDay = action.allDay !== undefined ? action.allDay : !action.time;
            document.getElementById('action-allDay-yes').checked = isAllDay;
            document.getElementById('action-allDay-no').checked = !isAllDay;
            this.toggleActionAllDay();

            document.getElementById('action-time').value = action.time || '';
            document.getElementById('action-duration').value = action.duration || '';
            document.getElementById('action-durationUnit').value = action.durationUnit || 'hours';
            
            // Conversion biweekly/frequency to new recurrence model
            let rec = action.recurrence || 'none';
            let interval = action.recurrenceInterval || 1;
            
            if (action.scheduleMode === 'frequency') {
                if (action.frequencyUnit === 'days') {
                    rec = 'daily';
                    interval = action.frequencyValue || 1;
                } else if (action.frequencyUnit === 'weeks') {
                    rec = 'weekly';
                    interval = action.frequencyValue || 1;
                } else {
                    rec = 'monthly';
                    interval = action.frequencyValue || 1;
                }
            } else if (rec === 'biweekly') {
                rec = 'weekly';
                interval = 2;
            }
            
            document.getElementById('action-recurrence').value = rec;
            document.getElementById('action-recurrence').classList.toggle('rounded-start', rec === 'none');
            document.getElementById('action-recurrenceInterval').value = interval;
            document.getElementById('action-recurrenceInterval').style.display = (rec === 'none') ? 'none' : '';
            document.getElementById('action-recurrence-label').style.display = (rec === 'none') ? 'none' : '';
            document.getElementById('action-monthlyType').value = action.monthlyType || 'date';
            
            document.querySelectorAll('.action-recurrence-day').forEach(cb => {
                cb.checked = action.recurrenceDays ? action.recurrenceDays.includes(parseInt(cb.value)) : false;
            });

            document.getElementById('action-recurrence-days-container').style.display = (rec === 'weekly') ? 'block' : 'none';
            document.getElementById('action-monthly-type-container').style.display = (rec === 'monthly') ? 'block' : 'none';
            document.getElementById('action-recurrenceEndDate-container').style.display = (rec === 'none') ? 'none' : 'block';
        }

        this.actionModal.show();
    }

    async saveAction() {
        const form = document.getElementById('action-form');
        if (!form.reportValidity()) return;

        const id = document.getElementById('action-id').value;
        const isAllDay = document.getElementById('action-allDay-yes').checked;
        const isNow = !id && document.getElementById('exec-type-now')?.checked;

        const data = {
            name: document.getElementById('action-name').value,
            states: document.getElementById('action-states').value.split(',').map(s => s.trim()).filter(s => s !== ''),
            description: document.getElementById('action-description').value,
            date: document.getElementById('action-date').value,
            recurrenceEndDate: document.getElementById('action-recurrenceEndDate').value || null,
            windowDays: Number(document.getElementById('action-windowDays').value),
            
            allDay: isAllDay,
            time: isAllDay ? '' : document.getElementById('action-time').value,
            duration: isAllDay ? null : Number(document.getElementById('action-duration').value),
            durationUnit: isAllDay ? null : document.getElementById('action-durationUnit').value,
            
            recurrence: isNow ? 'none' : document.getElementById('action-recurrence').value,
            recurrenceInterval: isNow ? 1 : (Number(document.getElementById('action-recurrenceInterval').value) || 1),
            recurrenceDays: isNow ? [] : Array.from(document.querySelectorAll('.action-recurrence-day:checked')).map(cb => parseInt(cb.value)),
            monthlyType: isNow ? 'date' : document.getElementById('action-monthlyType').value,
            
            // Clean up old fields
            scheduleMode: 'scheduled',
            frequencyValue: null,
            frequencyUnit: null,
            startDate: null
        };

        try {
            if (id) {
                await api.update(this.collectiveId, 'actions', id, data);
            } else {
                const createdAction = await api.create(this.collectiveId, 'actions', data);
                
                if (isNow) {
                    const logData = {
                        programmeId: createdAction.id,
                        type: 'done',
                        date: data.date,
                        time: data.time || null,
                        duration: data.duration,
                        durationUnit: data.durationUnit,
                        notes: null,
                        state: 1, // 1st state or done (if no states)
                        timestamp: Date.now()
                    };
                    await api.create(this.collectiveId, 'action-logs', logData);
                }
            }
            this.actionModal.hide();
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async deleteAction(id) {
        if (!confirm(t("confirm_delete"))) return;
        try {
            await api.delete(this.collectiveId, 'actions', id);
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Modal log (Fait !) ---

    // Génère le HTML d'information sur la date/heure/durée d'une action
    buildActionInfoHtml({ action, occDateStr }) {
        const locale = i18n.lang === 'en' ? 'en-US' : 'fr-FR';
        const occDateObj = new Date(`${occDateStr}T12:00:00`);
        const dateStr = occDateObj.toLocaleDateString(locale, {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        const isAllDay = action?.allDay !== undefined
            ? action.allDay : !action?.time;
        const timeStr = (!isAllDay && action?.time)
            ? `<br>⏰ ${t("time")} : ${action.time}` : '';
        const durationStr = action?.duration
            ? `<br>⏱️ ${t("duration")} : ${action.duration} `
                + `${t(action.durationUnit === 'hours' ? 'hours' : 'minutes')}`
            : '';
        return `📅 ${dateStr}${timeStr}${durationStr}`;
    }

    // Réinitialise la visibilité de tous les champs du modal log
    resetLogModalVisibility() {
        const notesEl = document.getElementById('log-notes');
        const dateRow = document.getElementById('log-date').closest('.mb-3');
        const timeDurRow = document.getElementById('log-time')
            .closest('.col-md-6').parentElement;
        const saveBtn = document.getElementById('btn-save-log');

        notesEl.disabled = false;
        notesEl.parentElement.style.display = '';
        dateRow.style.display = '';
        timeDurRow.style.display = '';
        saveBtn.style.display = '';
    }

    openLogModal(actionId, type = 'done', defaultDate = null) {
        const action = this.actions.find(a => a.id === actionId);
        document.getElementById('log-actionId').value = actionId;
        document.getElementById('log-id').value = '';
        this.resetLogModalVisibility();

        const todayStr = RecurrenceUtils.formatDateStr(new Date());
        const dateInput = document.getElementById('log-date');
        const saveBtn = document.getElementById('btn-save-log');
        const notesTextarea = document.getElementById('log-notes');
        const title = document.getElementById('logModalTitle');
        const windowInfoEl = document.getElementById('log-window-info');
        const locale = i18n.lang === 'en' ? 'en-US' : 'fr-FR';

        // Déterminer si aujourd'hui est dans la fenêtre d'exécution
        let canMarkDone = false;
        const occDateStr = defaultDate || todayStr;

        if (type === 'done') {
            const occDateObj = new Date(`${occDateStr}T12:00:00`);
            const windowStart = new Date(occDateObj);
            windowStart.setDate(
                windowStart.getDate() - (action?.windowDays || 0)
            );
            const windowStartStr = RecurrenceUtils.formatDateStr(windowStart);
            canMarkDone = todayStr >= windowStartStr;
        }

        document.getElementById('log-type').value = type;
        document.getElementById('log-occurrence-date').value = occDateStr;

        // ========== HORS FENÊTRE — Mode consultation seule ==========
        if (type === 'done' && !canMarkDone) {
            title.textContent = action?.name || t("action_label");

            // Infos date/heure/durée de l'action
            const actionInfo = this.buildActionInfoHtml({
                action, occDateStr
            });
            const occDateObj = new Date(`${occDateStr}T12:00:00`);
            const wsObj = new Date(occDateObj);
            wsObj.setDate(
                wsObj.getDate() - (action?.windowDays || 0)
            );
            const wsFormatted = wsObj.toLocaleDateString(locale, {
                weekday: 'long', day: 'numeric', month: 'long'
            });
            windowInfoEl.innerHTML = `
                <div class="alert alert-info py-2 mb-2">
                    ${actionInfo}
                </div>
                ${action?.description
                    ? `<div class="mb-2 text-dark">${action.description}</div>`
                    : ''}
                <div class="alert alert-warning py-2 mb-3">
                    <i class="bi bi-calendar-event"></i>
                    ${t("from_date")} ${wsFormatted}
                </div>`;
            windowInfoEl.classList.remove('d-none');

            // Masquer tous les champs de saisie
            dateInput.closest('.mb-3').style.display = 'none';
            document.getElementById('log-time')
                .closest('.col-md-6').parentElement.style.display = 'none';
            notesTextarea.parentElement.style.display = 'none';
            document.getElementById('log-state-container')
                .style.display = 'none';
            saveBtn.style.display = 'none';
            document.getElementById('btn-delete-log').classList.add('d-none');

            // Afficher les instructions existantes
            this.refreshExistingNotesInLogModal();
            this.logModal.show();
            return;
        }

        // ========== Mode instruction (note) ==========
        if (type === 'note') {
            const dateToUse = defaultDate || todayStr;
            dateInput.value = dateToUse;
            dateInput.disabled = true;
            saveBtn.textContent = t("save");
            saveBtn.className = 'btn btn-primary';
            title.textContent = t("instructions");

            // Afficher date/heure/durée de l'action
            const actionInfo = this.buildActionInfoHtml({
                action, occDateStr
            });
            windowInfoEl.innerHTML = `
                <div class="alert alert-info py-2 mb-2">
                    ${actionInfo}
                </div>`;
            windowInfoEl.classList.remove('d-none');

            document.getElementById('log-state-container')
                .style.display = 'none';
            document.getElementById('log-time').value =
                action?.time || '';
            notesTextarea.value = '';

            // Pré-remplir durée depuis l'action
            if (action?.duration) {
                document.getElementById('log-duration').value =
                    action.duration;
                document.getElementById('log-durationUnit').value =
                    action.durationUnit || 'hours';
            } else {
                document.getElementById('log-duration').value = '';
                document.getElementById('log-durationUnit').value = 'hours';
            }

            // Charger note existante
            const existingNote = this.actionLogs.find(
                l => l.programmeId === actionId
                    && l.type === 'note'
                    && l.date === occDateStr
            );
            if (existingNote) {
                document.getElementById('log-id').value = existingNote.id;
                notesTextarea.value = existingNote.notes || '';
                if (existingNote.time) {
                    document.getElementById('log-time').value =
                        existingNote.time;
                }
                document.getElementById('btn-delete-log')
                    .classList.remove('d-none');
            } else {
                document.getElementById('btn-delete-log')
                    .classList.add('d-none');
            }

            this.refreshExistingNotesInLogModal();
            this.logModal.show();
            return;
        }

        // ========== Mode "Fait" (done) dans la fenêtre ==========
        dateInput.value = occDateStr;
        dateInput.disabled = true;
        dateInput.min = '';
        dateInput.max = '';

        const logId = (() => {
            const occDoneLogs = this.actionLogs
                .filter(l => l.programmeId === actionId
                    && (!l.type || l.type === 'done')
                    && l.date === occDateStr)
                .sort((a, b) =>
                    (b.timestamp || 0) - (a.timestamp || 0)
                    || (b.state || 0) - (a.state || 0)
                );
            return occDoneLogs.length > 0 ? occDoneLogs[0] : null;
        })();

        if (logId) {
            document.getElementById('log-id').value = logId.id;
            notesTextarea.value = logId.notes || '';
            if (logId.time) {
                document.getElementById('log-time').value = logId.time;
            } else {
                document.getElementById('log-time').value = '';
            }
            if (logId.duration) {
                document.getElementById('log-duration').value =
                    logId.duration;
                document.getElementById('log-durationUnit').value =
                    logId.durationUnit || 'hours';
            } else if (action?.duration) {
                document.getElementById('log-duration').value =
                    action.duration;
                document.getElementById('log-durationUnit').value =
                    action.durationUnit || 'hours';
            } else {
                document.getElementById('log-duration').value = '';
                document.getElementById('log-durationUnit').value = 'hours';
            }
            document.getElementById('btn-delete-log')
                .classList.remove('d-none');
            title.textContent = t("edit") + ' — '
                + (action?.name || t("mark_done"));
            saveBtn.textContent = t("save");
            saveBtn.className = 'btn btn-primary';
        } else {
            document.getElementById('log-time').value = '';
            notesTextarea.value = '';
            if (action?.duration) {
                document.getElementById('log-duration').value =
                    action.duration;
                document.getElementById('log-durationUnit').value =
                    action.durationUnit || 'hours';
            } else {
                document.getElementById('log-duration').value = '';
                document.getElementById('log-durationUnit').value = 'hours';
            }
            document.getElementById('btn-delete-log')
                .classList.add('d-none');
            title.textContent = t("mark_done");
            saveBtn.textContent = t("mark_done");
            saveBtn.className = 'btn btn-success';
        }

        windowInfoEl.innerHTML = '';
        windowInfoEl.classList.add('d-none');

        // Gestion des états intermédiaires
        const states = action?.states || [];
        const stateSelect = document.getElementById('log-state');
        const stateContainer = document.getElementById('log-state-container');

        if (states.length > 0) {
            stateContainer.style.display = 'block';
            stateSelect.innerHTML = states
                .map((s, i) => `<option value="${i+1}">${s}</option>`)
                .join('')
                + `<option value="${states.length + 1}">Fait</option>`;

            const allDoneLogs = this.actionLogs
                .filter(l => l.programmeId === actionId
                    && (!l.type || l.type === 'done'));
            const occDoneLogs = allDoneLogs
                .filter(l => l.date === occDateStr)
                .sort((a, b) =>
                    (b.timestamp || 0) - (a.timestamp || 0)
                    || (b.state || 0) - (a.state || 0)
                );
            const currentState = occDoneLogs.length > 0
                && occDoneLogs[0].state !== undefined
                ? occDoneLogs[0].state : 0;
            const nextState = Math.min(
                currentState + 1, states.length + 1
            );
            stateSelect.value = nextState;
        } else {
            stateContainer.style.display = 'none';
        }

        this.refreshExistingNotesInLogModal();
        this.logModal.show();
    }

    refreshExistingNotesInLogModal() {
        const actionId = document.getElementById('log-actionId').value;
        const date = document.getElementById('log-date').value;
        const container = document.getElementById('log-existing-notes');

        if (!actionId || !date) {
            container.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        // Filtrer les notes existantes pour cette action et cette date
        const notes = this.actionLogs.filter(
            l => l.programmeId === actionId && l.type === 'note' && l.date === date
        );

        if (notes.length === 0) {
            container.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        const locale = i18n.lang === 'en' ? 'en-US' : 'fr-FR';
        container.classList.remove('d-none');
        container.innerHTML = `
            <label class="form-label fw-bold">
                <i class="bi bi-card-text"></i> ${t("notes")}
            </label>
            <div class="list-group">
                ${notes.map(n => {
                    const memberName = this.getMemberName(n.memberId);
                    const timeStr = n.time ? ` ⏰ ${n.time}` : '';
                    return `
                    <div class="list-group-item list-group-item-info py-1 small">
                        <div class="d-flex justify-content-between">
                            <span>${timeStr}</span>
                            <small class="text-muted">${memberName}</small>
                        </div>
                        ${n.notes ? `<div>${n.notes}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>`;
    }

    async saveLog() {
        const id = document.getElementById('log-id').value;
        const actionId = document.getElementById('log-actionId').value;
        const type = document.getElementById('log-type').value;
        const date = document.getElementById('log-date').value;
        const time = document.getElementById('log-time').value;
        const duration = document.getElementById('log-duration').value;
        const durationUnit = document.getElementById('log-durationUnit').value;
        const notes = document.getElementById('log-notes').value;

        const stateContainer = document.getElementById('log-state-container');
        const stateSelect = document.getElementById('log-state');
        const state = (stateContainer.style.display !== 'none' && stateSelect.value)
            ? Number(stateSelect.value)
            : undefined;

        if (!date) {
            alert(t("error") + ': ' + t("date"));
            return;
        }

        const data = {
            programmeId: actionId,
            type: type || 'done',
            date,
            time: time || null,
            duration: duration ? Number(duration) : null,
            durationUnit: duration ? durationUnit : null,
            notes: notes || null,
            timestamp: Date.now()
        };
        if (state !== undefined) {
            data.state = state;
        }

        try {
            if (id) {
                await api.update(this.collectiveId, 'action-logs', id, data);
            } else {
                await api.create(this.collectiveId, 'action-logs', data);
            }
            this.logModal.hide();
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    async deleteLog() {
        const logId = document.getElementById('log-id').value;
        if (!logId) return;
        if (!confirm(t("confirm_delete"))) return;

        try {
            await api.delete(this.collectiveId, 'action-logs', logId);
            this.logModal.hide();
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Modal historique ---

    openHistoryModal(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        const title = document.getElementById('historyModalTitle');
        title.textContent = `${t("history")} — ${action?.name || ''}`;

        const logs = this.actionLogs
            .filter(l => l.programmeId === actionId)
            .sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return (b.time || '').localeCompare(a.time || '');
            });

        const body = document.getElementById('history-body');

        if (logs.length === 0) {
            body.innerHTML = `<p class="text-muted">${t("no_history")}</p>`;
        } else {
            const locale = i18n.lang === 'en' ? 'en-US' : 'fr-FR';
            body.innerHTML = `
                <div class="list-group">
                    ${logs.map(log => {
                        const dateStr = new Date(log.date + 'T12:00:00').toLocaleDateString(locale, {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        });
                        const memberName = this.getMemberName(log.memberId);
                        const timeStr = log.time ? ` ⏰ ${log.time}` : '';
                        const durationStr = log.duration
                            ? ` ⏱️ ${log.duration} ${t(log.durationUnit === 'hours' ? 'hours' : 'minutes', log.duration).toLowerCase()}`
                            : '';
                        let typeBadgeStr = t("done") || "Fait";
                        let badgeClass = "bg-success";
                        if (log.type === 'note') {
                            typeBadgeStr = t("note");
                            badgeClass = "bg-info";
                        } else if (action && action.states && action.states.length > 0 && log.state !== undefined) {
                            const maxState = action.states.length + 1;
                            if (log.state < maxState && log.state > 0) {
                                typeBadgeStr = action.states[log.state - 1];
                                badgeClass = "bg-secondary";
                            }
                        }
                        
                        const typeBadge = `<span class="badge ${badgeClass}">${typeBadgeStr}</span>`;
                        return `
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${dateStr}</strong>${timeStr}${durationStr}
                                    ${typeBadge}
                                </div>
                                <small class="text-muted">${memberName}</small>
                            </div>
                            ${log.notes ? `<div class="mt-1 text-dark small">${log.notes}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>`;
        }

        this.historyModal.show();
    }

    // --- Init ---

    async init() {
        this.initTabs();

        // Bind view mode buttons
        document.querySelectorAll('input[name="view-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.viewMode = e.target.value;
                this.renderContent();
            });
        });

        // Bind calendar navigation
        document.getElementById('btn-prev-cal').addEventListener('click', () => {
            if (this.viewMode === 'month') {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() - 7);
            }
            this.renderContent();
        });

        document.getElementById('btn-next-cal').addEventListener('click', () => {
            if (this.viewMode === 'month') {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() + 7);
            }
            this.renderContent();
        });

        if (!this.isMember) {
            this.actionModal = new bootstrap.Modal(document.getElementById('actionModal'));

            document.getElementById('btn-add-action').addEventListener('click', () => {
                this.openActionModal();
            });

            document.getElementById('btn-save-action').addEventListener('click', () => {
                this.saveAction();
            });

            // Toggle journée entière
            document.querySelectorAll('input[name="action-allDay"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    this.toggleActionAllDay();
                });
            });

            document.querySelectorAll('input[name="action-executionType"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    this.toggleExecutionType();
                });
            });

            // Toggle récurrence
            const recSel = document.getElementById('action-recurrence');
            if (recSel) {
                recSel.addEventListener('change', (e) => {
                    const val = e.target.value;
                    document.getElementById('action-recurrence-days-container').style.display = (val === 'weekly') ? 'block' : 'none';
                    document.getElementById('action-monthly-type-container').style.display = (val === 'monthly') ? 'block' : 'none';
                    document.getElementById('action-recurrenceEndDate-container').style.display = (val === 'none') ? 'none' : 'block';
                    
                    const intervalInput = document.getElementById('action-recurrenceInterval');
                    const intervalLabel = document.getElementById('action-recurrence-label');
                    if (val === 'none') {
                        intervalInput.style.display = 'none';
                        if (intervalLabel) intervalLabel.style.display = 'none';
                        recSel.classList.add('rounded-start');
                    } else {
                        intervalInput.style.display = '';
                        if (intervalLabel) intervalLabel.style.display = '';
                        recSel.classList.remove('rounded-start');
                    }
                });
            }

            // Changer de modèle dans actionModal
            const actionTemplateSel = document.getElementById('action-template-select');
            if (actionTemplateSel) {
                actionTemplateSel.addEventListener('change', (e) => {
                    const templateId = e.target.value;
                    if (!templateId) return;
                    const template = this.actions.find(a => a.id === templateId);
                    if (template) {
                        document.getElementById('action-name').value = template.name || '';
                        document.getElementById('action-states').value = (template.states || []).join(', ');
                        document.getElementById('action-description').value = template.description || '';
                        document.getElementById('action-windowDays').value = template.windowDays || 0;
                        
                        const isAllDay = template.allDay !== undefined ? template.allDay : !template.time;
                        document.getElementById('action-allDay-yes').checked = isAllDay;
                        document.getElementById('action-allDay-no').checked = !isAllDay;
                        this.toggleActionAllDay();

                        document.getElementById('action-time').value = template.time || '';
                        document.getElementById('action-duration').value = template.duration || '';
                        document.getElementById('action-durationUnit').value = template.durationUnit || 'hours';

                        // Copie de la récurrence
                        let rec = template.recurrence || 'none';
                        let interval = template.recurrenceInterval || 1;
                        
                        if (template.scheduleMode === 'frequency') {
                            if (template.frequencyUnit === 'days') {
                                rec = 'daily';
                                interval = template.frequencyValue || 1;
                            } else if (template.frequencyUnit === 'weeks') {
                                rec = 'weekly';
                                interval = template.frequencyValue || 1;
                            } else {
                                rec = 'monthly';
                                interval = template.frequencyValue || 1;
                            }
                        } else if (rec === 'biweekly') {
                            rec = 'weekly';
                            interval = 2;
                        }
                        
                        document.getElementById('action-recurrence').value = rec;
                        document.getElementById('action-recurrence').classList.toggle('rounded-start', rec === 'none');
                        document.getElementById('action-recurrenceInterval').value = interval;
                        document.getElementById('action-recurrenceInterval').style.display = (rec === 'none') ? 'none' : '';
                        document.getElementById('action-recurrence-label').style.display = (rec === 'none') ? 'none' : '';
                        document.getElementById('action-monthlyType').value = template.monthlyType || 'date';
                        
                        document.querySelectorAll('.action-recurrence-day').forEach(cb => {
                            cb.checked = template.recurrenceDays ? template.recurrenceDays.includes(parseInt(cb.value)) : false;
                        });

                        document.getElementById('action-recurrence-days-container').style.display = (rec === 'weekly') ? 'block' : 'none';
                        document.getElementById('action-monthly-type-container').style.display = (rec === 'monthly') ? 'block' : 'none';
                        document.getElementById('action-recurrenceEndDate-container').style.display = (rec === 'none') ? 'none' : 'block';

                        this.toggleExecutionType();
                    }
                });
            }
        }

        // Modals accessibles à tous
        this.logModal = new bootstrap.Modal(document.getElementById('logModal'));
        this.historyModal = new bootstrap.Modal(document.getElementById('historyModal'));

        document.getElementById('btn-save-log').addEventListener('click', () => {
            this.saveLog();
        });

        document.getElementById('btn-delete-log').addEventListener('click', () => {
            this.deleteLog();
        });

        document.getElementById('log-date').addEventListener('change', (e) => {
            this.refreshExistingNotesInLogModal();
            const type = document.getElementById('log-type').value;
            if (type === 'note') {
                const actionId = document.getElementById('log-actionId').value;
                const date = e.target.value;
                const existingNote = this.actionLogs.find(l => l.programmeId === actionId && l.type === 'note' && l.date === date);
                if (existingNote) {
                    document.getElementById('log-id').value = existingNote.id;
                    document.getElementById('log-notes').value = existingNote.notes || '';
                    if (existingNote.time) document.getElementById('log-time').value = existingNote.time;
                    document.getElementById('btn-delete-log').classList.remove('d-none');
                } else {
                    document.getElementById('log-id').value = '';
                    document.getElementById('log-notes').value = '';
                    document.getElementById('log-time').value = '';
                    document.getElementById('btn-delete-log').classList.add('d-none');
                }
            }
        });

        await this.loadData();
    }
}
