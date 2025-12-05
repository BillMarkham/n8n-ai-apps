# Error Handler Troubleshooting Guide

If your Error Handler workflow isn't firing, follow these steps systematically.

## Quick Checklist

✅ **Error Handler workflow is activated** (toggle ON in n8n)
✅ **Source workflow has Error Workflow set** in Workflow Settings
✅ **Source workflow is actually throwing an error** (not just stopping)
✅ **Error Handler has valid credentials** for Claude API
✅ **Using n8n version 0.228.0 or later**

## Step-by-Step Diagnosis

### 1. Verify Error Handler is Activated

**Problem:** Error workflows must be active to receive error events.

**Solution:**
1. Open the "Error Handler: Claude" workflow in n8n
2. Look at the top-right corner
3. Toggle should be **ON** (blue/green)
4. If OFF, click it to activate

### 2. Configure Source Workflow Settings

**Problem:** The source workflow doesn't know to use the error handler.

**Solution:**
1. Open the workflow that's throwing errors
2. Click the **gear icon** (⚙️) or **Workflow** → **Settings**
3. Scroll to find **"Error Workflow"** setting
4. Select **"Error Handler: Claude"** from dropdown
5. **Save** the workflow
6. **Re-run** your workflow to trigger the error

**Screenshot locations:**
- n8n Cloud/Self-hosted: Settings → Error Workflow
- Older versions: Workflow menu → Settings → Error Workflow

### 3. Test with Deliberate Error

**Problem:** Not all errors trigger error workflows (e.g., validation errors vs runtime errors).

**Solution:**

Use the provided `Test_Error_Generator.json` workflow:

1. Import `Test_Error_Generator.json` into n8n
2. Open the workflow settings
3. Set Error Workflow to "Error Handler: Claude"
4. Click **"Test workflow"** button
5. The workflow should fail
6. Check Error Handler executions

**Alternative manual test:**
- Add a Code node to any workflow
- Put this code: `throw new Error('Test error');`
- Ensure workflow has Error Workflow set
- Run it

### 4. Check Error Handler Executions

**Problem:** Error handler might be running but silently failing.

**Solution:**
1. Go to **Executions** in n8n
2. Filter by workflow: "Error Handler: Claude"
3. Check if there are any executions (even failed ones)

**If you see executions:**
- Click on them to see what failed
- Check which node is failing (likely Claude API or credentials)
- Fix that specific issue

**If you see NO executions:**
- Error handler isn't being triggered
- Go back to steps 1-3

### 5. Verify n8n Version

**Problem:** Error workflows were improved in recent n8n versions.

**Solution:**
1. In n8n, click your profile icon (bottom-left)
2. Check version number
3. Recommended: **n8n 0.228.0+**
4. Update if needed: https://docs.n8n.io/hosting/installation/

### 6. Check Error Type

**Problem:** Some errors don't trigger error workflows.

**Errors that WILL trigger:**
- ✅ Runtime errors in nodes (connection failed, API errors)
- ✅ JavaScript errors in Code nodes (throw new Error)
- ✅ HTTP request failures (when "Continue on Fail" is OFF)
- ✅ Database query errors
- ✅ Authentication failures

**Errors that WON'T trigger:**
- ❌ Workflow stops (manual stop button)
- ❌ Validation errors before execution starts
- ❌ Node configuration errors (invalid JSON, missing fields)
- ❌ Nodes with "Continue on Fail" enabled (these don't throw)

**Solution:**
- Ensure the error is a runtime error
- Check the node doesn't have "Continue on Fail" enabled
- Verify the node actually executed and failed

### 7. Check n8n Logs

**Problem:** System-level issues preventing error workflow execution.

**Solution:**

**For self-hosted n8n:**
```bash
# Docker
docker logs n8n

# PM2
pm2 logs n8n

# NPM/Direct
# Check the terminal where n8n is running
```

**Look for:**
- Error workflow execution errors
- Permission issues
- Database connection problems
- System resource issues

**For n8n Cloud:**
- Contact n8n support with your workflow ID
- Check Status page: https://status.n8n.io/

### 8. Test Claude API Credentials

**Problem:** Error handler runs but fails at Claude API call.

**Solution:**

1. **Check credential configuration:**
   - Go to **Credentials** in n8n
   - Find "Anthropic API Key"
   - Click to edit
   - Verify header name is exactly: `x-api-key`
   - Verify value is your valid API key (starts with `sk-ant-`)
   - **Test** the credential if possible

2. **Manual API test:**
   - Open a terminal
   - Run this curl command:
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "content-type: application/json" \
     -H "x-api-key: YOUR_API_KEY_HERE" \
     -H "anthropic-version: 2023-06-01" \
     -d '{
       "model": "claude-3-5-sonnet-20241022",
       "max_tokens": 1024,
       "messages": [{"role": "user", "content": "Hello"}]
     }'
   ```
   - If this fails, your API key or network has issues

3. **Common credential issues:**
   - Wrong header name (must be `x-api-key`, not `Authorization`)
   - API key expired or invalid
   - Insufficient credits in Anthropic account
   - Network firewall blocking api.anthropic.com

### 9. Simplify Error Handler

**Problem:** Complex workflow might have issues.

**Solution:**

Create a minimal test version:

1. Open "Error Handler: Claude"
2. **Disable** all nodes after "Extract Error Details"
3. Add a simple Code node after "Extract Error Details":
   ```javascript
   console.log('ERROR HANDLER FIRED!');
   console.log('Error data:', JSON.stringify($input.all(), null, 2));
   return $input.all();
   ```
4. Save and test again
5. Check n8n logs/console for the message

If this works:
- Error handler IS firing
- Problem is downstream (Claude API, formatting, etc.)
- Re-enable nodes one by one to find the issue

If this doesn't work:
- Error handler not triggering at all
- Review steps 1-6 again

### 10. Check Workflow Settings

**Problem:** Workflow settings might prevent error handling.

**Solution:**

Check these settings in **source workflow**:

1. **Settings** → **Error Workflow**: Must be set to error handler
2. **Settings** → **Save Data Error Executions**: Should be ON
3. **Settings** → **Save Data Success Executions**: Should be ON (for comparison)
4. **Settings** → **Timezone**: Ensure correct (affects logging)

Check these settings in **Error Handler workflow**:

1. **Settings** → **Save Data Error Executions**: ON
2. **Settings** → **Save Data Success Executions**: ON
3. **Settings** → **Execution Order**: v1 (default)

## Common Issues and Solutions

### Issue: "Error Handler executes but shows empty data"

**Cause:** Error data structure changed or not passed correctly.

**Solution:**
1. Open the Error Handler execution
2. Click on "Extract Error Details" node
3. Look at the input data
4. If it's empty or structure is different, update the extraction logic
5. Check n8n version compatibility

### Issue: "Error Handler works for some errors but not others"

**Cause:** Different error types or node configurations.

**Solution:**
1. Check which nodes work vs don't work
2. Verify "Continue on Fail" is OFF on nodes that should trigger
3. Some nodes might need specific error handling settings
4. Review node documentation for error behavior

### Issue: "Too many error handler executions"

**Cause:** Error handler itself might be failing and retriggering.

**Solution:**
1. Check Error Handler executions for failures
2. Add error handling to Error Handler (create fallback)
3. Set **Settings** → **Max Execution Depth** to prevent loops
4. Add conditions to prevent recursive errors

### Issue: "Claude analysis is incomplete or wrong"

**Cause:** Error context might not have all needed data.

**Solution:**
1. Open "Extract Error Details" node
2. Review what data is being captured
3. Add more context if needed:
   ```javascript
   // Add to errorContext object
   additionalContext: {
     envVars: process.env,
     nodeVersion: process.version,
     workflowTags: errorData.workflow?.tags || []
   }
   ```
4. Adjust the prompt in promptForClaude

### Issue: "Error Handler takes too long"

**Cause:** Claude API call can take 5-30 seconds.

**Solution:**
1. This is normal for AI analysis
2. Consider making Claude API call async
3. Or move Claude analysis to a separate workflow
4. Use webhook to send data and analyze later

## Testing Workflow

Import `Test_Error_Generator.json` to easily test your error handler:

1. **Import** the test workflow
2. **Set Error Workflow** to "Error Handler: Claude"
3. **Click Test Workflow** button
4. **Should see:**
   - Test workflow fails (red)
   - Error Handler executes (check Executions)
   - Console log with error analysis

## Still Not Working?

If you've tried everything above:

### Check n8n Community Forum
- Search: "error workflow not triggering"
- Post your issue with:
  - n8n version
  - Self-hosted or Cloud
  - Steps already tried
  - Screenshots of settings

### Verify Basic Error Workflow Functionality

Create the simplest possible error handler:

1. New workflow: "Simple Error Test"
2. Add only: Error Trigger → Code node
3. Code node: `console.log('Error caught:', $input.all());`
4. Activate it
5. Set as error workflow in test workflow
6. Trigger error

If this doesn't work: **n8n error workflow feature itself has an issue**

### Debug Information to Collect

When asking for help, provide:

```
n8n version: [your version]
Environment: [Docker/NPM/n8n Cloud]
Error Handler activated: [YES/NO]
Source workflow has error workflow set: [YES/NO]
Test error generator works: [YES/NO]
Simple error handler works: [YES/NO]
Any executions in error handler: [YES/NO]
n8n logs show: [paste relevant errors]
```

## Advanced Debugging

### Enable Debug Mode

For self-hosted n8n:

```bash
# Add to environment variables
N8N_LOG_LEVEL=debug
N8N_LOG_OUTPUT=console

# Restart n8n
# Check logs for detailed error workflow info
```

### Check Database

If using PostgreSQL/MySQL:

```sql
-- Check workflow settings
SELECT id, name, settings
FROM workflow
WHERE name = 'Error Handler: Claude';

-- Check if error workflow reference exists
SELECT w1.name as source_workflow, w1.settings->>'errorWorkflow' as error_workflow_id
FROM workflow w1
WHERE settings->>'errorWorkflow' IS NOT NULL;
```

### Network Debugging

If Claude API fails:

```bash
# Test from n8n server
curl -v https://api.anthropic.com/v1/messages

# Check DNS
nslookup api.anthropic.com

# Check firewall
telnet api.anthropic.com 443
```

## Success Criteria

You'll know it's working when:

1. ✅ Test workflow throws error
2. ✅ Error Handler workflow shows new execution
3. ✅ Execution is successful (green)
4. ✅ Console logs show "ERROR REPORT - 🚨 Error in..."
5. ✅ Claude analysis appears in logs
6. ✅ Severity classification is present

## Maintenance Tips

Once working:

- **Test regularly** with Test_Error_Generator
- **Monitor** Error Handler execution history
- **Review** Claude's suggestions periodically
- **Update** prompts based on common errors
- **Check** API usage/costs monthly
- **Keep** n8n updated for improvements
