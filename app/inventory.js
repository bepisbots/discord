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
          .replace("{username}", i.username)
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
        .replace("{username}", message.author.username));
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
        .replace("{username}", message.author.username);
    });
  },
  invSell: async function (message, db, bot, configs, trickArgs, userArgs) {
    const cmdArgs = message.content.trim().split(" ");;
    if (!cmdArgs || cmdArgs.length < 3) {
      message.channel.send(configs.strings.sellError
        .replace("{username}", message.author.username));
      return;
    }
    const itemNumber = cmdArgs[1] - 1;
    const coins = cmdArgs[2];
    if (!coins || coins <= 0 || coins > 100) {
      message.channel.send(configs.strings.sellErrorCoins
        .replace("{username}", message.author.username));
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
        coins: coins
      });
      return configs.strings.sellSuccess
        .replace("{itemName}", Utils.removeUrls(item.content))
        .replace("{username}", message.author.username);
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
    const col = db.collection("users");
    await col.findOne({ userId: message.author.id }, function (err, usrDoc) {
      if (err) return;
      if (!usrDoc) return;
      if (!usrDoc.inventory) return;
      let count = 1;
      let inv = "**Inventory**\n" +
        Object.values(usrDoc.inventory)
          .filter(i => i.content)
          .map(i => (!i.selling ? configs.strings.invItem : configs.strings.invItemForSale)
            .replace("{id}", count++)
            .replace("{itemName}", Utils.removeUrls(i.content))
            .replace("{quantityOwned}", i.quantity)
            .replace("{quantityForSale}", i.selling)
            .replace("{username}", message.author.username))
          .reduce((i1, i2) => i1 + "\n" + i2);
      inv += "\n\n" + configs.strings.invShowTotalCoins
        .replace("{coins}", usrDoc.coins || 0)
        .replace("{username}", message.author.username);
      message.channel.send(inv);
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
              .replace("{username}", user)
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
          .replace("{username}", message.author.username)
          .replace("{itemName}", Utils.removeUrls(catched.content)) + "\n" +
          catched.content);
      });
    });
  },
  invBuy: async function (message, db, bot, configs, trickArgs, userArgs) {
    if (!userArgs || userArgs.length < 1) {
      message.channel.send(configs.strings.buyErro
        .replace("{username}", message.author.username));
      return;
    }
    const itemNumber = userArgs[0] - 1;
    // find item in inventory
    const shopCol = db.collection("shop");
    let shop = await shopCol.find().toArray();
    if (!shop) return;
    if (!shop[itemNumber]) {
      message.channel.send(configs.strings.buyError
        .replace("{username}", message.author.username));
      return;
    }
    const user = message.author.username;
    if (!user) return;
    const usrCol = db.collection("users");
    let buyer = await usrCol.findOne({ userId: message.author.id });
    if (!buyer.coins || shop[itemNumber].coins > buyer.coins) {
      message.channel.send(configs.strings.buyNotEnoughCoins
        .replace("{username}", message.author.username));
      return;
    }
    let seller = await usrCol.findOne({ userId: shop[itemNumber].userId });
    if (seller) {
      seller.coins += shop[itemNumber].coins;
      await usrCol.save(seller);
    }
    buyer.coins = buyer.coins - shop[itemNumber].coins;
    await usrCol.save(buyer);
    await shopCol.deleteOne({ _id: !shop[itemNumber]._id });

    const sellerUser =  bot.users.get(seller.userId);

    let buyMessage = "**{username}**, you have bought {itemName} from **@{sellerTag}** for {paidCoins} bepis"
      .replace("{itemName}", Utils.removeUrls(shop[itemNumber].item.content))
      .replace("{username}", message.author.username)
      .replace("{sellerTag}", (sellerUser ? sellerUser.tag: "Unknown"))
      .replace("{paidCoins}", shop[itemNumber].coins);

    message.channel.send(buyMessage);


    //   const shopCol = db.collection("shop");
    //   await shopCol.insertOne({
    //     itemId: key,
    //     username: message.author.username,
    //     item: item.content,
    //     coins: coins
    //   });
    //   return configs.strings.sellSuccess.replace("{itemName}", Utils.removeUrls(item.content));
    // });

  },
  invGive: async function (message, db, bot, configs, trickArgs, userArgs) {
    if (!userArgs || userArgs.length < 1) {
      message.channel.send(configs.strings.giveAwayError
        .replace("{username}", message.author.username));
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

    let greatestCoinsValue = 10; // Default value
    configs.symbols.forEach(entry => {
      if (item.content.indexOf(entry.symbol) >= 0 && greatestCoinsValue < entry.giveAwayValue) {
        greatestCoinsValue = entry.giveAwayValue;
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
      .replace("{username}", message.author.username);
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
