# 📝 Aiba PM Notes

**AI-Powered Meeting Notes & Project Management**

Never forget what was discussed in your meetings again. Aiba PM Notes helps you organize and analyze your typed meeting notes with AI, building a searchable knowledge base for your projects.

## 🌟 Features

### Core Functionality
- **✍️ Simple Notes Input** - Type your meeting notes directly in the browser
- **🤖 Intelligent Analysis** - AI extracts key decisions, action items, discussion topics, and technical details
- **📊 Structured Summaries** - Every meeting gets a comprehensive, organized summary
- **🔍 Full-Text Search** - Find anything across all your meetings instantly with relevance ranking
- **📚 Auto-Updating Wiki** - AI suggests updates to your project documentation based on meeting content
- **💬 AI Chat Mentor** - Context-aware assistant that knows your entire project history
- **🎯 Skills System** - Custom AI behaviors and instructions that activate automatically based on keywords
- **💭 Discuss Meeting** - Instantly open AI chat with full meeting context for deeper exploration
- **🔗 ServiceNow Integration** - View resource allocations, projects, demands, and link meetings to ServiceNow items

### Smart Features
- **Background Processing** - AI analysis happens automatically after submitting notes
- **Real-Time Status** - Auto-polling shows processing progress (analyzing → complete)
- **Project Organization** - Separate wikis and meeting histories per project
- **Markdown Support** - Full GitHub-flavored markdown in wiki and chat
- **Auto-Save** - Wiki changes save automatically 2 seconds after you stop typing
- **Search & Highlight** - Search within wiki content with live highlighting

### Modern UI
- **🎨 Glassmorphism Design** - Unique purple gradient theme with frosted glass effects
- **✨ Smooth Animations** - Hover effects, transitions, and micro-interactions
- **📱 Responsive Layout** - Works on desktop and tablet
- **🎯 Custom Scrollbars** - Purple gradient scrollbars that match the theme
- **🌓 Clean Interface** - No clutter, everything has a purpose

## 🚀 Quick Start

### Prerequisites

Before you begin, you'll need:
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **API Key** - Choose one:
  - **Anthropic (Recommended)** - Claude Sonnet 4.5: [Get API key](https://console.anthropic.com/)
  - **OpenAI** - GPT-4o: [Get API key](https://platform.openai.com/api-keys)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/aiba-pm.git
cd aiba-pm
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
cd ..
```

3. **Configure API keys**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your API keys:
```env
# Choose your AI backend
AI_BACKEND=openai

# Add your API key (you only need one)
OPENAI_API_KEY=sk-proj-your-key-here
# OR
ANTHROPIC_API_KEY=sk-ant-your-key-here

PORT=3001

# Optional: ServiceNow Integration (see below for setup)
# SERVICENOW_INSTANCE_URL=yourcompany.service-now.com
# SERVICENOW_CLIENT_ID=your_oauth_client_id
# SERVICENOW_CLIENT_SECRET=your_oauth_client_secret
# SERVICENOW_USERNAME_FIELD=your.username
```

4. **Start the application**

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

5. **Open your browser**

Navigate to: http://localhost:5173

🎉 You're ready to go!


### Project Structure

```
AibaPM-Notes/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js          # SQLite schema & queries
│   │   ├── routes/
│   │   │   ├── meetings.js          # Meeting CRUD & processing
│   │   │   ├── projects.js          # Project management
│   │   │   ├── wiki.js              # Wiki operations
│   │   │   ├── search.js            # Full-text search
│   │   │   ├── chat.js              # AI chat
│   │   │   ├── skills.js            # Skills system
│   │   │   └── servicenow.js        # ServiceNow integration
│   │   ├── services/
│   │   │   ├── aiAnalysis.js        # Claude/GPT-4o analysis
│   │   │   ├── searchIndex.js       # Search indexing
│   │   │   ├── skillMatcher.js      # Skills matching
│   │   │   ├── serviceNowService.js # ServiceNow OAuth & API
│   │   │   └── serviceNowResourceAPI.js # Resource planning API
│   │   └── server.js                # Express app
│   ├── storage/
│   │   ├── transcripts/             # Meeting notes (text files)
│   │   ├── summaries/               # AI summaries (JSON)
│   │   └── wikis/                   # Project wikis
│   └── aiba.db                      # SQLite database
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Notes/
│   │   │   │   └── NotesInput.jsx   # Notes input form
│   │   │   ├── Meetings/
│   │   │   │   ├── MeetingsList.jsx
│   │   │   │   ├── MeetingDetails.jsx
│   │   │   │   └── MentorFeedback.jsx
│   │   │   ├── Wiki/
│   │   │   │   └── WikiEditor.jsx
│   │   │   ├── Chat/
│   │   │   │   ├── AIChat.jsx
│   │   │   │   └── ChatSidebar.jsx
│   │   │   ├── Skills/
│   │   │   │   └── SkillsManager.jsx
│   │   │   ├── ServiceNow/
│   │   │   │   ├── Settings.jsx
│   │   │   │   └── ResourceDashboard.jsx
│   │   │   └── Search/
│   │   │       └── GlobalSearch.jsx
│   │   ├── stores/
│   │   │   └── useStore.js          # Zustand store
│   │   ├── services/
│   │   │   └── api.js               # API client
│   │   └── App.jsx                  # Main component
│   └── package.json
└── README.md

```

## 📖 How to Use

### First Time Setup

1. **Create Your First Project**
   - Go to the "Projects" tab
   - Click "Add Project"
   - Enter a name (e.g., "My Startup", "Q1 Planning")

2. **Add Your First Meeting Notes**
   - Switch to "New Meeting" tab
   - Select your project from the dropdown
   - Enter a meeting title
   - Type your meeting notes in the text area
   - Include key discussions, decisions, action items, and technical details
   - Click "Create Meeting & Analyze"

3. **Wait for AI Processing** (~30-60 seconds)
   - 🤖 Analyzing notes...
   - 📊 Generating summary...
   - Processing happens in the background

4. **View Your Meeting**
   - Go to "Meetings" tab
   - Click on your meeting
   - See tabs: Summary | Notes | Actions

### Using the AI Chat Mentor

The AI mentor knows your entire project context:

1. Click the panel on the left (or expand it if collapsed)
2. Select a project from the dropdown
3. Ask questions like:
   - "What did we decide about authentication?"
   - "Summarize our technical approach"
   - "What are our open action items?"
   - "Help me understand our architecture decisions"

The AI has access to your project's wiki and last 5 meetings!

### Managing Your Wiki

1. Go to "Wiki" tab
2. Select your project from the dropdown
3. Edit in markdown (left panel)
4. See live preview (right panel)
5. Auto-saves 2 seconds after you stop typing

**Pro tip:** After a meeting, go to the meeting summary and click "Get Wiki Suggestions" - AI will suggest specific updates based on what was discussed!

### ServiceNow Integration (Optional)

Connect to ServiceNow to view your resource planning data and link meetings to projects/demands.

**Features:**
- 📊 **Resource Dashboard** - View all your resource allocations and commitments
- 📁 **Projects & Demands** - See all assigned ServiceNow work items
- 🔗 **Meeting Linking** - Associate meetings with ServiceNow projects/demands
- ✏️ **Update Hours** - Modify resource allocations directly from the app
- 🎯 **AI Context** (Coming Soon) - AI mentor with awareness of your ServiceNow commitments

**Setup:**

1. Get ServiceNow OAuth credentials from your ServiceNow admin:
   - Request OAuth Client ID and Secret
   - Need roles: `rest_api_explorer`, `resource_user`, `resource_manager`, `itbm_user`

2. Add to `backend/.env`:
```env
SERVICENOW_INSTANCE_URL=yourcompany.service-now.com
SERVICENOW_CLIENT_ID=your_oauth_client_id
SERVICENOW_CLIENT_SECRET=your_oauth_client_secret
SERVICENOW_USERNAME_FIELD=your.username
```

3. Restart backend and go to ServiceNow tab → Settings → Test Connection

**Note:** ServiceNow integration is completely optional. The app works fine without it!

### Using the Skills System

The Skills System lets you customize how the AI responds by creating reusable "skills" that activate automatically based on keywords.

**What are Skills?**
- Custom instructions and behaviors for the AI
- Can be **Global** (active across all projects) or **Project-specific**
- Automatically activate when trigger keywords appear in your chat messages
- Written in markdown with clear instructions for the AI

**How to Create a Skill:**

1. Go to "Skills" tab
2. Click "Create Skill"
3. Fill in the details:
   - **Name**: What this skill does (e.g., "Marketing Status Format")
   - **Description**: Brief explanation
   - **Trigger Keywords**: Words that activate this skill (e.g., "status", "update", "marketing")
   - **Content**: Markdown instructions for the AI
   - **Scope**: Global or project-specific
4. Save and it's ready!

**Example Use Cases:**
- **Status Report Format**: Trigger on "status" → AI formats updates consistently
- **Code Review Guidelines**: Trigger on "review" → AI follows your code review standards
- **Meeting Notes Template**: Trigger on "notes" → AI structures meeting notes your way
- **Technical Writing Style**: Trigger on "documentation" → AI matches your docs style

**How It Works:**
- Skills are automatically matched to your chat messages based on keywords
- Multiple skills can activate at once
- Project skills take priority over global skills
- Skills are injected into the AI's system prompt seamlessly

### Discussing Meetings with AI

Want to dive deeper into a meeting's content? Use the "Discuss Meeting" feature!

**How to Use:**

1. Go to any meeting in the "Meetings" tab
2. In the **AI Mentor Feedback** section, click **💬 Discuss Meeting**
3. Chat sidebar opens automatically with the meeting title pre-filled
4. The AI has full context: transcript, summary, wiki, and project history
5. Ask questions, explore insights, or brainstorm solutions

**What You Can Do:**
- **Deep Dive**: "What were the technical tradeoffs we discussed?"
- **Clarify**: "Can you explain the authentication decision in simpler terms?"
- **Connect**: "How does this meeting relate to our previous architecture discussion?"
- **Action**: "Help me create a plan for the action items mentioned"
- **Update Wiki**: "What should we add to the wiki based on this meeting?"

The AI remembers the entire meeting context, so you can have a natural conversation about everything discussed!

## ⚙️ Configuration

### Choosing Your AI Backend

Edit `backend/.env`:

```env
# Use OpenAI (GPT-4o)
AI_BACKEND=openai
OPENAI_API_KEY=sk-proj-...

# OR use Anthropic (Claude Sonnet 4.5)
AI_BACKEND=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### AI Model Details

- **Analysis (OpenAI):** GPT-4o
- **Analysis (Anthropic):** Claude Sonnet 4.5 (2025-05-14)
- **Chat (OpenAI):** GPT-4o
- **Chat (Anthropic):** Claude Sonnet 4.5

## 💰 Cost Breakdown

All costs are pay-as-you-go to OpenAI/Anthropic (you pay them directly):

### OpenAI Pricing
- **GPT-4o analysis:** ~$0.01-0.05 per meeting
- **GPT-4o chat:** ~$0.001-0.01 per message

### Anthropic Pricing
- **Claude Sonnet analysis:** ~$0.03-0.10 per meeting
- **Claude Sonnet chat:** ~$0.002-0.01 per message

### Real-World Examples
- **Per meeting analysis:** ~$0.01-0.10
- **10 chat messages:** ~$0.05-0.10
- **Monthly (20 meetings + chat):** ~$3-5

**This is extremely cheap compared to manual note-taking or paying for meeting analysis tools!**

## 🛠️ Tech Stack

### Frontend
- **React 19** - Latest React with concurrent features
- **Vite** - Lightning-fast build tool
- **Zustand** - Lightweight state management
- **Marked** - Markdown rendering
- **Custom CSS** - No component library, fully custom glassmorphism design

### Backend
- **Node.js + Express** - REST API server
- **SQLite + better-sqlite3** - Zero-config database
- **OpenAI SDK** - GPT-4o
- **Anthropic SDK** - Claude Sonnet 4.5
- **Axios** - ServiceNow API integration
- **Node-cron** - Scheduled cleanup tasks

### Storage
- **SQLite database** - Meetings, projects, metadata, chat history, ServiceNow cache
- **File system** - Meeting notes, AI summaries, project wikis
- Location: `backend/storage/`

### Architecture
- **Monorepo** - Frontend + backend in one repo
- **Background processing** - Async AI analysis pipeline
- **Auto-polling** - Frontend polls for processing completion
- **Pipeline:** Notes → AI Analysis → Database → Metadata → Search Index → Wiki Suggestions

## 🚢 Deployment Options

### Option 1: Local Use (Recommended for Personal Use)
Just follow the installation steps above. Run on your laptop, data stays with you.

### Option 2: Self-Hosted Server
Deploy to your own Linux server (DigitalOcean, AWS, etc.):

1. Install Node.js on server
2. Clone repo and install dependencies
3. Set up `.env` with API keys
4. Use **PM2** to keep it running:
```bash
npm install -g pm2
pm2 start backend/src/server.js --name aiba-backend
cd frontend && pm2 start "npm run dev" --name aiba-frontend
pm2 save
pm2 startup
```

5. Set up nginx as reverse proxy for SSL

### Option 3: Docker (Coming Soon)
A `Dockerfile` and `docker-compose.yml` are planned for 1-command deployment.

## 🔒 Security & Privacy

### Data Storage
- **All data stored locally** on your machine (or your server if you deploy)
- **SQLite database** in `backend/aiba.db`
- **Files** in `backend/storage/`
- **No external data sharing** - your data never leaves your control

### API Keys
- Stored in `backend/.env` (never committed to git)
- Only used to call OpenAI/Anthropic APIs
- Never sent anywhere else

### Best Practices
- Keep `.env` in `.gitignore` (already configured)
- Don't commit the `storage/` directory
- Don't commit `*.db` files
- Use environment variables for secrets

## 🤝 Contributing

This is a personal project, but contributions are welcome!

### How to Contribute
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/cool-feature`)
3. Make your changes
4. Test thoroughly
5. Commit (`git commit -m 'Add cool feature'`)
6. Push (`git push origin feature/cool-feature`)
7. Open a Pull Request

### Areas for Contribution
- 🐛 Bug fixes
- 📝 Documentation improvements
- 🎨 UI/UX enhancements
- 🌍 Internationalization (i18n)
- 🔌 New AI provider integrations (Gemini, Llama, etc.)
- 📱 Mobile app
- 🐳 Docker setup
- 🧪 Test coverage

## 🗺️ Roadmap

### Near Term
- [x] ServiceNow integration for resource planning
- [ ] AI mentor with ServiceNow context awareness
- [ ] Docker setup for easy deployment
- [ ] User authentication (optional, for multi-user deployments)
- [ ] Export meetings to PDF/Word
- [ ] Calendar integration (auto-create meetings from calendar events)
- [ ] Keyboard shortcuts

### Future Ideas
- [ ] Real-time collaboration (multiple users in same meeting)
- [ ] Mobile app (React Native)
- [ ] Cloud storage options (S3, Google Drive, Dropbox)
- [ ] More AI providers (Google Gemini, local Llama models)
- [ ] Video meeting integration (Zoom, Meet, Teams)
- [ ] Advanced analytics (meeting insights, trends, sentiment)
- [ ] Custom AI prompts (let users customize the analysis)
- [ ] API for integrations

## 🐛 Troubleshooting

### "API key not configured" error
- Check `backend/.env` has the correct API key
- Make sure you've set `AI_BACKEND` correctly
- Restart the backend server after changing `.env`

### Processing stuck on "Analyzing..."
- Check backend terminal for errors
- Verify your API key (OpenAI or Anthropic) is valid and has credits
- Large notes may take 30-60 seconds to process

### Database errors
- Delete `backend/aiba.db` to start fresh (WARNING: deletes all data)
- Run `cd backend && node src/db/database.js` to recreate schema

## 📄 License

**MIT License** - See [LICENSE](LICENSE) file for details.

TL;DR: Use it however you want, commercially or personally. Attribution appreciated but not required.

## 💝 Support

If Aiba PM saves you time and helps your projects, consider:

**☕ [Buy me a coffee](https://buymeacoffee.com/jsepetys)**

Every coffee helps me spend more time building features instead of working my day job! 😄

## 🙏 Acknowledgments

Built with:
- OpenAI GPT-4o and Anthropic Claude Sonnet 4.5 for AI analysis
- React and Node.js ecosystems
- ServiceNow REST APIs
- Lots of coffee ☕

## 📧 Contact

- **GitHub Issues** - For bugs and feature requests
- **Discussions** - For questions and ideas

---

**Made with ❤️ by Jordan Sepetys**

*"Never forget what was discussed."*
