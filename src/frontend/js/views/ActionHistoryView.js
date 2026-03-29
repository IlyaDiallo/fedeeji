class ActionHistoryView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(t("action_history") + " - " + t("brand"));
        this.orgId = params.orgId;
        this.isMember = api.getRole() === 'member';
        this.actionLogs = [];
        this.actions = [];
        this.members = [];
        this.filterAction = '';
        this.filterMember = '';
        this.filterType = '';
    }

    async getHtml() {
        return `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 data-i18n="action_history">${t("action_history")}</h2>
            </div>

            <div class="row mb-3">
                <div class="col-md-4 mb-2">
                    <label class="form-label">${t("action_label")}</label>
                    <select class="form-select" id="filter-action">
                        <option value="">${t("all")}</option>
                    </select>
                </div>
                <div class="col-md-4 mb-2">
                    <label class="form-label">${t("member")}</label>
                    <select class="form-select" id="filter-member">
                        <option value="">${t("all")}</option>
                    </select>
                </div>
                <div class="col-md-4 mb-2">
                    <label class="form-label">${t("type")}</label>
                    <select class="form-select" id="filter-type">
                        <option value="">${t("all")}</option>
                        <option value="done">${t("done")}</option>
                        <option value="note">${t("note")}</option>
                    </select>
                </div>
            </div>

            <div id="history-list" class="list-group border-0">
            </div>
        `;
    }

    async loadData() {
        try {
            const [actionLogs, actions, members] = await Promise.all([
                api.get(this.orgId, 'action-logs'),
                api.get(this.orgId, 'actions'),
                this.isMember ? Promise.resolve([]) : api.get(this.orgId, 'members')
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
        this.renderList();
    }

    populateFilters() {
        const actionSelect = document.getElementById('filter-action');
        const memberSelect = document.getElementById('filter-member');

        // Remplir les filtres
        this.actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action.id;
            option.textContent = action.name;
            actionSelect.appendChild(option);
        });

        this.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = `${member.firstName || ''} ${member.lastName || ''}`.trim();
            memberSelect.appendChild(option);
        });
    }

    renderList() {
        const container = document.getElementById('history-list');
        container.innerHTML = '';

        let logs = [...this.actionLogs];

        // Appliquer les filtres
        if (this.filterAction) {
            logs = logs.filter(l => l.programmeId === this.filterAction);
        }
        if (this.filterMember) {
            logs = logs.filter(l => l.memberId === this.filterMember);
        }
        if (this.filterType) {
            logs = logs.filter(l => {
                const logType = l.type || 'done';
                return logType === this.filterType;
            });
        }

        // Trier par date/heure décroissante
        logs.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.time || '').localeCompare(a.time || '');
        });

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
        const durationStr = log.duration
            ? ` ⏱️ ${log.duration} ${t(log.durationUnit === 'hours' ? 'hours' : 'minutes')}`
            : '';

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
        if (!memberId) return '';
        const m = this.members.find(m => m.id === memberId);
        if (!m) return '';
        return `(${m.firstName || ''} ${m.lastName || ''})`.trim();
    }

    initFilters() {
        document.getElementById('filter-action').addEventListener('change', (e) => {
            this.filterAction = e.target.value;
            this.renderList();
        });

        document.getElementById('filter-member').addEventListener('change', (e) => {
            this.filterMember = e.target.value;
            this.renderList();
        });

        document.getElementById('filter-type').addEventListener('change', (e) => {
            this.filterType = e.target.value;
            this.renderList();
        });
    }

    async init() {
        this.initFilters();
        await this.loadData();
    }
}