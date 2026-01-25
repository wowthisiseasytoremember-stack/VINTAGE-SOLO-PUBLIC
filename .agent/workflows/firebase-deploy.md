---
description: Build and deploy Vintage Solo to Firebase Hosting
---

// turbo-all

1. Archive backend files to `_archived/`
2. Change directory to `frontend/`
3. Install frontend dependencies: `npm install`
4. Build production bundle: `npm run build`
5. Return to root directory
6. Deploy to Firebase: `npx firebase deploy --only hosting`
