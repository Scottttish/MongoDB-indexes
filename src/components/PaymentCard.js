import React from 'react';
import { FiZap, FiDroplet, FiWifi, FiPhone, FiTrash2, FiTv, FiShield, FiMoreHorizontal, FiThermometer, FiWind } from 'react-icons/fi';
import { FiPlus, FiCheck } from 'react-icons/fi';

const CATEGORY_CONFIG = {
    electricity: { icon: <FiZap />, label: 'Электроэнергия', color: '#F5A623', bg: '#FFF8EE' },
    gas: { icon: <FiWind />, label: 'Газ', color: '#7B68EE', bg: '#F3F1FF' },
    water: { icon: <FiDroplet />, label: 'Вода', color: '#4DA6FF', bg: '#EEF6FF' },
    internet: { icon: <FiWifi />, label: 'Интернет', color: '#2ECC71', bg: '#EFFFEF' },
    phone: { icon: <FiPhone />, label: 'Телефон', color: '#E74C3C', bg: '#FFEEED' },
    heating: { icon: <FiThermometer />, label: 'Отопление', color: '#FF6B35', bg: '#FFF1EB' },
    trash: { icon: <FiTrash2 />, label: 'Вывоз мусора', color: '#95A5A6', bg: '#F5F5F5' },
    cable: { icon: <FiTv />, label: 'Кабельное ТВ', color: '#8E44AD', bg: '#F7EEFF' },
    security: { icon: <FiShield />, label: 'Охрана', color: '#C0392B', bg: '#FFEDED' },
    other: { icon: <FiMoreHorizontal />, label: 'Прочее', color: '#16A085', bg: '#EDFFF9' },
};

const STATUS_LABELS = { pending: 'Ожидает', paid: 'Оплачено', overdue: 'Просрочено', cancelled: 'Отменено' };

function formatAmount(amount, currency = 'KZT') {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TITLE_PREFIXES = ['Счет — ', 'Счёт — ', 'Счет — ', 'Оплата — '];
const CATEGORY_TITLES = {
    electricity: 'Электроэнергия', gas: 'Оплата газа', water: 'Водоснабжение',
    internet: 'Интернет', phone: 'Телефон', heating: 'Отопление',
    trash: 'Вывоз мусора', cable: 'Кабельное ТВ', security: 'Охрана', other: 'Прочее',
};

function getDisplayTitle(card) {
    let t = card.title || '';
    // Strip technical prefixes and english category names
    TITLE_PREFIXES.forEach(p => { if (t.startsWith(p)) t = t.slice(p.length); });
    const lower = t.toLowerCase().trim();
    if (CATEGORY_TITLES[lower]) return CATEGORY_TITLES[lower];
    if (!t || t === card.category) return CATEGORY_TITLES[card.category] || t;
    return t;
}

export default function PaymentCard({ card, onAddToBasket, isInBasket, loading }) {
    const cat = CATEGORY_CONFIG[card.category] || CATEGORY_CONFIG.other;

    return (
        <div className="payment-card" style={{ '--card-accent': cat.color, '--icon-bg': cat.bg }}>
            <div className="card-header">
                <div className="card-icon" style={{ color: cat.color }}>{cat.icon}</div>
                <div className="card-header-main">
                    <h3 className="card-title">{getDisplayTitle(card)}</h3>
                    <p className="card-provider">{card.provider}</p>
                </div>
                <div className="card-category-badge" style={{ '--badge-bg': cat.bg, '--badge-color': cat.color }}>
                    {cat.label}
                </div>
            </div>
            <div className="card-amount">{formatAmount(card.amount, card.currency)}</div>
            <div className="card-meta">
                <span className={`card-status ${card.status}`}>{STATUS_LABELS[card.status]}</span>
                <span className="card-date">{formatDate(card.createdAt)}</span>
            </div>
            <div className="card-actions">
                <button
                    className={`card-add-btn ${isInBasket ? 'added' : ''}`}
                    onClick={() => !isInBasket && onAddToBasket(card._id)}
                    disabled={loading || isInBasket}
                >
                    {isInBasket ? <><FiCheck /> Добавлено</> : <><FiPlus /> В корзину</>}
                </button>
            </div>
        </div>
    );
}

export { CATEGORY_CONFIG };
