const Functions = require('./Functions');
const Utils = require('./utils');

module.exports = {
  randomPost: async function (message, db, bot, configs, trickArgs) {
    const channelId = trickArgs[1];
    Utils.getRandomMessage(db, channelId, configs, (chosenMessage) => {
      message.channel.send(chosenMessage.content);
    });
  },
  listTricks: async function (message, db, bot, configs, trickArgs, userArgs, params) {
    const pageNumber = params['pageNumber'];
    const col = db.collection("tricks");
    await col.find().toArray(function (err, allTricks) {
      if (err) return;
      if (!allTricks) return;

      const fns = Functions.getFunctions();
      const cats = Functions.getCategories();
      const isAdmin = Utils.isAdmin(message);

      // Categorize all tricks by function
      let tricksByFn = {};
      allTricks.forEach(t => {
        let fnName = t.say.split(" ")[0];
        if (!fns[fnName]) {
          fnName = "NON_FUNCTION";
        }
        if (!tricksByFn[fnName]) {
          tricksByFn[fnName] = [];
        }
        tricksByFn[fnName].push(t);
      });

      const MAX_CHARS_PER_PAGE = 2000;

      var helptext = "";
      var helpSection = "";
      var currentPage = 1;
      var currCharCount = 0;
      var lastTitle = "";
      var reachedTargetPage = false;
      function addLine(title, line) {
        if (reachedTargetPage) {
          return false;
        }
        if (!lastTitle) {
          lastTitle = title;
        } else if (title !== lastTitle) {
          endHelpSection();
          lastTitle = title;
        }

        if ((currCharCount + line.length + title.length) > MAX_CHARS_PER_PAGE) {
          endHelpSection();
          if (currentPage >= pageNumber) {
            reachedTargetPage = true;
            return false; // Returns false when it reached the target page
          }
          currCharCount = 0;
          currentPage++;
          helptext = "";
          helpSection = "";
        }
        currCharCount += line.length;
        helpSection += line + "\n";
        return true;
      }

      function endHelpSection() {
        if (helpSection.length > 0) {
          var newLine = "\n" + lastTitle + "\n==================\n";
          currCharCount += newLine.length;
          helptext = helptext + newLine + helpSection;
          helpSection = "";
        }
      }

      function formatHelpMessage(fnDef, trickDef) {
        var help = fnDef.help;
        if (help.indexOf("{channelId}") >= 0) {
          var fnParts = trickDef.say.split(" ");
          if (fnParts.length < 2) { return; }
          let fnParam = fnParts[1];
          const channel = bot.channels.get(fnParam);
          if (channel){
            help = help.replace("{channelId}", channel.name);
          }
        }
        return help;
      }

      // Generate help by category
      Object.keys(cats).forEach(catIdx => {
        let cat = cats[catIdx];
        Object.keys(fns)
          .filter(fnName => fns[fnName].category === cat)
          .forEach(fnName => {
            const fnDef = fns[fnName];
            if (fnDef.onlyAdmin && !isAdmin) {
              return;
            }
            const fnTricks = tricksByFn[fnName];
            if (!fnTricks || fnTricks.length === 0) {
              return;
            } else if (fnTricks.length < 4) {
              if (!addLine(cat, "[" + fnTricks[0].name + "]: " + formatHelpMessage(fnDef, fnTricks[0]))) {
                return;
              }
            } else {
              if (!addLine(cat, fnDef.help)) { return; }
              const msg = printInColumns(fnTricks, "name") + "\n";
              const splitLines = msg.split('\n');
              for (lineNo in splitLines) {
                var line = splitLines[lineNo].trim();
                if (!addLine(cat, line)) {
                  return;
                }
              }
            }
          });
      });

      if (isAdmin) {
        let functionsHelp = Object.keys(fns)
          .filter(fn => fns[fn].help)
          .map(fn => fn + ": " + fns[fn].help);
        for (helpIdx in functionsHelp) {
          if (!addLine("Programable Functions", functionsHelp[helpIdx])) {
            break;
          }
        }
      }
      endHelpSection();
      message.channel.send("```asciidoc\n" + helptext + "```");
    });
  }
};


function printInColumns(list, elementName) {
  const COLS = 3;
  const COL_LEN = 20;
  let colNum = 1;

  let textMsg = "";
  for (idx in list) {
    const msg = "[" + list[idx][elementName] + "]";
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
  return textMsg;
}