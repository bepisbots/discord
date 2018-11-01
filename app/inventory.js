const Utils = require('./utils');

module.exports = {
  invShop: async function (message, db, bot, configs, trickArgs, userArgs) {
    const col = db.collection("shop");
    await col.find().toArray(function (err, shop) {
      if (err) return;
      if (!shop) return;

      let shopMessage = configs.strings.shopTitle + "\n";
      let id = 1;
      shop.forEach(i => {
        shopMessage += configs.strings.shopListing
          .replace("{id}", id)
          .replace("{itemName}", Utils.removeUrls(i.item))
          .replace("{userName}", i.username)
          .replace("{coins}", i.coins) + "\n";
        id++;
      });
      message.channel.send(shopMessage);
    });
  },
  invUnSell: async function (message, db, bot, configs, trickArgs, userArgs) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 2) {
      message.channel.send(configs.strings.unSellError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    changeUser(message, db, async (usrDoc) => {
      if (!usrDoc.inventory) return;
      const invKeys = Object.keys(usrDoc.inventory);
      if (invKeys.length < itemNumber || itemNumber < 0) return;
      const key = invKeys[itemNumber];
      if (!key) return;
      const item = usrDoc.inventory[key];
      if (!item) return;
      if (!item.selling || item.selling <= 0) return;
      item.selling--;

      const shopCol = db.collection("shop");
      await shopCol.deleteOne({ userId: message.author.id, itemId: key });
      return configs.strings.unSellSuccess
        .replace("{itemName}", Utils.removeUrls(item.content))
        .replace("{userTag}", "<@" + message.author.id + ">");
    });
  },
  invSell: async function (message, db, bot, configs, trickArgs, userArgs) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 3) {
      message.channel.send(configs.strings.sellError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    const coins = parseInt(cmdArgs[2]);
    if (!coins || coins <= 0 || coins > 100) {
      message.channel.send(configs.strings.sellErrorCoins
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    changeUser(message, db, async (usrDoc) => {
      if (!usrDoc.inventory) return;
      const invKeys = Object.keys(usrDoc.inventory);
      if (invKeys.length < itemNumber || itemNumber < 0) return;
      const key = invKeys[itemNumber];
      if (!key) return;
      const item = usrDoc.inventory[key];
      if (!item) return;
      if (!item.selling) {
        item.selling = 1;
      } else if (item.quantity >= item.selling + 1) {
        item.selling++;
      } else
        return;

      const shopCol = db.collection("shop");
      await shopCol.insertOne({
        itemId: key,
        userId: message.author.id,
        username: message.author.username,
        item: item.content,
        coins: parseInt(coins)
      });
      return configs.strings.sellSuccess
        .replace("{itemName}", Utils.removeUrls(item.content))
        .replace("{userTag}", "<@" + message.author.id + ">");
    });
  },
  invTrash: async function (message, db, bot, configs, trickArgs, userArgs) {
    // Get user entry
    const user = message.author.username;
    if (!user) return;
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 2) {
      message.channel.send("Error: Please specify the item number from your inventory.");
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    changeUser(message, db, async (usrDoc) => {
      if (!usrDoc.inventory) return;
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
      return Utils.removeUrls(item.content) + " has been removed from your inventory!";
    });
  },
  invShow: async function (message, db, bot, configs, trickArgs, userArgs) {
    // Get user entry
    const user = message.author.username;
    if (!user) return;
    const itemNumber = (userArgs[0] ? parseInt(userArgs[0]) : 0);
    // Show all inventory
    const col = db.collection("users");
    await col.findOne({ userId: message.author.id }, function (err, usrDoc) {
      if (err) return;
      if (!usrDoc) return;
      if (!usrDoc.inventory) return;
      let count = 1;
      if (itemNumber > 0) {
        // Show single item in inventory
        const invEntry = Object.values(usrDoc.inventory)[itemNumber - 1];
        if (invEntry){
          message.channel.send(invEntry.content);
        }
      } else {
        let inventory = Object.values(usrDoc.inventory)
          .filter(i => i.content)
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
        let sideBarColor = 0xff8040;
        if (usrDoc && usrDoc.preferences && usrDoc.preferences.sideBarColor) {
          sideBarColor = usrDoc.preferences.sideBarColor;
        }
        message.channel.send({
          embed: {
            color: sideBarColor,
            title: "**Inventory**",
            description: inventory + "\n\n" + footer
          }
        });
      }
    });
  },
  invColor: async function (message, db, bot, configs, trickArgs, userArgs) {
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
    const userRecord = await col.findOne({ userId: message.author.id });
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
  invCatch: async function (message, db, bot, configs, trickArgs, userArgs) {
    // Get user entry
    const user = message.author.username;
    if (!user) return;
    const channelId = trickArgs[1];
    if (!channelId) return;
    const hoursToWait = parseFloat(trickArgs[2]);
    const col = db.collection("users");
    await col.findOne({ userId: message.author.id }, function (err, usrDoc) {
      if (err) return;
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
          }
          if (!Utils.isAdmin(message)) {
            return;
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

        message.channel.send(configs.strings.catchSuccessMessage
          .replace("{userTag}", "<@" + message.author.id + ">")
          .replace("{itemName}", Utils.removeUrls(catched.content)) + "\n" +
          catched.content);
      });
    });
  },
  invBuy: async function (message, db, bot, configs, trickArgs, userArgs) {
    if (!userArgs || userArgs.length < 1) {
      message.channel.send(configs.strings.buyError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = userArgs[0] - 1;
    // find item in inventory
    const shopCol = db.collection("shop");
    let shop = await shopCol.find().toArray();
    if (!shop) return;
    if (!shop[itemNumber]) {
      message.channel.send(configs.strings.buyError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const user = message.author.username;
    if (!user) return;
    const usrCol = db.collection("users");
    let buyer = await usrCol.findOne({ userId: message.author.id });
    if (!parseInt(buyer.coins) || parseInt(shop[itemNumber].coins) > parseInt(buyer.coins)) {
      message.channel.send(configs.strings.buyNotEnoughCoins
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemId = shop[itemNumber].itemId;
    // Update seller
    let seller = await usrCol.findOne({ userId: shop[itemNumber].userId });
    if (seller) {
      if (!parseInt(seller.coins)) seller.coins = 0;
      seller.coins += parseInt(shop[itemNumber].coins);
      if (seller.inventory[itemId]) {
        seller.inventory[itemId].selling--;
        seller.inventory[itemId].quantity--;
        if (seller.inventory[itemId].quantity <= 0) {
          delete seller.inventory[itemId];
        }
      }
      await usrCol.save(seller);
    }
    // Update buyer
    buyer.coins = parseInt(buyer.coins) - parseInt(shop[itemNumber].coins);
    if (buyer.inventory[itemId]) {
      buyer.inventory[itemId].quantity++;
    } else {
      buyer.inventory[itemId] = {
        content: shop[itemNumber].item,
        quantity: 1
      };
    }
    await usrCol.save(buyer);

    // Update shop
    await shopCol.deleteOne(shop[itemNumber]);

    let buyMessage = configs.strings.buySuccess
      .replace("{sellerTag}", "<@" + seller.userId + ">")
      .replace("{paidCoins}", shop[itemNumber].coins);
    buyMessage = Utils.replaceTemplates(buyMessage, message, shop[itemNumber].item);
    message.channel.send(buyMessage);
  },
  invGive: async function (message, db, bot, configs, trickArgs, userArgs) {
    if (!userArgs || userArgs.length < 1) {
      message.channel.send(configs.strings.giveAwayError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = userArgs[0] - 1;
    const usrCol = db.collection("users");
    let user = await usrCol.findOne({ userId: message.author.id });
    if (!user) return;
    const invKeys = Object.keys(user.inventory);
    if (invKeys.length < itemNumber || itemNumber < 0) return;
    const key = invKeys[itemNumber];
    if (!key) return;
    const item = user.inventory[key];
    if (!item) return;
    // Make sure the item is not in the shop
    if (item.selling > 0) {
      message.channel.send(configs.strings.giveAwayErrorShop
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }

    let greatestCoinsValue = 10; // Default value
    configs.symbols.forEach(entry => {
      if (item.content.indexOf(entry.symbol) >= 0 && greatestCoinsValue < entry.giveAwayValue) {
        greatestCoinsValue = parseInt(entry.giveAwayValue);
      }
    });

    if (item.quantity <= 1) {
      delete user.inventory[key];
    } else {
      item.quantity--;
    }
    if (!user.coins)
      user.coins = greatestCoinsValue;
    else
      user.coins += greatestCoinsValue;
    usrCol.save(user);

    let textMessage = configs.strings.giveAwayMessage
      .replace("{receivedCoins}", greatestCoinsValue)
      .replace("{totalCoins}", user.coins)
      .replace("{itemName}", Utils.removeUrls(item.content))
      .replace("{userTag}", "<@" + message.author.id + ">");
    message.channel.send(textMessage);
  }
};

async function changeUser(message, db, callback) {
  // Get user entry
  const user = message.author.username;
  if (!user) return;
  const col = db.collection("users");
  await col.findOne({ userId: message.author.id }, async function (err, usrDoc) {
    if (err) return;
    if (!usrDoc) return;
    const textMessage = await callback(usrDoc);
    if (!textMessage) return;
    col.save(usrDoc);
    message.channel.send(textMessage);
  });
}
