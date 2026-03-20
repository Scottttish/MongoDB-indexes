const express = require('express');
const router = express.Router();
const PaymentCard = require('../models/PaymentCard');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/cards — paginated with search, sort, filter
router.get('/', async (req, res) => {
    try {
        const { search, category, status, sort = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;
        const query = { userId: req.user._id };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { provider: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category && category !== 'all') query.category = category;
        if (status && status !== 'all') query.status = status;

        const sortObj = {};
        sortObj[sort] = order === 'asc' ? 1 : -1;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [cards, total] = await Promise.all([
            PaymentCard.find(query).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
            PaymentCard.countDocuments(query)
        ]);

        res.json({ cards, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('Get cards error:', err);
        res.status(500).json({ message: 'Ошибка получения карточек' });
    }
});

// POST /api/cards
router.post('/', async (req, res) => {
    try {
        const { title, category, provider, amount, currency, status, dueDate, accountNumber, description } = req.body;
        if (!title || !category || !provider || amount === undefined)
            return res.status(400).json({ message: 'Заполните обязательные поля' });

        const card = new PaymentCard({ title, category, provider, amount, currency, status, dueDate, accountNumber, description, userId: req.user._id });
        await card.save();
        res.status(201).json(card);
    } catch (err) {
        console.error('Create card error:', err);
        res.status(500).json({ message: 'Ошибка создания карточки' });
    }
});

// DELETE /api/cards/:id
router.delete('/:id', async (req, res) => {
    try {
        const card = await PaymentCard.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!card) return res.status(404).json({ message: 'Карточка не найдена' });
        res.json({ message: 'Карточка удалена' });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка удаления карточки' });
    }
});

module.exports = router;
