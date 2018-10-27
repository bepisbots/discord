Welcome to Configurabel Discord Bot
===================================

This bot has the following features:
- Allows dynamic creation of commands
  Example: You can teach it new commands by entering: !teach [keyword] A_FUNCTION
- Uses MongoDb as backend
- Supports the following functions:
    CATCH_INVENTORY: Catches a random post from a given channel        
        To register new trick: !teach [keyword] CATCH_INVENTORY [channelId]
        To use: ![keyword] (i.e. !catch)
    SHOW_INVENTORY
    TRASH_INVENTORY
    SELL_INVENTORY
    UNSELL_INVENTORY
    SHOP_INVENTORY
    BUY_INVENTORY
    GIVE_AWAY_INVENTORY
    SCAN_CHANNELS: Takes a channel id as optional argument, otherwsie it scans and indexes all channels registered with other functions, such as CATCH_INVENTORY or RANDOM_POST
    NEW_TRICK
    FORGET_TRICK
    LIST_TRICKS
    RANDOM_POST
