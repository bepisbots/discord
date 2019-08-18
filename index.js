const Discord = require('discord.js');
const MongoClient = require('mongodb').MongoClient;
const Admin = require('./app/admin');
const Functions = require('./app/functions');
const Entities = require('html-entities').AllHtmlEntities;
const Utils = require('./app/utils');

const entities = new Entities();
let lastTimeChannelsScanned = Date.now();

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

// process.on('uncaughtException', function (err) {
//     console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
//     console.error(err.stack)
//     process.exit(1)
//   })

// Initialize connection once
let _db;
const getDb = function (callback, bot) {
    if (_db != null) {
        callback(_db);
    } else {
        MongoClient.connect(Utils.getConfig('databaseConnectionString'),
            { useNewUrlParser: true }, function (err, database) {
                if (err) throw err;
                _db = database.db("bepisdb");
                setTimeout(() => {
                    Utils.log(null, bot, "DB connection closed");
                    database.close();
                    _db = null;
                }, 1000 * 60 * 20);
                Utils.log(null, bot, "DB connection opened");
                callback(_db);
            });
    }
}

let firstTime = true;
let bot;
const main = function () {
    if (firstTime)
        Utils.log(null, bot, "Bot Initiated");
    if (bot) {
        bot.destroy();
    }
    bot = new Discord.Client({
        disableEveryone: true,
        disabledEvents: ['TYPING_START']
    });
    let token = Utils.getConfig('token');
    // if (Utils.getConfig("devMode") === true){
    //     token = Utils.getConfig('tokenDev');
    // }
    bot.login(token);

    bot.on("ready", () => {
        bot.user.setActivity('with shibes!'); //you can set a default game
        if (firstTime) {
            Utils.log(null, bot, `Bot is online!\n${bot.users.size} users, in ${bot.guilds.size} servers connected.`);
            firstTime = false;
        }
    });

    bot.on("guildCreate", guild => {
        try {
            Utils.log(null, bot, `Unauthorized guild: ${guild.name} (${guild.id}), owned by ${guild.owner.user.tag} (${guild.owner.user.id}).`);
            guild.leave()
                .then(g => Utils.log(null, bot, `left unauthorized guild`))
                .catch(console.warn);
        } catch (e) {
            console.warn(e);
        }
    });

    bot.on("message", async message => {
        if (message.author.bot || message.system) return; // Ignore bots
        if (message.channel.type === 'dm') { // Direct Message
            return; //Optionally handle direct messages
        }
        if (Utils.getConfig("devMode") === true && !Utils.getConfig("owners").includes(message.author.id)) {
            return;
        }
        var foundChannelInServer = false;
        let serverIds = Utils.getConfig('serverIds');
        if (!Array.isArray(serverIds)){
            serverIds = JSON.parse(serverIds);
        }
        for (serverId of serverIds) {
            let server = bot.guilds.get(serverId);
            if (!server) { 
                console.error("Failure loading server id: " + serverId);
                console.log(serverIds);
                continue; 
            }
            if (server.channels.get(message.channel.id)) {
                foundChannelInServer = true;                
                break;
            }
        }
        if (!foundChannelInServer) {
            Utils.log(null, bot, `Unauthorized message: ${message.author.tag}: ${message.content}`);
            return;
        }

        if (message.content.indexOf(Utils.getConfig('prefix')) === 0) { // Message starts with your prefix
            Utils.log(null, bot, message, message.author.tag + ", [" + message.content + "]"); // Log chat to console for debugging/testing
            let msg = message.content
                .slice(Utils.getConfig('prefix').length)
                .replaceAll("\n", " ")
                .replaceAll("\t", " ")
                .replaceAll("  ", " ");
            let args = msg.split(" "); // break the message into part by spaces
            let cmd = args[0].toLowerCase(); // set the first word as the command in lowercase just in case
            args.shift(); // delete the first word from the args        

            getDb((db, bot) => {
                // find key, in case is one of the recorded ones                
                trick(cmd, message, db, bot, args);
                // Run scan channels automatically every hour
                var hours = (Date.now() - lastTimeChannelsScanned) / 36e5;
                if (hours > 1) {
                    lastTimeChannelsScanned = Date.now();
                    Admin.scanChannels(null, db, bot, null, null, null, Functions.getFunctions());
                }
            });
        }
    });
}
setInterval(main, 1000 * 60 * 60);
main();

const trick = async function (cmd, message, db, bot, userArgs) {
    try {
        const col = db.collection("tricks");
        let trick;
        if (cmd === 'teach') {
            trick = { say: "NEW_TRICK" }
        } else {
            trick = await col.findOne({ name: cmd }, { limit: 1 });
        }
        if (!trick || !trick.say) return;
        let trickArgs = trick.say.trim().split(" "); // break the message into part by spaces
        if (!trickArgs) return false;
        if (Functions.exists(trickArgs[0])) {
            Functions.run(cmd, trickArgs[0], message, db, bot, trickArgs, userArgs)
        } else
            Utils.sendMessage(db, bot, message, entities.decode(trick.say));
    } catch (e) {
        console.warn(e);
    }
}
