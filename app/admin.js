const Entities = require('html-entities').AllHtmlEntities;
const Utils = require('./utils');
const entities = new Entities();

module.exports = {
  newTrick: async function (message, db, bot, trickArgs, userArgs) {
    if (userArgs.length < 2) {
      Utils.sendMessage(db, bot, message, 'Arf-arf!\nPlease teach me as follows: !newTrick [command] [whatToSay]');
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
    Utils.sendMessage(db, bot, message, "Successfully teached new trick!\nWhen you say: !" + trickName + ", I Say:");
    Utils.sendMessage(db, bot, message, entities.decode(whatToSay));
  },
  forgetTrick: async function (message, db, bot, trickArgs, userArgs) {
    if (userArgs.length < 1) {
      Utils.sendMessage(db, bot, message, 'Arf-arf!\nPlease un-teach me as follows: !forgetTrick [command]');
      return;
    }
    const col = db.collection("tricks");
    await col.deleteOne({ name: userArgs[0] });
    Utils.sendMessage(db, bot, message, "Trick forgotten");
  },
  scanChannels: async function (message, db, bot, trickArgs, userArgs, params, FUNCTIONS) {
    // Find all channels that are listed in tricks
    if (userArgs && userArgs.length >= 1) {
      const ch = userArgs[0];
      processChannel(db, bot, message, ch);
      return;
    }
    const functionsWithChannelId = Object.keys(FUNCTIONS)
      .filter(name => FUNCTIONS[name].setupParams.channelId);

    const col = db.collection("tricks");
    col.find().toArray(function (err, allTricks) {
      if (err) return;
      if (!allTricks) return;

      let channelIds = allTricks
        .map(v => v.say.trim().split(" "))
        .filter(parts => parts.length > 1 && functionsWithChannelId.includes(parts[0]))
        .map(parts => parts[1])
        .filter(ch => ch);
      // dedup 
      channelIds = channelIds.filter((item, pos) => channelIds.indexOf(item) === pos);

      channelIds.forEach(ch => {
        processChannel(db, bot, message, ch);
      });
      // For each channel, scan and parse the contents
    });
  }
};

async function processChannel(db, bot, message, channelId) {
  const textProcessing = "Processing Channel: " + channelId;
  Utils.sendMessage(db, bot, message, textProcessing);

  const channel = bot.channels.get(channelId);
  const col = db.collection("posts");
  let counter = 0;
  if (!channel) {
    const text = "Failed accessing channel " + channelId + ". Make sure the bot has read rights on the channel and try again:";
    Utils.sendMessage(db, bot, message, text);
    return;
  }
  let lastMessageId;
  let lastMessageIdProcessed;
  do {
    await channel.fetchMessages({ limit: 100, before: lastMessageId }).then(messages => {
      messages.array()
        .filter(m => m.content)
        .forEach(async (m) => {
          await col.findOne({ channel: channelId, createdTimestamp: m.createdTimestamp }, { limit: 1 }, function (err, doc) {
            if (err) return;
            if (!doc) {
              const msg = {
                channel: channelId,
                author: m.author.username,
                authorId: m.author.id,
                createdTimestamp: m.createdTimestamp,
                content: m.content.trim()
              };
              let title = Utils.removeUrls(m.content).trim();
              if (title) msg.title = title;
              col.insertOne(msg);
              counter++;
            } else if (doc.content.trim() != m.content.trim()) {
              Utils.sendMessage(db, bot, message, "Updated:[" + doc.content.trim() + "]\n to:[" + m.content.trim() + "]\n")
              doc.content = m.content.trim();
              col.save(doc);
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
  const textProcessed = "Processed " + counter + " new messages for channel" + channelId;
  Utils.sendMessage(db, bot, message, textProcessed);
}
