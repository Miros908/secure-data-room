import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'danger';

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = crypto.randomUUID();
    set((current) => ({
      toasts: [...current.toasts, { id, message, tone }],
    }));
    window.setTimeout(() => {
      set((current) => ({
        toasts: current.toasts.filter((toast) => toast.id !== id),
      }));
    }, 4200);
  },
  dismiss: (id) =>
    set((current) => ({
      toasts: current.toasts.filter((toast) => toast.id !== id),
    })),
}));
