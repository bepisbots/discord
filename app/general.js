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

      let regularTricks = allTricks
        .filter(t => !Functions.getFunctions()[t.say.split(" ")[0]] || !Functions.getFunctions()[t.say.split(" ")[0]].onlyAdmin)
        .map(v => v.name)
        .sort();

      let adminTricks = allTricks
        .filter(t => Functions.getFunctions()[t.say.split(" ")[0]] && Functions.getFunctions()[t.say.split(" ")[0]].onlyAdmin)
        .map(v => v.name + " " + v.say)
        .sort();

      const isAdmin = Utils.isAdmin(message);

      let functionsHelp = Object.values(Functions.getFunctions())
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