import api from './api';

export const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
};

export const register = async (nickname, email, password) => {
    const { data } = await api.post('/api/auth/register', { nickname, email, password });
    return data;
};
