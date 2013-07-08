var fs = require('fs');
var Steam = require('steam');
var Cleverbot = require('cleverbot-node');

var bot = new Steam.SteamClient();
var config;

var cleverbots = {};

process.stdin.resume();
process.stdin.setEncoding('utf8');

// load config
fs.readFile('config.json', function (err, data) {
  config = JSON.parse(data.toString());
  bot.logOn(process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD);
  bot.setPersonaName(config.botName);
});

process.stdin.on('data', function (text) {
  text = text.trim();

  console.log('received data:', text);
  textArr = text.split(' ');

  if (textArr[0] == 'join' && textArr[1]) {
    var message = textArr.slice(2).join(' ') || 'Hi, are you a computer?';
    joinChat(textArr[1], message);
  }
  else if (text.toLowerCase() === 'show chatrooms') {
    console.log(bot.chatRooms);
  }
  else if (text.toLowerCase() === 'show users') {
    console.log(bot.users);
  }
  else if (text.toLowerCase() === 'quit') {
    console.log('Bye!');
    process.exit();
  }
});

bot.on('loggedOn', function() {
  console.log('Logged in!');
  bot.setPersonaState(Steam.EPersonaState.Online);

  for (chatID in config.autoJoin) {
    joinChat(chatID, config.autoJoin[chatID]);
  }
});

bot.on('relationship', function(steamID, relationship) {
  console.log('Relationship change for ' + steamID + ' - ' + relationship);
  if (relationship == Steam.EFriendRelationship.PendingInvitee) {
    bot.addFriend(steamID);
    bot.sendMessage(steamID, "Hi, thanks for adding me to your friends! I'm Cleverbot, I will reply to all of your questions.", Steam.EChatEntryType.ChatMsg);
  }
});

bot.on('chatInvite', function(chatRoomID, chatRoomName, patronID) {
  console.log('Got an invite to ' + chatRoomName + ' from ' + bot.users[patronID].playerName);
  bot.joinChat(chatRoomID); // autojoin on invite
});

bot.on('message', function(source, message, type, chatter) {
  // respond to both chat room and private messages
  
  message = message.trim();

  if (message != '') {
    var shouldReply = false;

    if (chatter === undefined) {
      // chat between a bot and another user
      shouldReply = true;
    }
    else {
      // it's a group chat, respond only when users call Cleverbot directly (config.listenToCalls)

      for (var i = 0; i < config.listenToCalls.length; i++) {
        if (message.toLowerCase().substr(0, config.listenToCalls[i].length) == config.listenToCalls[i].toLowerCase()) {
          message = message.replace(new RegExp("^" + config.listenToCalls[i] + "(\\W)+", "i"), "");
          shouldReply = true;
          break;
        }
      }
    }

    if (shouldReply) {
      console.log('Received message from ' + source + ': ' + message);
      if (message == 'ping') {
        bot.sendMessage(source, 'pong', Steam.EChatEntryType.ChatMsg);
      }
      else {
        if (cleverbots[source] === undefined) {
          cleverbots[source] = new Cleverbot;
        }
        
        cleverbots[source].write(message, function(resp) {
          var reply = (chatter === undefined) ? resp['message'] : '"' + message + "\"\n" + resp['message'];
          bot.sendMessage(source, reply, Steam.EChatEntryType.ChatMsg);
          console.log('Reply to ' + source + ' - message "' + message + '": ' + resp['message']);
        });
      }
    }
  }
});

bot.on('error', function(e) {
  showError('BOT - ' + e);
});

function showError(err) {
  console.log('ERROR: ' + err);
}

function joinChat(roomID, message) {
  console.log('Joining chat ' + roomID);
  bot.joinChat(roomID);
  if (message) {
    bot.sendMessage(roomID, message, Steam.EChatEntryType.ChatMsg);
  }
}