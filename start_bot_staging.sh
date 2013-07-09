#!/bin/bash

BOT_ENV=staging forever start -a -l cleverbot_staging_forever.log -o cleverbot_staging_out.log -e cleverbot_staging_err.log --minUptime 10000 --spinSleepTime 10000 bot.js