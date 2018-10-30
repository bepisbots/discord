const Admin = require('./admin');
const Utils = require('./utils');
const Inventory = require('./inventory');

module.exports = {
  exists: function (name) {
    return (Object.keys(FUNCTIONS).find(f => f === name));
  },
  run: async function (name, message, db, bot, configs, trickArgs, userArgs) {
    const isAdmin = Utils.isAdmin(message);
    if (FUNCTIONS[name].onlyAdmin && !isAdmin) {
      return;
    }
    let fn = FUNCTIONS[name].fn;
    return fn(message, db, bot, configs, trickArgs, userArgs);
  },
};

// All functions take same arguments
const FUNCTIONS = {
  "SCAN_CHANNELS": {
    onlyAdmin: true,
    fn: Admin.scanChannels,
    help: "!trick [name] SCAN_CHANNELS [optionalChannelId] (Admin Only)"
  },
  "NEW_TRICK": {
    onlyAdmin: true,
    fn: Admin.newTrick,
    help: "!trick [name] NEW_TRICK (Admin Only)"
  },
  "FORGET_TRICK": {
    onlyAdmin: true,
    fn: Admin.forgetTrick,
    help: "!trick [name] FORGET_TRICK (Admin Only)"
  },
  "LIST_TRICKS": {
    fn: listTricks,
    help: "!trick [name] LIST_TRICKS"
  },
  "RANDOM_POST": {
    fn: randomPost,
    help: "!trick [name] RANDOM_POST [channelId]"
  },
  "CATCH_INVENTORY": {
    fn: Inventory.invCatch,
    help: "!trick [name] CATCH_INVENTORY [channelId] [hoursToWait]"
  },
  "SHOW_INVENTORY": {
    fn: Inventory.invShow,
    help: "!trick [name] SHOW_INVENTORY"
  },
  "TRASH_INVENTORY": {
    fn: Inventory.invTrash,
    help: "!trick [name] TRASH_INVENTORY"
  },
  "SELL_INVENTORY": {
    fn: Inventory.invSell,
    help: "!trick [name] SELL_INVENTORY"
  },
  "UNSELL_INVENTORY": {
    fn: Inventory.invUnSell,
    help: "!trick [name] UNSELL_INVENTORY"
  },
  "SHOP_INVENTORY": {
    fn: Inventory.invShop,
    help: "!trick [name] SHOP_INVENTORY"
  },
  "BUY_INVENTORY": {
    fn: Inventory.invBuy,
    help: "!trick [name] BUY_INVENTORY"
  },
  "GIVE_AWAY_INVENTORY": {
    fn: Inventory.invGive,
    help: "!trick [name] GIVE_AWAY_INVENTORY"
  },
  "CHANGE_COLOR_INVENTORY": {
    onlyAdmin: true,
    fn: Inventory.invColor,
    help: "!trick [name] CHANGE_COLOR_INVENTORY"
  },
};

async function listTricks(message, db, bot, configs, trickArgs, userArgs) {
  const col = db.collection("tricks");
  await col.find().toArray(function (err, allTricks) {
    if (err) return;
    if (!allTricks) return;

    let regularTricks = allTricks
      .filter(t => !FUNCTIONS[t.say.split(" ")[0]] || !FUNCTIONS[t.say.split(" ")[0]].onlyAdmin)
      .map(v => v.name)
      .sort();

    let adminTricks = allTricks
      .filter(t => FUNCTIONS[t.say.split(" ")[0]] && FUNCTIONS[t.say.split(" ")[0]].onlyAdmin)
      .map(v => v.name + " " + v.say)
      .sort();

    const isAdmin = Utils.isAdmin(message);

    let functionsHelp = Object.values(FUNCTIONS)
      .filter(fn => fn.help)
      .map(fn => fn.help);

    let textMsg = "```md";
    if (isAdmin) {
      textMsg += "\n\nNon-Admin Commands\n==================\n"
    } else {
      textMsg += "\n\nHelp\n==================\n"
    }
    const COLS = 3;
    const COL_LEN = 20;
    let colNum = 1;
    
    for (command in regularTricks){
      const msg = "[" + regularTricks[command] + "]"; 
      if (colNum++ <  COLS){
        let spaces = COL_LEN - msg.length;
        while (spaces <= 0) {
          spaces += COL_LEN
          colNum++;
        }
        textMsg += msg + " ".repeat(spaces);  
      } else {
        colNum = 1;
        textMsg += msg + "\n";
      }
    }
    //textMsg += regularTricks.reduce((n1, n2) => n1 + "\n" + n2);;
    if (isAdmin) {
      if (functionsHelp)
        textMsg += "\n\nAdmin Functions:\n==================\n" +
          functionsHelp.reduce((n1, n2) => n1 + "\n" + n2);
      if (adminTricks)
        textMsg += "\n\nAdmin Commands:\n==================\n" +
          adminTricks.reduce((n1, n2) => n1 + "\n" + n2);
    }
    textMsg += "```";

    message.channel.send(textMsg);
  });
}

async function randomPost(message, db, bot, configs, trickArgs) {
  const channelId = trickArgs[1];
  Utils.getRandomMessage(db, channelId, configs, (chosenMessage) => {
    message.channel.send(chosenMessage.content);
  });
};
