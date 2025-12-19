function wait(minutes) {
    return new Promise(resolve => setTimeout(resolve, minutes * 60 * 1000));
}

async function run(waitMinutes) {
    console.error("Waiting for "+waitMinutes+" minutes...");
    await wait(waitMinutes);
}

const ical = require('/var/lib/wilma/node-ical');
const moment = require('moment');

const data = ical.parseFile('/tmp/niiles.ics');
const now = moment().utc();
const rangeEnd = moment().add(10, 'hours');

let firstStart = null;

    for (const k in data) {
        const event = data[k];
        if (event.type !== 'VEVENT') continue;

        const startDate = moment(event.start).utc();
        // Handle non-recurring events
        if (!event.rrule) {
            if (startDate.isAfter(now) && (!firstStart || startDate.isBefore(firstStart))) {
                firstStart = startDate;
            }
        } else {
            // Handle recurring events
            let dates = event.rrule.between(now.toDate(), rangeEnd.toDate(), true);
            if (event.recurrences) {
                for (const r in event.recurrences) {
                    const recDate = moment(new Date(r));
                    if (recDate.isBetween(now, rangeEnd)) dates.push(new Date(r));
                }
            }
            for (const date of dates) {
                let curStart = moment(date);
                if (event.recurrences && event.recurrences[date.toISOString().substring(0, 10)]) {
                    curStart = moment(event.recurrences[date.toISOString().substring(0, 10)].start);
                }
                if (curStart.isAfter(now) && (!firstStart || curStart.isBefore(firstStart))) {
                    firstStart = curStart;
                }
            }
        }
    }

if (firstStart) {
    console.error(firstStart.format())
    const diffMinutes = firstStart.diff(now, 'minutes');
    run(diffMinutes-120-30)
    const msg = {};
    msg.payload = diffMinutes;
    console.log(JSON.stringify(msg));
} else {
    console.error("no calendar events found")
}
