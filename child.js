const TIMEZONE = 'Europe/Helsinki';

function wait(minutes) {
    return new Promise(resolve => setTimeout(resolve, minutes * 60 * 1000));
}

async function run(waitMinutes) {
    console.error("Waiting for "+waitMinutes+" minutes...");
    await wait(waitMinutes);
}

const ical = require('node-ical');
const moment = require('moment-timezone');

// Read input from command line argument (passed by Node-RED exec node) or environment
const args = process.argv.slice(2);
let childName = args.join(' ').trim();

if (!childName) {
    childName = process.env.CHILD_NAME || '';
}

// If arg/env is valid JSON string, try parsing
if (childName.startsWith('{')) {
    try {
        const parsed = JSON.parse(childName);
        childName = parsed.child || parsed.name || parsed.payload || '';
    } catch (e) {
        // fallback if parsing fails
    }
}

// Clean childName (sanitize path and remove quotes if passed with surrounding quotes)
childName = childName.replace(/^["']|["']$/g, '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

const fs = require('fs');

if (!childName) {
    console.error(`Error: No child name passed in process arguments (received argv: ${JSON.stringify(process.argv.slice(2))}).`);
    console.error(`Please enable "Append msg.payload" in the Node-RED Exec node, or specify the child name in the command (e.g. node child.js niiles).`);
    process.exit(1);
}

const icsFile = `/tmp/${childName}.ics`;

if (!fs.existsSync(icsFile)) {
    console.error(`Error: ICS file non-existent: ${icsFile} (received childName: "${childName}", argv: ${JSON.stringify(process.argv.slice(2))})`);
    process.exit(1);
}

const data = ical.parseFile(icsFile);

const now = moment().tz(TIMEZONE);
const rangeEnd = moment().tz(TIMEZONE).endOf('day');

let firstStart = null;

for (const k in data) {
    const event = data[k];
    if (event.type !== 'VEVENT') continue;

    // Handle non-recurring events
    if (!event.rrule) {
        const startDate = moment(event.start).tz(TIMEZONE);
        if (startDate.isBetween(now, rangeEnd, null, '[)') && (!firstStart || startDate.isBefore(firstStart))) {
            firstStart = startDate;
        }
    } else {
        // Handle recurring events
        // Ensure start time of recurring events matches original event start time in local timezone
        const eventStartLocal = moment(event.start).tz(TIMEZONE);
        let dates = event.rrule.between(now.toDate(), rangeEnd.toDate(), true);
        if (event.recurrences) {
            for (const r in event.recurrences) {
                const recDate = moment(new Date(r)).tz(TIMEZONE);
                if (recDate.isBetween(now, rangeEnd, null, '[)')) dates.push(new Date(r));
            }
        }
        for (const date of dates) {
            let curStart = moment(date).tz(TIMEZONE).hours(eventStartLocal.hours()).minutes(eventStartLocal.minutes()).seconds(eventStartLocal.seconds());
            if (event.recurrences && event.recurrences[date.toISOString().substring(0, 10)]) {
                curStart = moment(event.recurrences[date.toISOString().substring(0, 10)].start).tz(TIMEZONE);
            }
            if (curStart.isBetween(now, rangeEnd, null, '[)') && (!firstStart || curStart.isBefore(firstStart))) {
                firstStart = curStart;
            }
        }
    }
}

if (firstStart) {
    console.error(firstStart.format());
    const diffMinutes = firstStart.diff(now, 'minutes');
    const waitMinutes = diffMinutes - 30;
    run(waitMinutes);
    const msg = {};
    msg.payload = diffMinutes;
    console.log(JSON.stringify(msg));
} else {
    console.error("no events for today");
}
