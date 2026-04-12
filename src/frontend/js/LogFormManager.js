/**
 * Gestion du formulaire de logs (modal logModal) : done, note, consultation.
 * Reçoit une référence vers la vue pour accéder aux données partagées.
 */
class LogFormManager {
    constructor({ view }) {
        this.view = view;
    }

    // --- Helpers ---

    /** Génère le HTML d'information sur la date/heure/durée d'une action */
    buildActionInfoHtml({ action, occDateStr }) {
        const locale = this.view.locale;
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

    /** Réinitialise la visibilité de tous les champs du modal log */
    resetVisibility() {
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

    // --- Ouverture du modal ---

    open(actionId, type = 'done', defaultDate = null) {
        const action = this.view.actions.find(a => a.id === actionId);
        document.getElementById('log-actionId').value = actionId;
        document.getElementById('log-id').value = '';
        this.resetVisibility();

        const todayStr = RecurrenceUtils.formatDateStr(new Date());
        const dateInput = document.getElementById('log-date');
        const saveBtn = document.getElementById('btn-save-log');
        const notesTextarea = document.getElementById('log-notes');
        const title = document.getElementById('logModalTitle');
        const windowInfoEl = document.getElementById('log-window-info');
        const locale = this.view.locale;

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
            this._openReadOnlyMode({
                action, occDateStr, locale,
                title, windowInfoEl, dateInput,
                notesTextarea, saveBtn
            });
            return;
        }

        // ========== Mode instruction (note) ==========
        if (type === 'note') {
            this._openNoteMode({
                action, actionId, occDateStr, todayStr,
                locale, title, windowInfoEl, dateInput,
                saveBtn, notesTextarea
            });
            return;
        }

        // ========== Mode "Fait" (done) dans la fenêtre ==========
        this._openDoneMode({
            action, actionId, occDateStr,
            title, windowInfoEl, dateInput,
            saveBtn, notesTextarea
        });
    }

    // --- Rafraîchir les notes existantes ---

    refreshExistingNotes() {
        const actionId = document.getElementById('log-actionId').value;
        const date = document.getElementById('log-date').value;
        const container = document.getElementById('log-existing-notes');

        if (!actionId || !date) {
            container.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        const notes = this.view.actionLogs.filter(
            l => l.programmeId === actionId
                && l.type === 'note' && l.date === date
        );

        if (notes.length === 0) {
            container.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('d-none');
        container.innerHTML = ProgrammeRenderers.renderExistingNotes({
            notes,
            getMemberName: id => this.view.getMemberName(id)
        });
    }

    // --- Sauvegarde ---

    async save() {
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
        const state = (
            stateContainer.style.display !== 'none' && stateSelect.value
        ) ? Number(stateSelect.value) : undefined;

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
        if (state !== undefined) data.state = state;

        try {
            if (id) {
                await api.update(
                    this.view.collectiveId, 'action-logs', id, data
                );
            } else {
                await api.create(
                    this.view.collectiveId, 'action-logs', data
                );
            }
            this.view.logModal.hide();
            await this.view.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Suppression ---

    async delete() {
        const logId = document.getElementById('log-id').value;
        if (!logId) return;
        if (!confirm(t("confirm_delete"))) return;

        try {
            await api.delete(
                this.view.collectiveId, 'action-logs', logId
            );
            this.view.logModal.hide();
            await this.view.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Listeners (appelé une seule fois dans init) ---

    initListeners() {
        document.getElementById('btn-save-log')
            .addEventListener('click', () => this.save());

        document.getElementById('btn-delete-log')
            .addEventListener('click', () => this.delete());

        document.getElementById('log-date')
            .addEventListener('change', (e) => {
                this.refreshExistingNotes();
                this._onLogDateChange(e.target.value);
            });
    }

    // --- Méthodes privées : modes d'ouverture ---

    _openReadOnlyMode({
        action, occDateStr, locale,
        title, windowInfoEl, dateInput,
        notesTextarea, saveBtn
    }) {
        title.textContent = action?.name || t("action_label");

        const actionInfo = this.buildActionInfoHtml({ action, occDateStr });
        const occDateObj = new Date(`${occDateStr}T12:00:00`);
        const wsObj = new Date(occDateObj);
        wsObj.setDate(wsObj.getDate() - (action?.windowDays || 0));
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

        this.refreshExistingNotes();
        this.view.logModal.show();
    }

    _openNoteMode({
        action, actionId, occDateStr, todayStr,
        locale, title, windowInfoEl, dateInput,
        saveBtn, notesTextarea
    }) {
        const dateToUse = occDateStr || todayStr;
        dateInput.value = dateToUse;
        dateInput.disabled = true;
        saveBtn.textContent = t("save");
        saveBtn.className = 'btn btn-primary';
        title.textContent = t("instructions");

        const actionInfo = this.buildActionInfoHtml({ action, occDateStr });
        windowInfoEl.innerHTML = `
            <div class="alert alert-info py-2 mb-2">
                ${actionInfo}
            </div>`;
        windowInfoEl.classList.remove('d-none');

        document.getElementById('log-state-container')
            .style.display = 'none';
        document.getElementById('log-time').value = action?.time || '';
        notesTextarea.value = '';

        // Pré-remplir durée depuis l'action
        if (action?.duration) {
            document.getElementById('log-duration').value = action.duration;
            document.getElementById('log-durationUnit').value =
                action.durationUnit
                || ActionUtils.DEFAULT_DURATION_UNIT;
        } else {
            document.getElementById('log-duration').value = '';
            document.getElementById('log-durationUnit').value =
                ActionUtils.DEFAULT_DURATION_UNIT;
        }

        // Charger note existante
        const existingNote = this.view.actionLogs.find(
            l => l.programmeId === actionId
                && l.type === 'note'
                && l.date === occDateStr
        );
        if (existingNote) {
            document.getElementById('log-id').value = existingNote.id;
            notesTextarea.value = existingNote.notes || '';
            if (existingNote.time) {
                document.getElementById('log-time').value = existingNote.time;
            }
            document.getElementById('btn-delete-log')
                .classList.remove('d-none');
        } else {
            document.getElementById('btn-delete-log')
                .classList.add('d-none');
        }

        this.refreshExistingNotes();
        this.view.logModal.show();
    }

    _openDoneMode({
        action, actionId, occDateStr,
        title, windowInfoEl, dateInput,
        saveBtn, notesTextarea
    }) {
        dateInput.value = occDateStr;
        dateInput.disabled = true;
        dateInput.min = '';
        dateInput.max = '';

        // Chercher le dernier log "done" pour cette occurrence
        const existingLog = (() => {
            const occDoneLogs = this.view.actionLogs
                .filter(l => l.programmeId === actionId
                    && (!l.type || l.type === 'done')
                    && l.date === occDateStr)
                .sort((a, b) =>
                    (b.timestamp || 0) - (a.timestamp || 0)
                    || (b.state || 0) - (a.state || 0)
                );
            return occDoneLogs.length > 0 ? occDoneLogs[0] : null;
        })();

        if (existingLog) {
            document.getElementById('log-id').value = existingLog.id;
            notesTextarea.value = existingLog.notes || '';
            document.getElementById('log-time').value =
                existingLog.time || '';
            if (existingLog.duration) {
                document.getElementById('log-duration').value =
                    existingLog.duration;
                document.getElementById('log-durationUnit').value =
                    existingLog.durationUnit
                    || ActionUtils.DEFAULT_DURATION_UNIT;
            } else {
                this._prefillDuration(action);
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
            this._prefillDuration(action);
            document.getElementById('btn-delete-log')
                .classList.add('d-none');
            title.textContent = t("mark_done");
            saveBtn.textContent = t("mark_done");
            saveBtn.className = 'btn btn-success';
        }

        windowInfoEl.innerHTML = '';
        windowInfoEl.classList.add('d-none');

        // Gestion des états intermédiaires
        this._setupStateSelect({ action, actionId, occDateStr });

        this.refreshExistingNotes();
        this.view.logModal.show();
    }

    // --- Méthodes privées : utilitaires ---

    _prefillDuration(action) {
        if (action?.duration) {
            document.getElementById('log-duration').value = action.duration;
            document.getElementById('log-durationUnit').value =
                action.durationUnit
                || ActionUtils.DEFAULT_DURATION_UNIT;
        } else {
            document.getElementById('log-duration').value = '';
            document.getElementById('log-durationUnit').value =
                ActionUtils.DEFAULT_DURATION_UNIT;
        }
    }

    _setupStateSelect({ action, actionId, occDateStr }) {
        const states = action?.states || [];
        const stateSelect = document.getElementById('log-state');
        const stateContainer = document.getElementById('log-state-container');

        if (states.length > 0) {
            stateContainer.style.display = 'block';
            stateSelect.innerHTML = states
                .map((s, i) => `<option value="${i+1}">${s}</option>`)
                .join('')
                + `<option value="${states.length + 1}">Fait</option>`;

            const allDoneLogs = this.view.actionLogs
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
    }

    _onLogDateChange(date) {
        const type = document.getElementById('log-type').value;
        if (type !== 'note') return;

        const actionId = document.getElementById('log-actionId').value;
        const existingNote = this.view.actionLogs.find(
            l => l.programmeId === actionId
                && l.type === 'note' && l.date === date
        );
        if (existingNote) {
            document.getElementById('log-id').value = existingNote.id;
            document.getElementById('log-notes').value =
                existingNote.notes || '';
            if (existingNote.time) {
                document.getElementById('log-time').value = existingNote.time;
            }
            document.getElementById('btn-delete-log')
                .classList.remove('d-none');
        } else {
            document.getElementById('log-id').value = '';
            document.getElementById('log-notes').value = '';
            document.getElementById('log-time').value = '';
            document.getElementById('btn-delete-log')
                .classList.add('d-none');
        }
    }
}
