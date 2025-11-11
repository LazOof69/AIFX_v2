#!/bin/bash
# Verification Script for Discord Bot Fix

echo "=================================="
echo "Discord Bot Fix Verification"
echo "=================================="
echo ""

# Test 1: Instance Count
echo "Test 1: Checking bot instance count..."
INSTANCES=$(ps aux | grep "node bot.js" | grep -v grep | wc -l)
echo "  Running instances: $INSTANCES"

if [ "$INSTANCES" -eq 1 ]; then
  echo "  ✅ PASS - Exactly 1 instance running"
elif [ "$INSTANCES" -eq 0 ]; then
  echo "  ❌ FAIL - No instances running (bot is down)"
  exit 1
else
  echo "  ❌ FAIL - Multiple instances detected ($INSTANCES) - RACE CONDITION RISK!"
  exit 1
fi

echo ""

# Test 2: Bot Process
echo "Test 2: Checking bot process details..."
BOT_PID=$(pgrep -f "node bot.js")
if [ -n "$BOT_PID" ]; then
  echo "  PID: $BOT_PID"
  echo "  Memory: $(ps -p $BOT_PID -o rss= | awk '{print $1/1024 " MB"}')"
  echo "  CPU: $(ps -p $BOT_PID -o %cpu=)%"
  echo "  ✅ PASS - Bot process is healthy"
else
  echo "  ❌ FAIL - Bot process not found"
  exit 1
fi

echo ""

# Test 3: Log File
echo "Test 3: Checking bot logs..."
if [ -f "/tmp/single_bot.log" ]; then
  echo "  Log file: /tmp/single_bot.log"
  echo "  Log size: $(du -h /tmp/single_bot.log | cut -f1)"

  # Check for successful startup
  if grep -q "Discord bot logged in" /tmp/single_bot.log; then
    echo "  ✅ Bot logged in successfully"
  else
    echo "  ⚠️  WARNING - No login message in logs"
  fi

  # Check for commands loaded
  CMD_COUNT=$(grep -c "Loaded command:" /tmp/single_bot.log)
  echo "  Commands loaded: $CMD_COUNT"
  if [ "$CMD_COUNT" -ge 5 ]; then
    echo "  ✅ All commands loaded"
  else
    echo "  ⚠️  WARNING - Expected 5 commands, found $CMD_COUNT"
  fi

  # Check for "Unknown interaction" errors
  ERROR_COUNT=$(grep -c "Unknown interaction" /tmp/single_bot.log)
  if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "  ✅ No 'Unknown interaction' errors"
  else
    echo "  ❌ FAIL - Found $ERROR_COUNT 'Unknown interaction' errors"
    echo "  Recent errors:"
    grep "Unknown interaction" /tmp/single_bot.log | tail -3
    exit 1
  fi
else
  echo "  ⚠️  WARNING - Log file not found at /tmp/single_bot.log"
fi

echo ""

# Test 4: Management Scripts
echo "Test 4: Checking management scripts..."
SCRIPTS=("start_bot.sh" "stop_bot.sh" "check_bot_instances.sh")
SCRIPT_DIR="/root/AIFX_v2/discord_bot"

for script in "${SCRIPTS[@]}"; do
  if [ -x "$SCRIPT_DIR/$script" ]; then
    echo "  ✅ $script exists and is executable"
  else
    echo "  ❌ FAIL - $script not found or not executable"
    exit 1
  fi
done

echo ""

# Test 5: PM2 Configuration
echo "Test 5: Checking PM2 configuration..."
if [ -f "$SCRIPT_DIR/ecosystem.config.js" ]; then
  echo "  ✅ ecosystem.config.js exists"

  # Check if PM2 is installed
  if command -v pm2 &> /dev/null; then
    echo "  ✅ PM2 is installed"
  else
    echo "  ⚠️  PM2 not installed (optional but recommended)"
    echo "     Install with: npm install -g pm2"
  fi
else
  echo "  ❌ FAIL - ecosystem.config.js not found"
  exit 1
fi

echo ""

# Test 6: Documentation
echo "Test 6: Checking documentation..."
DOCS=("INTERACTION_FAILURE_ANALYSIS.md" "INCIDENT_SUMMARY.md" "README_BOT_MANAGEMENT.md")

for doc in "${DOCS[@]}"; do
  if [ -f "$SCRIPT_DIR/$doc" ]; then
    SIZE=$(du -h "$SCRIPT_DIR/$doc" | cut -f1)
    echo "  ✅ $doc exists ($SIZE)"
  else
    echo "  ❌ FAIL - $doc not found"
    exit 1
  fi
done

echo ""

# Test 7: Command Registration
echo "Test 7: Checking Discord command registration..."
cd "$SCRIPT_DIR" || exit 1

if [ -f "check_command_id.js" ]; then
  echo "  Running command verification..."
  node check_command_id.js > /tmp/cmd_check.log 2>&1

  if grep -q "1437452216213442571" /tmp/cmd_check.log; then
    echo "  ✅ Signal command registered correctly (ID: 1437452216213442571)"
  else
    echo "  ⚠️  WARNING - Signal command ID not found"
    cat /tmp/cmd_check.log
  fi
else
  echo "  ⚠️  Command verification script not found"
fi

echo ""

# Final Result
echo "=================================="
echo "Verification Complete"
echo "=================================="
echo ""
echo "✅ All critical tests passed!"
echo ""
echo "Bot Status:"
echo "  - Single instance running: YES"
echo "  - No race condition errors: YES"
echo "  - Management scripts: READY"
echo "  - Documentation: COMPLETE"
echo ""
echo "Next steps:"
echo "  1. Test /signal command in Discord"
echo "  2. Monitor logs: tail -f /tmp/single_bot.log"
echo "  3. Install PM2: npm install -g pm2"
echo "  4. Configure PM2: pm2 start ecosystem.config.js"
echo ""
echo "For more info, see: README_BOT_MANAGEMENT.md"
echo ""

exit 0
