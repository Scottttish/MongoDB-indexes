import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { login as loginService } from '../services/authService';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email || !password) return setError('Заполните все поля');
        setLoading(true);
        try {
            const { token, user } = await loginService(email, password);
            login(user, token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Ошибка входа. Проверьте данные.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Добро пожаловать</h1>
                <p className="auth-subtitle">Войдите в систему управления данными</p>

                {error && (
                    <div className="alert-box error">
                        <FiMail /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email" placeholder="Введите ваш email"
                            value={email} onChange={e => setEmail(e.target.value)}
                            className={error ? 'error' : ''} autoComplete="email"
                        />
                    </div>
                    <div className="form-group">
                        <label>Пароль</label>
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Введите пароль"
                            value={password} onChange={e => setPassword(e.target.value)}
                            className={error ? 'error' : ''} autoComplete="current-password"
                        />
                        <span className="input-icon" onClick={() => setShowPass(!showPass)}>
                            {showPass ? <FiEyeOff /> : <FiEye />}
                        </span>
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Вход...' : 'Войти'}
                    </button>
                </form>

                <div className="auth-divider"><span>или</span></div>
                <div className="auth-switch">
                    Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
                </div>
                <div className="auth-switch" style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Демо: <strong>demo@utility-app.kz</strong> / <strong>Demo1234!</strong>
                </div>
            </div>
        </div>
    );
}
