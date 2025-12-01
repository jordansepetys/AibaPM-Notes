# AibaPM Work Version - Setup Guide for AI Assistant

This document is for an AI assistant helping set up AibaPM after cloning the repository.

---

## What This Project Is

AibaPM is a meeting management and project documentation tool. This **work version** has been modified to:

1. **Use transcript uploads instead of audio recording** - Users drag-drop `.txt` or `.docx` files, or paste transcript text manually
2. **Use Azure OpenAI instead of personal API keys** - All AI calls go through Azure OpenAI endpoints

---

## Initial Setup Steps

### 1. Install Dependencies

```bash
cd AibaPM-Notes
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..
```

### 2. Create Environment File

Create `backend/.env` with Azure OpenAI configuration:

```env
# REQUIRED - Get these from your Azure portal
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE-NAME.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

# Optional
AZURE_OPENAI_API_VERSION=2024-02-15-preview
PORT=3001
NODE_ENV=development
```

### 3. Start the Application

```bash
npm run dev
```

This starts both frontend (port 5173) and backend (port 3001).

---

## Azure OpenAI Configuration Details

### What the user needs from their IT/Azure admin:

| Setting | Description | Example |
|---------|-------------|---------|
| `AZURE_OPENAI_ENDPOINT` | The Azure resource URL | `https://mycompany-ai.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | API key from Azure portal | `abc123...` |
| `AZURE_OPENAI_DEPLOYMENT` | The deployment name (NOT model name) | `gpt-5`, `gpt-4o-prod`, `my-chat-model` |

### Important: Deployment Name vs Model Name

Azure OpenAI works differently from regular OpenAI:
- In regular OpenAI, you specify a model like `gpt-4o`
- In Azure OpenAI, you **deploy** a model and give it a custom name
- The `AZURE_OPENAI_DEPLOYMENT` is this custom name your IT team chose

For example, if IT deployed GPT-5 and named it `production-gpt5`, you would set:
```env
AZURE_OPENAI_DEPLOYMENT=production-gpt5
```

---

## Key Files to Know About

### Azure Integration
- `backend/src/services/azureOpenAI.js` - Azure OpenAI client module
- `backend/src/services/aiAnalysis.js` - Meeting analysis (uses Azure)
- `backend/src/routes/chat.js` - Chat functionality (uses Azure)

### Transcript Upload
- `frontend/src/components/Meetings/TranscriptUploader.jsx` - Upload UI component
- `backend/src/routes/meetings.js` - Has `/api/meetings/transcript` endpoint

### Configuration
- `backend/.env.example` - Template for environment variables
- `backend/src/server.js` - Health check shows Azure status at `/api/health`

---

## Verifying the Setup

### Check Health Endpoint

After starting the server, visit or curl:
```
http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "ok",
  "aiBackend": "azure-openai",
  "aiConfigured": true,
  "deployment": "your-deployment-name",
  "modelName": "your-deployment-name"
}
```

If `aiConfigured` is `false`, check the environment variables.

### Test Transcript Upload

1. Open `http://localhost:5173`
2. Create a project (Projects tab)
3. Go to "Add Meeting" tab
4. Select the project, enter a title
5. Paste some sample meeting text:
   ```
   John: Let's discuss the new feature requirements.
   Sarah: I think we should prioritize the authentication system.
   John: Agreed. We'll use OAuth 2.0 for this.
   Sarah: I'll create the technical spec by Friday.
   ```
6. Click "Submit Transcript for Analysis"
7. The AI should analyze it and generate a summary

---

## Common Issues and Solutions

### "Azure OpenAI is not configured"
- Check that all three required env vars are set:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT`
- Restart the backend after changing `.env`

### 401 Unauthorized
- API key is incorrect or expired
- Check with IT for a new key

### 404 Not Found
- Deployment name doesn't match what's in Azure
- Ask IT: "What's the exact deployment name for [model]?"

### "Resource not found"
- Endpoint URL is wrong
- Should look like `https://something.openai.azure.com` (no trailing slash)

### Voice input not working
- This is expected - voice transcription is disabled in this version
- It would require Azure Speech Services (separate from Azure OpenAI)
- Users should type messages instead

---

## What Features Work

| Feature | Status |
|---------|--------|
| Transcript upload (.txt, .docx) | ✅ Works |
| Manual transcript entry | ✅ Works |
| AI meeting analysis | ✅ Works (via Azure) |
| Chat with AI | ✅ Works (via Azure) |
| Wiki documentation | ✅ Works |
| Project management | ✅ Works |
| Skills system | ✅ Works |
| Voice input for chat | ❌ Disabled (needs Azure Speech Services) |
| Audio recording | ❌ Removed |

---

## If User Needs Additional Azure Services

### For Voice Input (Optional)
Would need to add Azure Speech Services integration:
1. Create Azure Speech resource
2. Add `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` to `.env`
3. Modify `backend/src/routes/chat.js` to use Azure Speech SDK

### For Different Models
Just change `AZURE_OPENAI_DEPLOYMENT` in `.env` to point to a different deployed model.

---

## Project Structure Overview

```
AibaPM-Notes/
├── frontend/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Meetings/
│   │   │   │   └── TranscriptUploader.jsx  # Main upload component
│   │   │   ├── Chat/
│   │   │   └── Wiki/
│   │   ├── services/
│   │   │   └── api.js        # API calls to backend
│   │   └── App.jsx           # Main app component
│   └── package.json
├── backend/                  # Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── meetings.js   # Meeting endpoints
│   │   │   └── chat.js       # Chat endpoints
│   │   ├── services/
│   │   │   ├── azureOpenAI.js    # Azure client
│   │   │   └── aiAnalysis.js     # AI analysis
│   │   ├── db/
│   │   │   └── database.js   # SQLite database
│   │   └── server.js         # Express server
│   ├── storage/              # File storage (transcripts, summaries)
│   ├── .env                  # Environment config (create this)
│   └── .env.example          # Template
└── package.json              # Root package.json
```

---

## Summary

1. Clone repo
2. Run `npm install` in root, frontend, and backend
3. Create `backend/.env` with Azure credentials
4. Run `npm run dev`
5. Test at `http://localhost:5173`

The main thing the user needs is the Azure OpenAI credentials from their IT team. Once those are in the `.env` file, everything should work.
