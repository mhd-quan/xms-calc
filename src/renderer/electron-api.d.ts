import type { ElectronAPI } from '../shared/preload-contract';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
