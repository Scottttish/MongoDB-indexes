import React from 'react';
import { FiSearch, FiShoppingCart, FiPlus } from 'react-icons/fi';

export default function Navbar({ onBasketClick, basketCount, onProfileClick, onCreateClick, searchValue, onSearchChange }) {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <span className="navbar-brand-name">Сайт по <span>счётчикам</span></span>
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
                {/* Create Bill */}
                <button className="nav-action-btn create-btn" onClick={onCreateClick} title="Создать счёт">
                    <FiPlus size={18} />
                    <span>Создать</span>
                </button>

                {/* Basket */}
                <button className="nav-action-btn" onClick={onBasketClick} title="Корзина">
                    <div className="nav-action-icon">
                        <FiShoppingCart size={18} />
                        {basketCount > 0 && (
                            <span className="nav-badge">{basketCount > 99 ? '99+' : basketCount}</span>
                        )}
                    </div>
                </button>

                {/* Profile */}
                <button className="nav-action-btn" onClick={onProfileClick} title="Профиль">
                    <div className="nav-avatar">SH</div>
                    <span>Scott Houston</span>
                </button>
            </div>
        </nav>
    );
}
