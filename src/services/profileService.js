import api from './api';

export const getProfile = async () => {
    const { data } = await api.get('/api/profile');
    return data;
};

export const updateProfile = async (profileData) => {
    const { data } = await api.put('/api/profile', profileData);
    return data;
};

export const deleteAccount = async () => {
    const { data } = await api.delete('/api/profile');
    return data;
};
