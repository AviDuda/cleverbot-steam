var fs = require('fs');
var util = require('util');
var Steam = require('steam');
var Cleverbot = require('cleverbot-node');
var ent = require('ent'); // encoding/decoding strings

var bot = new Steam.SteamClient();
var config;

var cleverbots = {};

// load config
fs.readFile('config.json', function (err, data) {
  config = JSON.parse(data.toString());
  config = config[process.env.BOT_ENV];
  bot.logOn(config.steamUsername, config.steamPassword);
  bot.setPersonaName(config.botName);
});

bot.on('loggedOn', function() {
  util.log('Logged in!');
  setState(config.botState);

  for (chatID in config.autoJoin) {
    joinChat(chatID, config.autoJoin[chatID]);
  }
});

bot.on('relationship', function(steamID, relationship) {
  util.log('Relationship change for ' + steamID + ' - ' + relationship);
  if (relationship == Steam.EFriendRelationship.PendingInvitee) {
    bot.addFriend(steamID);
    checkCleverbotInstance(steamID);
    bot.sendMessage(steamID, "Hi, thanks for adding me to your friends! I'm Cleverbot, I will reply to all of your questions.", Steam.EChatEntryType.ChatMsg);
  }
});

bot.on('chatInvite', function(chatRoomID, chatRoomName, patronID) {
  util.log('Got an invite to ' + chatRoomName + ' from ' + bot.users[patronID].playerName);
  bot.joinChat(chatRoomID); // autojoin on invite
  checkCleverbotInstance(chatRoomID);
});

bot.on('message', function(source, message, type, chatter) {
  // respond to both chat room and private messages
  
  message = message.trim();

  if (message != '') {
    var shouldReply = false;

    checkCleverbotInstance(source);
    cleverbots[source]["lastMessage"] = new Date();
    if (bot.chatRooms[source] === undefined) {
      joinChat(source, false);
    }

    if (chatter) {
      // find if the bot should reply in the group chat
      for (var i = 0; i < config.listenToCalls.length; i++) {
        if (message.toLowerCase().substr(0, config.listenToCalls[i].length) == config.listenToCalls[i].toLowerCase()) {
          message = message.replace(new RegExp("^" + config.listenToCalls[i] + "[ ,.?!]+", "i"), "");
          shouldReply = true;
          break;
        }
      }
    }

    if (message[0] == "/" && (config.botAdmins.indexOf(source) >= 0 || config.botAdmins.indexOf(chatter) >= 0)) {
      // it's a command

      shouldReply = false;

      var msgArr = message.split(" ");

      var helpText = "Available commands: \
\n/join <roomID> [<message>] - Joins the room and posts a message '" + config.defaultJoinMessage + "' unless the message is specified. Set the message to 'false' if you don't want to send a message. \
\n/send <roomID> <message> - Sends a message to a chatroom. \
\n/sendtoall <lastActiveAgoInMS> <message> - Sends a message to all rooms which have the last message to/from bot was max. lastActiveAgoInMS milliseconds ago. lastActiveAgoInMS's default is 300000 (5 minutes). \
\n/chatrooms - List of chatrooms with members. \
\n/status online|offline|away|snooze|busy - Sets the bot's status. Warning: Bot isn't responding to any messages when you set its status to offline. \
\n/name <name> - Sets the bot's name.";

      if (/^\/join .*/.test(message) && msgArr.length >= 1) { // /join <roomID> [<message>]
          joinChat(msgArr[1], msgArr.slice(2).join(' '));
      }
      else if(/^\/send .*/.test(message) && msgArr.length >= 3) { // /send <roomID> <message>
        checkCleverbotInstance(msgArr[1]);
        cleverbots[msgArr[1]]["lastMessage"] = new Date();
        bot.sendMessage(msgArr[1], ent.decode(msgArr.slice(2).join(' ')), Steam.EChatEntryType.ChatMsg);
      }
      else if(/^\/sendtoall .*/.test(message) && msgArr.length >= 3) { // /sendtoall <lastActiveAgoInMS> <message>
        var lastActiveAgoInMS = parseInt(msgArr[1]) || 300000; // 300000 = 1000 * 60 * 5 = 5 minutes
        for (roomID in cleverbots) {
          if (new Date() - cleverbots[roomID]["lastMessage"] <= lastActiveAgoInMS) {
            bot.sendMessage(roomID, ent.decode(msgArr.slice(2).join(' ')), Steam.EChatEntryType.ChatMsg);
          }
        }
      }
      else if(message == "/chatrooms") {
        var reply = Object.keys(cleverbots).length + " chatrooms found.";
        for (roomID in cleverbots) {
          if (bot.chatRooms[roomID] === undefined) {
            // private chat
            reply += "\nhttp://steamcommunity.com/profiles/" + roomID;
          }
          else {
            // group chat
            var groupWord = (parseInt(roomID)) ? "gid" : "groups";
            reply += "\nhttp://steamcommunity.com/" + groupWord + "/" + roomID + " - " + Object.keys(bot.chatRooms[roomID]).length + " members";
          }

          reply += " - last message " + cleverbots[roomID]["lastMessage"];
        }
        bot.sendMessage(source, ent.decode(reply), Steam.EChatEntryType.ChatMsg);
      }
      else if(/^\/status .*/.test(message) && msgArr.length == 2) { // /status online|offline|away|snooze|busy
        setState(msgArr[1]);
      }
      else if(/^\/name.*/.test(message) && msgArr.length >= 1) { // /name <name>
        util.log("Setting bot's name to " + msgArr.slice(1).join(' '));
        bot.setPersonaName(msgArr.slice(1).join(' '));
      }
      else if(message == "/help") {
        bot.sendMessage(source, ent.decode(helpText), Steam.EChatEntryType.ChatMsg);
      }
      else {
        var reply = "Unknown command '" + message + "'.\n" + helpText;
        bot.sendMessage(source, ent.decode(reply), Steam.EChatEntryType.ChatMsg);
      }
    }
    else if (chatter === undefined) {
      // not a command and in a private chat
      shouldReply = true;
    }

    if (shouldReply) {
      cleverbots[source]["cleverbot"].write(message, function(resp) {
        cleverbots[source]["lastMessage"] = new Date();

        var reply;

        if (resp['message'] && resp['message'] != "<html>") {
          reply = (chatter === undefined) ? resp['message'] : bot.users[chatter].playerName + ': ' + message + "\n" + resp['message'];
          
        }
        else {
          reply = "Bot is broken. Please try again later.";
          showError("Bot is broken. Response was: " + JSON.stringify(resp));
        }

        bot.sendMessage(source, ent.decode(reply), Steam.EChatEntryType.ChatMsg);
      });
    }
  }
});

bot.on('error', function(e) {
  showError('BOT - ' + e);
});

function showError(err) {
  util.log('ERROR: ' + err);
}

function joinChat(roomID, message) {
  util.log('Joining chat ' + roomID);
  bot.joinChat(roomID);

  checkCleverbotInstance(roomID);

  if (message !== false && message !== "false") {
    var msg = (message) ? message : config.defaultJoinMessage;
    bot.sendMessage(roomID, ent.decode(msg), Steam.EChatEntryType.ChatMsg);

    cleverbots[roomID]["lastMessage"] = new Date();
  }
}

function checkCleverbotInstance(roomID) {
  if (cleverbots[roomID] === undefined) {
    util.log("New Cleverbot instance for " + roomID);
    cleverbots[roomID] = {
      "cleverbot": new Cleverbot,
      "lastMessage": new Date()
    }
  }
}

function setState(state) {
  var type = Steam.EPersonaState.Online;
  switch (state) {
    case "online": type = Steam.EPersonaState.Online; break;
    case "offline": type = Steam.EPersonaState.Offline; break;
    case "away": type = Steam.EPersonaState.Away; break;
    case "snooze": type = Steam.EPersonaState.Snooze; break;
    case "busy": type = Steam.EPersonaState.Busy; break;
    default: type = Steam.EPersonaState.Online; state = "online"; break;
  }
  util.log("Setting bot's state to " + state);
  bot.setPersonaState(type);
}