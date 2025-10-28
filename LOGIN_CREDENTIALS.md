# 🔐 AIFX v2 Login Credentials

## ✅ Correct Test Accounts

### User 1: John Doe (Admin)
```
Email:    john@example.com
Password: password123
```
⚠️ **Note:** Password is all lowercase, no special characters!

### User 2: Jane Smith (Trader)
```
Email:    jane@example.com
Password: trader2023
```

### User 3: Demo User
```
Email:    demo@example.com
Password: demo1234
```

### User 4: Test User
```
Email:    test@example.com
Password: test5678
```

---

## 🌐 Access URLs

### External Access (from anywhere)
```
http://168.138.182.181:5173
```

### Internal Access (same network)
```
http://10.0.0.135:5173
```

---

## 🐛 Troubleshooting Login Issues

### Issue 1: "Invalid credentials" error
**Solution:** Make sure you're using the correct password:
- ❌ Wrong: `Password123!` (uppercase P, with !)
- ✅ Correct: `password123` (all lowercase, no !)

### Issue 2: Cannot connect to server
**Check services are running:**
```bash
# Check all services
curl http://localhost:3000/api/v1/health  # Backend
curl http://localhost:5173                 # Frontend
curl http://localhost:8000/health          # ML Engine
```

### Issue 3: CORS errors in browser console
**Solution:** Backend CORS is configured for:
- `http://localhost:5173`
- `http://10.0.0.135:5173`
- `http://168.138.182.181:5173`

If accessing from a different IP, update backend CORS settings.

### Issue 4: "Network Error" in browser
**Check:**
1. Backend is running: `curl http://localhost:3000/api/v1/health`
2. Frontend env variables: Check `frontend/.env`
3. Browser console for detailed errors (F12)

---

## 🔧 Manual Login Test (curl)

Test backend directly:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"john@example.com","password":"password123"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "...",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

---

## 📝 Password Reset (if needed)

If you forgot the password or want to change it:

### Option 1: Re-run seeders
```bash
cd /root/AIFX_v2/backend
npx sequelize-cli db:seed:undo:all
npx sequelize-cli db:seed:all
```

### Option 2: Direct database update
```bash
# Generate new hash for "newpassword123"
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('newpassword123', 10).then(hash => console.log(hash));"

# Update in database (use the hash from above)
psql -U postgres -d aifx_v2_dev -c "UPDATE users SET password_hash='<HASH_HERE>' WHERE email='john@example.com';"
```

---

## 🎨 UI Changes (Recent)

### What's New:
- ✅ Form spacing optimized (25% more compact)
- ✅ Better fit for laptop screens
- ✅ Input fields adjusted (py-4 → py-3)
- ✅ Button sizes optimized (text-lg → text-base)
- ✅ Maintained visual impact

### Before/After:
```
Before: Very tall form (~800px)
After:  Compact form (~600px)
```

---

## 🚀 Quick Start

1. **Access the site:**
   ```
   http://168.138.182.181:5173
   ```

2. **Click "Login" tab** (should be selected by default)

3. **Enter credentials:**
   ```
   Email: john@example.com
   Password: password123
   ```

4. **Click "Sign In to AIFX ✨"**

5. **You should be redirected to Dashboard**

---

## 📞 Still Having Issues?

Check the system status:
```bash
bash /root/AIFX_v2/verify-system.sh
```

Check backend logs:
```bash
tmux attach -t aifx-backend
# Press Ctrl+B, D to exit
```

Check frontend logs:
```bash
tmux attach -t aifx-frontend
# Press Ctrl+B, D to exit
```

---

**Last Updated:** 2025-10-28 16:45
**Maintained by:** Claude Code
