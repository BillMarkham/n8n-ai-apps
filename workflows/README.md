# n8n Workflows

This directory contains n8n workflow templates for the n8n-ai-apps project.

## Workflows

- **Error_Handler_Claude.json** - AI-powered error handler using Claude
- **Test_Error_Generator.json** - Test workflow to verify error handler works
- **TROUBLESHOOTING.md** - Comprehensive troubleshooting guide

## Error Handler: Claude

**File:** `Error_Handler_Claude.json`

A sophisticated error handler workflow that uses Claude AI to analyze and provide actionable insights for errors occurring in your n8n workflows.

### Features

- ✅ **Automatic Error Capture**: Receives errors from any workflow configured to use it
- ✅ **AI-Powered Analysis**: Uses Claude to analyze errors and provide:
  - Root cause analysis
  - Impact assessment
  - Step-by-step solution recommendations
  - Prevention strategies
- ✅ **Severity Classification**: Automatically categorizes errors (CRITICAL, HIGH, MEDIUM)
- ✅ **Comprehensive Logging**: Detailed error reports in n8n console
- ✅ **Smart Notifications**: Optional alerts for critical errors
- ✅ **Rich Context**: Captures workflow info, execution data, stack traces, and node parameters

### Installation

1. **Import the Workflow**:
   - Open n8n
   - Go to Workflows
   - Click "Import from File"
   - Select `Error_Handler_Claude.json`

2. **Configure Anthropic API Credentials**:
   - In n8n, go to **Credentials** → **New**
   - Select **Header Auth**
   - Configure:
     - **Name**: `Anthropic API Key`
     - **Name** (header): `x-api-key`
     - **Value**: Your Anthropic API key (get from https://console.anthropic.com/)
   - Save the credential

3. **Activate the Workflow**:
   - Open the imported "Error Handler: Claude" workflow
   - Click the **Activate** toggle in the top-right
   - The workflow is now ready to receive errors

### Usage

#### Set as Error Workflow for Your Workflows

For any workflow where you want error handling:

1. Open the workflow in n8n
2. Click **Workflow Settings** (gear icon)
3. Scroll to **Error Workflow**
4. Select **Error Handler: Claude**
5. Save settings

Now when that workflow encounters an error, it will automatically:
- Send error details to this handler
- Get AI analysis from Claude
- Log the comprehensive report
- Send notifications if configured

### Workflow Structure

The workflow consists of these nodes:

1. **Error Trigger** - Entry point that receives error events
2. **Extract Error Details** - Gathers comprehensive context including:
   - Workflow and execution metadata
   - Error message, description, and stack trace
   - Failed node information and parameters
   - Input data that caused the error
3. **Send to Claude API** - Posts error context to Claude for analysis
4. **Format Analysis** - Processes Claude's response and determines severity
5. **Log Error Report** - Outputs detailed report to console
6. **Check if Critical** - Routes critical errors for immediate attention
7. **Send Notification** - (Optional) Sends alerts for critical errors

### Customization

#### Adjust Severity Levels

Edit the `determineSeverity()` function in the **Format Analysis** node:

```javascript
function determineSeverity(errorMessage) {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('fatal') || msg.includes('critical')) {
    return 'CRITICAL';
  } else if (msg.includes('timeout') || msg.includes('connection')) {
    return 'HIGH';
  } else if (msg.includes('warning')) {
    return 'MEDIUM';
  }

  return 'HIGH';
}
```

#### Add Notification Services

Replace or extend the **Send Notification** node with:

- **Email**: Add "Send Email" node
- **Slack**: Add "Slack" node with message formatting
- **Discord**: Add "Discord" node
- **Microsoft Teams**: Add "Microsoft Teams" node
- **Custom Webhook**: Add "HTTP Request" node
- **SMS**: Add "Twilio" node

The `$json` object contains:
- `subject`: Pre-formatted notification title
- `message`: Complete notification message
- `errorReport`: Full error details and Claude analysis
- `summary`: Condensed error information

#### Change Claude Model

Edit the **Send to Claude API** node JSON body to use a different model:

```json
{
  "model": "claude-3-5-sonnet-20241022",  // or claude-3-opus-20240229
  "max_tokens": 4096,
  ...
}
```

#### Modify Analysis Prompt

Customize what you want Claude to analyze in the **Extract Error Details** node by editing the `promptForClaude` template.

### Example Output

When an error occurs, you'll see a console log like:

```
================================================================================
ERROR REPORT - 🚨 Error in My Workflow
================================================================================
Severity: HIGH
Workflow: My Data Processing Workflow
Node: HTTP Request
Execution ID: 12345
Timestamp: 2025-12-05T10:30:45.123Z

Error Message:
connect ECONNREFUSED 127.0.0.1:5000

Claude Analysis:
## Root Cause Analysis
The error indicates a connection refusal when attempting to connect to a local
service on port 5000. This typically means...

## Impact Assessment
- The workflow cannot complete its data processing task
- Downstream nodes will not receive expected data...

## Recommended Solutions
1. Verify the service on port 5000 is running...
2. Check firewall settings...
3. Validate the URL configuration...

## Prevention
- Implement health checks before making requests
- Add retry logic with exponential backoff...
================================================================================
```

### Troubleshooting

⚠️ **Error handler not firing?** See the comprehensive **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** guide for detailed solutions.

#### Quick Fixes

**Workflow not receiving errors:**
- ✅ Ensure "Error Handler: Claude" is **activated** (toggle ON)
- ✅ Verify it's selected in the source workflow's **Settings → Error Workflow**
- ✅ Test with `Test_Error_Generator.json` workflow (import and run)
- ✅ Check Error Handler executions list for any runs

**Claude API errors:**
- Verify your API key is correct and has sufficient credits
- Check the credential name matches: "Anthropic API Key"
- Ensure the header name is exactly: `x-api-key`
- Test credential by running the workflow manually

**Missing analysis:**
- Check n8n console for API response errors
- Verify internet connectivity for API calls
- Increase `max_tokens` if analyses are truncated

**Notifications not sending:**
- Verify the **Check if Critical** condition matches your needs
- Ensure notification node credentials are configured
- Check the notification service is reachable

#### Test Your Setup

Use the **Test_Error_Generator.json** workflow:
1. Import the test workflow
2. Set its Error Workflow to "Error Handler: Claude"
3. Click "Test workflow" - it will deliberately fail
4. Check Error Handler executions for the triggered analysis

### Best Practices

1. **Monitor Regularly**: Review error logs to identify recurring issues
2. **Tune Severity**: Adjust severity logic based on your use cases
3. **Customize Prompts**: Tailor Claude's analysis to your specific needs
4. **Set Up Notifications**: Configure alerts for critical production workflows
5. **Test Thoroughly**: Trigger test errors to verify the handler works
6. **Version Control**: Keep workflow exports in git for rollback capability

### Cost Considerations

Each error triggers a Claude API call:
- Model: Claude 3.5 Sonnet
- Approximate cost: ~$0.01-0.05 per error (depending on error context size)
- Consider implementing rate limiting for high-error scenarios

### Security Notes

- Error context may contain sensitive data (API keys, user data, etc.)
- Review the **Extract Error Details** node to exclude sensitive fields
- Ensure logs and notifications don't expose credentials
- Consider encrypting error reports if storing them externally

## License

Part of the n8n-ai-apps project.
