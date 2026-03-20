import api from './api';

export const getBasket = async () => {
    const { data } = await api.get('/api/basket');
    return data;
};

export const addToBasket = async (cardId) => {
    const { data } = await api.post('/api/basket', { cardId });
    return data;
};

export const removeFromBasket = async (id) => {
    const { data } = await api.delete(`/api/basket/${id}`);
    return data;
};
