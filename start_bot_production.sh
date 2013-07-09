#!/bin/bash

BOT_ENV=production forever start -a -l cleverbot_production_forever.log -o cleverbot_production_out.log -e cleverbot_production_err.log --minUptime 10000 --spinSleepTime 10000 bot.js