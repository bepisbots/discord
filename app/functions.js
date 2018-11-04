const Admin = require('./admin');
const Utils = require('./utils');
const Inventory = require('./inventory');
const General = require('./general');
const Discord = require('discord.js');

module.exports = {
  getFunctions: function () { return FUNCTIONS; },
  exists: function (name) {
    return (Object.keys(FUNCTIONS).find(f => f === name));
  },
  run: async function (command, name, message, db, bot, configs, trickArgs, userArgs) {
    const isAdmin = Utils.isAdmin(message);
    if (FUNCTIONS[name].onlyAdmin && !isAdmin) {
      return;
    }
    // Validate and resolve function parameters
    let asyncParams = [
      ...resolveParams(message, db, bot, configs, command, FUNCTIONS[name].setupParams, trickArgs),
      ...resolveParams(message, db, bot, configs, command, FUNCTIONS[name].userParams, userArgs)
    ];

    Promise.all(asyncParams).then(resolvedParams => {
      let params = {};
      resolvedParams.forEach(p => params[p.name] = p.value);
      let fn = FUNCTIONS[name].fn;
      return fn(message, db, bot, configs, trickArgs, userArgs, params);
    }).catch(e => {
      const embed = new Discord.RichEmbed().setColor(Utils.hexColors.red)
        .setTitle("Error").setDescription(e.message);
      message.channel.send({ embed });
      return;
    });
  }
};

function resolveParams(message, db, bot, configs, command, functionParameters, passedArguments) {
  let params = [];
  let argumentIndex = 0;
  Object.keys(functionParameters).forEach(paramName => {
    const param = PARAMETERS[paramName];
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
        } else {
          throw new Error(getCommandHelpFormat(command, functionParameters));
        }
      }));
    } else {
      params.push(param(message, db, bot, configs, arg)
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

// All functions take same arguments
const FUNCTIONS = {
  "SCAN_CHANNELS": {
    onlyAdmin: true,
    fn: Admin.scanChannels,
    help: "!trick [name] SCAN_CHANNELS (Admin Only)",
    setupParams: {},
    userParams: { channelId: { isOptional: true } }
  },
  "NEW_TRICK": {
    onlyAdmin: true,
    fn: Admin.newTrick,
    help: "!trick [name] NEW_TRICK (Admin Only)",
    setupParams: {},
    userParams: {}
  },
  "FORGET_TRICK": {
    onlyAdmin: true,
    fn: Admin.forgetTrick,
    help: "!trick [name] FORGET_TRICK (Admin Only)",
    setupParams: {},
    userParams: { trickName: {} }
  },
  "LIST_TRICKS": {
    fn: General.listTricks,
    help: "!trick [name] LIST_TRICKS",
    setupParams: {},
    userParams: {}
  },
  "RANDOM_POST": {
    fn: General.randomPost,
    help: "!trick [name] RANDOM_POST [channelId]",
    setupParams: { channelId: {} },
    userParams: {}
  },
  "CATCH_INVENTORY": {
    fn: Inventory.invCatch,
    help: "!trick [name] CATCH_INVENTORY [channelId] [hoursToWait]",
    setupParams: { channelId: {} },
    userParams: {}
  },
  "LIST_INVENTORY": {
    fn: Inventory.invList,
    help: "!trick [name] LIST_INVENTORY",
    setupParams: {},
    userParams: { pageNumber: { isOptional: true, default: 0 } }
  },
  "SHOW_INVENTORY": {
    fn: Inventory.invShow,
    help: "!trick [name] SHOW_INVENTORY",
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "TRASH_INVENTORY": {
    fn: Inventory.invTrash,
    help: "!trick [name] TRASH_INVENTORY",
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "SELL_INVENTORY": {
    fn: Inventory.invSell,
    help: "!trick [name] SELL_INVENTORY",
    setupParams: {},
    userParams: { inventoryItemNumber: {}, totalCost: {} },
  },
  "UNSELL_INVENTORY": {
    fn: Inventory.invUnSell,
    help: "!trick [name] UNSELL_INVENTORY",
    setupParams: {},
    userParams: { inventoryItemNumber: {} },
  },
  "SHOP_INVENTORY": {
    fn: Inventory.invShop,
    help: "!trick [name] SHOP_INVENTORY",
    setupParams: {},
    userParams: { pageNumber: { isOptional: true, default: 0 } }
  },
  "BUY_INVENTORY": {
    fn: Inventory.invBuy,
    help: "!trick [name] BUY_INVENTORY",
    setupParams: {},
    userParams: { shopItemNumber: {} }
  },
  "GIVE_AWAY_INVENTORY": {
    fn: Inventory.invGive,
    help: "!trick [name] GIVE_AWAY_INVENTORY",
    setupParams: {},
    userParams: { inventoryItemNumber: {} }
  },
  "CHANGE_COLOR_INVENTORY": {
    onlyAdmin: true,
    fn: Inventory.invColor,
    help: "!trick [name] CHANGE_COLOR_INVENTORY",
    setupParams: {},
    userParams: { userTag: {}, hexColor: {} }
  },
};

const PARAMETERS = {
  channelId: async function (message, db, bot, configs, arg) {
  },
  trickName: async function (message, db, bot, configs, arg) {
  },
  pageNumber: async function (message, db, bot, configs, arg) {
    if (isNaN(arg)){
      throw new Error("Enter a numeric value in pageNumber");
    }
  },
  inventoryItemNumber: async function (message, db, bot, configs, arg) {
    if (isNaN(arg)){
      throw new Error("Enter a numeric value in inventoryItemNumber");
    }
  },
  shopItemNumber: async function (message, db, bot, configs, arg) {
    if (isNaN(arg)){
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
  userTag: async function (message, db, bot, configs, arg) {
  },
  hexColor: async function (message, db, bot, configs, arg) {
  },
  totalCost: async function (message, db, bot, configs, arg) {
    if (isNaN(arg)){
      throw new Error("Enter a numeric value in totalCost");
    }
    const cost = parseInt(arg);
    if (cost <= 0 || cost > 1000) {
      throw new Error("Invalid total cost. Enter a value between 1 and 1000");
    }
  }
};
