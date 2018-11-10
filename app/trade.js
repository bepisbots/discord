const Utils = require('./utils');
const Discord = require('discord.js');
const PAGE_SIZE = 12;

module.exports = {
  tradeShop: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    let pageNumber = params['pageNumber'] - 1;
    const col = db.collection("shop");
    await col.find().toArray(function (err, shop) {
      if (err) return;
      if (!shop) return;
      const totalPages = Math.ceil(shop.length / PAGE_SIZE);
      if (pageNumber + 1 > totalPages)
        pageNumber = totalPages - 1;
      const startElement = (pageNumber * PAGE_SIZE);
      const endElement = startElement + PAGE_SIZE;
      shop = shop.slice(startElement, endElement);
      let id = startElement + 1;

      let shopMessage = "";
      shop.forEach(i => {
        shopMessage += configs.strings.shopListing
          .replace("{id}", id)
          .replace("{itemName}", Utils.removeUrls(i.item))
          .replace("{userName}", i.username)
          .replace("{coins}", i.coins) + "\n";
        id++;
      });
      const title = configs.strings.shopTitle + (totalPages > 1 ? " Page " + (pageNumber + 1) + " of " + totalPages : "");
      message.channel.send({
        embed: {
          color: Utils.hexColors.yellow,
          title: title,
          description: shopMessage
        }
      });
    });
  },
  tradeUnSell: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 2) {
      message.channel.send(configs.strings.unSellError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    const userRecord = params['userRecord'];

    if (!userRecord.inventory) return;
    const invKeys = Object.keys(userRecord.inventory);
    if (invKeys.length < itemNumber || itemNumber < 0) return;
    const key = invKeys[itemNumber];
    if (!key) return;
    const item = userRecord.inventory[key];
    if (!item) return;
    if (!item.selling || item.selling <= 0) return;
    item.selling--;

    const userCol = db.collection("users");
    userCol.save(userRecord);

    const shopCol = db.collection("shop");
    await shopCol.deleteOne({ userId: message.author.id, itemId: key });
    message.channel.send(configs.strings.unSellSuccess
      .replace("{itemName}", Utils.removeUrls(item.content))
      .replace("{userTag}", "<@" + message.author.id + ">"));
  },
  tradeSell: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 3) {
      message.channel.send(configs.strings.sellError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    const coins = parseInt(cmdArgs[2]);
    if (!coins || coins <= 0 || coins > 1000) {
      message.channel.send(configs.strings.sellErrorCoins
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const userRecord = params['userRecord'];

    if (!userRecord.inventory) return;
    const invKeys = Object.keys(userRecord.inventory);
    if (invKeys.length < itemNumber || itemNumber < 0) return;
    const key = invKeys[itemNumber];
    if (!key) return;
    const item = userRecord.inventory[key];
    if (!item) return;
    if (!item.selling) {
      item.selling = 1;
    } else if (item.quantity >= item.selling + 1) {
      item.selling++;
    } else
      return;

    const userCol = db.collection("users");
    userCol.save(userRecord);

    const shopCol = db.collection("shop");
    await shopCol.insertOne({
      itemId: key,
      userId: message.author.id,
      username: message.author.username,
      item: item.content,
      coins: parseInt(coins)
    });
    message.channel.send(configs.strings.sellSuccess
      .replace("{itemName}", Utils.removeUrls(item.content))
      .replace("{userTag}", "<@" + message.author.id + ">")
    );
  },
  tradeBuy: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    if (!userArgs || userArgs.length < 1) {
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.red)
        .setDescription(configs.strings.buyError
          .replace("{userTag}", "<@" + message.author.id + ">"));
      message.channel.send({ embed });
      return;
    }
    // find item in inventory
    const shopCol = db.collection("shop");
    const shopItem = params['shopItemNumber'];

    const usrCol = db.collection("users");

    let buyer = params['userRecord'];
    if (!parseInt(buyer.coins) || parseInt(shopItem.coins) > parseInt(buyer.coins)) {
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.red)
        .setDescription(configs.strings.buyNotEnoughCoins
          .replace("{userTag}", "<@" + message.author.id + ">"));
      message.channel.send({ embed });
      return;
    }
    const itemId = shopItem.itemId;
    // Update seller
    let seller = await usrCol.findOne({ userId: shopItem.userId });
    if (seller) {
      if (!parseInt(seller.coins)) seller.coins = 0;
      seller.coins += parseInt(shopItem.coins);
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
    if (buyer.userId === seller.userId) {
      buyer = seller;
    }
    buyer.coins = parseInt(buyer.coins) - parseInt(shopItem.coins);
    if (buyer.inventory[itemId]) {
      buyer.inventory[itemId].quantity++;
    } else {
      buyer.inventory[itemId] = {
        content: shopItem.item,
        quantity: 1
      };
    }
    await usrCol.save(buyer);

    // Update shop
    await shopCol.deleteOne(shopItem);

    let buyMessage = configs.strings.buySuccess
      .replace("{sellerTag}", "<@" + seller.userId + ">")
      .replace("{paidCoins}", shopItem.coins)
      .replace("{itemName}", Utils.removeUrls((shopItem.item)));
    buyMessage = Utils.replaceTemplates(buyMessage, message, null);
    message.channel.send(buyMessage);
  },
  tradeGive: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    if (!userArgs || userArgs.length < 1) {
      message.channel.send(configs.strings.giveAwayError
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = userArgs[0] - 1;
    const usrCol = db.collection("users");
    let user = params['userRecord'];
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
  },
  showCoins: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    let userRecord;
    let userId;
    userRecord = params['userTag'];
    if (!userRecord) {
      userRecord = params['userRecord'];
    }
    userId = userRecord.userId;
    if (!userRecord) {
      return;
    }
    message.channel.send(configs.strings.invShowTotalCoins
      .replace("{coins}", userRecord.coins || 0)
      .replace("{userTag}", "<@" + userId + ">"));
  }
};