# Welcome to Configurabel Discord Bot

## Features
Bepisbot allows to setup new kewords based on predefined functions. By default, the bot only allows the Server admin to create new kewords. For instance, to create a command for help, the Admin would type the following:
```
!teach help LIST_TRICKS
```
Then when a user types ```!help``` the bot will execute the LIST_TRICKS function

Here's the current list of functions supported by the bot:
1. LIST_TRICKS
1. RANDOM_POST
1. CATCH_INVENTORY: Catches a random post from a given channel  
   **To register:** !teach [keyword] CATCH_INVENTORY [channelId]
   **To use:** ![keyword] (i.e. !catch)
1. SHOW_INVENTORY: Shows list of inventory that current user owns
   **To register:** !teach [keyword] SHOW_INVENTORY
   **To use:** ![keyword] (i.e. !show)
1. TRASH_INVENTORY: Removes a single inventoy item from the user
   **To register:** !teach [keyword] TRASH_INVENTORY
   **To use:** ![keyword] [inventoryId] (i.e. !trash 1)
1. SELL_INVENTORY
1. UNSELL_INVENTORY
1. SHOP_INVENTORY
1. BUY_INVENTORY
1. GIVE_AWAY_INVENTORY

The following are Admin-only functions:
1. NEW_TRICK: Command to teach new tricks to the bot. By default "teach"
1. FORGET_TRICK
1. SCAN_CHANNELS: Takes a channel id as optional argument, otherwsie it scans and indexes all channels registered with other functions, such as CATCH_INVENTORY or RANDOM_POST

## Setup 

WIP
