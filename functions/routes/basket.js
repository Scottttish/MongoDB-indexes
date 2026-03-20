const express = require('express');
const router = express.Router();
const Basket = require('../models/Basket');
const PaymentCard = require('../models/PaymentCard');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/basket
router.get('/', async (req, res) => {
    try {
        const items = await Basket.find({ userId: req.user._id })
            .populate('cardId')
            .sort({ addedAt: -1 })
            .lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка получения корзины' });
    }
});

// POST /api/basket
router.post('/', async (req, res) => {
    try {
        const { cardId } = req.body;
        const card = await PaymentCard.findOne({ _id: cardId, userId: req.user._id });
        if (!card) return res.status(404).json({ message: 'Карточка не найдена' });

        const existing = await Basket.findOne({ userId: req.user._id, cardId });
        if (existing) return res.status(400).json({ message: 'Карточка уже в корзине' });

        const item = new Basket({ userId: req.user._id, cardId });
        await item.save();
        const populated = await item.populate('cardId');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка добавления в корзину' });
    }
});

// DELETE /api/basket/:id
router.delete('/:id', async (req, res) => {
    try {
        const item = await Basket.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!item) return res.status(404).json({ message: 'Элемент не найден' });
        res.json({ message: 'Удалено из корзины' });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка удаления из корзины' });
    }
});

module.exports = router;
