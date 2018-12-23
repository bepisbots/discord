const Admin = require('./admin');
const Utils = require('./utils');
const Inventory = require('./inventory');
const Trade = require('./trade');
const General = require('./general');
const Discord = require('discord.js');

module.exports = {
  exists: function (name) {
    return (Object.keys(FUNCTIONS).find(f => f === name));
  },
  run: async function (command, name, message, db, bot, trickArgs, userArgs) {
    const isAdmin = Utils.isAdmin(message);
    if (FUNCTIONS[name].onlyAdmin && !isAdmin) {
      return;
    }
    // Validate and resolve function parameters
    let asyncParams = [
      ...General.resolveParams(message, db, bot, command, FUNCTIONS[name].setupParams, trickArgs, PARAMETERS),
      ...General.resolveParams(message, db, bot, command, FUNCTIONS[name].userParams, userArgs, PARAMETERS),
      ...General.resolveParams(message, db, bot, command, { userRecord: {} }, [message.author.id], PARAMETERS),
    ];

    Promise.all(asyncParams).then(resolvedParams => {
      let params = {};
      resolvedParams.forEach(p => params[p.name] = p.value);
      let fn = FUNCTIONS[name].fn;
      return fn(message, db, bot, trickArgs, userArgs, params, FUNCTIONS, CATEGORIES);
    }).catch(e => {
      console.warn(e);
      const embed = new Discord.RichEmbed().setColor(Utils.hexColors.red)
        .setTitle("Error").setDescription(e.message);
      Utils.sendMessage(db, message, { embed });
      return;
    });
  }
};

const CATEGORIES = {
  Inventory: "Inventory",
  Trade: "Trade",
  Admin: "Admin",
  General: "General"
};

// All functions take same arguments
const FUNCTIONS = {
  "NON_FUNCTION": {
    category: CATEGORIES.General,
    help: Utils.getString("nonFunctionHelp"),
    setupParams: {},
    userParams: {}
  },
  "CHANGE_COLOR_INVENTORY": {
    onlyAdmin: true,
    category: CATEGORIES.Admin,
    fn: Inventory.invColor,
    help: Utils.getString("invColorHelp"),
    setupParams: {},
    userParams: { userTag: {}, hexColor: {} }
  },
  "SCAN_CHANNELS": {
    onlyAdmin: true,
    fn: Admin.scanChannels,
    category: CATEGORIES.Admin,
    help: Utils.getString("scanChannels"),
    setupParams: {},
    userParams: { channelId: { isOptional: true } }
  },
  "NEW_TRICK": {
    onlyAdmin: true,
    fn: Admin.newTrick,
    category: CATEGORIES.Admin,
    help: Utils.getString("newTrick"),
    setupParams: {},
    userParams: {}
  },
  "FORGET_TRICK": {
    onlyAdmin: true,
    fn: Admin.forgetTrick,
    category: CATEGORIES.Admin,
    help: Utils.getString("forgetTrickHelp"),
    setupParams: {},
    userParams: { trickName: {} }
  },
  "GENERATE_INVITE": {
    fn: General.generateInvite,
    category: CATEGORIES.General,
    help: Utils.getString("generateInviteHelp"),
    setupParams: { channelId: {} },
    userParams: {}
  },
  "LIST_TRICKS": {
    fn: General.listTricks,
    category: CATEGORIES.General,
    help: Utils.getString("listTricksHelp"),
    setupParams: {},
    userParams: { pageNumber: { isOptional: true, default: 1 } }
  },
  "RANDOM_POST": {
    fn: General.randomPost,
    category: CATEGORIES.General,
    help: Utils.getString("randomPostHelp"),
    setupParams: { channelId: {} },
    userParams: {}
  },
  "CATCH_INVENTORY": {
    fn: Inventory.invCatch,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invCatchHelp"),
    setupParams: { channelId: {} },
    userParams: {}
  },
  "LIST_INVENTORY": {
    fn: Inventory.invList,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invListHelp"),
    setupParams: {},
    userParams: {
      pageNumber: { isOptional: true, default: 1 },
      userTag: { default: "userRecord" },
    }
  },
  "LIST_INVENTORY_ALL": {
    fn: Inventory.invListAll,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invListAllHelp"),
    setupParams: {},
    userParams: {
      userTag: { default: "userRecord" },
    }
  },
  "SHOW_INVENTORY": {
    fn: Inventory.invShow,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invShowHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "TRASH_INVENTORY": {
    fn: Inventory.invTrash,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invTrashHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "ASSIGN_NICKNAME": {
    fn: Inventory.invNick,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invNickHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {}, nickname: { multipleWords: true } },
  },
  "RESET_NICKNAME": {
    fn: Inventory.invClearNick,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invClearNickHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "FUSE_INVENTORY": {
    fn: Inventory.invFuse,
    category: CATEGORIES.Inventory,
    help: Utils.getString("invFuse"),
    setupParams: { channelId: {} },
    userParams: { inventoryItemNumber1: {}, inventoryItemNumber2: {} },
  },
  "SELL_INVENTORY": {
    fn: Trade.tradeSell,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeSellHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {}, coins: {} },
  },
  "UNSELL_INVENTORY": {
    fn: Trade.tradeUnSell,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeUnSellHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "SHOP_INVENTORY": {
    fn: Trade.tradeShop,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeShopHelp"),
    setupParams: {},
    userParams: { pageNumber: { isOptional: true, default: 1 } }
  },
  "BUY_INVENTORY": {
    fn: Trade.tradeBuy,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeBuyHelp"),
    setupParams: {},
    userParams: { shopItemNumber: {} }
  },
  "TRADE_INVENTORY": {
    fn: Trade.trade,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeHelp"),
    setupParams: {},
    userParams: {
      userTag: {}, inventoryItemNumber: {},
    }
  },
  "GIVE_AWAY_INVENTORY": {
    fn: Trade.tradeGive,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeGiveHelp"),
    setupParams: {},
    userParams: {
      inventoryItemNumber: {},
      userTag: { isOptional: true, default: null }
    }
  }, "FLIP_COIN": {
    fn: Trade.flipCoin,
    category: CATEGORIES.Trade,
    help: Utils.getString("tradeFlipCoinHelp"),
    setupParams: {},
    userParams: {
      coins: {}
    }
  },
  "ASSIGN_INVENTORY": {
    onlyAdmin: true,
    fn: Trade.assign,
    category: CATEGORIES.Admin,
    help: Utils.getString("assignInventoryHelp"),
    setupParams: {},
    userParams: {
      userTag: {},
      itemTitle: { multipleWords: true }
    }
  },
  // "RESTORE_INVENTORY": {
  //   onlyAdmin: true,
  //   fn: Inventory.restore,
  //   category: CATEGORIES.Admin,
  //   help: Utils.getString("restoreInventoryHelp"),
  //   setupParams: { channelId: {},  channelId: {} },
  //   userParams: {
  //   }
  // },
  "SHOW_COINS": {
    fn: Trade.showCoins,
    category: CATEGORIES.Trade,
    help: Utils.getString("showCoinsHelp"),
    setupParams: {},
    userParams: { userTag: { isOptional: true } }
  },
  "GIVE_COINS": {
    fn: Trade.giveCoins,
    category: CATEGORIES.Trade,
    help: Utils.getString("giveCoinsHelp"),
    setupParams: {},
    userParams: { userTag: {}, coins: {} }
  },
  "CREATE_COINS": {
    onlyAdmin: true,
    fn: Trade.createCoins,
    category: CATEGORIES.Admin,
    help: Utils.getString("createCoinsHelp"),
    setupParams: {},
    userParams: { userTag: {}, coins: {} }
  },
};

const PARAMETERS = {
  itemTitle: async function (message, db, bot, arg) {
    var regex = /^.{2,50}$/;
    if (!regex.test(arg)) {
      throw new Error("Invalid title!");
    }
    return arg;
  },
  nickname: async function (message, db, bot, arg) {
    var regex = /^.{2,50}$/;
    if (!regex.test(arg)) {
      throw new Error("Invalid name!");
    }
    return arg;
  },
  userRecord: async function (message, db, bot, arg) {
    if (!arg) arg = message.author.id;
    const col = db.collection("users");

    let userRecord = await col.findOne({ userId: arg });
    if (!userRecord) {
      userRecord = {
        userId: message.author.id,
        username: message.author.username,
        createdTimestamp: message.createdTimestamp,
        inventory: {},
      };
      col.insertOne(userRecord);
    }

    return userRecord;
  },
  channelId: async function (message, db, bot, arg) {
    return arg;
  },
  trickName: async function (message, db, bot, arg) {
    var regex = /^\S{2,50}$/;
    if (!regex.test(arg)) {
      throw new Error("Invalid name!");
    }
    return arg.toLowerCase();
  },
  pageNumber: async function (message, db, bot, arg) {
    if (isNaN(arg)) {
      throw new Error("Enter a numeric value in pageNumber");
    }
    const pageNumber = parseInt(arg);
    if (pageNumber < 1) {
      throw new Error("Enter a number greather than 0");
    }
    return pageNumber;
  },
  inventoryItemNumber: async function (message, db, bot, arg) {
    if (isNaN(arg)) {
      throw new Error("Enter a numeric value in inventoryItemNumber");
    }
    let itemNumber = parseInt(arg);
    if (itemNumber < 1) {
      throw new Error("Enter a value greather than 0 for inventoryItemNumber");
    }
    return itemNumber;
  },
  inventoryItemNumber1: function (message, db, bot, arg) {
    return PARAMETERS.inventoryItemNumber(message, db, bot, arg)
  },
  inventoryItemNumber2: function (message, db, bot, arg) {
    return PARAMETERS.inventoryItemNumber(message, db, bot, arg)
  },
  shopItemNumber: async function (message, db, bot, arg) {
    if (isNaN(arg)) {
      throw new Error("Enter a numeric value in shopItemNumber");
    }
    const itemNumber = parseInt(arg);
    if (itemNumber <= 0) throw new Error("Invalid shop item number");
    // find item in inventory
    const shopCol = db.collection("shop");
    return shopCol.find().toArray().then(shop => {
      if (!shop) throw new Error("Database error: can't read 'Shop'");
      if (!shop[itemNumber - 1]) throw new Error("Invalid shop item number");
      return shop[itemNumber - 1];
    });
  },
  botId: async function (message, db, bot, arg) {
    var numberPattern = /\d+/g;
    const userNumber = arg.match(numberPattern);
    return userNumber[0];
  },
  userTag: async function (message, db, bot, arg) {
    var numberPattern = /\d+/g;
    const userNumber = arg.match(numberPattern);
    const targetUser = bot.users.find("id", userNumber[0]);
    const usrCol = db.collection("users");
    let userRecord = await usrCol.findOne({ userId: userNumber[0] });
    if (userRecord === null) {
      userRecord = {
        userId: targetUser.id,
        username: targetUser.username,
        createdTimestamp: new Date(),
        inventory: {},
      };
    }
    return userRecord;
  },
  hexColor: async function (message, db, bot, arg) {
    return arg;
  },
  coins: async function (message, db, bot, arg) {
    if (isNaN(arg)) {
      throw new Error("Enter a numeric value");
    }
    const coins = parseInt(arg);
    return coins;
  },
  coins: async function (message, db, bot, arg) {
    if (isNaN(arg)) {
      throw new Error("Enter a numeric value for coins".replace('coins', Utils.getString('coins')));
    }
    const cost = parseInt(arg);
    if (cost <= 0 || cost > 1000) {
      throw new Error("Invalid coins. Enter a value between 1 and 1000".replace('coins', Utils.getString('coins')));
    }
    return cost;
  }
};
