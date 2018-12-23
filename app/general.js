const Utils = require('./utils');
const Discord = require('discord.js');

module.exports = {
  randomPost: async function (message, db, bot, trickArgs) {
    const channelId = trickArgs[1];
    Utils.getRandomMessage(db, channelId, (chosenMessage) => {
      Utils.sendMessage(db, message, chosenMessage.content);
    });
  },
  generateInvite: async function (message, db, bot, trickArgs, userArgs, params, fns, cats) {
    let userRecord = params['userRecord'];
    const channelId = trickArgs[1];

    if (userRecord.inviteLink) {
      Utils.sendMessage(db, message, Utils.getString("generateInvite")
        .replace("{userTag}", "<@" + userRecord.userId + ">")
        .replace("{inviteLink}", userRecord.inviteLink.url));
      return;
    }

    const channel = bot.channels.get(channelId);
    if (!channel.permissionsFor(message.member).has(Discord.Permissions.FLAGS.CREATE_INSTANT_INVITE)) {
      Utils.sendMessage(db, message, "Bot missing permission: CREATE_INSTANT_INVITE on channel '" + channel.name
        + "'\nPlease ask admin to add permission to bot.");
      return;
    }

    channel.createInvite({ maxAge: 0, unique: true }).then(link => {
      userRecord.inviteLink = { url: link.url, code: link.code };
      db.collection("users").save(userRecord);
      Utils.sendMessage(db, message, Utils.getString("generateInvite")
        .replace("{userTag}", "<@" + userRecord.userId + ">")
        .replace("{inviteLink}", userRecord.inviteLink.url));
    });

  },
  listTricks: async function (message, db, bot, trickArgs, userArgs, params, fns, cats) {
    const pageNumber = params['pageNumber'];
    const col = db.collection("tricks");
    await col.find().toArray(function (err, allTricks) {
      if (err) return;
      if (!allTricks) return;

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

      const MAX_CHARS_PER_PAGE = 1800;

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
        if (help && help.indexOf("{channelId}") >= 0) {
          var fnParts = trickDef.say.split(" ");
          if (fnParts.length < 2) { return; }
          let fnParam = fnParts[1];
          const channel = bot.channels.get(fnParam);
          if (channel) {
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
              for (trickNo in fnTricks) {
                if (!addLine(cat, "[" + fnTricks[trickNo].name + "]: " + formatHelpMessage(fnDef, fnTricks[trickNo]))) {
                  return;
                }
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
      Utils.sendMessage(db, message, "```asciidoc\n" + helptext + "```");
    });
  },
  resolveParams: function (message, db, bot, command, functionParameters, passedArguments, PARAMETERS) {
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

      let currentArg = passedArguments[argumentIndex];
      let arg = currentArg;
      if (functionParameters[paramName].multipleWords) {
        do {
          argumentIndex++;
          currentArg = passedArguments[argumentIndex];
          if (currentArg) arg += " " + currentArg;
        } while (currentArg);
      }

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
};

function getCommandHelpFormat(command, functionParameters) {
  let msg = "**Use as follows:**\n" + command;
  Object.keys(functionParameters).forEach(paramName => {
    let paramHelp = Utils.getString(paramName);
    paramHelp = paramHelp ? paramHelp : paramName;
    if (functionParameters[paramName].isOptional) {
      msg += " [" + paramHelp + "]";
    } else {
      msg += " {" + paramHelp + "}";
    }
  });
  return msg;
}

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