# Shwapno Outlet PWA

## ১. Backend (Google Sheets + Apps Script)
1. নতুন Google Sheet বানান → Extensions → Apps Script → `Code.gs` paste করুন।
2. Project Settings → Time zone = `Asia/Dhaka`।
3. Editor থেকে `setup` run করুন (sheets তৈরি হবে)।
4. `Users` sheet-এ নিজের row দিন: `your@gmail.com | admin | ADM001 | Active`
5. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web). Authorized JavaScript origins: `https://<username>.github.io`
6. Client ID `Code.gs`-এর `CLIENT_ID`-তে বসান।
7. Deploy → New deployment → Web app → Execute as: **Me**, Who has access: **Anyone** → URL কপি করুন।

## ২. Frontend (GitHub Pages)
1. `index.html`-এর `CONFIG`-এ `API_URL` (step 7) ও `CLIENT_ID` বসান।
2. সব ফাইল (`index.html, manifest.json, sw.js, icon-192.png, icon-512.png`) repo-তে push করুন।
3. Settings → Pages → Deploy from branch → main / root।
4. Android Chrome-এ খুলে "Add to Home screen"।

## নিরাপত্তা
- Google ID token সার্ভারে verify হয়; role/status `Users` sheet থেকে আসে।
- Employee শুধু নিজের task status, attendance ও আজকের sales লিখতে পারে; বাকি সব শুধু Admin।
- Code.gs বদলালে নতুন version হিসেবে re-deploy করুন।
