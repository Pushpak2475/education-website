# 📚 EduVault — College Knowledge Hub

## Complete Full-Stack Website
Department-wise, semester-wise notes, PYQs, assignments sharing platform
with real-time chat and admin panel.

---

## 🗂 Project Structure

```
eduvault/
│
├── server.js              ← Main server (start here)
├── package.json           ← Dependencies list
├── .env                   ← Secret config (MongoDB URL, JWT secret)
│
├── models/
│   ├── User.js            ← User schema (students, faculty, admin)
│   ├── File.js            ← Uploaded file schema
│   └── Message.js         ← Chat message schema
│
├── routes/
│   ├── auth.js            ← POST /api/auth/register, /login, GET /me
│   ├── files.js           ← Upload, download, browse, like, delete
│   ├── chat.js            ← Chat rooms list, message history
│   └── admin.js           ← Admin: stats, users, file moderation
│
├── middleware/
│   └── auth.js            ← JWT protect + role-based authorize
│
├── socket/
│   └── chatSocket.js      ← Real-time chat via Socket.IO
│
├── public/
│   └── index.html         ← Complete frontend (HTML + CSS + JS)
│
└── uploads/               ← Uploaded files stored here (auto-created)
```

---

## 🚀 HOW TO RUN (Step by Step)

### Step 1 — Install Node.js
Download from: https://nodejs.org (choose LTS version)
Verify: open terminal and type `node -v`

### Step 2 — Install MongoDB
Download from: https://www.mongodb.com/try/download/community
Install and start MongoDB service.
Or use MongoDB Atlas (free cloud): https://cloud.mongodb.com

### Step 3 — Set up the project
```bash
# Navigate to project folder
cd eduvault

# Install all dependencies from package.json
npm install
```

### Step 4 — Configure .env
Open `.env` file and set:
- `MONGO_URI` — your MongoDB connection string
- `JWT_SECRET` — any long random string (for security)

### Step 5 — Start the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# OR production
npm start
```

### Step 6 — Open in browser
```
http://localhost:5000
```

---

## 📡 API ENDPOINTS

### Auth
| Method | URL                     | Description          | Auth |
|--------|-------------------------|----------------------|------|
| POST   | /api/auth/register      | Create account       | No   |
| POST   | /api/auth/login         | Login, get token     | No   |
| GET    | /api/auth/me            | Get my profile       | Yes  |
| PUT    | /api/auth/update-profile| Update profile       | Yes  |

### Files
| Method | URL                        | Description          | Auth |
|--------|----------------------------|----------------------|------|
| POST   | /api/files/upload          | Upload a file        | Yes  |
| GET    | /api/files                 | Browse files         | No   |
| GET    | /api/files/:id             | Get file details     | No   |
| GET    | /api/files/download/:id    | Download file        | No   |
| POST   | /api/files/like/:id        | Like/unlike file     | Yes  |
| DELETE | /api/files/:id             | Delete file          | Yes  |

### Chat
| Method | URL                        | Description          | Auth |
|--------|----------------------------|----------------------|------|
| GET    | /api/chat/rooms            | Get room list        | No   |
| GET    | /api/chat/history/:room    | Get chat history     | Yes  |

### Admin (admin role only)
| Method | URL                        | Description          | Auth |
|--------|----------------------------|----------------------|------|
| GET    | /api/admin/stats           | Dashboard stats      | Admin|
| GET    | /api/admin/users           | All users            | Admin|
| PUT    | /api/admin/users/:id       | Ban/unban, role      | Admin|
| GET    | /api/admin/files           | All files            | Admin|
| PUT    | /api/admin/files/:id       | Approve/reject file  | Admin|
| DELETE | /api/admin/files/:id       | Delete file          | Admin|

---

## 🔑 Creating an Admin Account

After running the server, open MongoDB Compass (GUI) or shell and run:
```javascript
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

Or insert an admin directly:
```javascript
// Using mongosh
use eduvault
db.users.insertOne({
  name: "Admin",
  email: "admin@college.edu",
  password: "$2a$10$...", // bcrypt hash of your password
  role: "admin"
})
```

---

## 🧩 Tech Stack

| Layer     | Technology         | Purpose                        |
|-----------|--------------------|--------------------------------|
| Frontend  | HTML + CSS + JS    | UI, forms, API calls           |
| Backend   | Node.js + Express  | REST API server                |
| Database  | MongoDB + Mongoose | Store users, files, messages   |
| Auth      | JWT + bcryptjs     | Secure login, password hashing |
| File Upload | Multer           | Handle file uploads            |
| Real-time | Socket.IO          | Live chat                      |
| Config    | dotenv             | Environment variables          |

---

## 🛡 Security Features
- Passwords are bcrypt-hashed (never stored as plain text)
- JWT tokens expire after 7 days
- Role-based access control (student / faculty / admin)
- File type validation (only PDF, DOCX, PPTX, images allowed)
- 50 MB file size limit
- XSS prevention in chat (HTML escaped)
- Users can only delete their own files (or admin can delete any)
