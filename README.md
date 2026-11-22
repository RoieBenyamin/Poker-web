הנה קובץ `README.md` שלם, מפורט ומלא להעתקה בהדבקה אחת (Single Block) — כולל תיאור המוצר, ארכיטקטורה, סכמת מסד הנתונים, אלגוריתם קיזוז החובות, הוראות התקנה מלאות, פריסה ל-Vercel, ותקציר מלא בעברית בסוף.

```markdown
# ♠️ Poker Between Friends (פוקר בין חברים)

A modern, real-time Progressive Web App (PWA) for managing home poker games, tracking buy-ins/cash-outs live at the table, minimizing end-of-night peer-to-peer settlements, and analyzing long-term player statistics — built with zero-friction onboarding so friends can join straight from a WhatsApp invite link.

---

## 📋 Table of Contents

- [✨ Key Features](#-key-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ System Architecture & Data Model](#️-system-architecture--data-model)
- [🧮 Settlement Minimization Algorithm](#-settlement-minimization-algorithm)
- [🔒 Security & Access Control](#-security--access-control)
- [🚀 Local Development Setup](#-local-development-setup)
- [🔥 Firebase Configuration Checklist](#-firebase-configuration-checklist)
- [🌐 Production Deployment (Vercel)](#-production-deployment-vercel)
- [📱 Installing on Mobile (PWA)](#-installing-on-mobile-pwa)
- [🇮🇱 תקציר מלא בעברית](#-תקציר-מלא-בעברית)

---

## ✨ Key Features

- **⚡ Zero-Friction Onboarding:** Powered by **Firebase Anonymous Authentication** and group invite links. Players join a group from their phone in seconds by selecting or entering their name — no email, password, or registration form required.
- **🔄 Real-Time Table Synchronization:** Built on **Cloud Firestore** real-time listeners (`onSnapshot`). Every buy-in, rebuy, and cash-out updates instantaneously across all players' devices at the table.
- **💸 Smart Debt Settlement:** Automatically computes the minimum number of peer-to-peer transfers (e.g., Bit / PayBox) needed to settle all balances at the end of a session, eliminating manual spreadsheet math.
- **📊 Personal & Group Analytics:** Tracks complete session logs, net profit/loss history, total buy-ins, win rates, and cumulative performance trends over time for every player in the group.
- **📱 Mobile-First & PWA Ready:** Designed specifically for mobile viewports with full RTL Hebrew support and **Add to Home Screen** support for a native app experience.
- **🛡️ Role-Based Group Security:** Enforces strict group-level permissions via Firestore Security Rules so only verified group members can access group data while group admins manage table actions.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React + TypeScript | Component-based UI with strict type safety |
| **Build Tool** | Vite | Fast local development server and optimized production bundling |
| **Database** | Firebase Cloud Firestore | Real-time NoSQL cloud persistence and cross-group queries |
| **Authentication** | Firebase Anonymous Auth | Frictionless per-device session identity without passwords |
| **Deployment & Hosting** | Vercel | Continuous deployment from GitHub with HTTPS & global CDN |

---

## 🏗️ System Architecture & Data Model

### 1. Authentication & Device Persistence
When a user opens the application, Firebase silently generates a persistent anonymous `uid` cached in the browser storage. When joining a group via an invite code, the app links that `uid` to a player profile inside the group. If a player switches devices or clears browser data, they can simply reclaim their existing player profile inside the group without losing historical stats.

### 2. Firestore Collection Hierarchy
```text
groups/
 └── {groupId}/
      ├── name, inviteCode, createdAt, createdBy
      ├── members/
      │    └── {memberId}/
      │         └── name, userId (Firebase UID), role ("admin" | "member"), joinedAt
      └── sessions/
           └── {sessionId}/
                └── date, status ("active" | "closed"), entries[], settlements[]

```

### 3. Cross-Group Discovery

To display all groups a player belongs to immediately upon opening the app, the client queries across all `members` subcollections simultaneously using a Firestore **Collection Group Query** (`collectionGroup(db, 'members')` filtered by `userId == currentUser.uid`).

---

## 🧮 Settlement Minimization Algorithm

At the end of every poker session, each player has a net balance:


$$\text{Net}_i = \text{CashOut}_i - \text{TotalBuyIn}_i$$

To settle the table with the **fewest possible transfers**:

1. Players are partitioned into **Creditors** ($\text{Net}_i > 0$) and **Debtors** ($\text{Net}_i < 0$).
2. Both lists are sorted by magnitude (largest creditor and largest debtor first).
3. In each step, the largest debtor transfers $\min(|\text{Debt}|, \text{Credit})$ to the largest creditor.
4. Any player whose remaining balance reaches `0` is removed from the active queue, and the process repeats until all balances are settled.

---

## 🔒 Security & Access Control

The repository includes a `firestore.rules` file tailored for closed friend groups:

* **Authenticated Access Only:** Unauthenticated requests are rejected by default.
* **Member-Scoped Reads:** Users can only read group metadata, sessions, and member lists for groups where their `uid` is registered.
* **Admin Controls:** Sensitive operations (such as closing sessions or managing group settings) are restricted to group administrators.

---

## 🚀 Local Development Setup

### Prerequisites

* **Node.js** v18 or higher
* **npm** (included with Node.js)
* A **Firebase** project

### Installation Steps

1. **Clone the repository:**
```bash
git clone [https://github.com/RoieBenyamin/Poker-web.git](https://github.com/RoieBenyamin/Poker-web.git)
cd Poker-web

```


2. **Install dependencies:**
```bash
npm install

```


3. **Create your local environment file:**
Copy `.env.example` to `.env` in the root directory and populate it with your Firebase Web App credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

```


*(Note: `.env` is listed in `.gitignore` and is never committed to GitHub.)*
4. **Start the local development server:**
```bash
npm run dev

```


Open `http://localhost:5173/` in your browser.

---

## 🔥 Firebase Configuration Checklist

Before running the app in production, ensure the following three settings are configured in your **Firebase Console**:

1. **Enable Anonymous Authentication:**
* Go to **Authentication → Sign-in method → Anonymous** and toggle **Enable** on.
* Keep **Auto clean-up** unchecked so player sessions are not automatically purged after 30 days.


2. **Create the Collection Group Index:**
* Go to **Firestore Database → Indexes → Automatic (Single field) → Add exemption**.
* Set **Collection ID** to `members`, **Field path** to `userId`, and enable **Ascending** under **Collection group scope**.


3. **Publish Security Rules:**
* Go to **Firestore Database → Rules**, paste the contents of `firestore.rules` from this repository, and click **Publish**.



---

## 🌐 Production Deployment (Vercel)

1. Push your code to GitHub (`main` branch).
2. Log in to [Vercel](https://vercel.com/) and import the `Poker-web` repository (Framework Preset: **Vite**).
3. Under **Environment Variables**, import or add all `VITE_FIREBASE_*` keys from your `.env` file.
4. Click **Deploy** and copy your live production domain (e.g., `poker-web.vercel.app`).
5. **Authorize the Domain in Firebase:**
* Open **Firebase Console → Authentication → Settings → Authorized domains**.
* Click **Add domain** and paste your Vercel URL (without `https://`).



---

## 📱 Installing on Mobile (PWA)

Players can install the web app directly onto their phone's home screen without downloading anything from an app store:

* **iOS (Safari):** Open the group link → Tap the **Share** button (`↑`) → Select **Add to Home Screen** (`הוסף למסך הבית`).
* **Android (Chrome):** Open the group link → Tap the **Menu** icon (`⋮`) → Select **Add to Home Screen** (`הוסף למסך הבית`).

---

## 🇮🇱 תקציר מלא בעברית

**פוקר בין חברים (Poker Between Friends)** היא אפליקציית ווב מתקדמת (PWA) לניהול משחקי פוקר ביתיים בזמן אמת — שנועדה להחליף את טבלאות האקסל, הפתקים והחישובים המתישים בסוף הערב.

### למה בנינו את זה?

במשחקי פוקר ביתיים, הרגע הכי מעיק הוא סוף הלילה: לספור מי נכנס בכמה, כמה רי-באיים כל אחד עשה, ואיך מעבירים כסף בביט או בפייבוקס בלי להסתבך. האפליקציה פותרת את זה מקצה לקצה בלחיצת כפתור.

### מה האפליקציה יודעת לעשות?

* **כניסה ב-10 שניות בלי הרשמה ובלי סיסמאות:** שולחים קישור הזמנה בקבוצת הוואטסאפ -> כל חבר נכנס מהטלפון, בוחר את השם שלו ומיד מחובר (מבוסס על אימות אנונימי מאובטח של Firebase).
* **סנכרון חי בזמן אמת בשולחן:** כל כניסה למשחק, רי-באי (Rebuy) או יציאה (Cash-out) מתעדכנים מיידית על המסכים של כל השחקנים דרך Cloud Firestore.
* **קיזוז חובות חכם (מינימום העברות):** ברגע שסוגרים שולחן, האלגוריתם מחשב אוטומטית את המסלול הקצר ביותר לסגירת החובות ("יוסי מעביר 120 ₪ לדני") כדי לחסוך העברות כפולות ומיותרות.
* **היסטוריה, מאזנים וסטטיסטיקות:** כל הנתונים נשמרים בענן לתמיד — כולל היסטוריית משחקים מלאה, רווח/הפסד מצטבר לכל שחקן, אחוזי הצלחה ומגמות לאורך זמן.
* **מותאם ב-100% למובייל:** ממשק בעברית מלאה (RTL) עם אפשרות הוספה למסך הבית באייפון ובאנדרואיד לחוויית שימוש של אפליקציה רגילה.

```

### איך להעלות את זה לגיטהאב בבת אחת:
1. ב-VS Code, לחץ על כפתור **`New File`** בתיקייה הראשית (`poker`) ותן לו את השם המדויק **`README.md`** (אם כבר קיים קובץ כזה, מחק את תוכנו והדבק את הכל).
2. שמור (`Ctrl + S`) והרץ בטרמינל:
   ```bash
   git add README.md
   git commit -m "Add comprehensive project README"
   git push

```
