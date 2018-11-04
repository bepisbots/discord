const Functions = require('./Functions');
const Utils = require('./utils');

module.exports = {
  randomPost: async function (message, db, bot, configs, trickArgs) {
    const channelId = trickArgs[1];
    Utils.getRandomMessage(db, channelId, configs, (chosenMessage) => {
      message.channel.send(chosenMessage.content);
    });
  },
  listTricks: async function (message, db, bot, configs, trickArgs, userArgs) {
    const col = db.collection("tricks");
    await col.find().toArray(function (err, allTricks) {
      if (err) return;
      if (!allTricks) return;

      const fns = Functions.getFunctions();
      const cats = Functions.getCategories();
      let textMsg = "```md";

      // Categorize all tricks by function
      // let tricksByFn = {};
      // allTricks.forEach(t => {
      //   const fnName = t.say.split(" ")[0];
      //   if (fns[fnName]) {
      //     tricksByFn[fnName].push(t);
      //   } else {
      //     tricksByFn["OTHER"].push(t);
      //   }
      // });

      // Generate help by category
      // Object.keys(cats).forEach(cat => {
      //   textMsg += "\n\n" + cats[cat] + "\n==================\n";
      //   Object.keys(fns).filter(name => fns[name].category === cat)
      //     .forEach(name => {
      //       const tricks = tricksByFn[name];

      //     }
      //       textMsg += "[" + trick.name + "] : " + 
      //     });

      // });

      let regularTricks = allTricks
        .filter(t => !fns[t.say.split(" ")[0]] || !fns[t.say.split(" ")[0]].onlyAdmin)
        .map(v => v.name)
        .sort();

      let adminTricks = allTricks
        .filter(t => fns[t.say.split(" ")[0]] && fns[t.say.split(" ")[0]].onlyAdmin)
        .map(v => v.name + " " + v.say)
        .sort();

      const isAdmin = Utils.isAdmin(message);

      let functionsHelp = Object.keys(fns)
        .filter(fn => fns[fn].help)
        .map(fn => fn + " :" + fns[fn].help);

      if (isAdmin) {
        textMsg += "\n\nNon-Admin Commands\n==================\n"
      } else {
        textMsg += "\n\nHelp\n==================\n"
      }
      const COLS = 3;
      const COL_LEN = 20;
      let colNum = 1;

      for (command in regularTricks) {
        const msg = "[" + regularTricks[command] + "]";
        if (colNum++ < COLS) {
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
          textMsg += "\n\nProgramable Functions:\n==================\n" +
            functionsHelp.reduce((n1, n2) => n1 + "\n" + n2);
        if (adminTricks)
          textMsg += "\n\nAdmin Commands:\n==================\n" +
            adminTricks.reduce((n1, n2) => n1 + "\n" + n2);
      }
      textMsg += "```";

      message.channel.send(textMsg);
    });
  }
};