# Run Commands

This document contains the commands required to run the various applications within the Workout Analyzer project.

## Run Everything Together
Since this project uses Turborepo, you can start all applications simultaneously from the root directory:
```powershell
npm run dev
```

---

## Run Individually

If you prefer to run the applications separately, you can navigate to their respective directories and start them:

### 1. API
```powershell
cd apps/api
npm run dev
```

### 2. Web App
```powershell
cd apps/web
npm run dev
```

### 3. Mobile App (Android)
```powershell
cd apps/mobile
npm run dev

# Or to run specifically for Android:
npm run android
```
