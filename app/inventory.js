const Utils = require('./utils');
const Discord = require('discord.js');
const PAGE_SIZE = 12;

const mod = {
  invFuse: async function (message, db, bot, trickArgs, userArgs, params) {
    let itemNumber1 = params['inventoryItemNumber1'] - 1;
    let itemNumber2 = params['inventoryItemNumber2'] - 1;
    const channelId = trickArgs[1];
    let userRecord = params['userRecord'];

    const item1key = Utils.getInventoryItemKeyFromNumber(userRecord, itemNumber1);
    const item2key = Utils.getInventoryItemKeyFromNumber(userRecord, itemNumber2);

    const item1 = userRecord.inventory[item1key];
    const item2 = userRecord.inventory[item2key];

    const item1Name = Utils.getItenName(item1);
    const item2Name = Utils.getItenName(item2);

    if (item1.quantity === item1.selling) {
      message.channel.send("Failed\nReason: (" + (itemNumber1 + 1) + ") **"
        + item1Name + "** is currently for sale");
      return;
    }
    if (item2.quantity === item2.selling) {
      message.channel.send("Failed\nReason: (" + (itemNumber2 + 1) + ") **"
        + item2Name + "** is currently for sale");
      return;
    }

    const posts = db.collection("posts");
    posts.findOne({
      "channel": channelId,
      $text: {
        $search: "\"" + item1Name + "\" \"" + item2Name + "\""
      }
    }, { limit: 1 }).then(async fuseRecord => {
      if (!fuseRecord) {
        message.channel.send("No fuse formula found for **" + item1Name + "** and **" + item2Name + "**. Keep trying!");
        return;
      }
      let fuseParts = fuseRecord.title.split(';');
      if (fuseParts.length < 3) {
        message.channel.send("Error found in fuse formula for **" + item1Name + "** and **" + item2Name + "**. Ask the admin to fix it!");
        return;
      }
      fuseParts = fuseParts.map(part => part.trim());
      if (fuseParts[2] === item1Name || fuseParts[2] === item2Name) {
        return;
      }
      let fusedItem = await posts.findOne({ title: fuseParts[2] }, { limit: 1 });
      if (!fusedItem) {
        message.channel.send("Fused item not found: Error found in fuse formula for **" + item1Name + "** and **" + item2Name + "**. Ask the admin to fix it!");
        return;
      }
      // Make the assignment to user
      item1.quantity--;
      if (userRecord.inventory[item1key].quantity <= 0) {
        delete userRecord.inventory[item1key];
      }
      item2.quantity--;
      if (userRecord.inventory[item2key].quantity <= 0) {
        delete userRecord.inventory[item2key];
      }
      const fuseItemId = fusedItem._id.toString();
      if (userRecord.inventory[fuseItemId]) {
        userRecord.inventory[fuseItemId].quantity++;
      } else {
        userRecord.inventory[fuseItemId] = {
          content: fusedItem.content,
          quantity: 1
        };
      }
      db.collection("users").save(userRecord);
      message.channel.send("Congratulations! You earned **" + fusedItem.title + "** by combining **" + item1Name + "** and **" + item2Name + "**");
    });
  },
  invTrash: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    let userRecord = params['userRecord'];
    let itemNumber = params['inventoryItemNumber'] - 1;
    const item = Utils.getInventoryItemFromNumber(userRecord, itemNumber);

    if (item.quantity <= 1) {
      delete userRecord.inventory[key];
    } else {
      item.quantity--;
    }
    const userCol = db.collection("users");
    userCol.save(userRecord);

    message.channel.send(Utils.getItenName(item) + " has been removed from your inventory!");
  },
  invList: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    let pageNumber = params['pageNumber'] - 1;
    let userRecord = params['userTag'];
    if (!userRecord || !userRecord.inventory) return;
    let inventory = Object.values(userRecord.inventory);
    const totalPages = Math.ceil(inventory.length / PAGE_SIZE);
    if (pageNumber + 1 > totalPages)
      pageNumber = totalPages - 1;
    const startElement = (pageNumber * PAGE_SIZE);
    const endElement = startElement + PAGE_SIZE;
    inventory = inventory.slice(startElement, endElement);
    let count = startElement + 1;

    const text = inventory.filter(i => i.content)
      .map(i => (!i.selling ? Utils.getString("invItem") : Utils.getString("invItemForSale"))
        .replace("{id}", count++)
        .replace("{itemName}", Utils.getItenName(i))
        .replace("{quantityOwned}", (i.quantity > 1 ? ": " + i.quantity : ""))
        .replace("{quantityForSale}", i.selling)
        .replace("{userTag}", "<@" + userRecord.userId + ">"))
      .reduce((i1, i2) => i1 + "\n" + i2);

    let sideBarColor = Utils.hexColors.brownOrange;
    if (userRecord && userRecord.preferences && userRecord.preferences.sideBarColor) {
      sideBarColor = userRecord.preferences.sideBarColor;
    }
    let title;
    if (!params['noTitle']) {
      title = "**{userTag}'s Inventory**";
      title = title.replace("{userTag}", userRecord.username);
    }
    if (!params['noPages'] && totalPages > 1)
      title += " Page " + (pageNumber + 1) + " of " + totalPages;

    message.channel.send({
      embed: {
        color: sideBarColor,
        title: title,
        description: text
      }
    });
  },
  invListAll: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    let userRecord = params['userTag'];
    if (!userRecord || !userRecord.inventory) return;
    let inventory = Object.values(userRecord.inventory);
    const totalPages = Math.ceil(inventory.length / PAGE_SIZE);
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      params['pageNumber'] = pageNumber;
      params['noTitle'] = pageNumber != 1;
      params['noPages'] = true;
      mod.invList(message, db, bot, trickArgs, userArgs, params);
    }
  },
  invShow: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    let userRecord = params['userRecord'];
    let itemNumber = params['inventoryItemNumber'] - 1;
    const item = Utils.getInventoryItemFromNumber(userRecord, itemNumber);
    // Show all inventory
    const embed = new Discord.RichEmbed()
      .setColor(Utils.hexColors.red)
      .setTitle(Utils.getItenName(item))
      .setImage(Utils.getUrl(item.content));
    message.channel.send({ embed });
  },
  invColor: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    const userTag = userArgs[0];
    if (!userTag) {
      message.channel.send(Utils.getString("invColorError"));
      return;
    }
    var numberPattern = /\d+/g;
    const userNumber = userTag.match(numberPattern);
    const targetUser = bot.users.find("id", userNumber[0]);
    if (!targetUser) {
      message.channel.send(Utils.getString("invColorError"));
      return;
    }
    const colorHex = userArgs[1];
    if (!colorHex) {
      message.channel.send(Utils.getString("invColorError"));
      return;
    }
    var isOk = /^#[0-9A-F]{6}$/i.test(colorHex);
    if (!isOk) {
      message.channel.send(Utils.getString("invColorHexError"));
      return;
    }
    const colorNumber = parseInt(colorHex.substr(1), 16);

    const col = db.collection("users");
    const userRecord = await col.findOne({ userId: userNumber[0] });
    if (!userRecord) {
      message.channel.send(Utils.getString("invColorError"));
      return;
    }
    if (!userRecord.preferences) {
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
  invCatch: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    const channelId = trickArgs[1];
    if (!channelId) return;
    const hoursToWait = parseFloat(trickArgs[2]);
    const col = db.collection("users");
    let userRecord = params['userRecord'];
    Utils.getRandomMessage(db, channelId, (catched) => {
      const igmId = catched._id.toString();
      if (!userRecord) {
        userRecord = {
          userId: message.author.id,
          username: message.author.username,
          createdTimestamp: message.createdTimestamp,
          inventory: {},
        };
        col.insertOne(userRecord);
      }
      // Check user has waited hours
      const now = Date.now();
      if (userRecord.lastCatchOn && hoursToWait && hoursToWait > 0) {
        const duration = (now - userRecord.lastCatchOn)
        const hoursSinceLastCatch = duration / 3600000;
        if (hoursToWait > hoursSinceLastCatch) {
          const difference = (hoursToWait * 3600000) - duration;
          const seconds = parseInt((difference / 1000) % 60);
          const minutes = parseInt((difference / (1000 * 60)) % 60);
          const hours = parseInt((difference / (1000 * 60 * 60)) % 24);
          let text = Utils.getString("catchWaitMessage")
            .replace("{userTag}", "<@" + userRecord.userId + ">")
            .replace("{hours}", hours)
            .replace("{minutes}", minutes)
            .replace("{seconds}", seconds);
          message.channel.send(text);
          // if (!Utils.isAdmin(message)) {
          return;
          // }
        }
      }
      if (userRecord.inventory[igmId]) {
        userRecord.inventory[igmId].quantity++;
      } else {
        userRecord.inventory[igmId] = {
          content: catched.content,
          quantity: 1
        };
      }
      userRecord.lastCatchOn = now;
      col.save(userRecord);

      const text = Utils.getString("catchSuccessMessage")
        .replace("{userTag}", "<@" + message.author.id + ">")
        .replace("{itemName}", Utils.getItenName(catched))
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.greyDiscord)
        .setDescription(text)
        .setImage(Utils.getUrl(catched.content));
      message.channel.send({ embed });
    });
  },
  invNick: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    let userRecord = params['userRecord'];
    let inventoryItemNumber = params['inventoryItemNumber'] - 1;
    let nickname = params['nickname'];

    const item = Utils.getInventoryItemFromNumber(userRecord, inventoryItemNumber);
    item.nickname = nickname;

    const col = db.collection("users");
    col.save(userRecord);

    const text = Utils.getString("invNickSuccess")
      .replace("{nick}", nickname)
      .replace("{itemName}", Utils.getItenName(item))
    const embed = new Discord.RichEmbed()
      .setColor(Utils.hexColors.blueSky)
      .setDescription(text);
    message.channel.send({ embed });
  },
  invClearNick: async function (message, db, bot, trickArgs, userArgs, params) {
    // Get user entry
    let userRecord = params['userRecord'];
    let inventoryItemNumber = params['inventoryItemNumber'] - 1;

    const item = Utils.getInventoryItemFromNumber(userRecord, inventoryItemNumber);
    item.nickname = "";

    const col = db.collection("users");
    col.save(userRecord);

    const text = Utils.getString("invClearNickSuccess")
      .replace("{itemName}", Utils.getItenName(item))
    const embed = new Discord.RichEmbed()
      .setColor(Utils.hexColors.blueSky)
      .setDescription(text);
    message.channel.send({ embed });
  },
};
module.exports = mod;