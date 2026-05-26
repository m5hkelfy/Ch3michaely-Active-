'use strict';
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "teacher";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MathChem2026";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-to-a-very-long-random-string-2026";

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

[DATA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const readJSON = (file, fallback = []) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } 
    catch { return fallback; }
};

const writeJSON = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) { console.error("Write error:", e); }
};

let resources = readJSON(RESOURCES_FILE);
let comments = readJSON(COMMENTS_FILE);

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[m]));

const upload = multer({
    storage: multer.diskStorage({
        destination: UPLOADS_DIR,
        filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname).toLowerCase())
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        const allowed = ['.pdf','.png','.jpg','.jpeg','.gif','.docx','.txt'];
        allowed.includes(path.extname(file.originalname).toLowerCase()) 
            ? cb(null, true) 
            : cb(new Error('File type not allowed'));
    }
});

app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "/uploads/"],
    connectSrc: ["'self'"]
}}}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 14400000 }
}));

const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });
const commentLimiter = rateLimit({ windowMs: 60*1000, max: 5 });

const requireAdmin = (req, res, next) => req.session?.isAdmin ? next() : res.status(403).json({ error: 'Unauthorized' });

// Student Portal
app.get('/', (_req, res) => {
res.send(`<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChEmIcally Active | Student Portal</title>
<style>${CSS}</style>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" defer></script>
</head>
<body>
<!-- Your original student HTML here -->
</body>
</html>`);
});

// Admin Panel
app.get('/admin', (_req, res) => {
res.send(`<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChEmIcally Active — Admin</title>
<style>${CSS}</style>
</head>
<body>
<!-- Your original admin HTML here -->
</body>
</html>`);
});

// API Routes
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.post('/api/upload', requireAdmin, (req, res) => {
    upload.single('fileInput')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        const { title, subject, type, link } = req.body;
        if (!title || !type) return res.status(400).json({ error: 'Title and type required' });

        const isFileType = ['notes', 'picture'].includes(type);
        let filePath = link;

        if (isFileType) {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
            filePath = `/uploads/${req.file.filename}`;
        } else if (!link) {
            return res.status(400).json({ error: 'URL required' });
        }

        const entry = {
            id: Date.now(),
            title: esc(title),
            subject: esc(subject),
            type,
            path: filePath,
            date: new Date().toLocaleDateString()
        };

        resources.unshift(entry);
        writeJSON(RESOURCES_FILE, resources);
        res.json({ success: true });
    });
});

app.get('/api/resources', (_req, res) => res.json(resources));
app.get('/api/comments', (_req, res) => res.json(comments));

app.post('/api/comments', commentLimiter, (req, res) => {
    const { name, text } = req.body;
    if (!name || !text) return res.status(400).json({ error: 'Name and text required' });

    const entry = {
        name: esc(name.trim()),
        text: esc(text.trim()),
        date: new Date().toLocaleDateString()
    };

    comments.push(entry);
    writeJSON(COMMENTS_FILE, comments);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 ChEmIcally Active running on port ${PORT}`);
    console.log(`🔑 Admin panel: http://localhost:${PORT}/admin`);
});
