# Git Upload Guide - Tiikii Festival Server

## ✅ Files TO Upload to Git

### **Core Application Files**
```
src/                          # All source code
├── app.js                    # Main Express app
├── index.js                  # Server entry point
├── config.js                 # Configuration
├── database/                 # Database schemas and migrations
│   ├── database.js
│   ├── schema.sql
│   ├── migrate.js
│   └── seed.js
├── middleware/               # Custom middleware
├── routes/                   # API routes
├── services/                 # Business logic
├── socket/                   # Socket.IO handlers
└── utils/                    # Utility functions
```

### **Configuration Files**
```
package.json                  # Dependencies and scripts
package-lock.json            # Lock file for exact versions
jest.config.js               # Test configuration
Dockerfile                   # Container configuration
render.yaml                  # Render deployment config
railway.json                 # Railway deployment config
.dockerignore                # Docker ignore rules
.gitignore                   # Git ignore rules (updated)
.gitattributes               # Git attributes
```

### **Documentation**
```
Docs/                        # All documentation
├── DEPLOYMENT.md            # Deployment guide
├── DOCUMENTACION.md         # Main documentation
├── INSOMNIA_SETUP.md        # API testing setup
└── Diagramas/               # Architecture diagrams
```

### **Tests**
```
tests/                       # All test files
├── *.test.js               # Test files
├── openapi.yaml            # API specification
├── API_EXAMPLES.md         # API examples
└── POSTMAN_SETUP.md        # Postman setup
```

## ❌ Files NOT to Upload (Already in .gitignore)

### **Dependencies**
```
node_modules/                # NPM packages (regenerated with npm install)
```

### **Environment & Secrets**
```
.env                         # Environment variables
.env.local
.env.production.local
.env.development.local
.env.test.local
```

### **Database Files**
```
database/*.db                # SQLite database files
database/*.sqlite
database/*.sqlite3
*.db
*.sqlite
*.sqlite3
```

### **Build & Cache Files**
```
coverage/                    # Test coverage reports
.nyc_output/                # Coverage data
dist/                       # Build output
build/                      # Build artifacts
.cache/                     # Cache files
```

### **Logs & Runtime**
```
logs/                       # Log files
*.log                       # All log files
*.pid                       # Process IDs
```

### **OS & IDE Files**
```
.DS_Store                   # macOS files
Thumbs.db                   # Windows files
.vscode/                    # VS Code settings
.idea/                      # IntelliJ settings
```

## 🚀 Quick Upload Commands

### **1. Check what will be uploaded:**
```bash
git status
```

### **2. Add all files (respects .gitignore):**
```bash
git add .
```

### **3. Commit with message:**
```bash
git commit -m "Add Tiikii Festival server with deployment config"
```

### **4. Push to GitHub:**
```bash
git push origin main
```

## 🔍 Verify Before Upload

### **Check ignored files:**
```bash
git status --ignored
```

### **Check what's staged:**
```bash
git status --cached
```

### **Review changes:**
```bash
git diff --cached
```

## 📋 Pre-Upload Checklist

- [ ] `.env` file is NOT in repository
- [ ] Database files (*.db, *.sqlite) are ignored
- [ ] `node_modules/` is ignored
- [ ] Log files are ignored
- [ ] Coverage reports are ignored
- [ ] OS-specific files are ignored
- [ ] IDE files are ignored
- [ ] All source code is included
- [ ] Documentation is included
- [ ] Test files are included
- [ ] Deployment configs are included

## 🛡️ Security Checklist

- [ ] No API keys in code
- [ ] No database passwords in code
- [ ] No JWT secrets in code
- [ ] Environment variables use `.env` file
- [ ] Sensitive data in environment variables only

## 📁 Recommended Repository Structure

```
tiikii-festival-server/
├── src/                     # Source code
├── tests/                   # Test files
├── Docs/                    # Documentation
├── package.json             # Dependencies
├── Dockerfile              # Container config
├── render.yaml             # Render config
├── railway.json            # Railway config
├── .gitignore              # Git ignore rules
├── .dockerignore           # Docker ignore rules
├── jest.config.js          # Test config
└── README.md               # Project readme
```

## 🚨 Common Mistakes to Avoid

1. **Don't commit `.env` files** - Contains sensitive data
2. **Don't commit database files** - Platform-specific
3. **Don't commit `node_modules/`** - Can be regenerated
4. **Don't commit log files** - Unnecessary clutter
5. **Don't commit coverage reports** - Generated files
6. **Don't commit OS files** - System-specific

## 🔧 Environment Variables for Production

Set these in your deployment platform (Render/Railway/Heroku):

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
DB_PATH=/opt/render/project/src/database/tiikii_festival.db
CLIENT_URL=https://your-frontend-domain.com
```

## 📞 Need Help?

If you're unsure about a file:
1. Check if it's in `.gitignore`
2. Ask: "Can this be regenerated?"
3. Ask: "Does this contain sensitive data?"
4. When in doubt, exclude it

Your updated `.gitignore` now properly excludes all unnecessary files while keeping everything needed for deployment!
