const express = require('express');
const router = express.Router();
const userDb = require('../models/user');

const ADMIN_PHONE = process.env.ADMIN_PHONE || '0700000000';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const ADMIN_TOKEN = process.env.ADMIN_ID || 'TRADEXORA_ADMIN_KEY_99';

// Register User
router.post('/api/auth/register', (req, res) => {
    const { fullName, phoneNumber, password } = req.body;
    const cleanPhone = (phoneNumber || '').replace(/\s+/g, '');

    if (!fullName || !cleanPhone || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!cleanPhone.startsWith('0') || cleanPhone.length < 10) {
        return res.status(400).json({ success: false, message: 'Phone number must start with 0 (e.g. 0712345678).' });
    }

    const newUser = {
        fullName: fullName.trim(),
        phoneNumber: cleanPhone,
        password,
        role: 'user',
        kycStatus: 'PENDING',
        wallet: {
            realBalance: 0,
            demoBalance: 10000
        },
        createdAt: new Date()
    };

    userDb.insert(newUser, (err, doc) => {
        if (err) {
            return res.status(400).json({ success: false, message: 'Phone number already registered.' });
        }
        res.json({ success: true, message: 'Account created successfully!', user: doc });
    });
});

// Login
router.post('/api/auth/login', (req, res) => {
    const { phoneNumber, password } = req.body;
    const cleanPhone = (phoneNumber || '').replace(/\s+/g, '');

    // Admin login check
    if (cleanPhone === ADMIN_PHONE && password === ADMIN_PASS) {
        return res.json({
            success: true,
            isAdmin: true,
            adminId: ADMIN_TOKEN,
            message: 'Admin login successful'
        });
    }

    userDb.findOne({ phoneNumber: cleanPhone, password }, (err, user) => {
        if (err || !user) {
            return res.status(401).json({ success: false, message: 'Incorrect phone number or password.' });
        }
        res.json({ success: true, isAdmin: false, user });
    });
});

// Admin API: Get Users
router.get('/api/admin/users', (req, res) => {
    const adminId = req.headers['x-admin-id'];
    if (adminId !== ADMIN_TOKEN) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    userDb.find({}, (err, users) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, users });
    });
});

// Admin API: Fund Wallet
router.post('/api/admin/fund-wallet', (req, res) => {
    const adminId = req.headers['x-admin-id'];
    if (adminId !== ADMIN_TOKEN) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { userId, action, walletType, amount } = req.body;
    userDb.findOne({ _id: userId }, (err, user) => {
        if (err || !user) return res.status(404).json({ success: false, message: 'User not found' });

        const current = Number(user.wallet[walletType] || 0);
        const numAmount = Number(amount);
        const updatedBalance = action === 'add' ? current + numAmount : Math.max(0, current - numAmount);

        user.wallet[walletType] = updatedBalance;
        userDb.update({ _id: userId }, { $set: { wallet: user.wallet } }, {}, (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Update failed' });
            res.json({ success: true, message: 'Wallet updated successfully!' });
        });
    });
});

module.exports = router;