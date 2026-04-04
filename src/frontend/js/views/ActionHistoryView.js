class ActionHistoryView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("action_history") + " - " + t("brand"));
        this.collectiveId = params.collectiveId;
        this.isMember = api.getRole() === 'member';
        this.actionLogs = [];
        this.actions = [];
        this.members = [];
        this.filterAction = '';
        this.filterMember = '';
        this.filterType = '';
        this.filterPeriod = 'all';
        this.filterFrom = '';
        this.filterTo = '';
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="action_history">${t("action_history")}</h2>
            </div>

            <div class="row mb-3 g-2">
                <div class="col-md-3 mb-2">
                    <label class="form-label">${t("action_label")}</label>
                    <select class="form-select" id="filter-action">
                        <option value="">${t("all")}</option>
                    </select>
                </div>
                <div class="col-md-3 mb-2">
                    <label class="form-label">${t("member")}</label>
                    <select class="form-select" id="filter-member">
                        <option value="">${t("all")}</option>
                    </select>
                </div>
                <div class="col-md-3 mb-2">
                    <label class="form-label">${t("type")}</label>
                    <select class="form-select" id="filter-type">
                        <option value="">${t("all")}</option>
                        <option value="done">${t("done")}</option>
                        <option value="note">${t("note")}</option>
                    </select>
                </div>
                <div class="col-md-3 mb-2">
                    <label class="form-label">${t("period")}</label>
                    <select class="form-select" id="filter-period">
                        <option value="all">${t("period_all")}</option>
                        <option value="this_week">${t("period_this_week")}</option>
                        <option value="this_month">${t("period_this_month")}</option>
                        <option value="last_month">${t("period_last_month")}</option>
                        <option value="custom">${t("period_custom")}</option>
                    </select>
                </div>
            </div>

            <div class="row mb-3 g-2 d-none" id="custom-period-row">
                <div class="col-md-6">
                    <label class="form-label">${t("period_from")}</label>
                    <input type="date" class="form-control" id="filter-from">
                </div>
                <div class="col-md-6">
                    <label class="form-label">${t("period_to")}</label>
                    <input type="date" class="form-control" id="filter-to">
                </div>
            </div>

            <div id="duration-stats" class="mb-3 d-none">
            </div>

            <div id="history-list" class="list-group border-0">
            </div>
        `;
    }

    async loadData() {
        try {
            const [actionLogs, actions, members] = await Promise.all([
                api.get(this.collectiveId, 'action-logs'),
                api.get(this.collectiveId, 'actions'),
                this.isMember ? Promise.resolve([]) : api.get(this.collectiveId, 'members')
            ]);
            this.actionLogs = actionLogs || [];
            this.actions = actions || [];
            this.members = members || [];
        } catch (error) {
            this.actionLogs = [];
            this.actions = [];
            this.members = [];
        }
        this.populateFilters();
        this.renderAll();
    }

    populateFilters() {
        const actionSelect = document.getElementById('filter-action');
        const memberSelect = document.getElementById('filter-member');

        // Remplir les filtres actions
        this.actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action.id;
            option.textContent = action.name;
            actionSelect.appendChild(option);
        });

        // Remplir les filtres membres
        this.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = `${member.firstName || ''} ${member.lastName || ''}`.trim();
            memberSelect.appendChild(option);
        });
    }

    /** Calcule les bornes de dates selon le filtre de période sélectionné */
    getPeriodBounds() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        if (this.filterPeriod === 'this_week') {
            const day = now.getDay();
            const diff = day === 0 ? 6 : day - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - diff);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            return { from: toStr(monday), to: toStr(sunday) };
        }
        if (this.filterPeriod === 'this_month') {
            const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { from, to: toStr(lastDay) };
        }
        if (this.filterPeriod === 'last_month') {
            const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            return { from: toStr(firstOfLastMonth), to: toStr(lastOfLastMonth) };
        }
        if (this.filterPeriod === 'custom') {
            return { from: this.filterFrom || '', to: this.filterTo || '' };
        }
        return { from: '', to: '' };
    }

    /** Applique tous les filtres actifs et retourne les logs filtrés */
    getFilteredLogs() {
        let logs = [...this.actionLogs];

        if (this.filterAction) {
            logs = logs.filter(l => l.programmeId === this.filterAction);
        }
        if (this.filterMember) {
            logs = logs.filter(l => l.memberId === this.filterMember);
        }
        if (this.filterType) {
            logs = logs.filter(l => (l.type || 'done') === this.filterType);
        }

        const { from, to } = this.getPeriodBounds();
        if (from) logs = logs.filter(l => l.date >= from);
        if (to) logs = logs.filter(l => l.date <= to);

        // Tri par date/heure décroissante
        logs.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.time || '').localeCompare(a.time || '');
        });

        return logs;
    }

    /** Convertit une durée en minutes vers un texte lisible (ex: "1h 30min") */
    formatDuration(totalMinutes) {
        if (totalMinutes <= 0) return '0 ' + t("minutes_abbr");
        const h = Math.floor(totalMinutes / 60);
        const min = totalMinutes % 60;
        if (h > 0 && min > 0) return `${h}${t("hours_abbr")} ${min}${t("minutes_abbr")}`;
        if (h > 0) return `${h}${t("hours_abbr")}`;
        return `${min}${t("minutes_abbr")}`;
    }

    /** Convertit une valeur durée + unité en minutes */
    toMinutes({ duration, durationUnit }) {
        if (!duration) return 0;
        const val = Number(duration);
        if (isNaN(val) || val <= 0) return 0;
        return durationUnit === 'hours' ? val * 60 : val;
    }

    /** Calcule et affiche les statistiques de durée pour les logs filtrés */
    renderStats(logs) {
        const container = document.getElementById('duration-stats');

        // Logs "done" servant à l'affichage de la liste
        const doneLogs = logs.filter(l => (l.type || 'done') === 'done');

        // Parmi ceux-ci, seuls les logs avec durée contribuent aux cumuls
        const logsWithDuration = doneLogs.filter(l => l.duration);

        // Cacher le panneau s'il n'y a aucun log de type "done"
        if (doneLogs.length === 0) {
            container.classList.add('d-none');
            return;
        }

        // Calcul du total global en minutes
        const totalMinutes = logsWithDuration.reduce(
            (acc, l) => acc + this.toMinutes({ duration: l.duration, durationUnit: l.durationUnit }),
            0
        );

        // Cumul par action (sur les logs avec durée)
        const byAction = {};
        logsWithDuration.forEach(l => {
            const key = l.programmeId || '__none__';
            byAction[key] = (byAction[key] || 0) + this.toMinutes({
                duration: l.duration, durationUnit: l.durationUnit
            });
        });

        // Cumul par membre (sur les logs avec durée)
        const byMember = {};
        logsWithDuration.forEach(l => {
            const key = l.memberId || '__none__';
            byMember[key] = (byMember[key] || 0) + this.toMinutes({
                duration: l.duration, durationUnit: l.durationUnit
            });
        });

        // Tri décroissant par durée
        const sortedActions = Object.entries(byAction).sort((a, b) => b[1] - a[1]);
        const sortedMembers = Object.entries(byMember).sort((a, b) => b[1] - a[1]);

        // Afficher la colonne membres pour les admins s'il y a au moins 2 membres différents
        // dans l'ensemble des logs (pas seulement les filtrés), sauf si le filtre membre est actif
        const uniqueMembersInAllLogs = new Set(
            this.actionLogs
                .filter(l => (l.type || 'done') === 'done' && l.duration)
                .map(l => l.memberId)
        );
        const showMembers = !this.isMember
            && !this.filterMember
            && uniqueMembersInAllLogs.size > 1
            && sortedMembers.length > 0;

        const totalLabel = totalMinutes > 0
            ? this.formatDuration(totalMinutes)
            : `0${t("minutes_abbr")}`;

        let html = `
            <div class="card border-primary">
                <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2">
                    <span>⏱️ ${t("cumulative_durations")}</span>
                    <strong>${t("total_duration")} : ${totalLabel}</strong>
                </div>
                <div class="card-body p-2">`;

        if (logsWithDuration.length === 0) {
            // Des logs existent mais sans durée enregistrée
            html += `<p class="text-muted small mb-0">${t("no_duration_data")}</p>`;
        } else {
            html += `<div class="row g-2">`;

            // Colonne par action
            html += `
                    <div class="${showMembers ? 'col-md-6' : 'col-12'}">
                        <div class="small fw-bold text-muted mb-1">🔧 ${t("by_action")}</div>`;
            sortedActions.forEach(([actionId, minutes]) => {
                const action = this.actions.find(a => a.id === actionId);
                const name = action ? action.name : t("unknown_action");
                const pct = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
                html += `
                        <div class="mb-1">
                            <div class="d-flex justify-content-between small">
                                <span class="text-truncate me-2" style="max-width:70%">${name}</span>
                                <span class="fw-bold text-nowrap">${this.formatDuration(minutes)}</span>
                            </div>
                            <div class="progress" style="height:4px">
                                <div class="progress-bar bg-warning" style="width:${pct}%"></div>
                            </div>
                        </div>`;
            });
            html += `</div>`;

            // Colonne par membre (admin, pas de filtre membre actif, au moins 2 membres au global)
            if (showMembers) {
                html += `
                    <div class="col-md-6">
                        <div class="small fw-bold text-muted mb-1">👤 ${t("by_member")}</div>`;
                sortedMembers.forEach(([memberId, minutes]) => {
                    const member = this.members.find(m => m.id === memberId);
                    const name = member
                        ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                        : t("unknown_action");
                    const pct = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
                    html += `
                        <div class="mb-1">
                            <div class="d-flex justify-content-between small">
                                <span class="text-truncate me-2" style="max-width:70%">${name}</span>
                                <span class="fw-bold text-nowrap">${this.formatDuration(minutes)}</span>
                            </div>
                            <div class="progress" style="height:4px">
                                <div class="progress-bar bg-primary" style="width:${pct}%"></div>
                            </div>
                        </div>`;
                });
                html += `</div>`;
            }

            html += `</div>`;
        }

        html += `</div></div>`;

        container.innerHTML = html;
        container.classList.remove('d-none');
    }

    renderAll() {
        const logs = this.getFilteredLogs();
        this.renderStats(logs);
        this.renderList(logs);
    }

    renderList(logs) {
        const container = document.getElementById('history-list');
        container.innerHTML = '';

        if (logs.length === 0) {
            container.innerHTML = `<p class="text-muted">${t("no_history")}</p>`;
            return;
        }

        const locale = i18n.lang === 'en' ? 'en-US' : 'fr-FR';
        logs.forEach(log => {
            const el = this.renderItem(log, locale);
            container.appendChild(el);
        });
    }

    renderItem(log, locale) {
        const div = document.createElement('div');
        div.className = 'list-group-item border rounded mb-2';

        const action = this.actions.find(a => a.id === log.programmeId);
        const actionName = action ? action.name : t("unknown_action");
        const memberName = this.getMemberName(log.memberId);

        const dateStr = new Date(log.date + 'T12:00:00').toLocaleDateString(locale, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const timeStr = log.time ? ` ⏰ ${log.time}` : '';

        let durationStr = '';
        if (log.duration) {
            const totalMin = this.toMinutes({ duration: log.duration, durationUnit: log.durationUnit });
            durationStr = ` ⏱️ ${this.formatDuration(totalMin)}`;
        }

        const typeBadge = log.type === 'note'
            ? `<span class="badge bg-info">${t("note")}</span>`
            : `<span class="badge bg-success">${t("done")}</span>`;

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <span class="badge bg-warning text-dark me-2">🔧 ${t("action_label")}</span>
                    <strong>${actionName}</strong>
                    ${typeBadge}
                </div>
                <small class="text-muted">${memberName}</small>
            </div>
            <div class="mt-1">
                <small>
                    📅 ${dateStr}${timeStr}${durationStr}
                </small>
            </div>
            ${log.notes ? `<div class="mt-1 text-dark small">${log.notes}</div>` : ''}
        `;

        return div;
    }

    getMemberName(memberId) {
        return ActionUtils.getMemberName(memberId, this.members);
    }

    initFilters() {
        document.getElementById('filter-action').addEventListener('change', (e) => {
            this.filterAction = e.target.value;
            this.renderAll();
        });

        document.getElementById('filter-member').addEventListener('change', (e) => {
            this.filterMember = e.target.value;
            this.renderAll();
        });

        document.getElementById('filter-type').addEventListener('change', (e) => {
            this.filterType = e.target.value;
            this.renderAll();
        });

        document.getElementById('filter-period').addEventListener('change', (e) => {
            this.filterPeriod = e.target.value;
            const customRow = document.getElementById('custom-period-row');
            if (this.filterPeriod === 'custom') {
                customRow.classList.remove('d-none');
            } else {
                customRow.classList.add('d-none');
            }
            this.renderAll();
        });

        document.getElementById('filter-from').addEventListener('change', (e) => {
            this.filterFrom = e.target.value;
            this.renderAll();
        });

        document.getElementById('filter-to').addEventListener('change', (e) => {
            this.filterTo = e.target.value;
            this.renderAll();
        });
    }

    async init() {
        this.initFilters();
        await this.loadData();
    }
}
