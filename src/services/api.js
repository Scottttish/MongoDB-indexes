import axios from 'axios';
import { getAuthToken, logout } from '../context/AuthContext';

const API_URL = process.env.NODE_ENV === 'production'
    ? 'https://mongodb-indexes-api.onrender.com/api' // We will deploy to this URL on Render
    : 'http://localhost:8080/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Добавляем токен ко всем запросам автоматически
api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Глобальная обработка 401 (истек токен)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
