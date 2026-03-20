import React from 'react';
import { FiSearch, FiShoppingCart } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const AppIcon = () => (
    <svg viewBox="0 0 24 24" width="34" height="34" fill="var(--app-blue)" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" />
        <text x="3" y="18" fontSize="14" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">UA</text>
    </svg>
);

export default function Navbar({ onBasketClick, basketCount, onProfileClick, searchValue, onSearchChange }) {
    const { user } = useAuth();
    const initials = user?.nickname?.substring(0, 2)?.toUpperCase() || 'U';

    return (
        <nav className="navbar">
            <div className="navbar-logo">
                <AppIcon />
            </div>

            <div className="navbar-search">
                <FiSearch className="navbar-search-icon" />
                <input
                    type="text"
                    placeholder="Поиск платежей..."
                    value={searchValue}
                    onChange={e => onSearchChange(e.target.value)}
                />
            </div>

            <div className="navbar-spacer" />

            <div className="navbar-actions">
                <div className="navbar-btn-wrap">
                    <button className="navbar-btn" onClick={onBasketClick} title="Корзина платежей">
                        <FiShoppingCart />
                        <span>Корзина</span>
                    </button>
                    {basketCount > 0 && (
                        <span className="badge" style={{ position: 'absolute', top: 6, right: 6, background: '#E74C3C', color: 'white', fontWeight: 700, fontSize: '0.65rem', minWidth: 16, height: 16, borderRadius: 999, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{basketCount > 99 ? '99+' : basketCount}</span>
                    )}
                </div>

                <button className="navbar-btn" onClick={onProfileClick} title="Профиль">
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #0A66C2, #378fe9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>
                        {initials}
                    </div>
                    <span>Профиль</span>
                </button>
            </div>
        </nav>
    );
}
