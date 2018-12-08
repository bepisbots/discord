const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

module.exports = {
  newTrick: async function (message, db, bot, trickArgs, userArgs) {
    if (userArgs.length < 2) {
      message.channel.send('Arf-arf!\nPlease teach me as follows: !newTrick [command] [whatToSay]');
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
    message.channel.send("Successfully teached new trick!\nWhen you say: !" + trickName + ", I Say:");
    message.channel.send(entities.decode(whatToSay));
  },
  forgetTrick: async function (message, db, bot, trickArgs, userArgs) {
    if (userArgs.length < 1) {
      message.channel.send('Arf-arf!\nPlease un-teach me as follows: !forgetTrick [command]');
      return;
    }
    const col = db.collection("tricks");
    await col.deleteOne({ name: userArgs[0] });
    message.channel.send("Trick forgotten");
  },
  scanChannels: async function (message, db, bot, trickArgs, userArgs) {
    // Find all channels that are listed in tricks
    if (userArgs && userArgs.length >= 2) {
      const ch = userArgs[1];
      const message0 = "Processing Channel Id: " + ch;
      Utils.log(message, message0);
      processChannel(db, bot, message, ch);
      return;
    }
    const col = db.collection("tricks");
    col.find().toArray(function (err, allTricks) {
      if (err) return;
      if (!allTricks) return;

      let channelIds = allTricks
        .map(v => v.say.trim().split(" "))
        .filter(parts => parts.length > 1 && parts[0] === "RANDOM_POST")
        .map(parts => parts[1])
        .filter(ch => ch);
      // dedup 
      channelIds = channelIds.filter((item, pos) => channelIds.indexOf(item) === pos);

      channelIds.forEach(ch => {
        const text = "Processing Channel Id: " + ch;
        Utils.log(message, text);
        if (message) {
          message.channel.send(text);
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
    Utils.log(message, text);
    if (message) {
      message.channel.send(text);
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
            if (!doc) {
              const message = {
                channel: channelId,
                author: m.author.username,
                authorId: m.author.id,
                createdTimestamp: m.createdTimestamp,
                content: m.content.trim()
              };
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
  Utils.log(message, message1);
}
