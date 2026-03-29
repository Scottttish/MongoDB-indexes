import React, { useState } from 'react';
import { FiX, FiUser, FiMail, FiLock, FiLogOut, FiTrash2, FiSave, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { updateProfile, deleteAccount } from '../services/profileService';

export default function ProfilePanel({ isOpen, onClose, onToast }) {
    const { user, logout, updateUser } = useAuth();
    const [form, setForm] = useState({ nickname: user?.nickname || '', email: user?.email || '', currentPassword: '', password: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!isOpen) return null;

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
    const initials = user?.nickname?.substring(0, 2)?.toUpperCase() || 'U';

    const handleSave = async (e) => {
        e.preventDefault();
        if (form.password && form.password !== form.confirm) return onToast('Пароли не совпадают', 'error');
        if (form.password && !form.currentPassword) return onToast('Введите текущий пароль', 'error');
        setLoading(true);
        try {
            const payload = { nickname: form.nickname, email: form.email };
            if (form.password) { payload.password = form.password; payload.currentPassword = form.currentPassword; }
            const updated = await updateProfile(payload);
            updateUser(updated);
            setForm(f => ({ ...f, currentPassword: '', password: '', confirm: '' }));
            onToast('Профиль обновлён!', 'success');
        } catch (err) {
            onToast(err.response?.data?.message || 'Ошибка обновления', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteAccount();
            logout();
        } catch (err) {
            onToast('Ошибка удаления аккаунта', 'error');
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="panel-overlay" onClick={onClose} />
            <div className="panel-slide">
                <div className="panel-header">
                    <h2>Профиль</h2>
                    <button className="panel-close" onClick={onClose}><FiX /></button>
                </div>

                <div className="panel-body">
                    {/* Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                        <div className="profile-avatar">{initials}</div>
                        <div>
                            <div className="profile-name">{user?.nickname}</div>
                            <div className="profile-email">{user?.email}</div>
                        </div>
                    </div>

                    {/* Edit form */}
                    <form className="profile-form" onSubmit={handleSave}>
                        <div className="profile-section">
                            <h3>Личные данные</h3>
                            <div className="form-group">
                                <label><FiUser style={{ marginRight: 5 }} />Никнейм</label>
                                <input type="text" value={form.nickname} onChange={set('nickname')} />
                            </div>
                            <div className="form-group">
                                <label><FiMail style={{ marginRight: 5 }} />Email</label>
                                <input type="email" value={form.email} onChange={set('email')} />
                            </div>
                        </div>

                        <div className="profile-section">
                            <h3>Изменить пароль</h3>
                            <div className="form-group" style={{ position: 'relative' }}>
                                <label><FiLock style={{ marginRight: 5 }} />Текущий пароль</label>
                                <input type={showPass ? 'text' : 'password'} value={form.currentPassword} onChange={set('currentPassword')} placeholder="Текущий пароль" />
                                <span className="input-icon" onClick={() => setShowPass(!showPass)} style={{ top: 38 }}>
                                    {showPass ? <FiEyeOff /> : <FiEye />}
                                </span>
                            </div>
                            <div className="form-group">
                                <label>Новый пароль</label>
                                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Новый пароль (мин. 6 символов)" />
                            </div>
                            <div className="form-group">
                                <label>Повторите новый пароль</label>
                                <input type={showPass ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} placeholder="Повторите новый пароль" />
                            </div>
                        </div>

                        <div className="profile-actions">
                            <button type="submit" className="btn-save" disabled={loading}>
                                <FiSave /> {loading ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                        </div>
                    </form>

                    <div className="danger-zone">
                        <h3 className="danger-zone-title">Опасная зона</h3>
                        <p className="danger-zone-desc">Действия ниже отменить нельзя (или они прервут сессию).</p>
                        
                        <div className="danger-zone-actions">
                            <button type="button" className="btn-logout" onClick={() => { logout(); onClose(); }}>
                                <FiLogOut /> Выйти из аккаунта
                            </button>

                            {!showDeleteConfirm ? (
                                <button type="button" className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                                    <FiTrash2 /> Удалить аккаунт
                                </button>
                            ) : (
                                <div className="delete-confirm-box">
                                    <p className="delete-confirm-text">
                                        ⚠️ Это действие необратимо! Все ваши данные будут удалены.
                                    </p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button type="button" className="btn-danger" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
                                            {deleting ? 'Удаление...' : '✓ Подтвердить'}
                                        </button>
                                        <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                                            Отмена
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
