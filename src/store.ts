// Persistence layer — localStorage backed
// Note: Gateway configs are now managed server-side via backend API

import type { Theme, Tab } from './types';

const KEYS = {
  theme: 'openclaw-chat-theme',
  sidebarOpen: 'openclaw-chat-sidebar',
  activeGateway: 'openclaw-chat-active-gw',
  activeTab: 'openclaw-chat-active-tab',
  activeSession: 'openclaw-chat-active-session',
} as const;

export function loadTheme(): Theme {
  return (localStorage.getItem(KEYS.theme) as Theme) || 'dark';
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(KEYS.theme, theme);
}

export function loadSidebarOpen(): boolean {
  const v = localStorage.getItem(KEYS.sidebarOpen);
  return v !== 'false';
}

export function saveSidebarOpen(open: boolean) {
  localStorage.setItem(KEYS.sidebarOpen, String(open));
}

export function loadActiveGateway(): string | null {
  return localStorage.getItem(KEYS.activeGateway);
}

export function saveActiveGateway(id: string | null) {
  if (id) localStorage.setItem(KEYS.activeGateway, id);
  else localStorage.removeItem(KEYS.activeGateway);
}

export function loadActiveSession(): string {
  return localStorage.getItem(KEYS.activeSession) || `webchat-${Date.now()}`;
}

export function saveActiveSession(key: string) {
  localStorage.setItem(KEYS.activeSession, key);
}

export function loadActiveTab(): Tab {
  return (localStorage.getItem(KEYS.activeTab) as Tab) || 'chat';
}

export function saveActiveTab(tab: Tab) {
  localStorage.setItem(KEYS.activeTab, tab);
}
