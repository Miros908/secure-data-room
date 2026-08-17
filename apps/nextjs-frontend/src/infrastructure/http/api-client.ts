import axios, { type AxiosInstance } from 'axios';
import { apiBaseURL, uploadApiBaseURL } from './api-base-url';
import { toApiRequestError } from './api-error';

export const apiClient: AxiosInstance = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = apiBaseURL();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiRequestError(error)),
);

export const uploadApiClient: AxiosInstance = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

uploadApiClient.interceptors.request.use((config) => {
  config.baseURL = uploadApiBaseURL();
  return config;
});

uploadApiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiRequestError(error)),
);
