const Utils = require('./utils');
const Discord = require('discord.js');
const PAGE_SIZE = 12;

module.exports = {
  invTrash: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    // Get user entry
    const itemNumber = cmdArgs[1] - 1;
    let usrDoc = params['userRecord'];

    if (!usrDoc || !usrDoc.inventory) return;
    const invKeys = Object.keys(usrDoc.inventory);
    if (invKeys.length < itemNumber || itemNumber < 0) return;
    const key = invKeys[itemNumber];
    if (!key) return;
    const item = usrDoc.inventory[key];
    if (!item) return;
    if (item.quantity <= 1) {
      delete usrDoc.inventory[key];
    } else {
      item.quantity--;
    }
    const userCol = db.collection("users");
    userCol.save(usrDoc);

    message.channel.send(Utils.removeUrls(item.content) + " has been removed from your inventory!");
  },
  invList: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    // Get user entry
    let pageNumber = params['pageNumber'] - 1;
    let usrDoc = params['userRecord'];
    if (!usrDoc || !usrDoc.inventory) return;
    let inventory = Object.values(usrDoc.inventory);
    const totalPages = Math.ceil(inventory.length / PAGE_SIZE);
    if (pageNumber + 1> totalPages)
      pageNumber = totalPages - 1;
    const startElement = (pageNumber * PAGE_SIZE);
    const endElement = startElement + PAGE_SIZE;
    inventory = inventory.slice(startElement, endElement);
    let count = startElement + 1;

    const text = inventory.filter(i => i.content)
      .map(i => (!i.selling ? configs.strings.invItem : configs.strings.invItemForSale)
        .replace("{id}", count++)
        .replace("{itemName}", Utils.removeUrls(i.content))
        .replace("{quantityOwned}", i.quantity)
        .replace("{quantityForSale}", i.selling)
        .replace("{userTag}", "<@" + message.author.id + ">"))
      .reduce((i1, i2) => i1 + "\n" + i2);

    const footer = configs.strings.invShowTotalCoins
      .replace("{coins}", usrDoc.coins || 0)
      .replace("{userTag}", "<@" + message.author.id + ">");
    let sideBarColor = Utils.hexColors.brownOrange;
    if (usrDoc && usrDoc.preferences && usrDoc.preferences.sideBarColor) {
      sideBarColor = usrDoc.preferences.sideBarColor;
    }
    const title = "**Inventory**" + (totalPages > 1 ? " Page " + (pageNumber + 1) + " of " + totalPages : "");
    message.channel.send({
      embed: {
        color: sideBarColor,
        title: title,
        description: text + "\n\n" + footer
      }
    });
  },
  invShow: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    // Get user entry
    const itemNumber = (userArgs[0] ? parseInt(userArgs[0]) : 0);
    if (itemNumber <= 0) {
      return;
    }
    // Show all inventory
    const col = db.collection("users");
    let usrDoc = params['userRecord'];
    if (!usrDoc || !usrDoc.inventory) return;
    // Show single item in inventory
    const invEntry = Object.values(usrDoc.inventory)[itemNumber - 1];
    if (invEntry) {
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.red)
        .setTitle(Utils.removeUrls(invEntry.content))
        .setImage(Utils.getUrl(invEntry.content));
      message.channel.send({ embed });
    }
  },
  invColor: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    // Get user entry
    const userTag = userArgs[0];
    if (!userTag) {
      message.channel.send(configs.strings.invColorError);
      return;
    }
    var numberPattern = /\d+/g;
    const userNumber = userTag.match(numberPattern);
    const targetUser = bot.users.find("id", userNumber[0]);
    if (!targetUser) {
      message.channel.send(configs.strings.invColorError);
      return;
    }
    const colorHex = userArgs[1];
    if (!colorHex) {
      message.channel.send(configs.strings.invColorError);
      return;
    }
    var isOk = /^#[0-9A-F]{6}$/i.test(colorHex);
    if (!isOk) {
      message.channel.send(configs.strings.invColorHexError);
      return;
    }
    const colorNumber = parseInt(colorHex.substr(1), 16);

    const col = db.collection("users");
    let userRecord = params['userRecord'];
    if (!userRecord || !userRecord.preferences) {
      userRecord.preferences = {};
    }
    userRecord.preferences.sideBarColor = colorNumber;
    await col.save(userRecord);

    message.channel.send({
      embed: {
        color: colorNumber,
        title: "Successfully changed color for @" + targetUser.tag,
        description: "Color: " + colorHex + " (" + colorNumber + ")"
      }
    });

  },
  invCatch: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    // Get user entry
    const channelId = trickArgs[1];
    if (!channelId) return;
    const hoursToWait = parseFloat(trickArgs[2]);
    const col = db.collection("users");
    let usrDoc = params['userRecord'];
    Utils.getRandomMessage(db, channelId, configs, (catched) => {
      const igmId = catched._id.toString();
      if (!usrDoc) {
        usrDoc = {
          userId: message.author.id,
          username: user,
          createdTimestamp: message.createdTimestamp,
          inventory: {},
        };
        col.insertOne(usrDoc);
      }
      // Check user has waited hours
      const now = Date.now();
      if (usrDoc.lastCatchOn && hoursToWait && hoursToWait > 0) {
        const duration = (now - usrDoc.lastCatchOn)
        const hoursSinceLastCatch = duration / 3600000;
        if (hoursToWait > hoursSinceLastCatch) {
          const difference = (hoursToWait * 3600000) - duration;
          const seconds = parseInt((difference / 1000) % 60);
          const minutes = parseInt((difference / (1000 * 60)) % 60);
          const hours = parseInt((difference / (1000 * 60 * 60)) % 24);
          message.channel.send(configs.strings.catchWaitMessage
            .replace("{userTag}", user)
            .replace("{hours}", hours)
            .replace("{minutes}", minutes)
            .replace("{seconds}", seconds));
          if (!Utils.isAdmin(message)) {
            return;
          }
        }
      }
      if (usrDoc.inventory[igmId]) {
        usrDoc.inventory[igmId].quantity++;
      } else {
        usrDoc.inventory[igmId] = {
          content: catched.content,
          quantity: 1
        };
      }
      usrDoc.lastCatchOn = now;
      col.save(usrDoc);

      const text = configs.strings.catchSuccessMessage
        .replace("{userTag}", "<@" + message.author.id + ">")
        .replace("{itemName}", Utils.removeUrls(catched.content))
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.greyDiscord)
        .setDescription(text)
        .setImage(Utils.getUrl(catched.content));
      message.channel.send({ embed });
    });
  }
};
