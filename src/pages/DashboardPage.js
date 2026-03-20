/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getCards } from '../services/cardsService';
import { getBasket, addToBasket, removeFromBasket } from '../services/basketService';
import Navbar from '../components/Navbar';
import PaymentCard from '../components/PaymentCard';
import BasketPanel from '../components/BasketPanel';
import ProfilePanel from '../components/ProfilePanel';

const LIMIT = 12;

export default function DashboardPage() {
    const { isAuthenticated, user } = useAuth();
    const [cards, setCards] = useState([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [basketItems, setBasketItems] = useState([]);
    const [basketLoading, setBasketLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('createdAt');
    const [order, setOrder] = useState('desc');
    const [basketOpen, setBasketOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const searchTimer = useRef(null);

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);

    const fetchCards = useCallback(async (params = {}) => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const data = await getCards({ search, category, status, sort, order, page, limit: LIMIT, ...params });
            setCards(data.cards || []);
            setTotal(data.total || 0);
            setPages(data.pages || 1);
        } catch (err) {
            showToast('Ошибка загрузки данных', 'error');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, search, category, status, sort, order, page]);

    const fetchBasket = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await getBasket();
            setBasketItems(data || []);
        } catch { }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchCards();
            fetchBasket();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) fetchCards();
    }, [category, status, sort, order, page]);

    // Редирект, если не залогинен (теперь ПОСЛЕ хуков)
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const handleSearchChange = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setPage(1);
            fetchCards({ search: val, page: 1 });
        }, 400);
    };

    const handleAddToBasket = async (cardId) => {
        setBasketLoading(true);
        try {
            const item = await addToBasket(cardId);
            setBasketItems(prev => [...prev, item]);
            showToast('Добавлено в корзину', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Ошибка добавления', 'error');
        } finally {
            setBasketLoading(false);
        }
    };

    const handleRemoveFromBasket = async (id) => {
        try {
            await removeFromBasket(id);
            setBasketItems(prev => prev.filter(i => i._id !== id));
            showToast('Удалено', 'info');
        } catch {
            showToast('Ошибка удаления', 'error');
        }
    };

    return (
        <div className="dashboard">
            <Navbar
                onBasketClick={() => setBasketOpen(true)}
                basketCount={basketItems.length}
                onProfileClick={() => setProfileOpen(true)}
                searchValue={search}
                onSearchChange={handleSearchChange}
            />

            <main className="dashboard-content">
                <div className="filter-bar">
                    <select className="filter-select" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
                        <option value="all">Все категории</option>
                        <option value="electricity">Электричество</option>
                        <option value="water">Вода</option>
                        <option value="internet">Интернет</option>
                        <option value="gas">Газ</option>
                    </select>

                    <select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                        <option value="all">Любой статус</option>
                        <option value="pending">Ожидает</option>
                        <option value="paid">Оплачено</option>
                        <option value="overdue">Просрочено</option>
                    </select>

                    <button className={`sort-btn ${sort === 'amount' ? 'active' : ''}`} onClick={() => handleSort('amount')}>
                        По сумме {sort === 'amount' && (order === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
                    </button>
                    <button className={`sort-btn ${sort === 'createdAt' ? 'active' : ''}`} onClick={() => handleSort('createdAt')}>
                        По дате {sort === 'createdAt' && (order === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
                    </button>
                </div>

                {loading ? (
                    <div className="cards-grid">
                        {[...Array(6)].map((_, i) => <div key={i} className="skeleton-card skeleton" style={{ height: 200 }} />)}
                    </div>
                ) : (
                    <>
                        <div className="cards-header">
                            <h2>Найдено счетов: {total}</h2>
                        </div>
                        <div className="cards-grid">
                            {cards.map(card => (
                                <PaymentCard
                                    key={card._id}
                                    card={card}
                                    onAddToBasket={handleAddToBasket}
                                    isInBasket={basketItems.some(item => (item.cardId?._id || item.cardId) === card._id)}
                                    loading={basketLoading}
                                />
                            ))}
                        </div>

                        {pages > 1 && (
                            <div className="pagination">
                                {[...Array(pages)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        className={`page-btn ${page === i + 1 ? 'active' : ''}`}
                                        onClick={() => setPage(i + 1)}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            <BasketPanel
                isOpen={basketOpen}
                onClose={() => setBasketOpen(false)}
                items={basketItems}
                onRemove={handleRemoveFromBasket}
            />

            <ProfilePanel
                isOpen={profileOpen}
                onClose={() => setProfileOpen(false)}
                user={user}
            />

            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
                ))}
            </div>
        </div>
    );

    function handleSort(field) {
        if (sort === field) { setOrder(o => o === 'asc' ? 'desc' : 'asc'); }
        else { setSort(field); setOrder('desc'); }
        setPage(1);
    }
}
