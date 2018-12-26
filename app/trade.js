const Utils = require('./utils');
const Discord = require('discord.js');
const PAGE_SIZE = 12;

module.exports = {
  flipCoin: async function (message, db, bot, trickArgs, userArgs, params) {
    const user = params['userRecord'];
    let coins = params['coins'];

    if (user.coins < coins) {
      Utils.sendMessage(db, message, Utils.getString("notEnoughCoins")
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    if (!user.coins)
      user.coins = coins;

    let won = Math.random() >= 0.5;
    if (won) {
      user.coins += coins;
    } else {
      user.coins -= coins;
    }
    const usrCol = db.collection("users");
    usrCol.save(user);

    const text = Utils.getString(won ? "flipCoinWonMessage" : "flipCoinLostMessage")
      .replace("{userTag}", "<@" + message.author.id + ">")
      .replace("{totalCoins}", coins)
    Utils.sendMessage(db, message, text);
  },
  giveCoins: async function (message, db, bot, trickArgs, userArgs, params) {
    let user = params['userTag'];
    let coins = params['coins'];
    const roles = trickArgs[1];
    if (!Utils.isInAnyRole(db, message, roles)) return;

    const usrCol = db.collection("users");
    let sourceUser = params['userRecord'];

    if (sourceUser.userId === user.userId) {
      return;
    }

    if (sourceUser.coins < coins) {
      Utils.sendMessage(db, message, Utils.getString("notEnoughCoins")
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    sourceUser.coins -= coins;
    usrCol.save(sourceUser);

    if (!user.coins)
      user.coins = coins;
    else
      user.coins += coins;
    usrCol.save(user);

    const text = Utils.getString("giveCoinsSuccessMessage")
      .replace("{userTag}", "<@" + user.userId + ">")
      .replace("{totalCoins}", user.coins)
    const embed = new Discord.RichEmbed()
      .setColor(Utils.hexColors.greyDiscord)
      .setDescription(text);
    Utils.sendMessage(db, message, { embed });
  },
  createCoins: async function (message, db, bot, trickArgs, userArgs, params) {
    let user = params['userTag'];
    let coins = params['coins'];
    const roles = trickArgs[1];
    if (!Utils.isInAnyRole(db, message, roles)) return;

    const usrCol = db.collection("users");
    if (!user.coins)
      user.coins = coins;
    else
      user.coins += coins;
    usrCol.save(user);

    const text = Utils.getString("giveCoinsSuccessMessage")
      .replace("{userTag}", "<@" + user.userId + ">")
      .replace("{totalCoins}", user.coins)
    const embed = new Discord.RichEmbed()
      .setColor(Utils.hexColors.greyDiscord)
      .setDescription(text);
    Utils.sendMessage(db, message, { embed });
  },
  assign: async function (message, db, bot, trickArgs, userArgs, params) {
    let userRecord = params['userTag'];
    let itemTitle = params['itemTitle'];
    const roles = trickArgs[1];
    if (!Utils.isInAnyRole(db, message, roles)) return;

    const posts = db.collection("posts");
    posts.findOne({ title: itemTitle }, { limit: 1 }, function (err, catched) {
      if (err) return;
      if (!catched) {
        Utils.sendMessage(db, message, "Title not found in channel. Make sure title is exact");
        return;
      }
      const col = db.collection("users");

      const igmId = catched._id.toString();
      if (userRecord.inventory[igmId]) {
        userRecord.inventory[igmId].quantity++;
      } else {
        userRecord.inventory[igmId] = {
          content: catched.content,
          quantity: 1
        };
      }
      col.save(userRecord);

      const text = Utils.getString("giftSuccessMessage")
        .replace("{userTag}", "<@" + userRecord.userId + ">")
        .replace("{itemName}", Utils.getItenName(catched))
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.greyDiscord)
        .setDescription(text)
        .setImage(Utils.getUrl(catched.content));
      Utils.sendMessage(db, message, { embed });
    });
  },
  tradeShop: async function (message, db, bot, trickArgs, userArgs, params) {
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
        shopMessage += Utils.getString("shopListing")
          .replace("{id}", id)
          .replace("{itemName}", Utils.removeUrls(i.item))
          .replace("{userName}", i.username)
          .replace("{coins}", i.coins) + "\n";
        id++;
      });
      const title = Utils.getString("shopTitle") + (totalPages > 1 ? " Page " + (pageNumber + 1) + " of " + totalPages : "");
      Utils.sendMessage(db, message, {
        embed: {
          color: Utils.hexColors.yellow,
          title: title,
          description: shopMessage
        }
      });
    });
  },
  tradeUnSell: async function (message, db, bot, trickArgs, userArgs, params) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 2) {
      Utils.sendMessage(db, message, Utils.getString("unSellError")
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
    Utils.sendMessage(db, message, Utils.getString("unSellSuccess")
      .replace("{itemName}", Utils.getItenName(item))
      .replace("{userTag}", "<@" + message.author.id + ">"));
  },
  tradeSell: async function (message, db, bot, trickArgs, userArgs, params) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 3) {
      Utils.sendMessage(db, message, Utils.getString("sellError")
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    const coins = parseInt(cmdArgs[2]);
    if (!coins || coins <= 0 || coins > 1000) {
      Utils.sendMessage(db, message, Utils.getString("sellErrorCoins")
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
    Utils.sendMessage(db, message, Utils.getString("sellSuccess")
      .replace("{itemName}", Utils.getItenName(item))
      .replace("{userTag}", "<@" + message.author.id + ">")
    );
  },
  tradeBuy: async function (message, db, bot, trickArgs, userArgs, params) {
    if (!userArgs || userArgs.length < 1) {
      const embed = new Discord.RichEmbed()
        .setColor(Utils.hexColors.red)
        .setDescription(Utils.getString("buyError")
          .replace("{userTag}", "<@" + message.author.id + ">"));
      Utils.sendMessage(db, message, { embed });
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
        .setDescription(Utils.getString("buyNotEnoughCoins")
          .replace("{userTag}", "<@" + message.author.id + ">"));
      Utils.sendMessage(db, message, { embed });
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

    let buyMessage = Utils.getString("buySuccess")
      .replace("{sellerTag}", "<@" + seller.userId + ">")
      .replace("{paidCoins}", shopItem.coins)
      .replace("{itemName}", Utils.removeUrls((shopItem.item)));
    buyMessage = Utils.replaceTemplates(buyMessage, message, null);
    Utils.sendMessage(db, message, buyMessage);
  },
  tradeGive: async function (message, db, bot, trickArgs, userArgs, params) {
    let user = params['userRecord'];
    const targetUser = params["userTag"];
    let itemNumber = params['inventoryItemNumber'] - 1;
    const key = Utils.getInventoryItemKeyFromNumber(user, itemNumber);
    const item = user.inventory[key];

    // Make sure the item is not in the shop
    if (item.selling > 0) {
      Utils.sendMessage(db, message, Utils.getString("giveAwayErrorShop")
        .replace("{userTag}", "<@" + message.author.id + ">"));
      return;
    }

    let greatestCoinsValue = 10; // Default value
    Utils.getConfigs().symbols.forEach(entry => {
      if (item.content.indexOf(entry.symbol) >= 0 && greatestCoinsValue < entry.giveAwayValue) {
        greatestCoinsValue = parseInt(entry.giveAwayValue);
      }
    });

    if (item.quantity <= 1) {
      delete user.inventory[key];
    } else {
      item.quantity--;
    }
    if (!targetUser) {
      if (!user.coins)
        user.coins = greatestCoinsValue;
      else
        user.coins += greatestCoinsValue;
    }

    const usrCol = db.collection("users");
    usrCol.save(user);

    if (targetUser) {
      if (targetUser.inventory[key]) {
        targetUser.inventory[key].quantity++;
      } else {
        targetUser.inventory[key] = {
          content: item.content,
          quantity: 1
        };
      }
      usrCol.save(targetUser);
    }
    let textMessage = (targetUser ? Utils.getString("donateMessage") : Utils.getString("giveAwayMessage"))
      .replace("{receivedCoins}", greatestCoinsValue)
      .replace("{totalCoins}", user.coins)
      .replace("{itemName}", Utils.getItenName(item))
      .replace("{userTag}", "<@" + message.author.id + ">")
      .replace("{userTagReceiver}", "<@" + (targetUser ? targetUser.userId : "") + ">");
    Utils.sendMessage(db, message, textMessage);
  },
  trade: async function (message, db, bot, trickArgs, userArgs, params) {
    const userRecord = params['userRecord'];
    const targetUser = params["userTag"];
    const itemNumber = params['inventoryItemNumber'] - 1;
    const itemKey = Utils.getInventoryItemKeyFromNumber(userRecord, itemNumber);
    const item = userRecord.inventory[itemKey];
    const that = this;

    // Make sure the item is not in the shop
    if (item.selling > 0) {
      Utils.sendMessage(db, message, Utils.getString("tradeErrorShop")
        .replace("{userTag}", "<@" + userRecord.userId + ">"));
      return;
    }

    // Check if there's a pending trade
    const tradeIdx = targetUser.userId + "-" + userRecord.userId;
    if (this.pendingTrades && this.pendingTrades[tradeIdx]) {
      // Execute trade
      const tradeItem = that.pendingTrades[tradeIdx];
      delete that.pendingTrades[tradeIdx];
      transferItem(db, targetUser, userRecord, tradeItem.key, tradeItem.item);
      transferItem(db, userRecord, targetUser, itemKey, item);

      let textMessage = Utils.getString("tradeMessageSuccess")
        .replace("{itemName1}", Utils.removeUrls(tradeItem.item.content))
        .replace("{itemName2}", Utils.removeUrls(item.content))
        .replace("{userTag}", "<@" + targetUser.userId + ">")
        .replace("{userTagReceiver}", "<@" + userRecord.userId + ">");
      Utils.sendMessage(db, message, textMessage);
      return;
    }

    let textMessage = Utils.getString("tradeMessage")
      .replace("{itemName}", Utils.removeUrls(item.content))
      .replace("{userTag}", "<@" + userRecord.userId + ">")
      .replace("{userTagReceiver}", "<@" + targetUser.userId + ">");

    const acceptedTrade = function () {
      if (!that.pendingTrades) that.pendingTrades = {};
      const tradeIdx = userRecord.userId + "-" + targetUser.userId;
      that.pendingTrades[tradeIdx] = { key: itemKey, item: item };
      Utils.sendMessage(db, message, Utils.getString("tradeMessageAccepted")
        .replace("{itemName}", Utils.removeUrls(item.content))
        .replace("{userTag}", "<@" + userRecord.userId + ">")
        .replace("{userTagReceiver}", "<@" + targetUser.userId + ">"));
    }

    const msg = await Utils.sendMessage(db, message, textMessage);

    const reactionFilter = function (reaction, user) {
      return user.id === targetUser.userId &&
        reaction.emoji.name === '🆗';
    }

    msg.awaitReactions(reactionFilter,
      { max: 1, time: 60 * 1000 * 5, errors: ['time'] })
      .then(collected => acceptedTrade());
  },
  showCoins: async function (message, db, bot, trickArgs, userArgs, params) {
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
    let text = Utils.getString("invShowTotalCoins")
      .replace("{coins}", userRecord.coins || 0)
      .replace("{userTag}", "<@" + userId + ">");
    Utils.sendMessage(db, message, text);
  }
};

const transferItem = function (db, sourceUser, targetUser, itemKey, item) {
  if (item.quantity <= 1) {
    delete sourceUser.inventory[itemKey];
  } else {
    item.quantity--;
  }
  const usrCol = db.collection("users");
  usrCol.save(sourceUser);

  if (targetUser.inventory[itemKey]) {
    targetUser.inventory[itemKey].quantity++;
  } else {
    targetUser.inventory[itemKey] = {
      content: item.content,
      quantity: 1
    };
  }
  usrCol.save(targetUser);
}

