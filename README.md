# Cleverbot - Steam chat bot

Simple Steam chat bot for people who are bored and don't have anyone to talk with. <3 [Cleverbot](http://www.cleverbot.com/).

## Commands

* `join <roomID> [<message>]` - Join a specified chatroom (group or private) with an optional message
* `show chatrooms` - Show the current chatroom list with all member SteamIDs
* `show users` - Show more info about all users
* `quit` - Quits the bot

## Run your own bot

* Install [node.js](http://nodejs.org/).
* In the directory with cleverbot-steam:
  * `npm install steam cleverbot-node`
  * Set values in [config.json](config.json):
      * `botName` - This will change the profile name of your bot.
      * `listenToCalls` - Bot replies in the group chat only to messages starting with the specified strings (case insensitive).
      * `autoJoin` - List of chatrooms (group and friend chats) to automatically join with an optional message (say hello).
  * Set environment variables `STEAM_USERNAME` and `STEAM_PASSWORD` and run the script (example in [start_bot.sh.example](start_bot.sh.example) - for Linux).