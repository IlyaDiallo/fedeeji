/**
 * Fonctions de rendu HTML pour le programme (liste, calendrier, historique).
 * Toutes les méthodes sont statiques et pures (pas d'effets de bord).
 */
class ProgrammeRenderers {

    /**
     * Rendu HTML d'un événement dans la vue liste.
     */
    static renderEventItem({ item, locale, collectiveId }) {
        const event = item.data;
        const occ = item.occurrence;
        const dateStr = new Date(occ.occurrenceDate).toLocaleDateString(locale, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const isAllDay = event.allDay !== undefined ? event.allDay : !event.time;
        const timeStr = isAllDay ? '' : ` ⏰ ${event.time || ''}`;
        const isRecurrent = event.recurrence && event.recurrence !== 'none';
        const cancelledLabel = occ.isCancelled
            ? ` <span class="badge bg-danger ms-1">${t("occurrence_cancelled")}</span>`
            : '';

        const inscLink = isRecurrent
            ? `<a href="/${collectiveId}/events/${event.id}/inscription-schedule"
                class="btn btn-sm btn-outline-primary" data-link
                title="${t("plan_inscriptions")}">
                <i class="bi bi-calendar-check"></i></a>`
            : `<a href="/${collectiveId}/inscriptions?eventId=${event.id}&date=${occ.occurrenceDate}"
                class="btn btn-sm btn-outline-success" data-link
                title="${t("inscriptions")}">
                <i class="bi bi-calendar-plus"></i></a>`;

        return `
            <div class="d-flex w-100 flex-column flex-sm-row justify-content-between
                align-items-start align-items-sm-center gap-2">
                <div class="ms-2 me-auto">
                    <div class="fw-bold text-primary d-flex align-items-center">
                        <span class="badge bg-info me-2">📅 ${t("event")}</span>
                        ${event.name}${cancelledLabel}
                    </div>
                    <div class="text-muted mt-1">
                        <small>🗓️ ${dateStr}${timeStr}</small>
                    </div>
                    ${event.description
                        ? `<div class="mt-1 text-dark small">${event.description}</div>`
                        : ''}
                </div>
                <div class="d-flex align-items-center flex-wrap justify-content-end
                    gap-1 mt-2 mt-sm-0 align-self-end align-self-sm-auto">
                    ${inscLink}
                </div>
            </div>`;
    }

    /**
     * Rendu HTML d'une action dans la vue liste.
     */
    static renderActionItem({ item, locale, isMember, getMemberName }) {
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
        const cancelledLabel = occ.isCancelled
            ? ` <span class="badge bg-danger ms-1">${t("occurrence_cancelled")}</span>`
            : '';

        let statusBadge;
        if (status === 'overdue') {
            statusBadge = `<span class="badge bg-danger ms-2">🔴 ${t("overdue")}</span>`;
        } else if (status === 'due') {
            statusBadge = `<span class="badge bg-warning text-dark ms-2">`
                + `🟡 ${t("due_now")}</span>`;
        } else {
            statusBadge = `<span class="badge bg-success ms-2">`
                + `🟢 ${t("status_ok")}</span>`;
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
            ? `✅ ${t("last_done")} ${lastLog.date} ${getMemberName(lastLog.memberId)}`
            : `⚠️ ${t("never_done")}`;

        const notesStr = targetNotes.length > 0
            ? `<span class="badge bg-info text-dark ms-2">`
                + `<i class="bi bi-card-text"></i> ${targetNotes.length} ${t("note")}</span>`
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
            doneBtn = `<button class="btn btn-sm btn-outline-success btn-edit-log"
                data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-check-circle-fill"></i></button>`;
        } else if (canDo) {
            doneBtn = `<button class="btn btn-sm btn-success btn-mark-done"
                data-id="${action.id}" title="${t("mark_done")}">
                ${nextStateName}</button>`;
        } else {
            doneBtn = `<button class="btn btn-sm btn-outline-secondary btn-edit-future"
                data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-pencil-square"></i></button>`;
        }

        const noteBtn = canDo
            ? `<button class="btn btn-sm btn-outline-info btn-add-note"
                data-id="${action.id}" title="${t("add_note")}">📝</button>`
            : '';

        const adminBtns = isMember ? '' : `
            <button class="btn btn-sm btn-outline-primary btn-edit-action"
                data-id="${action.id}" title="${t("edit")}">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger btn-delete-action"
                data-id="${action.id}" title="${t("delete")}">
                <i class="bi bi-trash"></i>
            </button>`;

        let recurrenceStr = '';
        if (action.recurrence && action.recurrence !== 'none') {
            const interval = action.recurrenceInterval || 1;
            if (interval === 1) {
                const everyMap = {
                    'daily': 'every_day', 'weekly': 'every_week', 'monthly': 'every_month'
                };
                recurrenceStr = `🔄 ${t(everyMap[action.recurrence] || 'every_day')}`
                    + ` &nbsp;|&nbsp; `;
            } else {
                const unitMap = {
                    'daily': 'days', 'weekly': 'weeks', 'monthly': 'months_unit'
                };
                const everyKey = action.recurrence === 'weekly' ? 'every_fem' : 'every';
                recurrenceStr = `🔄 ${t(everyKey)} ${interval} `
                    + `${t(unitMap[action.recurrence] || 'days', interval).toLowerCase()}`
                    + ` &nbsp;|&nbsp; `;
            }
        }

        return `
            <div class="d-flex w-100 flex-column flex-sm-row justify-content-between
                align-items-start align-items-sm-center gap-2">
                <div class="ms-2 me-auto">
                    <div class="fw-bold d-flex align-items-center flex-wrap">
                        <span class="badge bg-warning text-dark me-2">
                            🔧 ${t("action_label")}</span>
                        ${action.name}${cancelledLabel}
                        ${statusBadge}
                        ${stateBadge}
                        ${notesStr}
                    </div>
                    <div class="text-muted mt-1">
                        <small>
                            ${recurrenceStr}
                            📅 ${t("deadline")} ${dateStr}${timeStr}
                            ${action.windowDays > 0
                                ? `&nbsp;|&nbsp; 🪟 ${t("window")} `
                                    + `${action.windowDays}${t("days_short")}`
                                : ''}
                        </small>
                    </div>
                    ${action.description
                        ? `<div class="mt-1 text-dark small">${action.description}</div>`
                        : ''}
                    ${targetNotes.length > 0 ? `<div class="mt-1 small text-info">
                        ${targetNotes.map(n =>
                            `<div><i class="bi bi-card-text"></i> ${n.notes}</div>`
                        ).join('')}
                    </div>` : ''}
                    <div class="mt-1 small ${lastLog ? 'text-success' : 'text-muted'}">
                        ${lastLogStr}
                    </div>
                </div>
                <div class="d-flex align-items-center flex-wrap justify-content-end
                    gap-1 mt-2 mt-sm-0 align-self-end align-self-sm-auto">
                    ${doneBtn}
                    ${noteBtn}
                    <button class="btn btn-sm btn-outline-secondary btn-history"
                        data-id="${action.id}" title="${t("history")}">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    ${adminBtns}
                </div>
            </div>`;
    }

    /**
     * Rendu de la grille calendrier complète (semaine ou mois).
     */
    static renderCalendarGrid({ items, startCal, endCal, viewMode, month }) {
        // Construire la map date -> items
        const map = {};
        items.forEach(it => {
            const key = it.date;
            if (!map[key]) map[key] = [];
            map[key].push(it);
        });

        const dayHeaders = [
            t("day_1"), t("day_2"), t("day_3"),
            t("day_4"), t("day_5"), t("day_6"),
            t("day_0")
        ];

        const todayStr = RecurrenceUtils.formatDateStr(new Date());
        const cellHeight = viewMode === 'month' ? '120px' : '300px';
        const scrollHeight = viewMode === 'month' ? '90px' : '270px';

        let html = `<table class="table table-bordered table-fixed calendar-grid">
            <thead>
                <tr>${dayHeaders.map(d =>
                    `<th class="text-center w-14">${d}</th>`
                ).join('')}</tr>
            </thead>
            <tbody>`;

        let curr = new Date(startCal);
        while (curr <= endCal) {
            html += `<tr>`;
            for (let i = 0; i < 7; i++) {
                const dateStr = RecurrenceUtils.formatDateStr(curr);
                const dayNum = curr.getDate();
                const isToday = dateStr === todayStr;
                const isCurrentMonth = curr.getMonth() === month;

                let cellClass = "calendar-cell p-1";
                if (!isCurrentMonth && viewMode === 'month') {
                    cellClass += " bg-light text-muted";
                }
                if (isToday) cellClass += " bg-warning-subtle";

                html += `<td class="${cellClass}" `
                    + `style="vertical-align: top; height: ${cellHeight};">
                    <div class="d-flex justify-content-start mb-1 align-items-baseline">
                        <span class="calendar-cell-day-label small text-muted me-1 fw-bold">`
                            + `${dayHeaders[i]}</span>
                        <span class="fw-bold ${isToday ? 'text-danger' : ''}">`
                            + `${dayNum}</span>
                    </div>
                    <div class="calendar-items overflow-auto" `
                        + `style="max-height: ${scrollHeight};">`;

                const dayItems = (map[dateStr] || []).sort((a, b) => {
                    const ta = a.data.time || '';
                    const tb = b.data.time || '';
                    return ta.localeCompare(tb);
                });

                dayItems.forEach(it => {
                    if (it.type === 'event') {
                        const isCancelled = it.occurrence.isCancelled;
                        html += `<div class="p-1 mb-1 rounded small border bg-info-subtle`
                            + `${isCancelled
                                ? ' text-decoration-line-through text-muted' : ''}"
                            title="${it.data.name}">
                            <strong>${it.data.time || ''}</strong> ${it.data.name}
                        </div>`;
                    } else {
                        html += ProgrammeRenderers.renderCalendarActionCell(it);
                    }
                });

                html += `</div></td>`;
                curr.setDate(curr.getDate() + 1);
            }
            html += `</tr>`;
        }

        html += `</tbody></table>`;
        return html;
    }

    /**
     * Rendu d'une cellule action dans le calendrier.
     */
    static renderCalendarActionCell(it) {
        const hasNotes = it.targetNotes && it.targetNotes.length > 0;
        const notesIcon = hasNotes
            ? `<i class="bi bi-card-text text-info ms-1" `
                + `title="${it.targetNotes.length} `
                + `${t("instructions").toLowerCase()}"></i>`
            : '';
        const isDone = it.isDone;
        const bgClass = isDone
            ? 'bg-success-subtle'
            : (it.currentState > 0 ? 'bg-info-subtle' : 'bg-warning-subtle');

        let stateIndicator = '';
        if (isDone) {
            stateIndicator = '<i class="bi bi-check-circle-fill text-success"></i> ';
        } else if (it.currentState > 0) {
            stateIndicator = '<i class="bi bi-arrow-right-circle text-info"></i> ';
        }

        return `<div class="p-1 mb-1 rounded small border ${bgClass} action-item-cal `
            + `d-flex justify-content-between align-items-center" `
            + `data-id="${it.data.id}" data-date="${it.date}" role="button" `
            + `title="${it.data.name}">
            <div>
                ${stateIndicator}
                <strong>${it.data.time || ''}</strong> ${it.data.name} ${notesIcon}
            </div>
            <button class="btn btn-sm btn-link `
                + `${isDone ? 'text-success' : 'text-info'} p-0 ms-1 btn-add-note-cal" `
                + `data-id="${it.data.id}" data-date="${it.date}" `
                + `title="${t("add_note")}">
                <i class="bi bi-pencil-square"></i>
            </button>
        </div>`;
    }

    /**
     * Rendu du contenu de la modal historique.
     */
    static renderHistoryBody({ logs, action, locale, getMemberName }) {
        if (logs.length === 0) {
            return `<p class="text-muted">${t("no_history")}</p>`;
        }

        return `
            <div class="list-group">
                ${logs.map(log => {
                    const dateStr = new Date(log.date + 'T12:00:00')
                        .toLocaleDateString(locale, {
                            weekday: 'long', year: 'numeric',
                            month: 'long', day: 'numeric'
                        });
                    const memberName = getMemberName(log.memberId);
                    const timeStr = log.time ? ` ⏰ ${log.time}` : '';
                    const durationStr = log.duration
                        ? ` ⏱️ ${log.duration} `
                            + `${t(log.durationUnit === 'hours'
                                ? 'hours' : 'minutes', log.duration).toLowerCase()}`
                        : '';

                    let typeBadgeStr = t("done") || "Fait";
                    let badgeClass = "bg-success";
                    if (log.type === 'note') {
                        typeBadgeStr = t("note");
                        badgeClass = "bg-info";
                    } else if (
                        action?.states?.length > 0
                        && log.state !== undefined
                    ) {
                        const maxState = action.states.length + 1;
                        if (log.state < maxState && log.state > 0) {
                            typeBadgeStr = action.states[log.state - 1];
                            badgeClass = "bg-secondary";
                        }
                    }

                    const typeBadge = `<span class="badge ${badgeClass}">`
                        + `${typeBadgeStr}</span>`;
                    return `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${dateStr}</strong>${timeStr}${durationStr}
                                ${typeBadge}
                            </div>
                            <small class="text-muted">${memberName}</small>
                        </div>
                        ${log.notes
                            ? `<div class="mt-1 text-dark small">${log.notes}</div>`
                            : ''}
                    </div>`;
                }).join('')}
            </div>`;
    }

    /**
     * Rendu des notes existantes dans la modal log.
     */
    static renderExistingNotes({ notes, getMemberName }) {
        return `
            <label class="form-label fw-bold">
                <i class="bi bi-card-text"></i> ${t("notes")}
            </label>
            <div class="list-group">
                ${notes.map(n => {
                    const memberName = getMemberName(n.memberId);
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

    /**
     * Injecte le CSS du calendrier si absent.
     */
    static ensureCalendarStyles() {
        if (document.getElementById('calendar-grid-style')) return;
        const style = document.createElement('style');
        style.id = 'calendar-grid-style';
        style.innerHTML = `
            .w-14 { width: 14.28%; }
            .calendar-grid { table-layout: fixed; width: 100%; }
            .action-item-cal:hover { filter: brightness(0.95); cursor: pointer; }
            .calendar-items::-webkit-scrollbar { width: 4px; }
            .calendar-items::-webkit-scrollbar-thumb {
                background: #ccc; border-radius: 2px;
            }
            @media (max-width: 767.98px) {
                .calendar-grid thead { display: none; }
                .calendar-grid, .calendar-grid tbody,
                .calendar-grid tr, .calendar-grid td {
                    display: block; width: 100%;
                }
                .calendar-grid td {
                    height: auto !important;
                    min-height: 100px;
                    border-bottom: 1px solid #dee2e6;
                }
                .calendar-items { max-height: none !important; }
                .calendar-cell-day-label {
                    display: inline-block !important;
                    text-transform: capitalize;
                }
            }
            @media (min-width: 768px) {
                .calendar-cell-day-label { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    }
}
