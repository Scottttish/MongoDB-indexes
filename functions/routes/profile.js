const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PaymentCard = require('../models/PaymentCard');
const Basket = require('../models/Basket');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/profile
router.get('/', async (req, res) => {
    res.json(req.user.toJSON());
});

// PUT /api/profile
router.put('/', async (req, res) => {
    try {
        const { nickname, email, password, currentPassword } = req.body;
        const user = req.user;

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
            if (emailExists) return res.status(400).json({ message: 'Email уже занят' });
            user.email = email.toLowerCase();
        }
        if (nickname) user.nickname = nickname;
        if (password) {
            if (!currentPassword) return res.status(400).json({ message: 'Введите текущий пароль' });
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) return res.status(401).json({ message: 'Неверный текущий пароль' });
            user.password = password;
        }

        await user.save();
        res.json(user.toJSON());
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ message: 'Ошибка обновления профиля' });
    }
});

// DELETE /api/profile
router.delete('/', async (req, res) => {
    try {
        const userId = req.user._id;
        await Promise.all([
            PaymentCard.deleteMany({ userId }),
            Basket.deleteMany({ userId }),
            User.findByIdAndDelete(userId)
        ]);
        res.json({ message: 'Аккаунт удалён' });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка удаления аккаунта' });
    }
});

module.exports = router;
