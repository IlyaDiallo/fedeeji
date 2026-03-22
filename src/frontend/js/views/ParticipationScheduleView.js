class ParticipationScheduleView extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle(
            t("participation_schedule") + " - " + t("brand")
        );
        this.orgId = params.orgId;
        this.eventId = params.eventId;
        this.isMember = api.getRole() === 'member';
        this.event = null;
        this.members = [];
        this.participations = [];
        this.occurrences = [];
        // Réponse active pour le "pinceau"
        this.activeBrush = 'yes';
        // Mois affiché (Date au 1er du mois)
        this.currentMonth = new Date();
        this.currentMonth.setDate(1);
        // Membre sélectionné (admin peut choisir)
        this.selectedMemberId = this.isMember
            ? api.getMemberId() : null;
        // État local des réponses { "YYYY-MM-DD": "yes"|"no"|"maybe"|null }
        this.localResponses = {};
        this.dirty = false;
    }

    async getHtml() {
        const memberSelector = this.isMember ? '' : `
            <div class="mb-3">
                <label class="form-label fw-bold"
                    data-i18n="member">
                    ${t("member")}</label>
                <select class="form-select"
                    id="schedule-member-select">
                    <option value="">
                        ${t("select_member")}</option>
                </select>
            </div>`;

        return `
            <div class="d-flex justify-content-between
                align-items-center mb-3">
                <h2 id="schedule-title">
                    ${t("participation_schedule")}</h2>
                <a href="/${this.orgId}/schedule"
                    class="btn btn-outline-secondary"
                    data-link>
                    <i class="bi bi-arrow-left"></i>
                    ${t("back_to_schedule")}
                </a>
            </div>

            ${memberSelector}

            <div id="schedule-content"
                class="d-none">
                <!-- Sélecteur de réponse (pinceau) -->
                <div class="participation-brush mb-3
                    d-flex flex-wrap align-items-center
                    gap-2">
                    <span class="fw-bold me-2">
                        ${t("response")} :</span>
                    <button class="btn btn-success
                        brush-btn active"
                        data-brush="yes">
                        ${t("yes")}</button>
                    <button class="btn btn-outline-danger
                        brush-btn"
                        data-brush="no">
                        ${t("no")}</button>
                    <button class="btn btn-outline-warning
                        brush-btn"
                        data-brush="maybe">
                        ${t("maybe")}</button>
                    <div class="ms-auto d-flex gap-2">
                        <button class="btn
                            btn-outline-secondary"
                            id="btn-apply-all">
                            ${t("apply_to_all")}
                        </button>
                        <button class="btn btn-primary"
                            id="btn-save-schedule"
                            disabled>
                            <i class="bi bi-check-lg"></i>
                            ${t("save")}
                        </button>
                    </div>
                </div>

                <!-- Navigation mois -->
                <div class="d-flex justify-content-between
                    align-items-center mb-3">
                    <button class="btn btn-outline-secondary
                        btn-sm" id="btn-prev-month">
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <h5 id="month-label"
                        class="mb-0"></h5>
                    <button class="btn btn-outline-secondary
                        btn-sm" id="btn-next-month">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>

                <!-- Zone calendrier / liste -->
                <div id="schedule-grid"></div>
            </div>
        `;
    }

    async loadData() {
        try {
            const promises = [
                api.getById(
                    this.orgId, 'events', this.eventId
                ),
                api.get(this.orgId, 'participations')
            ];
            if (!this.isMember) {
                promises.push(
                    api.get(this.orgId, 'members')
                );
            }
            const results = await Promise.all(promises);
            this.event = results[0];
            this.participations = results[1];
            if (!this.isMember) {
                this.members = results[2];
            }

            // Générer les occurrences sur un an
            this.occurrences =
                window.RecurrenceUtils
                    ? window.RecurrenceUtils
                        .generateOccurrences({
                            event: this.event,
                            maxOccurrences: 200
                        })
                    : [];

            // Filtrer les annulées (membres uniquement, admin les voit)
            if (this.isMember) {
                this.occurrences = this.occurrences
                    .filter(o => !o.isCancelled);
            }

            document.getElementById('schedule-title')
                .textContent = `${t("participation_schedule")} — ${this.event.name}`;

            if (!this.isMember) {
                this.renderMemberSelect();
            } else {
                this.selectedMemberId = api.getMemberId();
                this.loadLocalResponses();
                document.getElementById('schedule-content')
                    .classList.remove('d-none');
                this.renderMonth();
            }
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    renderMemberSelect() {
        const select = document.getElementById(
            'schedule-member-select'
        );
        if (!select) return;
        select.innerHTML =
            `<option value="">`
            + `${t("select_member")}</option>`;
        this.members.forEach(m => {
            select.innerHTML +=
                `<option value="${m.id}">`
                + `${m.lastName} ${m.firstName}`
                + `</option>`;
        });
    }

    /** Charge les réponses existantes dans l'état local */
    loadLocalResponses() {
        this.localResponses = {};
        if (!this.selectedMemberId) return;
        const relevant = this.participations.filter(
            p => p.eventId === this.eventId
                && p.memberId === this.selectedMemberId
        );
        relevant.forEach(p => {
            const date = p.occurrenceDate || this.event.date;
            if (date) {
                this.localResponses[date] = p.response;
            }
        });
    }

    /** Dates d'occurrence qui tombent dans le mois affiché */
    getMonthOccurrences() {
        const y = this.currentMonth.getFullYear();
        const m = this.currentMonth.getMonth();
        const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const endDay = new Date(y, m + 1, 0).getDate();
        const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

        return this.occurrences.filter(o =>
            o.occurrenceDate >= startStr
            && o.occurrenceDate <= endStr
        );
    }

    renderMonth() {
        const grid = document.getElementById('schedule-grid');
        if (!grid) return;

        const y = this.currentMonth.getFullYear();
        const m = this.currentMonth.getMonth();

        // Mettre à jour le label du mois
        const label = document.getElementById('month-label');
        const monthName = new Date(y, m, 1)
            .toLocaleDateString(
                i18n.lang === 'en' ? 'en-US' : 'fr-FR',
                { month: 'long', year: 'numeric' }
            );
        label.textContent = monthName.charAt(0)
            .toUpperCase() + monthName.slice(1);

        const recType = this.event.recurrence;

        if (recType === 'monthly') {
            this.renderMonthlyList(grid);
        } else {
            this.renderWeeklyGrid(grid, y, m);
        }
    }

    /** Affichage calendrier semaine pour weekly/biweekly */
    renderWeeklyGrid(grid, year, month) {
        const monthOccs = this.getMonthOccurrences();
        // Map pour accéder aux données d'occurrence (dont isCancelled)
        const occMap = new Map(
            monthOccs.map(o => [o.occurrenceDate, o])
        );

        const daysInMonth = new Date(year, month + 1, 0)
            .getDate();
        let firstDay = new Date(year, month, 1).getDay();
        firstDay = (firstDay + 6) % 7;

        const dayHeaders = [
            t("day_1"), t("day_2"), t("day_3"),
            t("day_4"), t("day_5"), t("day_6"),
            t("day_0")
        ];

        let html = `<table class="table table-bordered
            participation-calendar">
            <thead><tr>`;
        dayHeaders.forEach(d => {
            html += `<th class="text-center">${d}</th>`;
        });
        html += `</tr></thead><tbody>`;

        let dayNum = 1;
        let started = false;

        for (let row = 0; row < 6; row++) {
            if (dayNum > daysInMonth) break;
            html += '<tr>';
            for (let col = 0; col < 7; col++) {
                if (!started && col < firstDay) {
                    html += '<td></td>';
                    continue;
                }
                started = true;
                if (dayNum > daysInMonth) {
                    html += '<td></td>';
                    continue;
                }

                const dateStr =
                    `${year}-${String(month + 1)
                        .padStart(2, '0')}`
                    + `-${String(dayNum)
                        .padStart(2, '0')}`;
                const occData = occMap.get(dateStr);
                const isOcc = !!occData;
                const isCancelled =
                    occData?.isCancelled || false;
                const response =
                    this.localResponses[dateStr] || null;

                if (isOcc) {
                    // Bouton annuler/rétablir (admin)
                    const cancelBtn = !this.isMember
                        ? `<button class="btn-cancel-occ
                            ${isCancelled
                                ? 'restore' : 'cancel'}"
                            data-cancel-date="${dateStr}"
                            title="${t(
                                'cancel_occurrence'
                            )}">
                            <i class="bi bi-${isCancelled
                                ? 'arrow-counterclockwise'
                                : 'x-circle'}"></i>
                        </button>` : '';

                    if (isCancelled) {
                        html += `<td class="text-center
                            participation-cell
                            cell-cancelled"
                            data-date="${dateStr}">
                            <div class="day-number">
                                ${dayNum}</div>
                            <div class="day-badge
                                text-muted">
                                <small>${t(
                                    "occurrence_cancelled"
                                )}</small>
                            </div>
                            ${cancelBtn}
                        </td>`;
                    } else {
                        const cls =
                            this.getResponseCellClass(
                                response
                            );
                        html += `<td class="text-center
                            participation-cell ${cls}"
                            data-date="${dateStr}"
                            role="button">
                            <div class="day-number">
                                ${dayNum}</div>
                            <div class="day-badge">
                                ${this.getResponseIcon(
                                    response
                                )}
                            </div>
                            ${cancelBtn}
                        </td>`;
                    }
                } else {
                    html += `<td class="text-center
                        text-muted
                        participation-cell-empty">
                        <div class="day-number">
                            ${dayNum}</div>
                    </td>`;
                }
                dayNum++;
            }
            html += '</tr>';
        }

        html += '</tbody></table>';
        html += this.renderLegend();

        grid.innerHTML = html;
        this.bindCellClicks();
        this.bindCancelButtons();
    }

    /** Affichage liste pour récurrence mensuelle */
    renderMonthlyList(grid) {
        // Afficher toutes les occurrences futures (pas filtrées par mois)
        const today = window.RecurrenceUtils
            ? window.RecurrenceUtils.formatDateStr(new Date())
            : new Date().toISOString().slice(0, 10);

        const allOccs = this.occurrences.filter(
            o => o.occurrenceDate >= today
        );

        if (allOccs.length === 0) {
            grid.innerHTML = `<p class="text-muted">
                ${t("no_upcoming_dates")}</p>`;
            return;
        }

        // Masquer la navigation mois pour le mode liste
        document.getElementById('btn-prev-month')
            .classList.add('d-none');
        document.getElementById('btn-next-month')
            .classList.add('d-none');
        document.getElementById('month-label')
            .textContent = t("all_dates");

        let html = '<div class="list-group">';
        allOccs.forEach(occ => {
            const dateObj = new Date(occ.occurrenceDate);
            const dateLabel = dateObj.toLocaleDateString(
                i18n.lang === 'en' ? 'en-US' : 'fr-FR',
                {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }
            );
            const isCancelled = occ.isCancelled || false;
            const response =
                this.localResponses[occ.occurrenceDate]
                || null;

            // Bouton annuler/rétablir (admin)
            const cancelBtn = !this.isMember
                ? `<button class="btn btn-sm ms-2
                    ${isCancelled
                        ? 'btn-outline-success'
                        : 'btn-outline-danger'}
                    btn-cancel-occ-list"
                    data-cancel-date="${occ.occurrenceDate}"
                    title="${t('cancel_occurrence')}">
                    <i class="bi bi-${isCancelled
                        ? 'arrow-counterclockwise'
                        : 'x-circle'}"></i>
                </button>` : '';

            if (isCancelled) {
                html += `
                    <div class="list-group-item
                        d-flex justify-content-between
                        align-items-center
                        participation-list-item
                        cell-cancelled"
                        data-date="${occ.occurrenceDate}">
                        <span class="
                            occurrence-cancelled">
                            ${dateLabel}</span>
                        <div class="d-flex
                            align-items-center">
                            <span class="badge
                                bg-danger">
                                ${t(
                                    "occurrence_cancelled"
                                )}</span>
                            ${cancelBtn}
                        </div>
                    </div>`;
            } else {
                const cls =
                    this.getResponseCellClass(response);
                html += `
                    <div class="list-group-item
                        d-flex justify-content-between
                        align-items-center
                        participation-list-item ${cls}"
                        data-date="${occ.occurrenceDate}"
                        role="button">
                        <span>${dateLabel}</span>
                        <div class="d-flex
                            align-items-center">
                            <span class="badge
                                ${this
                                    .getResponseBadgeClass(
                                        response
                                    )}">
                                ${this.getResponseLabel(
                                    response
                                )}
                            </span>
                            ${cancelBtn}
                        </div>
                    </div>`;
            }
        });
        html += '</div>';

        html += this.renderLegend();

        grid.innerHTML = html;
        this.bindCellClicks();
        this.bindCancelButtons();
    }

    renderLegend() {
        return `
            <div class="mt-3 d-flex flex-wrap gap-3
                participation-legend">
                <small>
                    <span class="badge bg-success">
                        ${t("yes")}</span>
                    ${t("yes")}
                </small>
                <small>
                    <span class="badge bg-danger">
                        ${t("no")}</span>
                    ${t("no")}
                </small>
                <small>
                    <span class="badge bg-warning
                        text-dark">
                        ${t("maybe")}</span>
                    ${t("maybe")}
                </small>
                <small>
                    <span class="badge bg-secondary">
                        —</span>
                    ${t("no_response")}
                </small>
            </div>`;
    }

    getResponseCellClass(response) {
        const map = {
            yes: 'cell-yes',
            no: 'cell-no',
            maybe: 'cell-maybe'
        };
        return map[response] || 'cell-none';
    }

    getResponseBadgeClass(response) {
        const map = {
            yes: 'bg-success',
            no: 'bg-danger',
            maybe: 'bg-warning text-dark'
        };
        return map[response] || 'bg-secondary';
    }

    getResponseIcon(response) {
        const map = {
            yes: '✓',
            no: '✗',
            maybe: '?'
        };
        return map[response] || '—';
    }

    getResponseLabel(response) {
        if (!response) return t("no_response");
        return t(response);
    }

    bindCellClicks() {
        // Cellules du calendrier (exclure les annulées)
        document.querySelectorAll(
            '.participation-cell[data-date]'
            + ':not(.cell-cancelled)'
        ).forEach(cell => {
            cell.addEventListener('click', (e) => {
                // Ne pas déclencher si clic sur bouton annuler
                if (e.target.closest('.btn-cancel-occ'))
                    return;
                this.toggleResponse(cell.dataset.date);
            });
        });
        // Items de la liste (exclure les annulés)
        document.querySelectorAll(
            '.participation-list-item[data-date]'
            + ':not(.cell-cancelled)'
        ).forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest(
                    '.btn-cancel-occ-list'
                )) return;
                this.toggleResponse(item.dataset.date);
            });
        });
    }

    /** Attache les boutons annuler/rétablir (admin) */
    bindCancelButtons() {
        // Grille calendrier
        document.querySelectorAll(
            '.btn-cancel-occ[data-cancel-date]'
        ).forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCancelDate(
                    btn.dataset.cancelDate
                );
            });
        });
        // Liste mensuelle
        document.querySelectorAll(
            '.btn-cancel-occ-list[data-cancel-date]'
        ).forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleCancelDate(
                    btn.dataset.cancelDate
                );
            });
        });
    }

    /** Annule ou rétablit une occurrence */
    async toggleCancelDate(date) {
        try {
            const cancelled =
                this.event.cancelledDates || [];
            if (cancelled.includes(date)) {
                this.event.cancelledDates =
                    cancelled.filter(d => d !== date);
            } else {
                this.event.cancelledDates =
                    [...cancelled, date];
            }
            await api.update(
                this.orgId, 'events', this.eventId,
                {
                    cancelledDates:
                        this.event.cancelledDates
                }
            );
            // Regénérer les occurrences avec le nouvel état
            this.occurrences =
                window.RecurrenceUtils
                    ? window.RecurrenceUtils
                        .generateOccurrences({
                            event: this.event,
                            maxOccurrences: 200
                        })
                    : [];
            if (this.isMember) {
                this.occurrences = this.occurrences
                    .filter(o => !o.isCancelled);
            }
            this.renderMonth();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    /** Applique le pinceau actif à une date */
    toggleResponse(date) {
        if (!this.selectedMemberId) {
            alert(t("select_member"));
            return;
        }
        const current = this.localResponses[date];
        // Si déjà la même réponse, on efface
        if (current === this.activeBrush) {
            this.localResponses[date] = null;
        } else {
            this.localResponses[date] = this.activeBrush;
        }
        this.dirty = true;
        document.getElementById('btn-save-schedule')
            .disabled = false;
        this.renderMonth();
    }

    /** Applique le pinceau à toutes les dates du mois affiché */
    applyToAll() {
        if (!this.selectedMemberId) {
            alert(t("select_member"));
            return;
        }
        const recType = this.event.recurrence;
        let dates;
        if (recType === 'monthly') {
            // Mode liste : dates futures non annulées
            const today = window.RecurrenceUtils
                ? window.RecurrenceUtils.formatDateStr(
                    new Date()
                ) : new Date().toISOString().slice(0, 10);
            dates = this.occurrences
                .filter(o => o.occurrenceDate >= today
                    && !o.isCancelled)
                .map(o => o.occurrenceDate);
        } else {
            // Mode calendrier : dates du mois non annulées
            dates = this.getMonthOccurrences()
                .filter(o => !o.isCancelled)
                .map(o => o.occurrenceDate);
        }
        dates.forEach(d => {
            this.localResponses[d] = this.activeBrush;
        });
        this.dirty = true;
        document.getElementById('btn-save-schedule')
            .disabled = false;
        this.renderMonth();
    }

    /** Sauvegarde bulk via l'API */
    async save() {
        if (!this.selectedMemberId) {
            alert(t("select_member"));
            return;
        }
        const entries = Object.entries(this.localResponses)
            .filter(([, response]) => response !== null)
            .map(([occurrenceDate, response]) => ({
                occurrenceDate, response
            }));

        // Dates sans réponse (effacées) → on les envoie aussi pour suppression
        const nullEntries = Object.entries(
            this.localResponses
        )
            .filter(([, response]) => response === null)
            .map(([occurrenceDate]) => ({
                occurrenceDate, response: null
            }));

        const allEntries = [...entries, ...nullEntries];

        try {
            await api.request(
                `/api/${this.orgId}/participations/bulk`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        eventId: this.eventId,
                        memberId: this.selectedMemberId,
                        entries: allEntries
                    })
                }
            );
            this.dirty = false;
            document.getElementById('btn-save-schedule')
                .disabled = true;
            // Recharger les participations pour être à jour
            this.participations = await api.get(
                this.orgId, 'participations'
            );
            this.loadLocalResponses();
            this.renderMonth();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }

    updateBrushButtons() {
        document.querySelectorAll('.brush-btn')
            .forEach(btn => {
                const brush = btn.dataset.brush;
                btn.classList.remove(
                    'active',
                    'btn-success', 'btn-outline-success',
                    'btn-danger', 'btn-outline-danger',
                    'btn-warning', 'btn-outline-warning'
                );
                const colorMap = {
                    yes: 'success',
                    no: 'danger',
                    maybe: 'warning'
                };
                const color = colorMap[brush];
                if (brush === this.activeBrush) {
                    btn.classList.add(
                        'active', `btn-${color}`
                    );
                } else {
                    btn.classList.add(
                        `btn-outline-${color}`
                    );
                }
            });
    }

    async init() {
        await this.loadData();

        // Sélecteur de membre (admin)
        const memberSelect = document.getElementById(
            'schedule-member-select'
        );
        if (memberSelect) {
            memberSelect.addEventListener(
                'change', (e) => {
                    this.selectedMemberId =
                        e.target.value || null;
                    if (this.selectedMemberId) {
                        this.loadLocalResponses();
                        document.getElementById(
                            'schedule-content'
                        ).classList.remove('d-none');
                        this.renderMonth();
                    } else {
                        document.getElementById(
                            'schedule-content'
                        ).classList.add('d-none');
                    }
                }
            );
        }

        // Boutons pinceau
        document.querySelectorAll('.brush-btn')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    this.activeBrush = btn.dataset.brush;
                    this.updateBrushButtons();
                });
            });

        // Navigation mois
        document.getElementById('btn-prev-month')
            .addEventListener('click', () => {
                this.currentMonth.setMonth(
                    this.currentMonth.getMonth() - 1
                );
                this.renderMonth();
            });
        document.getElementById('btn-next-month')
            .addEventListener('click', () => {
                this.currentMonth.setMonth(
                    this.currentMonth.getMonth() + 1
                );
                this.renderMonth();
            });

        // Appliquer à tout
        document.getElementById('btn-apply-all')
            .addEventListener('click', () => {
                this.applyToAll();
            });

        // Sauvegarder
        document.getElementById('btn-save-schedule')
            .addEventListener('click', () => {
                this.save();
            });
    }
}
