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
import SkeletonCard from '../components/SkeletonCard';
import AddCardModal from '../components/AddCardModal';
import IndexMonitorWidget from '../components/IndexMonitor/IndexMonitorWidget';

const CATEGORIES = [
    { value: 'all', label: 'Все категории' },
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
    { value: 'all', label: 'Все статусы' },
    { value: 'pending', label: 'Ожидает' },
    { value: 'paid', label: 'Оплачено' },
    { value: 'overdue', label: 'Просрочено' },
    { value: 'cancelled', label: 'Отменено' },
];
const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Дата' },
    { value: 'amount', label: 'Сумма' },
    { value: 'title', label: 'Название' },
    { value: 'provider', label: 'Поставщик' },
    { value: 'dueDate', label: 'Срок' },
];
const LIMIT = 20;

// Toast system
function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type}`}>
                    {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : 'ℹ'} {t.message}
                </div>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const { isAuthenticated } = useAuth();
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
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    const searchTimer = useRef(null);

    if (!isAuthenticated) return <Navigate to="/login" replace />;

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);

    const fetchCards = useCallback(async (params = {}) => {
        setLoading(true);
        try {
            const data = await getCards({ search, category, status, sort, order, page, limit: LIMIT, ...params });
            setCards(data.cards);
            setTotal(data.total);
            setPages(data.pages);
        } catch (err) {
            showToast('Ошибка загрузки карточек', 'error');
        } finally {
            setLoading(false);
        }
    }, [search, category, status, sort, order, page]);

    const fetchBasket = useCallback(async () => {
        try {
            const data = await getBasket();
            setBasketItems(data);
        } catch { }
    }, []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchCards(); fetchBasket(); }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchCards(); }, [category, status, sort, order, page]);

    const handleSearchChange = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setPage(1);
            fetchCards({ search: val, page: 1 });
        }, 400);
    };

    const handleSort = (field) => {
        if (sort === field) { setOrder(o => o === 'asc' ? 'desc' : 'asc'); }
        else { setSort(field); setOrder('desc'); }
        setPage(1);
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
            showToast('Удалено из корзины', 'info');
        } catch {
            showToast('Ошибка удаления', 'error');
        }
    };

    const basketCardIds = new Set(basketItems.map(i => i.cardId?._id || i.cardId));

    const renderPagination = () => {
        if (pages <= 1) return null;
        const buttons = [];
        buttons.push(<button key="prev" className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>);
        for (let i = 1; i <= Math.min(pages, 5); i++) {
            buttons.push(<button key={i} className={`page-btn ${page === i ? 'active' : ''}`} onClick={() => setPage(i)}>{i}</button>);
        }
        if (pages > 5) {
            if (page > 4) buttons.push(<span key="..." style={{ padding: '0 8px', color: 'var(--text-muted)' }}>...</span>);
            if (page > 4 && page < pages) buttons.push(<button key={page} className="page-btn active">{page}</button>);
            if (page < pages - 1) buttons.push(<span key="...2" style={{ padding: '0 8px', color: 'var(--text-muted)' }}>...</span>);
            buttons.push(<button key={pages} className={`page-btn ${page === pages ? 'active' : ''}`} onClick={() => setPage(pages)}>{pages}</button>);
        }
        buttons.push(<button key="next" className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page === pages}>›</button>);
        return <div className="pagination">{buttons}</div>;
    };

    return (
        <div className="dashboard">
            <Toast toasts={toasts} />
            <Navbar
                onBasketClick={() => setBasketOpen(true)}
                basketCount={basketItems.length}
                onProfileClick={() => setProfileOpen(true)}
                searchValue={search}
                onSearchChange={handleSearchChange}
            />

            <div className="dashboard-content">
                {/* Filter Bar */}
                <div className="filter-bar">
                    <div className="filter-search-wrap">
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Поиск по названию, поставщику..."
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            style={{ paddingLeft: 40 }}
                        />
                    </div>
                    <select className="filter-select" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {SORT_OPTIONS.map(o => (
                            <button key={o.value} className={`sort-btn ${sort === o.value ? 'active' : ''}`} onClick={() => handleSort(o.value)}>
                                {o.label}
                                {sort === o.value && (order === 'asc' ? <FiChevronUp /> : <FiChevronDown />)}
                            </button>
                        ))}
                    </div>
                    <button
                        className="btn-primary"
                        style={{ width: 'auto', height: 40, padding: '0 20px', gap: 6, fontSize: '0.875rem' }}
                        onClick={() => setAddModalOpen(true)}
                    >
                        <FiPlus /> Добавить
                    </button>
                </div>

                {/* Cards Header */}
                <div className="cards-header">
                    <h2>Платёжные карточки</h2>
                    <span>{loading ? 'Загрузка...' : `${total.toLocaleString('ru-RU')} платежей`}</span>
                </div>

                {/* Cards Grid */}
                <div className="cards-grid">
                    {loading
                        ? Array.from({ length: LIMIT }, (_, i) => <SkeletonCard key={i} />)
                        : cards.length === 0
                            ? (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
                                    <h3 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>Ничего не найдено</h3>
                                    <p>Попробуйте изменить фильтры или добавьте новую карточку</p>
                                </div>
                            )
                            : cards.map(card => (
                                <PaymentCard
                                    key={card._id}
                                    card={card}
                                    onAddToBasket={handleAddToBasket}
                                    isInBasket={basketCardIds.has(card._id)}
                                    loading={basketLoading}
                                />
                            ))}
                </div>

                {!loading && renderPagination()}
            </div>

            <BasketPanel
                isOpen={basketOpen}
                onClose={() => setBasketOpen(false)}
                items={basketItems}
                onRemove={handleRemoveFromBasket}
            />

            <ProfilePanel
                isOpen={profileOpen}
                onClose={() => setProfileOpen(false)}
                onToast={showToast}
            />

            <AddCardModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onCreated={(card) => {
                    setCards(prev => [card, ...prev]);
                    setTotal(t => t + 1);
                }}
                onToast={showToast}
            />

            <IndexMonitorWidget />
        </div>
    );
}
