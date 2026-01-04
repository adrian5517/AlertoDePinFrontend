import { create } from 'zustand';

export const useNotificationStore = create((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const notifObj = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...notification
    };
    console.log('[NotificationStore] Adding notification:', notifObj);
    set((state) => ({
      notifications: [notifObj, ...state.notifications]
    }));
  },
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  clearNotifications: () => set({ notifications: [] }),
}));

export const useAlertStore = create((set) => ({
  alerts: [],
  activeAlert: null,
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts]
  })),
  setActiveAlert: (alert) => set({ activeAlert: alert }),
  updateAlertStatus: (id, status) => set((state) => ({
    alerts: state.alerts.map(alert => 
      alert.id === id ? { ...alert, status } : alert
    )
  })),
}));
