const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'ultra-secret-jwt-key-utility-app-2026';
const generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { nickname, email, password } = req.body;
        if (!nickname || !email || !password)
            return res.status(400).json({ message: 'Заполните все поля' });
        if (password.length < 6)
            return res.status(400).json({ message: 'Пароль должен быть минимум 6 символов' });

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser)
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });

        const user = new User({ nickname, email, password });
        await user.save();
        const token = generateToken(user._id);
        res.status(201).json({ token, user: user.toJSON() });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({
            message: 'Ошибка сервера при регистрации',
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: 'Введите email и пароль' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user)
            return res.status(401).json({ message: 'Неверный email или пароль' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch)
            return res.status(401).json({ message: 'Неверный email или пароль' });

        const token = generateToken(user._id);
        res.json({ token, user: user.toJSON() });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            message: 'Ошибка сервера при входе',
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

module.exports = router;
