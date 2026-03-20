import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { register as registerService } from '../services/authService';

const LinkedInLogo = () => (
    <svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="32" fontSize="32" fontWeight="800" fill="#0A66C2" fontFamily="Inter, sans-serif">LinkedIn</text>
    </svg>
);

export default function RegisterPage() {
    const [form, setForm] = useState({ nickname: '', email: '', password: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const { nickname, email, password, confirm } = form;
        if (!nickname || !email || !password || !confirm) return setError('Заполните все поля');
        if (password.length < 6) return setError('Пароль должен быть минимум 6 символов');
        if (password !== confirm) return setError('Пароли не совпадают');
        setLoading(true);
        try {
            const { token, user } = await registerService(nickname, email, password);
            login(user, token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка регистрации');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-logo"><LinkedInLogo /></div>
            <div className="auth-card">
                <h1>Создать аккаунт</h1>
                <p className="auth-subtitle">Управляйте коммунальными платежами удобно</p>

                {error && <div className="alert-box error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Никнейм</label>
                        <input type="text" placeholder="Ваше имя" value={form.nickname} onChange={set('nickname')} autoComplete="nickname" />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
                    </div>
                    <div className="form-group">
                        <label>Пароль</label>
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Минимум 6 символов"
                            value={form.password} onChange={set('password')} autoComplete="new-password"
                        />
                        <span className="input-icon" onClick={() => setShowPass(!showPass)}>
                            {showPass ? <FiEyeOff /> : <FiEye />}
                        </span>
                    </div>
                    <div className="form-group">
                        <label>Повторите пароль</label>
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Повторите пароль"
                            value={form.confirm} onChange={set('confirm')} autoComplete="new-password"
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
                    </button>
                </form>

                <div className="auth-divider"><span>или</span></div>
                <div className="auth-switch">
                    Уже есть аккаунт? <Link to="/login">Войти</Link>
                </div>
            </div>
        </div>
    );
}
