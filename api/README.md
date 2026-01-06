# CiviQ Azure Speech Token Server

This Azure Function provides a secure token server for Azure Speech Services, eliminating the need to expose your API key in client-side code.

## Architecture

- Client calls the token server to get a temporary authentication token
- Token server exchanges your API key for a short-lived token from Azure
- Client uses the temporary token to access Azure Speech Services
- This keeps your API key secure on the server

## Deployment

### Prerequisites
- Azure Functions Core Tools: `npm install -g azure-functions-core-tools@4 --unsafe-perm true`
- Node.js
- Azure CLI

### Local Development
1. Install dependencies: `npm install`
2. Set environment variables in `local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "SPEECH_KEY": "your-actual-azure-speech-key",
       "SPEECH_REGION": "your-region"
     }
   }
   ```
3. Run locally: `func start`

### Azure Deployment
1. Create a Function App in Azure Portal
2. Deploy using Azure CLI or VS Code extension
3. Set application settings in Azure Portal:
   - `SPEECH_KEY`: Your Azure Speech Services key
   - `SPEECH_REGION`: Your Azure region (e.g., "uksouth")

### Client-Side Usage
Update the `tokenServerUrl` in your client code to point to your deployed function:
```javascript
const tokenServerUrl = 'https://your-function-app.azurewebsites.net/api/SpeechToken';
```

## Security Benefits
- API key never transmitted to client browsers
- Tokens have limited lifetime (typically 10 minutes)
- Server-side code handles all authentication
- Proper CORS headers for cross-origin requests