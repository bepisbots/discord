module.exports = {
  getRandomMessage: async function (db, channelId, configs, callback) {
    const col = db.collection("posts");
    col.countDocuments({ channel: channelId }, async function (err, totalMsgs) {
      let count = 0;
      let doc;
      let greatestScarcity = 0;
      do {
        var randomMessage = Math.floor(Math.random() * totalMsgs);
        doc = await col.find({ channel: channelId }).limit(-1).skip(randomMessage).next();
        greatestScarcity = 0;
        configs.symbols.forEach(entry => {
          let symbol = entry.symbol;
          let scarcity = entry.scarcity;
          if (doc.content.indexOf(symbol) >= 0 && greatestScarcity < scarcity) {
            greatestScarcity = scarcity;
          }
        });
      } while (count < 5 && count++ < greatestScarcity)
      callback(doc);
    });
  },
  removeUrls: function (message) {
    if (!message) return "";
    return message.replace(/(?:https?):\/\/[\n\S]+/g, '').trim();
  },
  getUrl: function (message) {
    if (!message) return "";
    return message.match(/(?:https?):\/\/[\n\S]+/g)[0].trim();
  },
  isAdmin: function (message) {
    if (message.author.id === '500743672799690752') return true;
    let perms = message.member.permissions;
    const isAdmin = perms.has("ADMINISTRATOR"); // message.member.roles.find("name", "Admin") || message.member.roles.find("name", "Mod");
    return isAdmin;
  },
  replaceTemplates: function (text, message, item) {
    if (!text) return;
    return text
      .replace("{itemName}", (item ? this.removeUrls(item.content): ""))
      .replace("{userTag}", (message ? "<@" + message.author.id + ">": ""));
  }
};