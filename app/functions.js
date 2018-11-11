const Admin = require('./admin');
const Utils = require('./utils');
const Inventory = require('./inventory');
const Trade = require('./trade');
const General = require('./general');
const Discord = require('discord.js');

module.exports = {
  getFunctions: function () { return FUNCTIONS; },
  getCategories: function () { return CASTEGORIES; },
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
      ...resolveParams(message, db, bot, command, FUNCTIONS[name].setupParams, trickArgs),
      ...resolveParams(message, db, bot, command, FUNCTIONS[name].userParams, userArgs),
      ...resolveParams(message, db, bot, command, { userRecord: {} }, [message.author.id]),
    ];

    Promise.all(asyncParams).then(resolvedParams => {
      let params = {};
      resolvedParams.forEach(p => params[p.name] = p.value);
      let fn = FUNCTIONS[name].fn;
      return fn(message, db, bot, trickArgs, userArgs, params);
    }).catch(e => {
      const embed = new Discord.RichEmbed().setColor(Utils.hexColors.red)
        .setTitle("Error").setDescription(e.message);
      message.channel.send({ embed });
      return;
    });
  }
};

function resolveParams(message, db, bot, command, functionParameters, passedArguments) {
  let params = [];
  let argumentIndex = 0;
  Object.keys(functionParameters).forEach(paramName => {
    let param = PARAMETERS[paramName];
    if (!param) {
      params.push(Promise.resolve(() => {
        throw new Error("Parameter '" + paramName + "' for command '" + command + "' is not defined!");
      }));
      return;
    }
    const arg = passedArguments[argumentIndex];
    if (!arg) {
      params.push(Promise.resolve().then(() => {
        if (functionParameters[paramName].isOptional) {
          return { name: paramName, value: functionParameters[paramName].default };
        } else if (functionParameters[paramName].default) {
          param = PARAMETERS[functionParameters[paramName].default];
          return param(message, db, bot, arg)
            .then(resultValue => {
              return { name: paramName, value: resultValue };
            })
            .catch(e => {
              throw new Error(e.message + "\n\n" + getCommandHelpFormat(command, functionParameters));
            });
        } else {
          throw new Error(getCommandHelpFormat(command, functionParameters));
        }
      }));
    } else {
      params.push(param(message, db, bot, arg)
        .then(resultValue => {
          return { name: paramName, value: resultValue };
        })
        .catch(e => {
          throw new Error(e.message + "\n\n" + getCommandHelpFormat(command, functionParameters));
        }));
    }
    argumentIndex++;
  });
  return params;
}

function getCommandHelpFormat(command, functionParameters) {
  let msg = "**Use as follows:**\n" + command;
  Object.keys(functionParameters).forEach(paramName => {
    if (functionParameters[paramName].isOptional) {
      msg += " [" + paramName + "]";
    } else {
      msg += " {" + paramName + "}";
    }
  });
  return msg;
}

const CASTEGORIES = {
  Inventory: "Inventory",
  Trade: "Trade",
  Admin: "Admin",
  General: "General"
};

// All functions take same arguments
const FUNCTIONS = {
  "NON_FUNCTION": {
    category: CASTEGORIES.General,
    help: Utils.getString("nonFunctionHelp"),
    setupParams: {},
    userParams: {}
  },
  "CHANGE_COLOR_INVENTORY": {
    onlyAdmin: true,
    category: CASTEGORIES.Admin,
    fn: Inventory.invColor,
    help: Utils.getString("invColorHelp"),
    setupParams: {},
    userParams: { userTag: {}, hexColor: {} }
  },
  "SCAN_CHANNELS": {
    onlyAdmin: true,
    fn: Admin.scanChannels,
    category: CASTEGORIES.Admin,
    help: Utils.getString("scanChannels"),
    setupParams: {},
    userParams: { channelId: { isOptional: true } }
  },
  "NEW_TRICK": {
    onlyAdmin: true,
    fn: Admin.newTrick,
    category: CASTEGORIES.Admin,
    help: Utils.getString("newTrick"),
    setupParams: {},
    userParams: {}
  },
  "FORGET_TRICK": {
    onlyAdmin: true,
    fn: Admin.forgetTrick,
    category: CASTEGORIES.Admin,
    help: Utils.getString("forgetTrickHelp"),
    setupParams: {},
    userParams: { trickName: {} }
  },
  "LIST_TRICKS": {
    fn: General.listTricks,
    category: CASTEGORIES.General,
    help: Utils.getString("listTricksHelp"),
    setupParams: {},
    userParams: { pageNumber: { isOptional: true, default: 1 } }
  },
  "RANDOM_POST": {
    fn: General.randomPost,
    category: CASTEGORIES.General,
    help: Utils.getString("randomPostHelp"),
    setupParams: { channelId: {} },
    userParams: {}
  },
  "CATCH_INVENTORY": {
    fn: Inventory.invCatch,
    category: CASTEGORIES.Inventory,
    help: Utils.getString("invCatchHelp"),
    setupParams: { channelId: {} },
    userParams: {}
  },
  "LIST_INVENTORY": {
    fn: Inventory.invList,
    category: CASTEGORIES.Inventory,
    help: Utils.getString("invListHelp"),
    setupParams: {},
    userParams: {
      pageNumber: { isOptional: true, default: 1 },
      userTag: { default: "userRecord" },
    }
  },
  "SHOW_INVENTORY": {
    fn: Inventory.invShow,
    category: CASTEGORIES.Inventory,
    help: Utils.getString("invShowHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "TRASH_INVENTORY": {
    fn: Inventory.invTrash,
    category: CASTEGORIES.Inventory,
    help: Utils.getString("invTrashHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "SELL_INVENTORY": {
    fn: Trade.tradeSell,
    category: CASTEGORIES.Trade,
    help: Utils.getString("tradeSellHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {}, totalCost: {} },
  },
  "UNSELL_INVENTORY": {
    fn: Trade.tradeUnSell,
    category: CASTEGORIES.Trade,
    help: Utils.getString("tradeUnSellHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "SHOP_INVENTORY": {
    fn: Trade.tradeShop,
    category: CASTEGORIES.Trade,
    help: Utils.getString("tradeShopHelp"),
    setupParams: {},
    userParams: { pageNumber: { isOptional: true, default: 1 } }
  },
  "BUY_INVENTORY": {
    fn: Trade.tradeBuy,
    category: CASTEGORIES.Trade,
    help: Utils.getString("tradeBuyHelp"),
    setupParams: {},
    userParams: { shopItemNumber: {} }
  },
  "GIVE_AWAY_INVENTORY": {
    fn: Trade.tradeGive,
    category: CASTEGORIES.Trade,
    help: Utils.getString("tradeGiveHelp"),
    setupParams: {},
    userParams: { inventoryItemNumber: {} }
  },
  "SHOW_COINS": {
    fn: Trade.showCoins,
    category: CASTEGORIES.Trade,
    help: Utils.getString("showCoinsHelp"),
    setupParams: {},
    userParams: { userTag: { isOptional: true } }
  },
};

const PARAMETERS = {
  userRecord: async function (message, db, bot, arg) {
    if (!arg) arg = message.author.id;
    const col = db.collection("users");
    return await col.findOne({ userId: arg });
  },
  channelId: async function (message, db, bot, arg) {
    return arg;
  },
  trickName: async function (message, db, bot, arg) {
    return arg;
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
    return parseInt(arg);
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
  userTag: async function (message, db, bot, arg) {
    var numberPattern = /\d+/g;
    const userNumber = arg.match(numberPattern);
    //const targetUser = bot.users.find("id", userNumber[0]);
    const usrCol = db.collection("users");
    return await usrCol.findOne({ userId: userNumber[0] });
  },
  hexColor: async function (message, db, bot, arg) {
    return arg;
  },
  totalCost: async function (message, db, bot, arg) {
    if (isNaN(arg)) {
      throw new Error("Enter a numeric value in totalCost");
    }
    const cost = parseInt(arg);
    if (cost <= 0 || cost > 1000) {
      throw new Error("Invalid total cost. Enter a value between 1 and 1000");
    }
    return cost;
  }
};
