const optionalRequire = require("optional-require")(require);
const DataConfigs = require('../data/configs.json');
const dateformat = require('dateformat');
const config = optionalRequire('../config.json') || {};

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
  getConfig: function(name) {
    if (config && config[name]){
      return config[name];
    } else if (process && process.env && process.env[name]){
      return process.env[name];
    } else {
        console.error('No ' + name + ' configured');
    }
  },
  log: function (message, text) {
    try {
      const channelName = message ? message.channel.name : "";
      const date = dateformat(new Date(), "dd/mm/yy, hh:MM:ss TT");
      const messagetext = (text ? text : (message ? message.content : ""));
      const authorTag = message ? message.author.tag : "";
      const infoText = message ? ": " + authorTag + " on " + channelName + ", " : "";

      console.log(date + ": " + infoText + "[" + messagetext + "]");
    } catch (e) {
      console.error(e);
    }
  },
  getInventoryItemFromNumber: function (userRecord, inventoryItemNumber) {
    const key = this.getInventoryItemKeyFromNumber(userRecord, inventoryItemNumber);
    const item = userRecord.inventory[key];
    return item;
  },
  getInventoryItemKeyFromNumber: function (userRecord, inventoryItemNumber) {
    const invKeys = Object.keys(userRecord.inventory);
    if (inventoryItemNumber >= invKeys.length || inventoryItemNumber < 0)
      throw new Error("Invalid item number");
    const key = invKeys[inventoryItemNumber];
    if (!key)
      throw new Error("Invalid item number");
    return key;
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
  getItenName: function (item) {
    const name = this.removeUrls(item.content);
    return (item.nickname ? item.nickname + " *(" + name + ")*" : name);
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
    //if (message.author.id === '500743672799690752') return true;
    let perms = message.member.permissions;
    const isAdmin = perms.has("ADMINISTRATOR"); // message.member.roles.find("name", "Admin") || message.member.roles.find("name", "Mod");
    return isAdmin;
  },
  replaceTemplates: function (text, message, item) {
    if (!text) return;
    return text
      .replace("{itemName}", (item ? this.getItenName(item) : ""))
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