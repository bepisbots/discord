const config = require('./config.json');
const Discord = require('discord.js');
const MongoClient = require('mongodb').MongoClient;
const Admin = require('./app/admin');
const Functions = require('./app/functions');
const Entities = require('html-entities').AllHtmlEntities;

const entities = new Entities();
let lastTimeChannelsScanned = Date.now();

let _configs;
const getDynamicConfigs = function (db, callback) {
    if (_configs) {
        callback(_configs);
        return;
    }
    const col = db.collection("config");
    col.find().toArray(function (err, configs) {
        if (err) return;
        if (!configs) return;
        _configs = {};
        configs.forEach(c => {
            _configs[c.type] = c.value;
        });
        callback(_configs);
    });
}

// Initialize connection once
let _db;
const getDb = function (callback) {
    if (_db != null) {
        callback(_db);
    } else {
        MongoClient.connect(config.database.connectionString,
            { useNewUrlParser: true }, function (err, database) {
                if (err) throw err;
                _db = database.db("bepisdb");
                setTimeout(() => {
                    console.log(Date() + ": DB connection closed");
                    database.close();
                    _db = null;
                }, 1000 * 60 * 10);
                console.log(Date() + ": DB connection opened");
                callback(_db);
            });
    }
}

let bot;
const main = function () {
    console.log(Date() + ": Bot Re-Initiated");
    if (bot) {
        bot.destroy();
    }
    bot = new Discord.Client({
        disableEveryone: true,
        disabledEvents: ['TYPING_START']
    });
    bot.login(config.token);

    bot.on("ready", () => {
        bot.user.setActivity('with shibes!'); //you can set a default game
        console.log(Date() + ": " + `Bot is online!\n${bot.users.size} users, in ${bot.guilds.size} servers connected.`);
    });

    bot.on("guildCreate", guild => {
        console.log(Date() + ": " + `I've joined the guild ${guild.name} (${guild.id}), owned by ${guild.owner.user.username} (${guild.owner.user.id}).`);
    });

    bot.on("message", async message => {
        if (message.author.bot || message.system) return; // Ignore bots
        if (message.channel.type === 'dm') { // Direct Message
            return; //Optionally handle direct messages
        }
        console.log(Date() + ": " + message.content); // Log chat to console for debugging/testing
        if (message.content.indexOf(config.prefix) === 0) { // Message starts with your prefix
            let msg = message.content.slice(config.prefix.length); // slice of the prefix on the message
            let args = msg.split(" "); // break the message into part by spaces
            let cmd = args[0].toLowerCase(); // set the first word as the command in lowercase just in case
            args.shift(); // delete the first word from the args        

            getDb((db) => getDynamicConfigs(db, (configs) => {
                // Run scan channels automatically every hour
                var hours = (Date.now() - lastTimeChannelsScanned) / 36e5;
                if (hours > 1) {
                    lastTimeChannelsScanned = Date.now();
                    Admin.scanChannels(null, db, bot, configs);
                }
                // find key, in case is one of the recorded ones                
                trick(cmd, message, db, bot, configs, args);
            }));
        }
    });
}
setInterval(main, 1000 * 60 * 60);
main();

const trick = async function (cmd, message, db, bot, configs, userArgs) {
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
        Functions.run(trickArgs[0], message, db, bot, configs, trickArgs, userArgs)
    } else
        message.channel.send(entities.decode(trick.say));
}
