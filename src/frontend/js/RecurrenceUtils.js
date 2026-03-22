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

    static generateOccurrences({ event, maxOccurrences = 50, startDate = new Date() }) {
        if (!event || !event.date) return [];
        
        const baseDate = new Date(`${event.date}T12:00:00`);
        const limitDateStr = event.recurrenceEndDate || null;
        
        const targetStartDate = startDate > baseDate ? startDate : baseDate;
        const targetStart = new Date(targetStartDate);
        targetStart.setHours(12, 0, 0, 0);

        const occurrences = [];
        let count = 0;

        const isRecurrent = event.recurrence && event.recurrence !== 'none';
        const recType = event.recurrence;
        
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

        if (recType === 'weekly' || recType === 'biweekly') {
            const recDays = event.recurrenceDays && event.recurrenceDays.length > 0 ? event.recurrenceDays : [baseDate.getDay()];
            let currentDate = new Date(baseDate);
            currentDate.setDate(currentDate.getDate() - currentDate.getDay());
            
            let weeksElapsed = 0;

            if (targetStart > baseDate) {
                const diffTime = targetStart.getTime() - currentDate.getTime();
                let diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
                diffWeeks = Math.max(0, diffWeeks - 1);
                
                if (recType === 'biweekly' && diffWeeks % 2 !== 0) {
                    diffWeeks--;
                }
                if (diffWeeks > 0) {
                    currentDate.setDate(currentDate.getDate() + (diffWeeks * 7));
                    weeksElapsed += diffWeeks;
                }
            }
            
            let keepGoing = true;
            let maxIterations = 1000;
            
            while (keepGoing && maxIterations > 0) {
                maxIterations--;
                
                if (recType === 'biweekly' && weeksElapsed % 2 !== 0) {
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

            if (targetStart > baseDate) {
                currentYear = targetStart.getFullYear();
                currentMonth = targetStart.getMonth();
                currentMonth--;
                if (currentMonth < 0) {
                    currentMonth = 11;
                    currentYear--;
                }
            }

            let keepGoing = true;
            let maxIterations = 1000;

            while (keepGoing && maxIterations > 0) {
                maxIterations--;
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
            }
        }

        return occurrences;
    }
}

window.RecurrenceUtils = RecurrenceUtils;
