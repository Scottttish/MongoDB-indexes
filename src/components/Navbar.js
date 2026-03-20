import React from 'react';
import { FiSearch, FiShoppingCart, FiDatabase } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onBasketClick, basketCount, onProfileClick, searchValue, onSearchChange }) {
    const { user } = useAuth();
    const initials = user?.nickname?.substring(0, 2)?.toUpperCase() || 'U';

    return (
        <nav className="navbar">
            {/* Brand - Removed Logo and Text as requested */}
            <div className="navbar-brand">
            </div>

            {/* Search */}
            <div className="navbar-search">
                <FiSearch className="navbar-search-icon" size={15} />
                <input
                    type="text"
                    placeholder="Поиск по счетам…"
                    value={searchValue}
                    onChange={e => onSearchChange(e.target.value)}
                />
            </div>

            <div className="navbar-spacer" />

            {/* Actions */}
            <div className="navbar-actions">
                {/* Basket */}
                <button className="nav-action-btn" onClick={onBasketClick} title="Корзина">
                    <div className="nav-action-icon">
                        <FiShoppingCart size={18} />
                        {basketCount > 0 && (
                            <span className="nav-badge">{basketCount > 99 ? '99+' : basketCount}</span>
                        )}
                    </div>
                    <span>Корзина</span>
                </button>

                {/* Profile */}
                <button className="nav-action-btn" onClick={onProfileClick} title="Профиль">
                    <div className="nav-avatar">{initials}</div>
                    <span>{user?.nickname || 'Профиль'}</span>
                </button>
            </div>
        </nav>
    );
}
