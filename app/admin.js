const Entities = require('html-entities').AllHtmlEntities;
const Utils = require('./utils');
const entities = new Entities();

module.exports = {
  newTrick: async function (message, db, bot, trickArgs, userArgs) {
    if (userArgs.length < 2) {
      Utils.sendMessage(db, message, 'Arf-arf!\nPlease teach me as follows: !newTrick [command] [whatToSay]');
      return;
    }
    const trickName = userArgs[0].toLowerCase();
    userArgs.shift();
    const whatToSay = entities.encode(userArgs.join(" ").trim());
    const author = message.author.toString();
    const trick = {
      name: trickName,
      say: whatToSay,
      author: author
    };
    const col = db.collection("tricks");
    await col.findOne({ name: trick.name }, { limit: 1 }, function (err, doc) {
      if (err) return;
      if (!doc) {
        col.insertOne(trick);
      } else {
        doc.say = trick.say;
        col.save(doc);
      }
    });
    Utils.sendMessage(db, message, "Successfully teached new trick!\nWhen you say: !" + trickName + ", I Say:");
    Utils.sendMessage(db, message, entities.decode(whatToSay));
  },
  forgetTrick: async function (message, db, bot, trickArgs, userArgs) {
    if (userArgs.length < 1) {
      Utils.sendMessage(db, message, 'Arf-arf!\nPlease un-teach me as follows: !forgetTrick [command]');
      return;
    }
    const col = db.collection("tricks");
    await col.deleteOne({ name: userArgs[0] });
    Utils.sendMessage(db, message, "Trick forgotten");
  },
  scanChannels: async function (message, db, bot, trickArgs, userArgs) {
    // Find all channels that are listed in tricks
    if (userArgs && userArgs.length >= 1) {
      const ch = userArgs[0];
      const message0 = "Processing Channel Id: " + ch;
      Utils.log(null, message, message0);
      processChannel(db, bot, message, ch);
      return;
    }
    const col = db.collection("tricks");
    col.find().toArray(function (err, allTricks) {
      if (err) return;
      if (!allTricks) return;

      let channelIds = allTricks
        .map(v => v.say.trim().split(" "))
        .filter(parts => parts.length > 1 && (parts[0] === "RANDOM_POST" 
        || parts[0] === "CATCH_INVENTORY" 
        || parts[0] === "EVENT" 
        || parts[0] === "FUSE_INVENTORY"))
        .map(parts => parts[1])
        .filter(ch => ch);
      // dedup 
      channelIds = channelIds.filter((item, pos) => channelIds.indexOf(item) === pos);

      channelIds.forEach(ch => {
        const text = "Processing Channel Id: " + ch;
        Utils.log(null, message, text);
        if (message) {
          Utils.sendMessage(db, message, text);
        }
        processChannel(db, bot, message, ch);
      });
      // For each channel, scan and parse the contents
    });
  }
};

async function processChannel(db, bot, message, channelId) {
  const channel = bot.channels.get(channelId);
  const col = db.collection("posts");
  let counter = 0;
  if (!channel) {
    const text = "Channel does not exist on this Server. Change server and run command again:" + channelId;
    Utils.log(null, message, text);
    if (message) {
      Utils.sendMessage(db, message, text);
    }
    return;
  }
  let lastMessageId;
  let lastMessageIdProcessed;
  do {
    await channel.fetchMessages({ limit: 100, before: lastMessageId }).then(messages => {
      messages.array()
        .filter(m => m.content)
        .forEach(async (m) => {
          await col.findOne({ channel: channelId, content: m.content.trim() }, { limit: 1 }, function (err, doc) {
            if (err) return;
            const message = {
              channel: channelId,
              author: m.author.username,
              authorId: m.author.id,
              createdTimestamp: m.createdTimestamp,
              content: m.content.trim()
            };
            let title = Utils.removeUrls(m.content).trim();
            if (title) message.title = title;

            if (!doc) {
              col.insertOne(message);
              counter++;
            }
          });
          lastMessageId = m.id;
        });
    });
    if (lastMessageIdProcessed === lastMessageId || !lastMessageId) {
      break;
    }
    lastMessageIdProcessed = lastMessageId;
  } while (true);
  const message1 = "Processed " + counter + " new messages for channel" + channelId;
  Utils.log(null, message, message1);
}
