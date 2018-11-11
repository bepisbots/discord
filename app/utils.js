const DataConfigs = require('../data/configs.json');

module.exports = {
  getConfigs: function () {
    if (this.configs) {
      return this.configs;
    }
    this.configs = {};
    DataConfigs.forEach(c => {
      this.configs[c.type] = c.value;
    });
    return this.configs;
  },
  getString: function (stringId) {
    return this.getConfigs().strings[stringId];
  },
  getRandomMessage: async function (db, channelId, callback) {
    const col = db.collection("posts");
    const that = this;
    col.countDocuments({ channel: channelId }, async function (err, totalMsgs) {
      let count = 0;
      let doc;
      let greatestScarcity = 0;
      do {
        var randomMessage = Math.floor(Math.random() * totalMsgs);
        doc = await col.find({ channel: channelId }).limit(-1).skip(randomMessage).next();
        greatestScarcity = 0;
        that.getConfigs().symbols.forEach(entry => {
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
      .replace("{itemName}", (item ? this.removeUrls(item.content) : ""))
      .replace("{userTag}", (message ? "<@" + message.author.id + ">" : ""));
  },
  hexColors: {
    red: 0xFF3333,
    yellow: 0xFFD133,
    brownOrange: 0xff8040,
    greyDiscord: 0x36393E,
    blueSky: 0x2770EA
  }
};

let configs = {};