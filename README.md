# Health Record System — React + Vite

## Modules

- **User module:** Create an account and log in; manage health records, report files, prescription paper pictures, health history, and profile.
- **Admin module:** Search user accounts, review their saved health records and prescription images, see project totals, and remove an account.

Both modules are implemented in React. Demo data is stored in the current browser's Local Storage, as required for the class review. This means browser data is local to the device/browser; it is not a shared online database.

## Demo Admin login

- Email: `admin@hrs.com`
- Password: `admin123`

## Run locally on Windows PowerShell

1. Install Node.js LTS.
2. Open this project folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run `npm.cmd install` once.
5. Run `npm.cmd run dev` when you want to start the app.
6. Open the `Local` address Vite prints.

## Build for deployment

Vercel uses the included `vercel.json` settings. Build command: `npm run build`. Output folder: `dist`.

## GitHub and Vercel

Push this project folder to a GitHub repository, then import that repository from Vercel. After deployment, open the Vercel URL and verify User signup/login and Admin login. The public link is not created yet; it requires connecting a GitHub repository and Vercel account.
