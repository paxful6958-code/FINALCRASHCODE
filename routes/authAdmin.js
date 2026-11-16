const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DB_FILE = path.join(__dirname, '..', 'database.json');

// Admin Credentials & Token Configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tradexora.com';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_ID || 'TRADEXORA_ADMIN_KEY_99';

// Initialize JSON database if it doesn't exist
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { users: [], chats: {} };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { users: [], chats: {} };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Middleware to verify Admin header
function requireAdmin(req, res, next) {
    const adminId = req.headers['x-admin-id'];
    if (adminId !== ADMIN_TOKEN) {
        return res.status(401).json({ success: false, message: 'Unauthorized Admin Session' });
    }
    next();
}

// ================= AUTH ROUTES (USER) =================

// Register User (Full Name + Phone starting with 0 + Password)
router.post('/api/auth/register', (req, res) => {
    const { fullName, phoneNumber, password } = req.body;
    const cleanPhone = (phoneNumber || '').replace(/\s+/g, '');

    if (!fullName || !cleanPhone || !password) {
        return res.status(400).json({ success: false, message: 'Full name, phone number, and password are required.' });
    }
    if (!cleanPhone.startsWith('0') || cleanPhone.length < 10) {
        return res.status(400).json({ success: false, message: 'Phone number must start with 0 (e.g. 0712345678).' });
    }

    const db = readDB();
    if (db.users.some(u => u.phoneNumber === cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Phone number already registered.' });
    }

    const newUser = {
        _id: 'USR_' + Date.now(),
        fullName: fullName.trim(),
        phoneNumber: cleanPhone,
        password,
        role: 'user',
        kycStatus: 'PENDING',
        wallet: {
            realBalance: 0,
            demoBalance: 10000
        },
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);

    res.json({ success: true, message: 'Account created successfully!', user: newUser });
});

// User Login (Phone Number + Password)
router.post('/api/auth/login', (req, res) => {
    const { phoneNumber, password } = req.body;
    const cleanPhone = (phoneNumber || '').replace(/\s+/g, '');

    const db = readDB();
    const user = db.users.find(u => u.phoneNumber === cleanPhone && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: 'Incorrect phone number or password.' });
    }

    res.json({ success: true, isAdmin: false, user });
});

// Get Live User Profile & Wallet State (For User Dashboard Synchronization)
router.get('/api/auth/user/:userId', (req, res) => {
    const db = readDB();
    const user = db.users.find(u => u._id === req.params.userId);

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Exclude password before sending back to client
    const { password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
});

// ================= ADMIN PORTAL LOGIN =================

router.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (cleanEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASS) {
        return res.json({
            success: true,
            adminId: ADMIN_TOKEN,
            message: 'Admin authentication successful'
        });
    }

    res.status(401).json({
        success: false,
        message: 'Invalid administrator email or password.'
    });
});

// ================= ADMIN MANAGEMENT ROUTES =================

// Get All Users
router.get('/api/admin/users', requireAdmin, (req, res) => {
    const db = readDB();
    res.json({ success: true, users: db.users });
});

// Fund / Deduct User Wallet
router.post('/api/admin/fund-wallet', requireAdmin, (req, res) => {
    const { userId, action, walletType, amount } = req.body;
    const db = readDB();
    const user = db.users.find(u => u._id === userId);

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.wallet) {
        user.wallet = { realBalance: 0, demoBalance: 10000 };
    }

    const current = Number(user.wallet[walletType] || 0);
    const numAmount = Number(amount);

    if (action === 'add') {
        user.wallet[walletType] = current + numAmount;
    } else if (action === 'subtract') {
        user.wallet[walletType] = Math.max(0, current - numAmount);
    }

    writeDB(db);
    res.json({ success: true, message: `Successfully updated ${user.fullName}'s ${walletType}.` });
});

// Pending KYC Queue
router.get('/api/admin/kyc-pending', requireAdmin, (req, res) => {
    const db = readDB();
    const pending = db.users.filter(u => (u.kycStatus || 'PENDING') === 'PENDING');
    res.json({ success: true, users: pending });
});

// Approve / Reject KYC
router.post('/api/admin/kyc-action', requireAdmin, (req, res) => {
    const { userId, action } = req.body;
    const db = readDB();
    const user = db.users.find(u => u._id === userId);

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.kycStatus = action;
    writeDB(db);
    res.json({ success: true, message: `User ${user.fullName} marked as ${action}.` });
});

// ================= SUPPORT CHAT ROUTES =================

router.get('/api/admin/chats/threads', requireAdmin, (req, res) => {
    const db = readDB();
    const threads = Object.keys(db.chats).map(userId => {
        const msgs = db.chats[userId];
        const last = msgs[msgs.length - 1];
        const user = db.users.find(u => u._id === userId || u.phoneNumber === userId);
        return {
            userId,
            displayName: user ? `${user.fullName} (${user.phoneNumber})` : userId,
            lastMessage: last ? last.message : ''
        };
    });
    res.json({ success: true, threads });
});

router.get('/api/auth/chat/:userId', (req, res) => {
    const db = readDB();
    res.json({ success: true, messages: db.chats[req.params.userId] || [] });
});

router.post('/api/auth/chat/send', (req, res) => {
    const { userId, sender, message } = req.body;
    const db = readDB();
    if (!db.chats[userId]) db.chats[userId] = [];
    db.chats[userId].push({
        sender,
        message,
        timestamp: new Date().toISOString()
    });
    writeDB(db);
    res.json({ success: true });
});


// ================= USER GAME WALLET ROUTES =================

// Generic wallet mutation for the logged-in user (bets, wins, losses)
router.post('/api/auth/wallet-update', (req, res) => {
    const { userId, walletType, amount, mode } = req.body; // mode: 'set' | 'add' | 'subtract'
    const db = readDB();
    const user = db.users.find(u => u._id === userId);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!['realBalance', 'demoBalance'].includes(walletType)) {
        return res.status(400).json({ success: false, message: 'Invalid wallet type' });
    }

    if (!user.wallet) user.wallet = { realBalance: 0, demoBalance: 10000 };

    const current = Number(user.wallet[walletType] || 0);
    const amt = Number(amount);

    if (isNaN(amt)) return res.status(400).json({ success: false, message: 'Invalid amount' });

    if (mode === 'set') {
        user.wallet[walletType] = Math.max(0, amt);
    } else if (mode === 'add') {
        user.wallet[walletType] = current + amt;
    } else if (mode === 'subtract') {
        if (current < amt) {
            return res.status(400).json({ success: false, message: 'Insufficient server balance' });
        }
        user.wallet[walletType] = current - amt;
    } else {
        return res.status(400).json({ success: false, message: 'Invalid mode' });
    }

    writeDB(db);
    const { password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
});
module.exports = router;