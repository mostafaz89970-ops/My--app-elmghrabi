# نظام الإنارة العامة - Firebase Setup Guide

## Steps to Enable Firebase Database:

### 1. Enable Realtime Database:
- Go to [Firebase Console](https://console.firebase.google.com/)
- Select project: `elmghrabyelectric`
- Go to "Realtime Database"
- Click "Create Database"
- Select a location (e.g., us-central1)
- **Important**: Select "Start in test mode" to allow read/write

### 2. Update Database Rules:
In Firebase Console > Realtime Database > Rules, use:
```
json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## To Install & Run:

1. **Install dependencies:**
```
bash
npm install
```

2. **Run locally:**
```
bash
npm run dev
```

3. **Build for production:**
```
bash
npm run build
```

4. **Create installer (EXE):**
```
bash
npm run dist
```

## Firebase Configuration (Already Configured):

- **Project ID:** elmghrabyelectric
- **Database URL:** https://elmghrabyelectric-default-rtdb.firebaseio.com
- **Auth Domain:** elmghrabyelectric.firebaseapp.com

## Troubleshooting:

If data doesn't show in cloud:
1. Check Firebase Console > Realtime Database is created
2. Verify rules allow read/write
3. Check browser console for errors
4. Make sure npm install completed successfully
