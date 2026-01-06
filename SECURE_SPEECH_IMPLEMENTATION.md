# Secure Azure Speech Implementation for CiviQ

## Overview
This document outlines the secure implementation of Azure Speech Services for the CiviQ application, addressing the security concern of exposing API keys in client-side code.

## Problem
Previously, Azure Speech Services API keys were exposed directly in client-side JavaScript, which poses security risks:
- API keys visible in browser developer tools
- Potential for unauthorized usage and billing
- GitHub secret scanning blocking commits with exposed keys

## Solution
Implemented a token server pattern using Azure Functions to securely handle API authentication:

### 1. Azure Function Token Server
- **Location**: `api/SpeechToken/`
- **Function**: Exchanges API key for temporary authentication tokens
- **Security**: API key stored in server environment variables only

### 2. Client-Side Integration
- **Location**: `JS/app.js` (startAzureDictation function)
- **Process**: Requests temporary token from server, then uses it for speech services
- **Fallback**: Maintains direct API key configuration for local development

### 3. Files Created
- `api/SpeechToken/index.js` - Main Azure Function code
- `api/SpeechToken/function.json` - Function configuration
- `api/host.json` - Azure Functions host configuration
- `api/package.json` - Dependencies and scripts
- `api/local.settings.json` - Local development settings (excluded from git)
- `api/README.md` - Deployment and usage instructions

## Security Benefits
1. **API Key Protection**: Never exposed to client browsers
2. **Token Expiration**: Temporary tokens have limited lifetime (typically 10 minutes)
3. **Server-Side Authentication**: All sensitive operations handled server-side
4. **CORS Support**: Proper headers for cross-origin requests
5. **Error Handling**: Secure error responses without sensitive information

## Deployment Instructions

### For Local Development
1. Ensure `local.settings.json` contains your credentials:
   ```json
   {
     "SPEECH_KEY": "your-actual-key",
     "SPEECH_REGION": "uksouth"
   }
   ```
2. Run the function locally: `func start`
3. The function will be available at `http://localhost:7071/api/SpeechToken`

### For Azure Deployment
1. Create a Function App in Azure Portal
2. Deploy the function code using Azure CLI or VS Code
3. Set application settings in Azure Portal:
   - `SPEECH_KEY`: Your Azure Speech Services key
   - `SPEECH_REGION`: Your Azure region (e.g., "uksouth")
4. Update the client-side URL to point to your deployed function

## Client-Side Configuration
The client code automatically handles both secure and fallback configurations:
- In production: Uses token server for authentication
- In development: Falls back to direct API key if needed
- Proper error handling and user feedback

## Verification
- [ ] Azure Function returns valid tokens when called
- [ ] Client successfully uses tokens for speech recognition
- [ ] No API keys exposed in browser network requests
- [ ] GitHub secret scanning passes without blocking commits

## Architecture Flow
1. User clicks microphone button in CiviQ app
2. App requests token from secure server (no API key exposed)
3. Server exchanges API key for temporary token with Azure
4. Server returns temporary token to client
5. Client uses token for speech recognition (valid for ~10 minutes)
6. Process completes without exposing API key to client

This implementation provides enterprise-level security while maintaining the speech-to-text functionality for the CiviQ application.