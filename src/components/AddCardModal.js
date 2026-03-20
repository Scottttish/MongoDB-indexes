import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { createCard } from '../services/cardsService';

const CATEGORIES = [
    { value: 'electricity', label: 'Электроэнергия' },
    { value: 'gas', label: 'Газ' },
    { value: 'water', label: 'Вода' },
    { value: 'internet', label: 'Интернет' },
    { value: 'phone', label: 'Телефон' },
    { value: 'heating', label: 'Отопление' },
    { value: 'trash', label: 'Вывоз мусора' },
    { value: 'cable', label: 'Кабельное ТВ' },
    { value: 'security', label: 'Охрана' },
    { value: 'other', label: 'Прочее' },
];
const STATUSES = [
    { value: 'pending', label: 'Ожидает' },
    { value: 'paid', label: 'Оплачено' },
    { value: 'overdue', label: 'Просрочено' },
    { value: 'cancelled', label: 'Отменено' },
];

export default function AddCardModal({ isOpen, onClose, onCreated, onToast }) {
    const [form, setForm] = useState({
        title: '', category: 'electricity', provider: '',
        amount: '', currency: 'KZT', status: 'pending',
        dueDate: '', accountNumber: '', description: ''
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;
    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title || !form.provider || !form.amount) return onToast('Заполните обязательные поля', 'error');
        setLoading(true);
        try {
            const card = await createCard({ ...form, amount: parseFloat(form.amount) });
            onCreated(card);
            onToast('Карточка создана!', 'success');
            onClose();
            setForm({ title: '', category: 'electricity', provider: '', amount: '', currency: 'KZT', status: 'pending', dueDate: '', accountNumber: '', description: '' });
        } catch (err) {
            onToast(err.response?.data?.message || 'Ошибка создания', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2>Новая карточка платежа</h2>
                    <button className="panel-close" onClick={onClose}><FiX /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Название *</label>
                            <input type="text" placeholder="Счёт за электроэнергию" value={form.title} onChange={set('title')} required />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Категория *</label>
                                <select className="filter-select" value={form.category} onChange={set('category')} style={{ width: '100%', height: 48, borderRadius: 8, border: '1.5px solid #e0e0e0', padding: '0 12px', fontSize: '1rem', background: 'white' }}>
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Статус</label>
                                <select className="filter-select" value={form.status} onChange={set('status')} style={{ width: '100%', height: 48, borderRadius: 8, border: '1.5px solid #e0e0e0', padding: '0 12px', fontSize: '1rem', background: 'white' }}>
                                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Поставщик *</label>
                            <input type="text" placeholder="Название компании" value={form.provider} onChange={set('provider')} required />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Сумма *</label>
                                <input type="number" placeholder="0.00" value={form.amount} onChange={set('amount')} min="0" step="0.01" required />
                            </div>
                            <div className="form-group">
                                <label>Валюта</label>
                                <select className="filter-select" value={form.currency} onChange={set('currency')} style={{ width: '100%', height: 48, borderRadius: 8, border: '1.5px solid #e0e0e0', padding: '0 12px', fontSize: '1rem', background: 'white' }}>
                                    <option value="KZT">KZT — Тенге</option>
                                    <option value="USD">USD — Доллар</option>
                                    <option value="RUB">RUB — Рубль</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Срок оплаты</label>
                                <input type="date" value={form.dueDate} onChange={set('dueDate')} style={{ height: 48 }} />
                            </div>
                            <div className="form-group">
                                <label>Номер счёта</label>
                                <input type="text" placeholder="ACC-XXXXXXX" value={form.accountNumber} onChange={set('accountNumber')} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Описание</label>
                            <input type="text" placeholder="Дополнительная информация" value={form.description} onChange={set('description')} />
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
                            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 28px' }} disabled={loading}>
                                {loading ? 'Создание...' : 'Создать карточку'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
