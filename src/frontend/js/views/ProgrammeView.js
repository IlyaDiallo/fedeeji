class ProgrammeView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("programme") + " - " + t("brand"));
        this.orgId = params.orgId;
        this.isMember = api.getRole() === 'member';
        this.events = [];
        this.actions = [];
        this.actionLogs = [];
        this.members = [];
    }

    async getHtml() {
        const addBtn = this.isMember ? '' : `
            <button class="btn btn-primary"
                id="btn-add-action">
                <i class="bi bi-plus-lg"></i>
                <span class="d-none d-md-inline"
                    data-i18n="add_action">
                    ${t("add_action")}</span>
            </button>`;

        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="programme">${t("programme")}</h2>
                ${addBtn}
            </div>

            <ul class="nav nav-tabs mb-3" id="programme-tabs">
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

            <div id="programme-list" class="list-group border-0">
            </div>

            <!-- Modal action -->
            <div class="modal fade" id="actionModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="actionModalTitle">${t("add_edit_action")}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="action-form">
                                <input type="hidden" id="action-id">
                                <div class="mb-3">
                                    <label class="form-label">${t("name")}</label>
                                    <input type="text" class="form-control" id="action-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" id="action-description"></textarea>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label" data-i18n="start_date">${t("start_date")}</label>
                                        <input type="date" class="form-control" id="action-date" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
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

                                <div class="mb-3">
                                    <label class="form-label" data-i18n="recurrence">${t("recurrence")}</label>
                                    <div class="input-group">
                                        <span class="input-group-text">${t("every")}</span>
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
                                
                                <div class="mb-3">
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
                                <input type="hidden" id="log-actionId">
                                <input type="hidden" id="log-type" value="done">
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
                api.get(this.orgId, 'events'),
                api.get(this.orgId, 'actions'),
                api.get(this.orgId, 'action-logs')
            ]);
            this.events = events || [];
            this.actions = actions || [];
            this.actionLogs = actionLogs || [];
            if (!this.isMember) {
                this.members = await api.get(this.orgId, 'members');
            }
        } catch (error) {
            this.events = [];
            this.actions = [];
            this.actionLogs = [];
            this.members = [];
        }
        this.renderList();
    }

    // --- Rendu de la liste unifiée ---

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
                
                // Pour le calcul des récurrences, on ne considère que les "done"
                const doneLogs = logs.filter(l => !l.type || l.type === 'done');
                const lastLog = doneLogs.length > 0 ? doneLogs[0] : null;

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
                } else {
                    targetOccurrence = occurrences[0];
                }

                if (targetOccurrence) {
                    const occDateStr = targetOccurrence.occurrenceDate;
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

                    items.push({
                        type: 'action',
                        data: action,
                        nextDate: occDateStr,
                        occurrence: targetOccurrence,
                        status: status,
                        lastLog: lastLog
                    });
                }
            });
        }

        // Tri par prochaine date
        items.sort((a, b) => a.nextDate.localeCompare(b.nextDate));

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
            ? `<a href="/${this.orgId}/events/${event.id}/inscription-schedule" class="btn btn-sm btn-outline-primary ms-1" data-link title="${t("plan_inscriptions")}"><i class="bi bi-calendar-check"></i></a>`
            : `<a href="/${this.orgId}/inscriptions?eventId=${event.id}&date=${occ.occurrenceDate}" class="btn btn-sm btn-outline-success ms-1" data-link title="${t("inscriptions")}"><i class="bi bi-calendar-plus"></i></a>`;

        return `
            <div class="d-flex w-100 justify-content-between align-items-center">
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
                <div class="d-flex align-items-center">
                    ${inscLink}
                </div>
            </div>`;
    }

    renderActionItem(item, locale) {
        const action = item.data;
        const occ = item.occurrence;
        const status = item.status;
        const lastLog = item.lastLog;
        
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

        const lastLogStr = lastLog
            ? `✅ ${t("last_done")} ${lastLog.date} ${this.getMemberName(lastLog.memberId)}`
            : `⚠️ ${t("never_done")}`;

        const canDo = status === 'due' || status === 'overdue';
        const doneBtn = canDo
            ? `<button class="btn btn-sm btn-success btn-mark-done ms-1" data-id="${action.id}" title="${t("mark_done")}">✅</button>`
            : `<button class="btn btn-sm btn-outline-secondary ms-1" disabled title="${t("not_yet_due")}">✅</button>`;

        const noteBtn = `<button class="btn btn-sm btn-outline-info btn-add-note ms-1" data-id="${action.id}" title="${t("add_note")}">📝</button>`;

        const adminBtns = this.isMember ? '' : `
            <button class="btn btn-sm btn-outline-primary btn-edit-action ms-1" data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger btn-delete-action ms-1" data-id="${action.id}" title="${t("delete")}">
                <i class="bi bi-trash"></i>
            </button>`;

        let recurrenceStr = '';
        if (action.recurrence && action.recurrence !== 'none') {
            const interval = action.recurrenceInterval || 1;
            const unitMap = { 'daily': 'days', 'weekly': 'weeks', 'monthly': 'months_unit' };
            recurrenceStr = `🔄 ${t("every")} ${interval} ${t(unitMap[action.recurrence] || 'days').toLowerCase()} &nbsp;|&nbsp; `;
        }

        return `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div class="ms-2 me-auto">
                    <div class="fw-bold d-flex align-items-center flex-wrap">
                        <span class="badge bg-warning text-dark me-2">🔧 ${t("action_label")}</span>
                        ${action.name}${cancelledLabel}
                        ${statusBadge}
                    </div>
                    <div class="text-muted mt-1">
                        <small>
                            ${recurrenceStr}
                            📅 ${t("deadline")} ${dateStr}${timeStr}
                            ${action.windowDays > 0 ? `&nbsp;|&nbsp; 🪟 ${t("window")} ${action.windowDays}${t("days_short")}` : ''}
                        </small>
                    </div>
                    ${action.description ? `<div class="mt-1 text-dark small">${action.description}</div>` : ''}
                    <div class="mt-1 small ${lastLog ? 'text-success' : 'text-muted'}">
                        ${lastLogStr}
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    ${doneBtn}
                    ${noteBtn}
                    <button class="btn btn-sm btn-outline-secondary btn-history ms-1" data-id="${action.id}" title="${t("history")}">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    ${adminBtns}
                </div>
            </div>`;
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
            btn.addEventListener('click', () => this.openLogModal(btn.dataset.id, 'done'));
        });

        document.querySelectorAll('.btn-add-note').forEach(btn => {
            btn.addEventListener('click', () => this.openLogModal(btn.dataset.id, 'note'));
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
                this.renderList(tab.dataset.tab);
            });
        });
    }

    // --- Modal action (CRUD) ---

    toggleActionAllDay() {
        const isAllDay = document.getElementById('action-allDay-yes').checked;
        document.getElementById('action-time-duration').style.display = isAllDay ? 'none' : 'block';
    }

    openActionModal(id = null) {
        const form = document.getElementById('action-form');
        form.reset();
        document.getElementById('action-id').value = '';
        this.toggleActionAllDay();

        document.getElementById('action-recurrence').value = 'none';
        document.getElementById('action-recurrenceInterval').value = '1';
        document.getElementById('action-recurrenceInterval').disabled = true;
        document.getElementById('action-recurrence-days-container').style.display = 'none';
        document.getElementById('action-monthly-type-container').style.display = 'none';
        document.querySelectorAll('.action-recurrence-day').forEach(cb => cb.checked = false);

        if (id) {
            const action = this.actions.find(a => a.id === id);
            if (!action) return;

            document.getElementById('action-id').value = action.id;
            document.getElementById('action-name').value = action.name || '';
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
                } else {
                    rec = 'monthly';
                    interval = action.frequencyValue || 1;
                }
            } else if (rec === 'biweekly') {
                rec = 'weekly';
                interval = 2;
            }
            
            document.getElementById('action-recurrence').value = rec;
            document.getElementById('action-recurrenceInterval').value = interval;
            document.getElementById('action-recurrenceInterval').disabled = (rec === 'none');
            document.getElementById('action-monthlyType').value = action.monthlyType || 'date';
            
            document.querySelectorAll('.action-recurrence-day').forEach(cb => {
                cb.checked = action.recurrenceDays ? action.recurrenceDays.includes(parseInt(cb.value)) : false;
            });

            document.getElementById('action-recurrence-days-container').style.display = (rec === 'weekly') ? 'block' : 'none';
            document.getElementById('action-monthly-type-container').style.display = (rec === 'monthly') ? 'block' : 'none';
        }

        this.actionModal.show();
    }

    async saveAction() {
        const form = document.getElementById('action-form');
        if (!form.reportValidity()) return;

        const id = document.getElementById('action-id').value;
        const isAllDay = document.getElementById('action-allDay-yes').checked;

        const data = {
            name: document.getElementById('action-name').value,
            description: document.getElementById('action-description').value,
            date: document.getElementById('action-date').value,
            recurrenceEndDate: document.getElementById('action-recurrenceEndDate').value || null,
            windowDays: Number(document.getElementById('action-windowDays').value),
            
            allDay: isAllDay,
            time: isAllDay ? '' : document.getElementById('action-time').value,
            duration: isAllDay ? null : Number(document.getElementById('action-duration').value),
            durationUnit: isAllDay ? null : document.getElementById('action-durationUnit').value,
            
            recurrence: document.getElementById('action-recurrence').value,
            recurrenceInterval: Number(document.getElementById('action-recurrenceInterval').value) || 1,
            recurrenceDays: Array.from(document.querySelectorAll('.action-recurrence-day:checked')).map(cb => parseInt(cb.value)),
            monthlyType: document.getElementById('action-monthlyType').value,
            
            // Clean up old fields
            scheduleMode: 'scheduled',
            frequencyValue: null,
            frequencyUnit: null,
            startDate: null
        };

        try {
            if (id) {
                await api.update(this.orgId, 'actions', id, data);
            } else {
                await api.create(this.orgId, 'actions', data);
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
            await api.delete(this.orgId, 'actions', id);
            await this.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Modal log (Fait !) ---

    openLogModal(actionId, type = 'done') {
        const action = this.actions.find(a => a.id === actionId);
        document.getElementById('log-actionId').value = actionId;
        document.getElementById('log-type').value = type;
        document.getElementById('log-date').value = RecurrenceUtils.formatDateStr(new Date());
        document.getElementById('log-time').value = '';
        document.getElementById('log-notes').value = '';

        // Pré-remplir la durée depuis l'action
        if (action && action.duration) {
            document.getElementById('log-duration').value = action.duration;
            document.getElementById('log-durationUnit').value = action.durationUnit || 'hours';
        } else {
            document.getElementById('log-duration').value = '';
            document.getElementById('log-durationUnit').value = 'hours';
        }

        // Mettre à jour le titre selon le type
        const title = document.getElementById('logModalTitle');
        title.textContent = type === 'note' ? t("add_note") : t("mark_done");

        this.logModal.show();
    }

    async saveLog() {
        const actionId = document.getElementById('log-actionId').value;
        const type = document.getElementById('log-type').value;
        const date = document.getElementById('log-date').value;
        const time = document.getElementById('log-time').value;
        const duration = document.getElementById('log-duration').value;
        const durationUnit = document.getElementById('log-durationUnit').value;
        const notes = document.getElementById('log-notes').value;
        if (!date) return;

        try {
            await api.create(this.orgId, 'action-logs', {
                programmeId: actionId,
                memberId: api.getMemberId(),
                date,
                time: time || null,
                duration: duration ? Number(duration) : null,
                durationUnit: duration ? durationUnit : null,
                notes,
                type
            });
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
                            ? ` ⏱️ ${log.duration} ${t(log.durationUnit === 'hours' ? 'hours' : 'minutes')}`
                            : '';
                        const typeBadge = log.type === 'note'
                            ? `<span class="badge bg-info">${t("note")}</span>`
                            : `<span class="badge bg-success">${t("done")}</span>`;
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

            // Toggle récurrence
            const recSel = document.getElementById('action-recurrence');
            if (recSel) {
                recSel.addEventListener('change', (e) => {
                    const val = e.target.value;
                    document.getElementById('action-recurrence-days-container').style.display = (val === 'weekly') ? 'block' : 'none';
                    document.getElementById('action-monthly-type-container').style.display = (val === 'monthly') ? 'block' : 'none';
                    
                    const intervalInput = document.getElementById('action-recurrenceInterval');
                    if (val === 'none') {
                        intervalInput.disabled = true;
                    } else {
                        intervalInput.disabled = false;
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

        await this.loadData();
    }
}
