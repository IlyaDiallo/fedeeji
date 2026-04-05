/**
 * Gestion du formulaire CRUD d'actions (modal actionModal).
 * Reçoit une référence vers la vue pour accéder aux données partagées.
 */
class ActionFormManager {
    constructor({ view }) {
        this.view = view;
    }

    // --- Toggles d'interface ---

    toggleAllDay() {
        const isAllDay = document.getElementById('action-allDay-yes').checked;
        document.getElementById('action-time-duration')
            .style.display = isAllDay ? 'none' : 'block';
    }

    toggleExecutionType() {
        const isNow = document.getElementById('exec-type-now')?.checked;
        const recContainer = document.getElementById(
            'action-recurrence-main-container'
        );
        const windowContainer = document.getElementById(
            'action-window-main-container'
        );

        if (isNow) {
            if (recContainer) recContainer.style.display = 'none';
            if (windowContainer) windowContainer.style.display = 'none';

            const today = new Date();
            const dateStr = window.RecurrenceUtils
                ? RecurrenceUtils.formatDateStr(today)
                : today.toISOString().split('T')[0];
            const timeStr = today.toTimeString().slice(0, 5);

            document.getElementById('action-date').value = dateStr;
            document.getElementById('action-time').value = timeStr;
            document.getElementById('action-allDay-no').checked = true;
            this.toggleAllDay();
        } else {
            if (recContainer) recContainer.style.display = 'block';
            if (windowContainer) windowContainer.style.display = 'block';
        }
    }

    // --- Ouverture du modal ---

    open(id = null) {
        const form = document.getElementById('action-form');
        form.reset();
        document.getElementById('action-id').value = '';

        const titleEl = document.getElementById('actionModalTitle');
        const templateContainer = document.getElementById(
            'action-template-container'
        );
        const typeContainer = document.getElementById(
            'action-type-container'
        );

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

            const templateSelect = document.getElementById(
                'action-template-select'
            );
            const seenNames = new Set();
            const uniqueActions = this.view.actions.filter(a => {
                const name = a.name ? a.name.trim().toLowerCase() : '';
                if (!name || seenNames.has(name)) return false;
                seenNames.add(name);
                return true;
            });
            uniqueActions.sort(
                (a, b) => (a.name || '').localeCompare(b.name || '')
            );
            templateSelect.innerHTML =
                `<option value="">${t("no_template")}</option>`
                + uniqueActions.map(
                    a => `<option value="${a.id}">${a.name}</option>`
                ).join('');
        }

        this.toggleAllDay();
        this.toggleExecutionType();
        this._resetRecurrenceFields();

        if (id) {
            this._populateFromAction(id);
        }

        this.view.actionModal.show();
    }

    // --- Sauvegarde ---

    async save() {
        const form = document.getElementById('action-form');
        if (!form.reportValidity()) return;

        const id = document.getElementById('action-id').value;
        const isAllDay = document.getElementById('action-allDay-yes').checked;
        const isNow = !id
            && document.getElementById('exec-type-now')?.checked;

        const data = {
            name: document.getElementById('action-name').value,
            states: document.getElementById('action-states').value
                .split(',').map(s => s.trim()).filter(s => s !== ''),
            description: document.getElementById('action-description').value,
            date: document.getElementById('action-date').value,
            recurrenceEndDate:
                document.getElementById('action-recurrenceEndDate').value
                || null,
            windowDays: Number(
                document.getElementById('action-windowDays').value
            ),

            allDay: isAllDay,
            time: isAllDay
                ? '' : document.getElementById('action-time').value,
            duration: isAllDay
                ? null
                : Number(document.getElementById('action-duration').value),
            durationUnit: isAllDay
                ? null
                : document.getElementById('action-durationUnit').value,

            recurrence: isNow
                ? 'none'
                : document.getElementById('action-recurrence').value,
            recurrenceInterval: isNow ? 1 : (
                Number(document.getElementById(
                    'action-recurrenceInterval'
                ).value) || 1
            ),
            recurrenceDays: isNow ? [] : Array.from(
                document.querySelectorAll('.action-recurrence-day:checked')
            ).map(cb => parseInt(cb.value)),
            monthlyType: isNow
                ? 'date'
                : document.getElementById('action-monthlyType').value,

            // Nettoyage des anciens champs
            scheduleMode: 'scheduled',
            frequencyValue: null,
            frequencyUnit: null,
            startDate: null
        };

        try {
            if (id) {
                await api.update(
                    this.view.collectiveId, 'actions', id, data
                );
            } else {
                const created = await api.create(
                    this.view.collectiveId, 'actions', data
                );

                // Action ponctuelle créée "Maintenant" : enregistrer comme commencée (state=1).
                // Pour une action récurrente, pas de log automatique :
                // la première occurrence doit apparaître "À faire" dans la liste et le calendrier.
                const isRecurrent = data.recurrence && data.recurrence !== 'none';
                if (isNow && !isRecurrent) {
                    const logData = {
                        programmeId: created.id,
                        type: 'done',
                        date: data.date,
                        time: data.time || null,
                        duration: data.duration,
                        durationUnit: data.durationUnit,
                        notes: null,
                        state: 1,
                        timestamp: Date.now()
                    };
                    await api.create(
                        this.view.collectiveId, 'action-logs', logData
                    );
                }
            }
            this.view.actionModal.hide();
            await this.view.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Suppression ---

    async delete(id) {
        if (!confirm(t("confirm_delete"))) return;
        try {
            await api.delete(this.view.collectiveId, 'actions', id);
            await this.view.loadData();
        } catch (error) {
            alert(t("error") + ': ' + error.message);
        }
    }

    // --- Listeners (appelé une seule fois dans init) ---

    initListeners() {
        document.getElementById('btn-add-action')
            .addEventListener('click', () => this.open());

        document.getElementById('btn-save-action')
            .addEventListener('click', () => this.save());

        document.querySelectorAll('input[name="action-allDay"]')
            .forEach(r => r.addEventListener('change', () => this.toggleAllDay()));

        document.querySelectorAll('input[name="action-executionType"]')
            .forEach(r => r.addEventListener('change',
                () => this.toggleExecutionType()));

        const recSel = document.getElementById('action-recurrence');
        if (recSel) {
            recSel.addEventListener('change', (e) => {
                this._onRecurrenceChange(e.target.value);
            });
        }

        const tplSel = document.getElementById('action-template-select');
        if (tplSel) {
            tplSel.addEventListener('change', (e) => {
                this._onTemplateChange(e.target.value);
            });
        }
    }

    // --- Méthodes privées ---

    _resetRecurrenceFields() {
        document.getElementById('action-recurrence').value = 'none';
        document.getElementById('action-recurrenceEndDate-container')
            .style.display = 'none';
        document.getElementById('action-recurrence')
            .classList.add('rounded-start');
        document.getElementById('action-recurrenceInterval').value = '1';
        document.getElementById('action-recurrenceInterval')
            .style.display = 'none';
        document.getElementById('action-recurrence-label')
            .style.display = 'none';
        document.getElementById('action-recurrence-days-container')
            .style.display = 'none';
        document.getElementById('action-monthly-type-container')
            .style.display = 'none';
        document.querySelectorAll('.action-recurrence-day')
            .forEach(cb => cb.checked = false);
    }

    _populateFromAction(id) {
        const action = this.view.actions.find(a => a.id === id);
        if (!action) return;

        document.getElementById('action-id').value = action.id;
        document.getElementById('action-name').value = action.name || '';
        document.getElementById('action-states').value =
            (action.states || []).join(', ');
        document.getElementById('action-description').value =
            action.description || '';
        document.getElementById('action-date').value =
            action.date || action.startDate || '';
        document.getElementById('action-recurrenceEndDate').value =
            action.recurrenceEndDate || '';
        document.getElementById('action-windowDays').value =
            action.windowDays || 0;

        const isAllDay = action.allDay !== undefined
            ? action.allDay : !action.time;
        document.getElementById('action-allDay-yes').checked = isAllDay;
        document.getElementById('action-allDay-no').checked = !isAllDay;
        this.toggleAllDay();

        document.getElementById('action-time').value = action.time || '';
        document.getElementById('action-duration').value =
            action.duration || '';
        document.getElementById('action-durationUnit').value =
            action.durationUnit || 'hours';

        this._applyNormalizedRecurrence(action);
    }

    _applyNormalizedRecurrence(actionOrTemplate) {
        const norm = ActionUtils.normalize(actionOrTemplate);
        const rec = norm.recurrence || 'none';
        const interval = norm.recurrenceInterval || 1;

        document.getElementById('action-recurrence').value = rec;
        document.getElementById('action-recurrence')
            .classList.toggle('rounded-start', rec === 'none');
        document.getElementById('action-recurrenceInterval').value = interval;
        document.getElementById('action-recurrenceInterval')
            .style.display = (rec === 'none') ? 'none' : '';
        document.getElementById('action-recurrence-label')
            .style.display = (rec === 'none') ? 'none' : '';
        document.getElementById('action-monthlyType').value =
            actionOrTemplate.monthlyType || 'date';

        document.querySelectorAll('.action-recurrence-day').forEach(cb => {
            cb.checked = actionOrTemplate.recurrenceDays
                ? actionOrTemplate.recurrenceDays.includes(parseInt(cb.value))
                : false;
        });

        document.getElementById('action-recurrence-days-container')
            .style.display = (rec === 'weekly') ? 'block' : 'none';
        document.getElementById('action-monthly-type-container')
            .style.display = (rec === 'monthly') ? 'block' : 'none';
        document.getElementById('action-recurrenceEndDate-container')
            .style.display = (rec === 'none') ? 'none' : 'block';
    }

    _onRecurrenceChange(val) {
        document.getElementById('action-recurrence-days-container')
            .style.display = (val === 'weekly') ? 'block' : 'none';
        document.getElementById('action-monthly-type-container')
            .style.display = (val === 'monthly') ? 'block' : 'none';
        document.getElementById('action-recurrenceEndDate-container')
            .style.display = (val === 'none') ? 'none' : 'block';

        const intervalInput = document.getElementById(
            'action-recurrenceInterval'
        );
        const intervalLabel = document.getElementById(
            'action-recurrence-label'
        );
        const recSel = document.getElementById('action-recurrence');

        if (val === 'none') {
            intervalInput.style.display = 'none';
            if (intervalLabel) intervalLabel.style.display = 'none';
            recSel.classList.add('rounded-start');
        } else {
            intervalInput.style.display = '';
            if (intervalLabel) intervalLabel.style.display = '';
            recSel.classList.remove('rounded-start');
        }
    }

    _onTemplateChange(templateId) {
        if (!templateId) return;
        const tpl = this.view.actions.find(a => a.id === templateId);
        if (!tpl) return;

        document.getElementById('action-name').value = tpl.name || '';
        document.getElementById('action-states').value =
            (tpl.states || []).join(', ');
        document.getElementById('action-description').value =
            tpl.description || '';
        document.getElementById('action-windowDays').value =
            tpl.windowDays || 0;

        const isAllDay = tpl.allDay !== undefined
            ? tpl.allDay : !tpl.time;
        document.getElementById('action-allDay-yes').checked = isAllDay;
        document.getElementById('action-allDay-no').checked = !isAllDay;
        this.toggleAllDay();

        document.getElementById('action-time').value = tpl.time || '';
        document.getElementById('action-duration').value =
            tpl.duration || '';
        document.getElementById('action-durationUnit').value =
            tpl.durationUnit || 'hours';

        this._applyNormalizedRecurrence(tpl);
        this.toggleExecutionType();
    }
}
