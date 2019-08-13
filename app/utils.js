const optionalRequire = require("optional-require")(require);
const DataConfigs = require('../data/configs.json');
const dateformat = require('dateformat');
const config = optionalRequire('../config.json') || {};

module.exports = {
  getDiscordUsername: function (bot, userId) {
    if (!this.usernamesCache) {
      this.usernamesCache = {}
    }
    let username = this.usernamesCache[userId];
    if (username) { return username; }
    const user = bot.users.find("id", userId);
    if (!user) { return "noone"; }
    username = user.username;
    this.usernamesCache[userId] = username;
    return username;
  },
  log: function (db, message, text) {
    if (!message || !message.channel || !text) return;
    try {
      const channelName = message ? message.channel.name : "";
      const guildName = message ? message.channel.guild.name : "";
      const date = dateformat(new Date(), "dd/mm/yy, hh:MM:ss TT");
      const messagetext = (text ? text : (message ? message.content : ""));
      const authorTag = message ? message.author.tag : "";
      const infoText = message ? ": " + authorTag + " on " + channelName + ", " : "";
      console.log(date + ": " + infoText + "[" + messagetext + "]");

      if (db) {
        let logEntry = {
          timestamp: Date.now(),
          formattedTime: date,
          guildName: guildName,
          channelName: channelName,
          authorId: (message.author ? message.author.id : ""),
          authorTag: authorTag,
          request: message.content,
          response: (text.embed ? text.embed.title : text),
          responseFull: text
        };
        db.collection("log").insertOne(logEntry);
      }
    } catch (e) {
      console.error(e);
    }
  },
  sendMessage: function (db, message, text) {
    if (!message || !message.channel || !text) return;
    this.log(db, message, text);
    return message.channel.send(text);
  },
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
  getConfig: function (name) {

    if (config["devMode"] === true && config[name + "Dev"]) {
      return config[name + "Dev"];
    }
    if (config && config[name]) {
      return config[name];
    } else if (process && process.env && process.env[name]) {
      return process.env[name];
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
      if (!totalMsgs) {
        throw new Error("No entries found in channel. Please scan channel");
      }
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
    let matches = message.match(/(?:https?):\/\/[\n\S]+/g);
    if (!matches || matches.length === 0) return message;
    return message.match(/(?:https?):\/\/[\n\S]+/g)[0].trim();
  },
  isAdmin: function (message) {
    if (this.getConfig("devMode") === true) return true;
    if (this.getConfig("owners").includes(message.author.id)) return true;
    return false;
    //let perms = message.member.permissions;
    //const isAdmin = perms.has("ADMINISTRATOR"); // message.member.roles.find("name", "Admin") || message.member.roles.find("name", "Mod");
    //return isAdmin;
  },
  isInAnyRole: function (db, message, roles) {
    if (!roles) return true;
    let rolesArray = roles.split(",");
    if (this.isAdmin(message)) {
      return true;
    }
    if (rolesArray && Array.isArray(rolesArray)) {
      let isInARole = false;
      rolesArray.forEach(roleId => {
        if (message.member.roles.find("id", roleId)) {
          isInARole = true;
        }
      });
      if (isInARole) return true;
      this.sendMessage(db, message, "You can't perform this action as you're not member of any of the following roles:\n"
        + rolesArray.join(", "));
    }
    return false;
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
