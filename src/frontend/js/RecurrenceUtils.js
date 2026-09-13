class RecurrenceUtils {
    static getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    static getNthWeekday(year, month, dayOfWeek, n) {
        let count = 0;
        for (let d = 1; d <= 31; d++) {
            const date = new Date(year, month, d);
            if (date.getMonth() !== month) break;
            if (date.getDay() === dayOfWeek) {
                count++;
                if (count === n) return date;
            }
        }
        return null;
    }

    static formatDateStr(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /** Inclusive action window, in calendar days (not 24-hour durations). */
    static actionWindow(action, occurrenceDate) {
        const start = new Date(`${occurrenceDate}T12:00:00`);
        const end = new Date(start);
        start.setDate(start.getDate() - (action.windowDays || 0));
        end.setDate(end.getDate() + (action.windowAfterDays || 0));
        return { start: this.formatDateStr(start), end: this.formatDateStr(end) };
    }

    static isInActionWindow(action, occurrenceDate, date) {
        const { start, end } = this.actionWindow(action, occurrenceDate);
        return date >= start && date <= end;
    }

    /** One actionable instance, or the next future one for the settings list. */
    static nextActionOccurrence({ action, todayStr, completedThrough = null, excludeCancelled = true, includeExpired = false }) {
        let from = completedThrough || action.date || todayStr;
        const occurrences = [];
        // generateOccurrences has a one-year horizon; walk old schedules too.
        while (true) {
            const batch = this.generateOccurrences({ event: action,
                startDate: new Date(`${from}T12:00:00`), maxOccurrences: Infinity });
            occurrences.push(...batch);
            const last = batch.at(-1)?.occurrenceDate;
            if (!last || last >= todayStr || !action.recurrence
                || action.recurrence === 'none' || last < from) break;
            const next = new Date(`${last}T12:00:00`);
            next.setDate(next.getDate() + 1);
            from = this.formatDateStr(next);
        }
        const available = occurrences.filter(o => (!excludeCancelled || !o.isCancelled)
            && (!completedThrough || o.occurrenceDate > completedThrough));
        const upcoming = available.find(o => o.occurrenceDate >= todayStr);
        const previous = available.filter(o => o.occurrenceDate < todayStr).at(-1);
        if (upcoming && this.isInActionWindow(action, upcoming.occurrenceDate, todayStr)) return upcoming;
        if (previous && this.isInActionWindow(action, previous.occurrenceDate, todayStr)) return previous;
        return upcoming || (includeExpired ? previous : null) || null;
    }

    static generateOccurrences({ event, maxOccurrences = 1000, startDate = new Date() }) {
        if (!event || !event.date) return [];
        
        const baseDate = new Date(`${event.date}T12:00:00`);
        // Horizon max : 1 an dans le futur
        const maxHorizon = new Date(startDate);
        maxHorizon.setFullYear(maxHorizon.getFullYear() + 1);
        const maxHorizonStr = RecurrenceUtils.formatDateStr(maxHorizon);
        const endDateStr = event.recurrenceEndDate || null;
        const limitDateStr = endDateStr
            ? (endDateStr < maxHorizonStr ? endDateStr : maxHorizonStr)
            : maxHorizonStr;
        
        const targetStartDate = startDate > baseDate ? startDate : baseDate;
        const targetStart = new Date(targetStartDate);
        targetStart.setHours(12, 0, 0, 0);

        const occurrences = [];
        let count = 0;

        const isRecurrent = event.recurrence && event.recurrence !== 'none';
        const recType = event.recurrence;
        let interval = parseInt(event.recurrenceInterval) || 1;
        if (recType === 'biweekly') interval = 2;
        
        const addOccurrence = (dateStr) => {
            if (limitDateStr && dateStr > limitDateStr) return false;
            const isCancelled = event.cancelledDates && event.cancelledDates.includes(dateStr);
            occurrences.push({
                ...event,
                originalEventId: event.id,
                occurrenceDate: dateStr,
                isCancelled: isCancelled
            });
            count++;
            return count < maxOccurrences;
        };

        if (!isRecurrent) {
            addOccurrence(event.date);
            return occurrences;
        }

        if (recType === 'daily') {
            let currentDate = new Date(baseDate);
            let daysElapsed = 0;

            if (targetStart > baseDate) {
                const diffTime = targetStart.getTime() - currentDate.getTime();
                let diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
                diffDays = Math.max(0, diffDays - 1);
                diffDays = diffDays - (diffDays % interval);

                if (diffDays > 0) {
                    currentDate.setDate(currentDate.getDate() + diffDays);
                    daysElapsed += diffDays;
                }
            }

            let keepGoing = true;
            let maxIterations = 5000;

            while (keepGoing && maxIterations > 0) {
                maxIterations--;

                if (daysElapsed % interval !== 0) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    daysElapsed++;
                    continue;
                }

                const dateStr = RecurrenceUtils.formatDateStr(currentDate);
                if (dateStr >= event.date) {
                    keepGoing = addOccurrence(dateStr);
                }

                currentDate.setDate(currentDate.getDate() + 1);
                daysElapsed++;
            }
        } else if (recType === 'weekly' || recType === 'biweekly') {
            const recDays = event.recurrenceDays && event.recurrenceDays.length > 0 ? event.recurrenceDays : [baseDate.getDay()];
            let currentDate = new Date(baseDate);
            currentDate.setDate(currentDate.getDate() - currentDate.getDay());
            
            let weeksElapsed = 0;

            if (targetStart > baseDate) {
                const diffTime = targetStart.getTime() - currentDate.getTime();
                let diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
                diffWeeks = Math.max(0, diffWeeks - 1);
                
                diffWeeks = diffWeeks - (diffWeeks % interval);
                
                if (diffWeeks > 0) {
                    currentDate.setDate(currentDate.getDate() + (diffWeeks * 7));
                    weeksElapsed += diffWeeks;
                }
            }
            
            let keepGoing = true;
            let maxIterations = 2000;
            
            while (keepGoing && maxIterations > 0) {
                maxIterations--;
                
                if (weeksElapsed % interval !== 0) {
                    currentDate.setDate(currentDate.getDate() + 7);
                    weeksElapsed++;
                    continue;
                }

                for (let i = 0; i < 7; i++) {
                    const dayDate = new Date(currentDate);
                    dayDate.setDate(currentDate.getDate() + i);
                    
                    if (recDays.includes(dayDate.getDay())) {
                        const dateStr = RecurrenceUtils.formatDateStr(dayDate);
                        if (dateStr >= event.date) {
                            keepGoing = addOccurrence(dateStr);
                            if (!keepGoing) break;
                        }
                    }
                }
                currentDate.setDate(currentDate.getDate() + 7);
                weeksElapsed++;
            }
        } else if (recType === 'monthly') {
            const monthlyType = event.monthlyType || 'date';
            let currentYear = baseDate.getFullYear();
            let currentMonth = baseDate.getMonth();
            const baseDayOfWeek = baseDate.getDay();
            const baseNth = Math.ceil(baseDate.getDate() / 7);

            let monthsElapsed = 0;

            if (targetStart > baseDate) {
                let yDiff = targetStart.getFullYear() - baseDate.getFullYear();
                let mDiff = targetStart.getMonth() - baseDate.getMonth();
                monthsElapsed = yDiff * 12 + mDiff;
                monthsElapsed = Math.max(0, monthsElapsed - 1);
                
                monthsElapsed = monthsElapsed - (monthsElapsed % interval);
                
                currentYear = baseDate.getFullYear() + Math.floor(monthsElapsed / 12);
                currentMonth = baseDate.getMonth() + (monthsElapsed % 12);
                if (currentMonth > 11) {
                    currentMonth -= 12;
                    currentYear++;
                }
            }

            let keepGoing = true;
            let maxIterations = 1000;

            while (keepGoing && maxIterations > 0) {
                maxIterations--;
                
                if (monthsElapsed % interval !== 0) {
                    currentMonth++;
                    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
                    monthsElapsed++;
                    continue;
                }

                let targetDate = null;

                if (monthlyType === 'date') {
                    const daysInMonth = RecurrenceUtils.getDaysInMonth(currentYear, currentMonth);
                    const d = Math.min(baseDate.getDate(), daysInMonth);
                    targetDate = new Date(currentYear, currentMonth, d, 12, 0, 0);
                } else if (monthlyType === 'first_day') {
                    targetDate = new Date(currentYear, currentMonth, 1, 12, 0, 0);
                } else if (monthlyType === 'last_day') {
                    const daysInMonth = RecurrenceUtils.getDaysInMonth(currentYear, currentMonth);
                    targetDate = new Date(currentYear, currentMonth, daysInMonth, 12, 0, 0);
                } else if (monthlyType === 'nth_weekday') {
                    const d = RecurrenceUtils.getNthWeekday(currentYear, currentMonth, baseDayOfWeek, baseNth);
                    if (d) targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
                }

                if (targetDate) {
                    const dateStr = RecurrenceUtils.formatDateStr(targetDate);
                    if (dateStr >= event.date) {
                        keepGoing = addOccurrence(dateStr);
                    }
                }

                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
                monthsElapsed++;
            }
        }

        return occurrences;
    }
}

if (typeof window !== 'undefined') window.RecurrenceUtils = RecurrenceUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = RecurrenceUtils;
