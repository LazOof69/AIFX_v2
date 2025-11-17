# AIFX_v2 Documentation Index

**Last Updated**: November 11, 2025

This document serves as a navigation guide to all documentation in the AIFX_v2 project.

---

## Quick Start (Read These First)

1. **PROJECT_STRUCTURE_QUICK_REFERENCE.md** (13 KB)
   - 5-minute project overview
   - Technology stack summary
   - Key entry points
   - Quick start commands
   - Troubleshooting tips
   - **Best for**: Getting familiar with the project quickly

2. **START_HERE.md** (Chinese)
   - Quick installation guide (in Chinese)
   - Service startup instructions
   - tmux session management
   - **Best for**: First-time setup

---

## Comprehensive Documentation

3. **PROJECT_ARCHITECTURE_ANALYSIS.md** (29 KB) - NEW
   - Complete directory structure with full explanations
   - All services detailed (Backend, Frontend, ML Engine, Discord Bot)
   - Database schema and migrations
   - API endpoints (35+)
   - System architecture diagrams
   - Data flow examples
   - Configuration details
   - Technology stack details
   - Deployment structure
   - **Best for**: Understanding complete architecture

---

## Status & Progress Documentation

4. **PROJECT_STATUS.md** (11 KB)
   - Development phase progress
   - Completed features by phase
   - Test results
   - Current blockers
   - **Best for**: Understanding what's been done and what's in progress

5. **DISCORD_SERVICE_STATUS.md** (15 KB)
   - Discord bot status
   - Slash commands documentation
   - Error handling details
   - Recent issues and fixes
   - **Best for**: Discord bot troubleshooting and understanding

6. **ML_INTEGRATION_STATUS_REPORT.md** (17 KB)
   - ML engine integration status
   - Model details
   - Training pipeline
   - API endpoints
   - **Best for**: Understanding ML component

---

## Setup & Installation

7. **COMPLETE_SETUP_GUIDE.md** (10 KB)
   - Full installation instructions
   - Database setup
   - Service configuration
   - Environment variables
   - **Best for**: Complete project setup from scratch

8. **ML_ENGINE_DEPLOYMENT.md** (21 KB)
   - ML engine setup guide
   - Model training instructions
   - Deployment procedures
   - **Best for**: ML engine configuration

9. **DISCORD_SETUP.md** (8 KB)
   - Discord bot setup
   - Token configuration
   - Command deployment
   - **Best for**: Discord bot configuration

---

## Technical Details

10. **DATABASE_ARCHITECTURE.md** (21 KB)
    - Complete database schema
    - Table relationships
    - Migration details
    - **Best for**: Understanding data structure

11. **E2E_TEST_GUIDE.md** (10 KB)
    - End-to-end testing guide
    - Test scenarios
    - Test results
    - **Best for**: Testing the system

12. **TESTING_ALL_PHASES.md**
    - Comprehensive test coverage
    - Phase-wise tests
    - Test results
    - **Best for**: Ensuring all features work

---

## Project Rules & Guidelines

13. **CLAUDE.md** (17 KB)
    - Project rules and conventions
    - Code style guidelines
    - Security requirements
    - API design rules
    - Git workflow
    - Commit message format
    - **Best for**: Following project conventions

14. **`.env.example`**
    - Environment variable template
    - All required configuration
    - **Best for**: Setting up environment

---

## Diagnostic & Troubleshooting

15. **FIX_DISCORD_BOT_TIMEOUTS.md** (5 KB)
    - Discord timeout issues
    - Retry logic explanation
    - Solutions
    - **Best for**: Fixing Discord bot issues

16. **DIAGNOSTIC_GUIDE.md** (5 KB)
    - Troubleshooting guide
    - Common issues
    - Solutions
    - **Best for**: Quick troubleshooting

17. **BUG_FIX_REPORT.md** (3 KB)
    - Recent bug fixes
    - Issue tracking
    - **Best for**: Understanding recent changes

---

## Advanced Topics

18. **FINAL_TEST_REPORT.md** (10 KB)
    - Final system test results
    - Test coverage
    - Performance metrics
    - **Best for**: Verifying system functionality

19. **CONTINUOUS_LEARNING_PROGRESS.md** (17 KB)
    - ML continuous learning setup
    - Model updates
    - **Best for**: Understanding ML updates

20. **ML_DATA_STRATEGY.md** (21 KB)
    - Data collection strategy
    - Data processing pipeline
    - **Best for**: Understanding data workflow

---

## Phase-Specific Documentation

21. **PHASE3_PROGRESS_STATUS.md**
    - Phase 3 progress
    - Features implemented
    - Current status
    - **Best for**: Phase 3 specific information

22. **PHASE3_WEEK1_MONITORING_SERVICE_COMPLETE.md**
    - Week 1 monitoring service completion
    - Features added
    - Testing results
    - **Best for**: Monitoring service details

---

## Configuration Files

### Root Configuration
- `.env.example` - Environment variable template
- `.gitignore` - Git ignore rules

### Backend Configuration
- `backend/.env` - Backend environment variables
- `backend/.env.example` - Backend environment template
- `backend/package.json` - Node.js dependencies
- `backend/jest.config.js` - Jest testing configuration
- `backend/.sequelizerc` - Sequelize CLI configuration
- `backend/database/config/config.js` - Database configuration

### Frontend Configuration
- `frontend/.env` - Frontend environment variables
- `frontend/package.json` - React dependencies
- `frontend/vite.config.js` - Vite build configuration
- `frontend/tailwind.config.js` - Tailwind CSS configuration
- `frontend/postcss.config.js` - PostCSS configuration

### ML Engine Configuration
- `ml_engine/.env` - ML engine environment variables
- `ml_engine/.env.example` - ML engine template
- `ml_engine/config.yaml` - LSTM and training configuration
- `ml_engine/requirements.txt` - Python dependencies

### Discord Bot Configuration
- `discord_bot/.env` - Discord bot environment variables
- `discord_bot/.env.example` - Discord bot template
- `discord_bot/package.json` - Node.js dependencies

---

## Documentation by Purpose

### For New Developers
1. Start: PROJECT_STRUCTURE_QUICK_REFERENCE.md
2. Setup: COMPLETE_SETUP_GUIDE.md
3. Rules: CLAUDE.md
4. Deep dive: PROJECT_ARCHITECTURE_ANALYSIS.md

### For Frontend Developers
1. Architecture: PROJECT_ARCHITECTURE_ANALYSIS.md (Frontend section)
2. API: Read API endpoints section in PROJECT_ARCHITECTURE_ANALYSIS.md
3. Setup: COMPLETE_SETUP_GUIDE.md (Frontend section)

### For Backend Developers
1. Architecture: PROJECT_ARCHITECTURE_ANALYSIS.md (Backend section)
2. Database: DATABASE_ARCHITECTURE.md
3. API Design: CLAUDE.md (API Design Rules section)
4. Setup: COMPLETE_SETUP_GUIDE.md (Backend section)

### For ML Engineers
1. ML Status: ML_INTEGRATION_STATUS_REPORT.md
2. Deployment: ML_ENGINE_DEPLOYMENT.md
3. Data: ML_DATA_STRATEGY.md
4. Architecture: PROJECT_ARCHITECTURE_ANALYSIS.md (ML Engine section)

### For DevOps / SysAdmins
1. Setup: COMPLETE_SETUP_GUIDE.md
2. Deployment: All services have deployment instructions
3. Configuration: Environment variables and config files
4. Troubleshooting: DIAGNOSTIC_GUIDE.md

### For Discord Bot Developers
1. Status: DISCORD_SERVICE_STATUS.md
2. Setup: DISCORD_SETUP.md
3. Issues: FIX_DISCORD_BOT_TIMEOUTS.md
4. Architecture: PROJECT_ARCHITECTURE_ANALYSIS.md (Discord Bot section)

---

## File Locations

All documentation files are located in `/root/AIFX_v2/` unless noted otherwise.

### Documentation Hierarchy
```
/root/AIFX_v2/
├── (This file) DOCUMENTATION_INDEX.md
│
├── QUICK START GUIDES
│   ├── PROJECT_STRUCTURE_QUICK_REFERENCE.md (15 min read)
│   ├── START_HERE.md (Chinese quick start)
│   └── COMPLETE_SETUP_GUIDE.md
│
├── DETAILED ARCHITECTURE
│   ├── PROJECT_ARCHITECTURE_ANALYSIS.md (30 min read)
│   ├── DATABASE_ARCHITECTURE.md
│   └── PROJECT_OVERVIEW_ZH.md (Chinese)
│
├── SERVICE-SPECIFIC DOCUMENTATION
│   ├── DISCORD_SERVICE_STATUS.md
│   ├── DISCORD_SETUP.md
│   ├── ML_INTEGRATION_STATUS_REPORT.md
│   ├── ML_ENGINE_DEPLOYMENT.md
│   └── ML_DATA_STRATEGY.md
│
├── PROJECT MANAGEMENT
│   ├── PROJECT_STATUS.md (Phase progress)
│   ├── PHASE3_PROGRESS_STATUS.md
│   └── FINAL_TEST_REPORT.md
│
├── GUIDELINES & RULES
│   ├── CLAUDE.md (Project rules)
│   ├── E2E_TEST_GUIDE.md
│   └── TESTING_ALL_PHASES.md
│
├── TROUBLESHOOTING
│   ├── DIAGNOSTIC_GUIDE.md
│   ├── FIX_DISCORD_BOT_TIMEOUTS.md
│   └── BUG_FIX_REPORT.md
│
├── ADVANCED TOPICS
│   ├── CONTINUOUS_LEARNING_PROGRESS.md
│   ├── ML_V3_ARCHITECTURE_DESIGN.md
│   ├── ML_V3_DATA_PREPARATION_COMPLETE.md
│   └── (20+ other technical documents)
│
└── CONFIGURATION TEMPLATES
    ├── .env.example
    ├── backend/.env.example
    ├── frontend/.env.example
    ├── ml_engine/.env.example
    └── discord_bot/.env.example
```

---

## How to Use This Index

1. **First time?** → Read PROJECT_STRUCTURE_QUICK_REFERENCE.md
2. **Want full details?** → Read PROJECT_ARCHITECTURE_ANALYSIS.md
3. **Setting up project?** → Read COMPLETE_SETUP_GUIDE.md
4. **Need to troubleshoot?** → Read DIAGNOSTIC_GUIDE.md
5. **Following conventions?** → Read CLAUDE.md
6. **Service-specific help?** → Find in the service-specific section above

---

## Documentation Maintenance

These documents are maintained as part of the project. Updates happen when:
- New features are implemented
- Architecture changes
- Bugs are fixed
- Deployment procedures change

Last documentation sync: November 11, 2025

---

## Related Resources

- Git Repository: https://github.com/AIFX_v2
- Issue Tracker: GitHub Issues
- Project Board: GitHub Projects

---

For questions or suggestions about documentation, see CLAUDE.md for contribution guidelines.

