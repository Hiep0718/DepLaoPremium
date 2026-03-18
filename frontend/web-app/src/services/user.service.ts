import api from './axios';

export const getUserProfile = async () => {
  return api.get('/users/profile');
};

export const searchUsers = async (search: string, page = 0, size = 20) => {
  return api.get(`/users/search?search=${search}&page=${page}&size=${size}`);
};
