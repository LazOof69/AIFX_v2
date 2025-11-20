# Claude Code Rules for AIFX_v2

## Project Overview
AIFX_v2 is an AI-powered forex trading advisory system that provides trading signals and market analysis to users through web interface and Discord notifications.

## Core Architecture
- Backend: Node.js with Express.js
- Database: PostgreSQL with Sequelize ORM
- Cache: Redis
- ML Engine: Python with TensorFlow/scikit-learn
- Frontend: React + Vite
- Notifications: Discord.js
- Real-time: Socket.io

## 🏗️ Microservices Architecture Principles

**CRITICAL**: This system is being refactored to follow microservices architecture. These principles are MANDATORY for all future development.

### Architecture Decision Record (2025-11-20)

The system has identified **systemic architectural flaws** requiring a fundamental restructure to microservices:

#### 1️⃣ Service Independence (服務獨立性)
**Principle**: Each service MUST be able to operate independently
- ✅ Each service can start/stop without affecting others
- ✅ Service failure should NOT cascade to other services
- ✅ Each service has its own health check endpoint
- ❌ NO shared database models between services
- ❌ NO direct database access (except Backend)

**Implementation**:
```javascript
// ✅ CORRECT: Service can run independently
// Discord Bot doesn't need database connection to start
const bot = new DiscordBot({
  backendApiUrl: process.env.BACKEND_API_URL
});

// ❌ WRONG: Service depends on database
const db = require('../models'); // DON'T DO THIS in Discord Bot
```

#### 2️⃣ Simplified Process (簡化流程)
**Principle**: Clear service boundaries and responsibilities
- ✅ Backend: Data access layer, business logic, user auth
- ✅ ML Engine: Model training, predictions, ML-specific logic
- ✅ Discord Bot: Discord interactions, notification delivery
- ✅ Frontend: User interface, visualization
- ❌ NO mixing of responsibilities across services

**Service Responsibility Matrix**:
| Responsibility | Backend | ML Engine | Discord Bot | Frontend |
|---------------|---------|-----------|-------------|----------|
| Database Access | ✅ ONLY | ❌ API | ❌ API | ❌ API |
| User Auth | ✅ | ❌ | ❌ | ✅ Client |
| ML Training | ❌ | ✅ ONLY | ❌ | ❌ |
| Discord Messages | ❌ | ❌ | ✅ ONLY | ❌ |
| WebSocket | ✅ Server | ❌ | ❌ | ✅ Client |

#### 3️⃣ API-Only Communication (純 API 通信)
**Principle**: Services communicate EXCLUSIVELY through REST APIs
- ✅ Backend exposes APIs for other services
- ✅ All inter-service communication is HTTP REST
- ✅ API contracts are versioned and documented
- ❌ NO direct function calls between services
- ❌ NO shared modules or libraries (except types)
- ❌ NO direct database access from Discord Bot or ML Engine

**Communication Rules**:
```
Frontend ──REST/WS──► Backend ──REST──► ML Engine
                        ▲
                        │
                      REST
                        │
                   Discord Bot
```

**Example**:
```javascript
// ✅ CORRECT: Discord Bot calls Backend API
const response = await axios.get(
  `${BACKEND_API_URL}/api/v1/discord/users/${discordId}`,
  { headers: { 'Authorization': `Bearer ${API_KEY}` } }
);

// ❌ WRONG: Discord Bot directly accesses database
const user = await User.findOne({ where: { discordId } }); // DON'T DO THIS
```

#### 4️⃣ Context Management (上下文管理)
**Principle**: This file (CLAUDE.md) is the source of truth
- ✅ All architectural decisions are documented here
- ✅ Claude Code MUST reference this file for architecture questions
- ✅ Any deviation from these principles requires updating this file
- ❌ NO architectural decisions without documenting

### Service Communication Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Service Communication Rules                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Frontend  ─────REST/WS────►  Backend (Port 3000)       │
│                                   │                      │
│                                   │ PostgreSQL           │
│                                   │ (ONLY Backend        │
│                                   │  can access)         │
│                                   │                      │
│                                   ├──REST──► ML Engine   │
│                                   │         (Port 8000)  │
│                                   │                      │
│                                   └──REST──► Discord Bot │
│  (Discord Bot calls Backend API)                        │
│                                                           │
│  KEY RULES:                                              │
│  • Only Backend accesses PostgreSQL directly            │
│  • Discord Bot: NO database, uses Backend API           │
│  • ML Engine: NO database, uses Backend API             │
│  • All communication through REST APIs                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Database Access Strategy

**CRITICAL RULE**: Shared Database + API Layer

```
Services:           Database Access:

Frontend            ──┐
                      │
ML Engine           ──┤──── REST API ────► Backend ──► PostgreSQL
                      │                      (ONLY)
Discord Bot         ──┘
```

**Rules**:
1. ✅ **Backend ONLY** has direct PostgreSQL access
2. ✅ Backend uses Sequelize ORM
3. ✅ Other services MUST use Backend REST APIs
4. ❌ **NEVER** create database connections in Discord Bot
5. ❌ **NEVER** create database connections in ML Engine
6. ❌ **NEVER** share Sequelize models between services

**File Structure**:
```
✅ ALLOWED:
backend/src/models/          # Only Backend has models
backend/src/config/database.js

❌ FORBIDDEN:
discord_bot/models/          # DELETE THIS
discord_bot/config/database.js  # DELETE THIS
ml_engine/models/            # No database models here
```

### API Design Standards

All APIs must follow these standards:

#### Versioning
```
/api/v1/discord/users       ✅ Correct
/discord/users              ❌ Wrong (no version)
```

#### Authentication
```javascript
// Backend API for Discord Bot
headers: {
  'Authorization': 'Bearer <API_KEY>',
  'X-Service-Name': 'discord-bot'
}

// Backend API for Frontend
headers: {
  'Authorization': 'Bearer <JWT_TOKEN>'
}
```

#### Response Format
```javascript
// Success response (ALWAYS use this format)
{
  "success": true,
  "data": { /* actual data */ },
  "error": null,
  "metadata": {
    "timestamp": "2025-11-20T10:30:00Z",
    "version": "v1",
    "requestId": "uuid-here"
  }
}

// Error response
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PAIR",
    "message": "Invalid currency pair format"
  },
  "metadata": { /* ... */ }
}
```

### Migration Strategy

**Approach**: Incremental Migration (漸進式遷移)

**Phases**:
1. **Phase 1**: Define service boundaries (Week 1-2)
2. **Phase 2**: Build Backend APIs for Discord Bot (Week 3-4)
3. **Phase 3**: Build Backend APIs for ML Engine (Week 5-6)
4. **Phase 4**: Refactor Discord Bot (Week 7-8)
5. **Phase 5**: Testing & Validation (Week 9-10)

**Current Phase**: Planning Complete ✅

**Reference**: See `MICROSERVICES_REFACTOR_PLAN.md` for detailed implementation plan

### Refactoring Checklist

Before making ANY changes to the codebase, verify:

- [ ] Does this change follow service independence principle?
- [ ] Am I using API calls instead of direct database access?
- [ ] Is the API contract documented?
- [ ] Does this maintain service isolation?
- [ ] Have I updated CLAUDE.md if architecture changed?

### Common Anti-Patterns to Avoid

❌ **NEVER DO THIS**:
```javascript
// Discord Bot accessing database directly
const { User } = require('../models');
const user = await User.findOne({ where: { discordId } });

// Services sharing models
const UserModel = require('../../backend/src/models/User'); // WRONG

// Circular dependencies
Backend ──calls──► ML Engine ──calls──► Backend  // WRONG
```

✅ **ALWAYS DO THIS**:
```javascript
// Discord Bot using Backend API
const backendClient = new BackendApiClient();
const user = await backendClient.getUser(discordId);

// Clear dependency direction
Frontend ──► Backend ──► ML Engine  // CORRECT
Discord Bot ──► Backend              // CORRECT
```

### Performance Considerations

While microservices add network latency, we mitigate with:

1. **Caching**: Aggressive caching at each service level
2. **Batching**: Batch API calls where possible
3. **Async**: Use async processing for non-critical paths
4. **Monitoring**: Track API response times (target: p95 < 200ms)

### Service Health Checks

Each service MUST implement:
```javascript
GET /health
Response:
{
  "status": "healthy",
  "service": "backend",
  "version": "1.0.0",
  "uptime": 3600,
  "dependencies": {
    "postgres": "connected",
    "redis": "connected"
  }
}
```

### Documentation Requirements

For any new API endpoint, document:
- OpenAPI/Swagger specification
- Request/response examples
- Error codes and meanings
- Rate limits
- Authentication requirements

**Reference**: See `docs/api/` directory

## Development Principles

### 1. Code Style
- Use ES6+ syntax for all JavaScript code
- Use async/await over callbacks
- Implement proper error handling with try-catch blocks
- Add JSDoc comments for all functions
- Use meaningful variable names
- Follow RESTful API conventions

### 2. Project Structure
Always maintain this directory structure:
```
AIFX_v2/
├── backend/          # Node.js API server
├── ml_engine/        # Python ML services
├── frontend/         # React application
├── discord_bot/      # Discord bot service
└── database/         # Migration and seed files
```

### 3. Security Requirements
- Never commit API keys or secrets
- Use environment variables for all configurations
- Implement JWT authentication with refresh tokens
- Add rate limiting to all API endpoints
- Validate all user inputs
- Use parameterized queries to prevent SQL injection
- Hash passwords with bcrypt (min 10 rounds)

### 4. API Design Rules
- All endpoints must follow pattern: `/api/{version}/{resource}/{action}`
- Return consistent JSON response format:
```javascript
{
  success: boolean,
  data: object | array | null,
  error: string | null,
  timestamp: ISO8601
}
```
- Implement pagination for list endpoints
- Use appropriate HTTP status codes
- Add request validation middleware

### 5. Database Guidelines
- All tables must have: id, created_at, updated_at
- Use migrations for schema changes
- Create indexes for frequently queried columns
- Implement soft delete where appropriate
- Use transactions for multi-table operations

### 6. Trading Logic Rules
- Never provide guaranteed profit claims
- Always include risk warnings in responses
- Implement stop-loss recommendations
- Log all trading signals for audit
- Cache market data aggressively (min 1 minute)
- Handle API rate limits gracefully

### 7. ML Integration
- Separate ML API from main backend
- Version all models
- Log prediction confidence scores
- Implement fallback to technical indicators if ML fails
- Store training metrics for monitoring

### 8. Testing Requirements
- Write unit tests for all services
- Include integration tests for API endpoints
- Test error scenarios
- Mock external API calls
- Maintain >70% code coverage

### 9. Performance Optimization
- Implement caching strategy for market data
- Use connection pooling for database
- Optimize database queries with indexes
- Implement lazy loading where appropriate
- Use CDN for static assets

### 10. Error Handling
```javascript
// Always use this error format
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // e.g., 'INVALID_PAIR', 'API_LIMIT'
  }
}
```

## Specific Implementation Guidelines

### Forex Data Service
- Primary: Alpha Vantage API (5 req/min limit)
- Fallback: Twelve Data API (800 req/day)
- Cache all responses in Redis (TTL: 60 seconds for real-time, 1 day for historical)
- Implement exponential backoff for retries

### User Preferences Schema
```javascript
{
  tradingFrequency: 'scalping' | 'daytrading' | 'swing' | 'position',
  riskLevel: 1-10,
  preferredPairs: string[],
  tradingStyle: 'trend' | 'counter-trend' | 'mixed',
  indicators: {
    sma: { enabled: boolean, period: number },
    rsi: { enabled: boolean, period: number }
  }
}
```

### Technical Indicators
- Keep calculations simple and efficient
- Use ta-lib or technicalindicators library
- Always validate input data
- Return null for insufficient data

### Discord Notifications
- Rate limit: Max 1 notification per user per minute
- Format messages with embeds for better UX
- Include timestamp and source in all alerts
- Allow users to customize notification types

### ML Model Integration
```python
# Standard prediction response format
{
  "prediction": "buy" | "sell" | "hold",
  "confidence": 0.0-1.0,
  "factors": {
    "technical": 0.0-1.0,
    "sentiment": 0.0-1.0,
    "pattern": 0.0-1.0
  },
  "timestamp": ISO8601
}
```

## Environment Variables
Always require these environment variables:
```env
NODE_ENV=development|production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ALPHA_VANTAGE_KEY=...
TWELVE_DATA_KEY=...
DISCORD_BOT_TOKEN=...
ML_API_URL=http://localhost:8000
```

## Git Workflow & GitHub Integration

### **🔐 GitHub Authentication**

**GitHub Personal Access Token (PAT):**
- PAT is stored in: `~/.git-credentials` (secure file with 600 permissions)
- Git remote URL is configured with PAT for automatic authentication
- Use `git push origin main` to push - authentication is automatic
- PAT is also available in git config credential helper

**IMPORTANT**: Always use the stored PAT to push to GitHub. No manual authentication needed.

### **🔄 Session-Based Commit Strategy**

**IMPORTANT**: At the end of EVERY Claude Code session where changes were made, you MUST commit and push to GitHub.

### **Commit Frequency Rules**

1. **After Every Conversation Session**
   - Commit all changes made during the session
   - Include descriptive commit message with context
   - Push to GitHub immediately

2. **After Completing Major Features**
   - Commit when a feature is fully implemented
   - Commit when tests pass
   - Commit after successful deployment

3. **Before Ending Work**
   - Always commit before closing terminal
   - Always commit before shutting down
   - Always commit before switching tasks

### **Commit Message Format**

Use **Conventional Commits** specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### **Type** (Required)
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, or auxiliary tools
- `config`: Configuration changes
- `ml`: Machine learning model updates
- `deploy`: Deployment-related changes

#### **Scope** (Optional but Recommended)
Examples: `backend`, `frontend`, `ml-engine`, `discord-bot`, `api`, `auth`, `trading-signals`, `database`

#### **Subject** (Required)
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters

#### **Body** (Required for Session Commits)
- Explain WHAT was changed and WHY
- Include context about the conversation
- Reference issue numbers if applicable
- Wrap at 72 characters

#### **Footer** (Optional)
- Breaking changes: `BREAKING CHANGE: <description>`
- Issue references: `Closes #123`, `Fixes #456`
- Co-authored by: `Co-Authored-By: Claude <noreply@anthropic.com>`

### **Session Commit Examples**

#### Example 1: Frontend Development
```bash
git add frontend/src/components/Login.jsx frontend/src/services/api.js
git commit -m "fix(frontend): resolve CORS and login authentication issues

Session Summary:
- Modified Login component to use 'identifier' instead of 'email'
- Updated authAPI.login() to accept identifier parameter
- Fixed CORS configuration in backend for public IP
- Added public IP (144.24.41.178) to allowed origins
- Updated Apache proxy configuration for API endpoints

Changes made during Claude Code session to fix login functionality
and enable external access to the application.

Fixes: Login form 'Not allowed by CORS' error
Tested: Successfully logged in with john@example.com

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Example 2: ML Engine Setup
```bash
git add ml_engine/ ML_ENGINE_TODO.md
git commit -m "docs(ml-engine): create ML engine setup documentation

Session Summary:
- Created ML_ENGINE_TODO.md with 14-step setup guide
- Documented ML engine architecture and requirements
- Added installation instructions for Python dependencies
- Included training data preparation guidelines
- Documented API integration with backend

Documentation created during planning session for ML engine
deployment. No code changes, preparation for next implementation phase.

Reference: /root/AIFX_v2/ML_ENGINE_TODO.md

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Example 3: Backend API Fix
```bash
git add backend/src/controllers/authController.js backend/src/app.js
git commit -m "fix(backend): support email/username login and update CORS

Session Summary:
- Modified authController.login() to accept 'identifier' field
- Updated User.findOne() to search by email OR username using Sequelize Op.or
- Added public IPs (144.24.41.178, 10.0.0.199) to CORS allowed origins
- Fixed validation error message to reflect identifier requirement

Backend changes to support frontend login form and enable external access.
Login now accepts both email and username as identifier.

Tested: curl request with identifier successfully authenticated
Impact: Resolves authentication issues for web application

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Example 4: Configuration Changes
```bash
git add frontend/.env apache2/sites-available/000-default.conf
git commit -m "config(frontend,apache): configure production environment

Session Summary:
- Updated frontend/.env to use relative API URL (/api/v1)
- Configured Apache reverse proxy for backend API (port 3000 -> /api)
- Configured Apache reverse proxy for frontend (port 5173 -> /)
- Added WebSocket support for Vite HMR
- Enabled Apache proxy modules (proxy, proxy_http, proxy_wstunnel)

Environment configuration for production deployment with Apache.
Frontend now accessible via http://144.24.41.178

Services running:
- Frontend: port 5173 (proxied)
- Backend: port 3000 (proxied)
- Apache: port 80

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

### **Automated Session Commit Template**

At the end of each session, use this template:

```bash
# 1. Review all changes
git status

# 2. Stage all changed files
git add .

# 3. Create commit with session summary
git commit -m "<type>(<scope>): <concise description>

Session Summary:
- [Change 1: What was modified and why]
- [Change 2: What was modified and why]
- [Change 3: What was modified and why]

[Context: Why these changes were needed]
[Impact: What problems were solved]

[Optional: Testing results]
[Optional: Related issues]

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push to GitHub
git push origin main
```

### **Pre-Commit Checklist**

Before every commit, verify:
- [ ] No sensitive data (API keys, passwords, secrets)
- [ ] No debugging code (console.log, debugger)
- [ ] Code follows project style guide
- [ ] Tests pass (if applicable)
- [ ] Documentation updated (if needed)
- [ ] Environment variables documented

### **Session End Protocol**

**Every time you finish working with Claude Code:**

```bash
# Step 1: Check working tree
git status

# Step 2: Review changes
git diff

# Step 3: Stage changes
git add .

# Step 4: Commit with detailed message
git commit -m "type(scope): description

[Detailed session summary here]

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Step 5: Push to remote
git push origin main

# Step 6: Verify
git log -1
```

### **Branch Naming Conventions**

- `feature/*` - New features (e.g., `feature/ml-integration`)
- `fix/*` - Bug fixes (e.g., `fix/cors-error`)
- `hotfix/*` - Urgent production fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates
- `test/*` - Test additions or updates
- `config/*` - Configuration changes

### **Pull Request Guidelines**

When creating PRs:
1. **Title**: Follow commit message format
2. **Description**: Include:
   - Summary of changes
   - Motivation and context
   - Testing performed
   - Screenshots (if UI changes)
   - Breaking changes (if any)
3. **Labels**: Add appropriate labels
4. **Reviewers**: Assign reviewers (if team)
5. **Link Issues**: Reference related issues

### **Git Workflow Process**

```bash
# Daily workflow
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Make changes during Claude Code session
# ... coding ...

# Session end commit
git add .
git commit -m "feat(scope): description

Session Summary:
[Details of what was implemented]

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push and create PR
git push origin feature/your-feature-name
# Create PR on GitHub

# After PR approval
git checkout main
git pull origin main
git branch -d feature/your-feature-name
```

### **Commit Message Quality Standards**

**Good Examples:**
```
✅ feat(trading-signals): add RSI indicator calculation
✅ fix(auth): resolve JWT token expiration handling
✅ docs(api): update trading endpoints documentation
✅ refactor(ml-engine): optimize LSTM model architecture
✅ config(apache): add reverse proxy for ML API
```

**Bad Examples:**
```
❌ update stuff
❌ fix bug
❌ changes
❌ WIP
❌ asdfasdf
```

### **Special Commit Scenarios**

#### Initial Commit
```bash
git commit -m "chore: initial project setup

- Initialize AIFX v2 forex trading advisory system
- Setup backend (Node.js + Express)
- Setup frontend (React + Vite)
- Setup ML engine (Python + TensorFlow)
- Configure PostgreSQL and Redis
- Add Discord bot integration
- Create project documentation"
```

#### Database Migration
```bash
git commit -m "feat(database): add user preferences table

- Create migration for user_preferences table
- Add fields: trading_frequency, risk_level, preferred_pairs
- Create foreign key relationship to users table
- Add indexes for user_id and created_at
- Include rollback migration

Migration file: 20250101000002-create-user-preferences.js"
```

#### Hotfix
```bash
git commit -m "hotfix(api): fix critical CORS vulnerability

URGENT: Production issue causing all external requests to fail

- Add missing CORS origin for production domain
- Update security headers
- Add rate limiting to prevent abuse
- Deploy immediately to production

Fixes: #234 (CORS error blocking all users)
Priority: Critical"
```

## Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis cache cleared
- [ ] ML models deployed
- [ ] Discord bot online
- [ ] SSL certificates valid
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] **Git commits pushed to GitHub**
- [ ] **Session changes documented in commit**

## Common Pitfalls to Avoid
1. Don't store sensitive data in JWT
2. Don't trust client-side calculations
3. Don't make synchronous API calls
4. Don't ignore rate limits
5. Don't cache user-specific data globally
6. Don't expose internal error details to users
7. Don't use floating point for monetary calculations
8. **Don't end sessions without committing to GitHub**
9. **Don't write vague commit messages**
10. **Don't commit without session summary**

## Performance Metrics to Monitor
- API response time < 200ms (p95)
- Database query time < 50ms (p95)
- ML prediction time < 1000ms
- WebSocket latency < 100ms
- Cache hit rate > 80%
- Error rate < 1%

## Dependencies to Use
### Backend (Node.js)
- express: ^4.18.0
- sequelize: ^6.0.0
- jsonwebtoken: ^9.0.0
- bcrypt: ^5.0.0
- axios: ^1.0.0
- socket.io: ^4.0.0
- redis: ^4.0.0
- winston: ^3.0.0 (logging)
- joi: ^17.0.0 (validation)
- helmet: ^7.0.0 (security)
- cors: ^2.8.0
- dotenv: ^16.0.0

### ML Engine (Python)
- tensorflow>=2.10.0
- scikit-learn>=1.0.0
- pandas>=1.5.0
- numpy>=1.23.0
- fastapi>=0.100.0
- uvicorn>=0.23.0
- redis>=4.0.0

### Frontend (React)
- react: ^18.2.0
- vite: ^4.0.0
- axios: ^1.0.0
- react-router-dom: ^6.0.0
- tailwindcss: ^3.0.0
- chart.js: ^4.0.0
- socket.io-client: ^4.0.0

## Response Examples

### Success Response
```javascript
res.status(200).json({
  success: true,
  data: {
    signal: 'buy',
    confidence: 0.75,
    indicators: { sma: 1.1234, rsi: 45 }
  },
  error: null,
  timestamp: new Date().toISOString()
});
```

### Error Response
```javascript
res.status(400).json({
  success: false,
  data: null,
  error: 'Invalid currency pair format',
  timestamp: new Date().toISOString()
});
```

## Final Notes
- Always prioritize user data security
- Implement gradual rollout for new features
- Maintain comprehensive documentation
- Follow the principle of least privilege
- Regular security audits are mandatory
- Keep dependencies updated
- Monitor and log everything
- **Commit all session changes to GitHub before ending work**
- **Write descriptive commit messages with session context**
- **Include 🤖 Generated with Claude Code signature in commits**
