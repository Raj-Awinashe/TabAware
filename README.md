# 🚀 TabAware  
### Smart Focus Tracking & Distraction Blocking  

👥 **Team: ChaceYourDreams**

---

## ✨ Overview

TabAware is a productivity-focused system that helps users stay focused by:

- Tracking browser activity in real time  
- Blocking distracting websites  
- Providing live insights into focus behavior  
- Managing productivity sessions  

It combines a **Chrome Extension + Backend + Dashboard UI** into one seamless system.

---

## 🔥 Features

### 🔒 Smart Website Blocking
- Automatically blocks distracting domains  
- Redirects users to a custom blocked page  
- Works in real time via Chrome extension  

### 📊 Live Dashboard
- Tracks active time  
- Shows distraction percentage  
- Displays domains visited  
- Gives productivity recommendations  

### 🧠 Focus Sessions
- Tracks current session  
- Shows session start time  
- Encourages focus with feedback  

### 🔐 Authentication
- Secure login system  
- Token-based authentication  
- Sync between extension and dashboard  

---

## 🧱 Tech Stack

| Layer        | Technology |
|-------------|-----------|
| Frontend    | React + Vite + TailwindCSS |
| Backend     | Node.js + Express |
| Database    | SQLite |
| Extension   | Chrome Extension (Manifest v3) |
| Auth        | JWT |

---

## 📂 Project Structure


TabAware/
├── src/ # React frontend
├── server.ts # Backend server
├── manifest.json # Chrome extension config
├── background.js # Extension logic
├── blocked.html # Blocked page UI
├── package.json
├── launch.bat
└── stop.bat


---

## ⚙️ Quick Start (Recommended)

### 🖥 Windows

Just run:


launch.bat


This will:
- Install all dependencies  
- Start backend server  
- Start frontend UI  

---

## 🧪 Manual Setup

### 1. Install dependencies


npm install


### 2. Start backend


npx tsx server.ts


### 3. Start frontend


npm run dev


---

## 🌐 Load the Chrome Extension

1. Open Chrome  
2. Go to:  

chrome://extensions

3. Enable **Developer Mode**  
4. Click **Load unpacked**  
5. Select your project folder  

---

## 🔑 Login

- Open the dashboard (`http://localhost:5173` or shown port)
- Create account or login  
- Extension will automatically use your session  

⚠️ Backend must be running on:

http://localhost:3000


---

## 🧠 How It Works

1. Chrome extension monitors tabs  
2. Sends activity to backend  
3. Backend stores data (SQLite)  
4. Dashboard fetches analytics  
5. Blocking is enforced in real time  

---

## 🐛 Common Issues & Fixes

### ❌ Extension not blocking
- Make sure backend is running  
- Ensure you're logged in  
- Check console for `401 Unauthorized`  

---

### ❌ UI looks broken
- Tailwind not configured correctly  
- Restart dev server  

---

### ❌ Port already in use


taskkill /F /IM node.exe


---

### ❌ "Failed to fetch"
- Backend not running  
- Wrong API URL  
- CORS issues  

---

## 🔥 Future Improvements

- AI-powered productivity insights  
- Focus streaks & gamification  
- Cross-device sync  
- Better analytics dashboard  
- Mobile companion app  

---

## 👥 Team

**ChaceYourDreams**

---
## 💡 Inspiration

Built for students and developers who want to take control of their time and eliminate distractions.
