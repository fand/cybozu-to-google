# c2g - Move schedules from Cybozu to Google Calendar.

# Usage

First, create '~/.config/c2g' like this:

```json
{
  "cybozuUrl": "https://XXXXXXX.cybozu.com/",
  "username": "YOUR_USERNAME_OF_CYBOZU",
  "password": "YOUR_PASSWORD_OF_CYBOZU",
  "calendar": {
    "key": "GOOGLE_SERVICE_ACCOUND_PRIVATE_KEY",
    "serviceAcctId": "<GOOGLE_SERVICE_ACCOUNT_ID>.iam.gserviceaccount.com",
    "calendarId": {
      "primary": "<GOOGLE_CALENDAR_ID>@group.calendar.google.com"
    },
    "timezone": "UTF+09:00"
  }
}
```

After that, just hit `c2g` in your terminal.

# Options

```
  --config, -c    Pass config file. By default, c2g will read "~/.config/c2g".
  --quiet,  -q    Hide debug messages
  --show, -s      Show browser window
  --version, -v   Show version
  --help, -h      Show this help
```

# Examples

```
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
```


# License

MIT
