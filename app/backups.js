module.exports = {
    restoreBepisBot: async function (message, db, bot, trickArgs, userArgs, params) {
        const channelId = trickArgs[1];
        const channel = bot.channels.get(channelId);
        //const channelIdToCatch = trickArgs[2];

        let lastMessageId;
        let lastMessageIdProcessed;

        let inventoriesByUser = {
            // userId: {
            //   pagesNo: {
            //     timestamp: 0,
            //     content: ""
            //   }
            // }
        };

        do {
            await channel.fetchMessages({ limit: 100, before: lastMessageId }).then(messages => {
                let msgArray = messages.array();
                msgArray.filter(m => m.author && m.author.bot && m.embeds && m.embeds[0])
                    .forEach(async (m) => {
                        // Is it an inventory list?            
                        let footer = m.embeds[0].footer ? m.embeds[0].footer.text : "";
                        if (footer.indexOf("Nice shibes!") < 0) {
                            return;
                        }
                        // Get user id
                        let title = m.embeds[0].title;
                        let userTag = title.substr(0, title.length - "'s shibes".length);
                        // Get inv page
                        let page = 1;
                        if (footer.indexOf("page 2/") >= 0) page = 2;
                        else if (footer.indexOf("page 3/") >= 0) page = 3;
                        else if (footer.indexOf("page 4/") >= 0) page = 4;
                        else if (footer.indexOf("page 5/") >= 0) page = 5;
                        else if (footer.indexOf("page 6/") >= 0) page = 6;
                        else if (footer.indexOf("page 7/") >= 0) page = 7;
                        else if (footer.indexOf("page 8/") >= 0) page = 8;
                        else if (footer.indexOf("page 9/") >= 0) page = 9;
                        else if (footer.indexOf("page 10/") >= 0) page = 10;

                        if (!inventoriesByUser[userTag]) inventoriesByUser[userTag] = {};
                        if (!inventoriesByUser[userTag][page]) {
                            inventoriesByUser[userTag][page] = {
                                timestamp: m.createdTimestamp,
                                content: m.embeds[0].description
                            };
                        }

                    });
                lastMessageId = msgArray[msgArray.length - 1].id;
                console.log("Fetching next 100 from " + new Date(msgArray[0].createdTimestamp) + " - " + Object.keys(inventoriesByUser).length);
            });
            if (lastMessageIdProcessed === lastMessageId || !lastMessageId) {
                break;
            }
            lastMessageIdProcessed = lastMessageId;
        } while (Object.keys(inventoriesByUser).length < 173);

        // Now let's restore inventory for all users
        const usrCol = db.collection("users");
        const posts = db.collection("posts");
        let processedUsers = Object.keys(inventoriesByUser).length;
        let totalItemsRestored = 0;

        Object.keys(inventoriesByUser).forEach(async user => {

            // Add user to DB
            let targetUser = bot.users.find("username", "『toxic.aiff』");
            if (!targetUser) {
                processedUsers--;
                console.log("Remaining users to process: " + processedUsers + ". Restored: " + totalItemsRestored + " items");
                return;
            }
            let userRecord = await usrCol.findOne({ userId: targetUser.id });
            if (userRecord === null) {
                userRecord = {
                    userId: targetUser.id,
                    username: targetUser.username,
                    createdTimestamp: new Date(),
                    inventory: {},
                };
                usrCol.insertOne(userRecord);
            }

            let allInv = "\n";
            Object.keys(inventoriesByUser[user]).forEach(page => {
                allInv += inventoriesByUser[user][page].content + "\n";
            });
            //console.log(user + ":" + "\n" + allInv);
            let currInvNumber = parseInt(allInv.match(/(\d)+/)[0].trim());
            let invInv = "\n" + currInvNumber + "): ";
            let posInv = allInv.indexOf(invInv);

            let notFound = {};

            while (posInv >= 0 && currInvNumber < 200) {
                try {
                    let itemLine = allInv.substr(posInv + invInv.length);
                    itemLine = itemLine.substr(0, itemLine.indexOf("\n"));
                    let itemQty = itemLine.substr(itemLine.indexOf(" x ") + " x ".length);
                    itemLine = itemLine.substr(0, itemLine.indexOf(" x "));
                    itemQty = parseInt(itemQty);

                    // Find item in items to catch
                    itemLine = itemLine.match(/(\w|\s)+/)[0].trim();
                    let item;
                    if (!notFound[itemLine]) {
                        item = await posts.findOne({ $text: { $search: "\"" + itemLine + "\"" } });
                    }
                    if (!item) {
                        if (!notFound[itemLine]) {
                            notFound[itemLine] = 1;
                            console.log("Not found: " + itemLine);
                        }
                    } else {
                        // Add item to user's inventory
                        totalItemsRestored++;
                        let restoredData = false;
                        const igmId = item._id.toString();
                        if (userRecord.inventory[igmId]) {
                            if (userRecord.inventory[igmId].quantity < itemQty) {
                                userRecord.inventory[igmId].quantity = itemQty;
                                restoredData = true;
                            }
                        } else {
                            userRecord.inventory[igmId] = {
                                content: item.content,
                                quantity: itemQty
                            };
                            restoredData = true;
                        }
                        if (restoredData) {
                            usrCol.save(userRecord);
                            console.log(targetUser.username + ": Restored : '" + itemLine + "' x " + itemQty);
                        }
                    }
                    currInvNumber++;
                    invInv = "\n" + currInvNumber + "): ";
                    posInv = allInv.indexOf(invInv);

                } catch (e) {
                    console.error(e);
                }
            }
            processedUsers--;
            console.log("Remaining users to process: " + processedUsers + ". Restored: " + totalItemsRestored + " items");
        });
    },
    restoreOldBot: async function (message, db, bot, trickArgs, userArgs, params) {
        const channelId = trickArgs[1];
        const channel = bot.channels.get(channelId);
        //const channelIdToCatch = trickArgs[2];

        let lastMessageId = "484517549233668096";
        let lastMessageIdProcessed;

        let inventoriesByUser = {
            // userId: {
            //   pagesNo: {
            //     timestamp: 0,
            //     content: ""
            //   }
            // }
        };

        let nextMessage;
        do {
            let foundUsers = 0;
            await channel.fetchMessages({ limit: 100, before: lastMessageId }).then(messages => {
                let msgArray = messages.array();
                msgArray.forEach(m => {
                    if (nextMessage && nextMessage.embeds && nextMessage.embeds.length > 0
                        && m.content.indexOf("!inv") === 0 && nextMessage.author
                        && nextMessage.author.id === "445741076259536897") {
                        //&& m.author.username.indexOf("toxic")>=0) {
                        let title = nextMessage.embeds[0].title;
                        // Get user id
                        let userTag = m.author.username;
                        // Get inv page
                        let page = 1;
                        if (title.indexOf("page 2/") >= 0) page = 2;
                        else if (title.indexOf("page 3/") >= 0) page = 3;
                        else if (title.indexOf("page 4/") >= 0) page = 4;
                        else if (title.indexOf("page 5/") >= 0) page = 5;
                        else if (title.indexOf("page 6/") >= 0) page = 6;
                        else if (title.indexOf("page 7/") >= 0) page = 7;
                        else if (title.indexOf("page 8/") >= 0) page = 8;
                        else if (title.indexOf("page 9/") >= 0) page = 9;
                        else if (title.indexOf("page 10/") >= 0) page = 10;

                        if (!inventoriesByUser[userTag]) inventoriesByUser[userTag] = {};
                        if (!inventoriesByUser[userTag][page]) {
                            foundUsers++;
                            inventoriesByUser[userTag][page] = {
                                timestamp: nextMessage.createdTimestamp,
                                content: nextMessage.embeds[0].description
                            };
                        }
                    }
                    nextMessage = m;
                });
                let lastMsg = msgArray[msgArray.length - 1];
                lastMessageId = lastMsg ? lastMsg.id : lastMessageIdProcessed;
                console.log("Fetching next 100 from " + new Date(msgArray[0].createdTimestamp) +
                    " - " + Object.keys(inventoriesByUser).length + " - found " + foundUsers);
            });
            if (lastMessageIdProcessed === lastMessageId || !lastMessageId) {
                break;
            }
            lastMessageIdProcessed = lastMessageId;
        } while (Object.keys(inventoriesByUser).length < 58);

        // Now let's restore inventory for all users
        const usrCol = db.collection("users");
        const posts = db.collection("posts");
        let processedUsers = Object.keys(inventoriesByUser).length;
        let totalItemsRestored = 0;

        Object.keys(inventoriesByUser).forEach(async user => {

            // Add user to DB
            const targetUser = bot.users.find("username", user);
            if (!targetUser) {
                processedUsers--;
                console.log("Remaining users to process: " + processedUsers + ". Restored: " + totalItemsRestored + " items");
                return;
            }
            let userRecord = await usrCol.findOne({ userId: targetUser.id });
            if (userRecord === null) {
                userRecord = {
                    userId: targetUser.id,
                    username: targetUser.username,
                    createdTimestamp: new Date(),
                    inventory: {},
                };
                usrCol.insertOne(userRecord);
            }

            let allInv = "";
            Object.keys(inventoriesByUser[user]).forEach(page => {
                allInv += inventoriesByUser[user][page].content + "\n";
            });
            //console.log(user + ":" + "\n" + allInv);
            let notFound = {};
            let invArray = allInv.split('\n');
            invArray.forEach(async invItem => {
                try {


                    invItem += " (x1)";
                    let itemParts = invItem.match(/(?:\d*\)\s)(.+?)\s(((?:\*\()(.+)(\)\*))+?|((?:\(x)(\d+)))/);
                    if (!itemParts)
                        return;
                    let itemName = itemParts[1];
                    let itemNick = itemParts[4] ? itemParts[4] : "";
                    let itemQty = itemParts[7] ? parseInt(itemParts[7]) : 1;

                    // Find item in items to catch
                    let item;
                    if (!notFound[itemName]) {
                        item = await posts.findOne({ $text: { $search: "\"" + itemName + "\"" } });
                    }
                    if (!item) {
                        if (!notFound[itemName]) {
                            notFound[itemName] = 1;
                            console.log("Not found: " + itemName);
                        }
                    } else {
                        // Add item to user's inventory
                        totalItemsRestored++;
                        let restoredData = false;
                        const igmId = item._id.toString();
                        if (userRecord.inventory[igmId]) {
                            if (userRecord.inventory[igmId].quantity < itemQty) {
                                userRecord.inventory[igmId].quantity = itemQty;
                                restoredData = true;
                            }
                        } else {
                            userRecord.inventory[igmId] = {
                                content: item.content,
                                quantity: itemQty,
                                nickname: itemNick
                            };
                            restoredData = true;
                        }
                        if (restoredData) {
                            usrCol.save(userRecord);
                            console.log(targetUser.username + ": Restored : '" + itemName + "' x " + itemQty);
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            });
            processedUsers--;
            console.log("Remaining users to process: " + processedUsers + ". Restored: " + totalItemsRestored + " items");
        });
    }
}
