import api from './api';

export const getCards = async (params = {}) => {
    const { data } = await api.get('/api/cards', { params });
    return data;
};

export const createCard = async (cardData) => {
    const { data } = await api.post('/api/cards', cardData);
    return data;
};

export const deleteCard = async (id) => {
    const { data } = await api.delete(`/api/cards/${id}`);
    return data;
};
