#!/usr/bin/env node
const meow = require('meow');
const puppeteer = require('puppeteer');
const CalendarAPI = require('node-google-calendar');
const fs = require('fs');
const os = require('os');
const path = require('path');
const moment = require('moment');
const parseCsv = require('csv-parse/lib/sync');
const rc = require('rc');

const cli = meow(`
  c2g - Move schedules from Cybozu to Google Calendar.

  Usage
    $ c2g

  Options
    --config, -c    Pass config file. By default, c2g will read "~/.config/c2g".
    --quiet,  -q    Hide debug messages
    --show, -s      Show browser window
    --version, -v   Show version
    --help, -h      Show this help

  Examples
    $ c2g -c ./config.json
      >>>> Fetching events from Cybozu Calendar...DONE
      >>>> Fetching events from Google Calendar...DONE
      >>>> Inserting new events...
        Inserted: [会議] B社MTG (2018/08/16)
        Inserted: [会議] 目標面談 (2018/10/31)
      >>>> Inserted 2 events.
      >>>> Deleting removed events...
      	Deleted: [外出] 幕張メッセ (2018/08/17)
      >>>> Deleted 1 events.
`, {
  flags: {
    config: {
      type: 'string',
      alias: 'c',
    },
    quiet: {
      type: 'boolean',
      alias: 'q',
    },
    show: {
      type: 'boolean',
      alias: 's',
    },
    help: {
      type: 'boolean',
      alias: 'h',
    },
    version: {
      type: 'boolean',
      alias: 'v',
    },
  }
});

// Detect CLI flags
if (cli.flags.help) {
  cli.showHelp();
}
if (cli.flags.version) {
  cli.showVersion();
}

const log = cli.flags.quiet ?
  () => {} :
  (str) => process.stdout.write(str);

let config = rc('c2g');
if (cli.flags.config) {
  try {
    config = JSON.parse(fs.readFileSync(cli.flags.config))
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
}

// Utils
const calendar = new CalendarAPI(config.calendar);

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const day = now.getDate();

const csvDir = path.join(os.tmpdir(), Date.now() + '');
const csvPath = path.join(csvDir, 'schedule.csv');

// Main
(async () => {
  const browser = await puppeteer.launch({ headless: !cli.flags.show });
  const page = await browser.newPage();
  await page._client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: csvDir,
  });

  log('>>>> Fetching events from Cybozu Calendar...');

  // Login
  await page.goto(config.cybozuUrl);
  await page.type('input[name="username"]', config.username)
  await page.type('input[name="password"]', config.password);
  await page.waitFor(1000);
  await page.click('form input[type=submit]');
  await page.waitForNavigation({ timeout: 30000, waitUntil: 'domcontentloaded' });

  // Go to CSV exporter page
  await page.goto(`${config.cybozuUrl}o/ag.cgi?page=PersonalScheduleExport`, { waitUntil: 'domcontentloaded' });

  // Input date
  await page.select('select[name="SetDate.Year"]', year + '');
  await page.select('select[name="SetDate.Month"]', month + '');
  await page.select('select[name="SetDate.Day"]', day + '');
  await page.select('select[name="EndDate.Year"]', (year + 1) + '');
  await page.select('select[name="EndDate.Month"]', month + '');
  await page.select('select[name="EndDate.Day"]', day + '');
  await page.select('select[name="oencoding"]', 'UTF-8');

  // Download CSV
  await page.click('.vr_hotButton');
  await page.waitFor(3000);
  await browser.close();

  // Parse CSV
  const newEvents = [];
  const csv = fs.readFileSync(csvPath, 'utf8');
  parseCsv(csv).forEach((line, i) => {
    if (i === 0) { return; }

    const start = moment(new Date(line[0] + ' ' + line[1]));
    const end = moment(new Date(line[2] + ' ' + line[3]));
    const summary = `[${line[4]}] ${line[5]} (${start.format("YYYY/MM/DD")})`;
    const location = line[8];

    newEvents.push({
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      location, summary,
    });
  });

  log('DONE\n');
  log('>>>> Fetching events from Google Calendar...');

  const oldEvents = await calendar.Events.list(config.calendar.calendarId.primary, {
    timeMin: moment().startOf('day').toISOString(),
    timeMax: moment().startOf('day').add(1, 'year').toISOString(),
    q: '',
    singleEvents: true,
    orderBy: 'startTime'
  });

  log('DONE\n');
  log(`>>>> Inserting new events...\n`);

  let insertedCount = 0;
  for (const event of newEvents) {
    if (oldEvents.findIndex(e => e.summary === event.summary) !== -1) {
      continue;
    }
    await calendar.Events.insert(config.calendar.calendarId.primary, event);

    log(`\tInserted: ${event.summary}\n`);
    insertedCount++;
  }

  log(`>>>> Inserted ${insertedCount} events.\n`);
  log(`>>>> Deleting removed events...\n`);

  let deletedCount = 0;
  for (const event of oldEvents) {
    if (newEvents.findIndex(e => e.summary === event.summary) !== -1) {
      continue;
    }
    await calendar.Events.delete(config.calendar.calendarId.primary, event.id, { sendNotifications: true });

    log(`\tDeleted: ${event.summary}\n`);
    deletedCount++;
  }
  log(`>>>> Deleted ${deletedCount} events.\n`);
})();
