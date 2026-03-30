import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCards } from '../services/cardsService';
import { getBasket, addToBasket, removeFromBasket } from '../services/basketService';
import Navbar from '../components/Navbar';
import PaymentCard from '../components/PaymentCard';
import BasketPanel from '../components/BasketPanel';
import ProfilePanel from '../components/ProfilePanel';
import SkeletonCard from '../components/SkeletonCard';
import AddCardModal from '../components/AddCardModal';

const LIMIT = 12;

export default function DashboardPage() {
    const { isAuthenticated, user } = useAuth();
    const [cards, setCards] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    
    // Sort and Filter state
    const [sort, setSort] = useState('createdAt');
    const [category, setCategory] = useState('all');

    const [basketItems, setBasketItems] = useState([]);
    const [basketLoading, setBasketLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [basketOpen, setBasketOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [toasts, setToasts] = useState([]);
    
    const searchTimer = useRef(null);
    const observer = useRef(null);

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);

    const fetchCards = useCallback(async (currentSearch, currentPage, currentSort, currentCategory, append = false) => {
        if (!isAuthenticated) return;
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const data = await getCards({
                search: currentSearch,
                category: currentCategory,
                status: 'all',
                sort: currentSort,
                order: 'desc',
                page: currentPage,
                limit: LIMIT
            });
            
            if (append) {
                setCards(prev => [...prev, ...(data.cards || [])]);
            } else {
                setCards(data.cards || []);
            }
            
            setHasMore(data.pages > currentPage && data.cards?.length > 0);
        } catch (err) {
            showToast('Ошибка загрузки данных', 'error');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [isAuthenticated, showToast]);

    const fetchBasket = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const data = await getBasket();
            setBasketItems(data || []);
        } catch { }
    }, [isAuthenticated]);

    // Initial load and filter changes
    useEffect(() => {
        if (isAuthenticated) {
            fetchCards(search, 1, sort, category, false);
            setPage(1);
            fetchBasket();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, sort, category]); // only on auth or explicit filter change

    const handleSearchChange = (val) => {
        setSearch(val);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setPage(1);
            fetchCards(val, 1, sort, category, false);
        }, 400);
    };
    
    const loadMore = () => {
        if (!loadingMore && hasMore && !loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchCards(search, nextPage, sort, category, true);
        }
    };

    const lastCardElementRef = useCallback(node => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore();
            }
        });
        if (node) observer.current.observe(node);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, loadingMore, hasMore, page, search, sort, category]);

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

    const handleCardCreated = (newCard) => {
        setPage(1);
        fetchCards(search, 1, sort, category, false);
    };

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="dashboard">
            <Navbar
                onBasketClick={() => setBasketOpen(true)}
                basketCount={basketItems.length}
                onProfileClick={() => setProfileOpen(true)}
                onCreateClick={() => setAddModalOpen(true)}
                searchValue={search}
                onSearchChange={handleSearchChange}
            />

            <main className="dashboard-content">
                <div className="navbar-spacer" />

                <div className="filter-bar">
                    <select className="filter-select" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="all">Все категории</option>
                        <option value="electricity">Электроэнергия</option>
                        <option value="gas">Газ</option>
                        <option value="water">Вода</option>
                        <option value="internet">Интернет</option>
                    </select>

                    <div style={{flex: 1}}></div>

                    <button className={`sort-btn ${sort === 'createdAt' ? 'active' : ''}`} onClick={() => setSort('createdAt')}>
                        По дате
                    </button>
                    <button className={`sort-btn ${sort === 'amount' ? 'active' : ''}`} onClick={() => setSort('amount')}>
                        По сумме
                    </button>
                </div>

                {loading && page === 1 ? (
                    <div className="cards-grid">
                        {[...Array(LIMIT)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : (
                    <>
                        <div className="cards-grid">
                            {cards.map((card, index) => {
                                const isLast = index === cards.length - 1;
                                return (
                                    <div key={card._id} ref={isLast ? lastCardElementRef : null} style={isLast ? { paddingBottom: '1px' } : undefined}>
                                        <PaymentCard
                                            card={card}
                                            onAddToBasket={handleAddToBasket}
                                            isInBasket={basketItems.some(item => (item.cardId?._id || item.cardId) === card._id)}
                                            loading={basketLoading}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {loadingMore && (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                                Загрузка новых счетов...
                            </div>
                        )}
                        {!hasMore && cards.length > 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                Вы просмотрели все найденные счета.
                            </div>
                        )}
                        {!loading && cards.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                                Счета не найдены.
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
                onToast={showToast}
            />

            <AddCardModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onCreated={handleCardCreated}
                onToast={showToast}
            />

            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
                ))}
            </div>
        </div>
    );
}
