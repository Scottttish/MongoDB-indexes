import React from 'react';
import { FiX, FiTrash2 } from 'react-icons/fi';
import { CATEGORY_CONFIG } from './PaymentCard';

function formatAmount(amount, currency = 'KZT') {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export default function BasketPanel({ isOpen, onClose, items, onRemove }) {
    if (!isOpen) return null;

    const total = items.reduce((sum, item) => sum + (item.cardId?.amount || 0), 0);

    return (
        <>
            <div className="panel-overlay" onClick={onClose} />
            <div className="panel-slide">
                <div className="panel-header">
                    <h2>🛒 Корзина платежей</h2>
                    <button className="panel-close" onClick={onClose}><FiX /></button>
                </div>

                <div className="panel-body">
                    {items.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🛒</div>
                            <h3>Корзина пуста</h3>
                            <p>Добавьте платёжные карточки для оплаты</p>
                        </div>
                    ) : (
                        items.map((item) => {
                            const card = item.cardId;
                            if (!card) return null;
                            const cat = CATEGORY_CONFIG[card.category] || CATEGORY_CONFIG.other;
                            return (
                                <div key={item._id} className="basket-item">
                                    <div className="basket-item-icon" style={{ background: cat.bg, color: cat.color }}>
                                        {cat.icon}
                                    </div>
                                    <div className="basket-item-info">
                                        <div className="basket-item-title">{card.title}</div>
                                        <div className="basket-item-provider">{card.provider}</div>
                                    </div>
                                    <div className="basket-item-amount">{formatAmount(card.amount, card.currency)}</div>
                                    <button className="basket-remove-btn" onClick={() => onRemove(item._id)} title="Удалить">
                                        <FiTrash2 />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {items.length > 0 && (
                    <div className="panel-footer">
                        <div className="basket-total">
                            <span className="basket-total-label">Итого ({items.length} платежей):</span>
                            <span className="basket-total-amount">{formatAmount(total)}</span>
                        </div>
                        <button className="basket-pay-btn">Оплатить всё</button>
                    </div>
                )}
            </div>
        </>
    );
}
