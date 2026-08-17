import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DriveViewMode = 'list' | 'grid';
export type DriveSortKey = 'name' | 'date' | 'size';
export type DriveSortDir = 'asc' | 'desc';

type DriveUiState = {
  sidebarCollapsed: boolean;
  viewMode: DriveViewMode;
  sortKey: DriveSortKey;
  sortDir: DriveSortDir;
  detailsOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setViewMode: (value: DriveViewMode) => void;
  setSort: (key: DriveSortKey) => void;
  setDetailsOpen: (value: boolean) => void;
  toggleDetails: () => void;
};

export const useDriveUiStore = create<DriveUiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      viewMode: 'list',
      sortKey: 'name',
      sortDir: 'asc',
      detailsOpen: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setViewMode: (viewMode) => set({ viewMode }),
      setSort: (key) => {
        const current = get();
        if (current.sortKey === key) {
          set({ sortDir: current.sortDir === 'asc' ? 'desc' : 'asc' });
          return;
        }
        set({ sortKey: key, sortDir: key === 'name' ? 'asc' : 'desc' });
      },
      setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
      toggleDetails: () => set({ detailsOpen: !get().detailsOpen }),
    }),
    {
      name: 'sdr-drive-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        viewMode: state.viewMode,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        detailsOpen: state.detailsOpen,
      }),
    },
  ),
);
