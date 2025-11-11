# Discord Bot Timeout Fix - Implementation Guide

**Problem**: Commands failing with "Unknown interaction" error
**Root Cause**: Global command propagation delay causing command ID mismatches
**Solution**: Switch to guild-specific commands for instant propagation

---

## Quick Fix (Recommended - 5 minutes)

### Step 1: Update Discord Bot Configuration

```bash
# Add guild ID to .env file
cd /root/AIFX_v2/discord_bot
echo "DISCORD_GUILD_ID=1316785145042178149" >> .env
```

### Step 2: Redeploy Commands as Guild Commands

```bash
# Clear existing global commands first (optional but recommended)
cd /root/AIFX_v2/discord_bot
node -e "
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [] })
  .then(() => console.log('✅ Cleared global commands'))
  .catch(console.error);
"

# Deploy guild-specific commands
node deploy-commands.js
```

### Step 3: Restart Bot

```bash
# Find and kill current bot process
kill 344302

# Start bot (or use your process manager)
cd /root/AIFX_v2/discord_bot
nohup node bot.js > /tmp/discord_bot.log 2>&1 &
```

### Step 4: Verify Fix

```bash
# Test command in Discord
# Use: /signal pair:EUR/USD

# Monitor logs
tail -f /tmp/discord_bot.log | grep -E "(defer|Unknown|Success)"
```

---

## Alternative Fix: Add Interaction Age Check (Band-Aid)

If you can't use guild commands, add this safety check:

### Edit `/root/AIFX_v2/discord_bot/bot.js`

Replace lines 249-261 with:

```javascript
try {
  // Check interaction age
  const interactionAge = Date.now() - interaction.createdTimestamp;

  if (interactionAge > 2500) {
    logger.warn(`Interaction too old (${interactionAge}ms), likely expired`);
    return;
  }

  // Check if interaction is still repliable
  if (!interaction.isRepliable()) {
    logger.warn('Interaction is not repliable (already expired)');
    return;
  }

  // Defer immediately
  if (!interaction.replied && !interaction.deferred) {
    try {
      await interaction.deferReply();
      logger.debug(`Deferred interaction from ${interaction.user.username} after ${interactionAge}ms`);
    } catch (deferError) {
      // If defer fails, log and return early
      if (deferError.code !== 40060) {
        logger.error(`Failed to defer interaction: ${deferError.message}`, {
          code: deferError.code,
          age: interactionAge,
          user: interaction.user.username
        });
        return; // Don't execute command if defer failed
      }
    }
  }

  await command.execute(interaction);
  logger.info(`Command ${interaction.commandName} executed by ${interaction.user.username}`);
} catch (error) {
  logger.error(`Error executing command ${interaction.commandName}:`, error);

  const errorMessage = {
    content: '❌ There was an error executing this command!',
    ephemeral: true
  };

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  } catch (replyError) {
    logger.error(`Failed to send error message: ${replyError.message}`);
  }
}
```

---

## Verification Checklist

After applying the fix:

- [ ] Guild ID is set in `.env`: `DISCORD_GUILD_ID=1316785145042178149`
- [ ] Commands redeployed: Run `node deploy-commands.js`
- [ ] Bot restarted: Kill old process and start new one
- [ ] Commands visible in Discord: Check with `/` in your server
- [ ] Test /signal command: Should respond within 1-2 seconds
- [ ] No "Unknown interaction" errors in logs
- [ ] No "InteractionNotReplied" errors in logs

---

## Expected Results

### Before Fix:
```
[warn] Failed to defer interaction: Unknown interaction
[error] Signal command error: The reply to this interaction has not been sent or deferred.
```

### After Fix:
```
[debug] Deferred interaction from lazoof7414 after 45ms
[info] User service-discord-bot requesting signal for EUR/USD
[info] Generated hold signal for EUR/USD with 0.91 confidence
[info] Command signal executed by lazoof7414
```

---

## Rollback Plan

If the fix causes issues:

```bash
# Remove guild ID from .env
cd /root/AIFX_v2/discord_bot
sed -i '/DISCORD_GUILD_ID=/d' .env

# Redeploy as global commands
node deploy-commands.js

# Restart bot
kill <PID>
nohup node bot.js > /tmp/discord_bot.log 2>&1 &
```

---

## Additional Notes

1. **Guild vs Global Commands:**
   - Guild commands: Instant update (< 5 seconds)
   - Global commands: Up to 1 hour propagation
   - For production with multiple servers, use global commands and wait full propagation time

2. **Why This Fix Works:**
   - Guild commands have immediate propagation
   - No command ID caching issues
   - Interactions arrive with current, valid command IDs
   - deferReply() succeeds because Discord recognizes the interaction

3. **Performance Impact:**
   - None - guild commands are just as fast as global commands
   - Actually FASTER because no CDN caching delays

4. **Monitoring:**
   ```bash
   # Watch for defer failures
   tail -f /tmp/discord_bot.log | grep -i "defer"

   # Watch for command executions
   tail -f /tmp/discord_bot.log | grep -i "executed"

   # Watch for any errors
   tail -f /tmp/discord_bot.log | grep -i "error"
   ```

---

## Support

If issues persist after this fix, check:

1. Bot permissions in Discord server (needs `applications.commands` scope)
2. Network latency to Discord API (run `ping discord.com`)
3. Server load (run `top` and check CPU/memory)
4. Bot token validity (test with Discord API)

For urgent issues, consider:
- Restarting Redis: `sudo systemctl restart redis`
- Restarting PostgreSQL: `sudo systemctl restart postgresql`
- Checking backend API: `curl http://localhost:3000/api/v1/health`
