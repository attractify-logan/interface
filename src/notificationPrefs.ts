// Notification preferences management for per-agent push notifications

const NOTIFICATION_PREFS_KEY = 'openclaw-chat-notification-prefs';

export interface NotificationPrefs {
  [key: string]: boolean; // key format: "gateway_id:agent_id"
}

/**
 * Load notification preferences from localStorage
 */
export function loadNotificationPrefs(): NotificationPrefs {
  const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Save notification preferences to localStorage
 */
export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Check if notifications are enabled for a specific agent
 */
export function isNotificationEnabled(gatewayId: string, agentId: string): boolean {
  const prefs = loadNotificationPrefs();
  const key = `${gatewayId}:${agentId}`;
  return prefs[key] === true;
}

/**
 * Toggle notification for a specific agent
 */
export function toggleNotification(gatewayId: string, agentId: string): boolean {
  const prefs = loadNotificationPrefs();
  const key = `${gatewayId}:${agentId}`;
  const newValue = !prefs[key];
  prefs[key] = newValue;
  saveNotificationPrefs(prefs);
  return newValue;
}

/**
 * Request browser notification permission if not already granted
 * Returns true if permission is granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return false;
  }
}

/**
 * Show a browser notification if tab is not focused
 */
export function showNotification(
  agentName: string,
  message: string,
  gatewayName?: string
): void {
  // Log visibility state for debugging
  console.log('[notif] showNotification called, visible:', document.visibilityState, 'hasFocus:', document.hasFocus(), 'permission:', Notification.permission);

  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    const title = gatewayName
      ? `${agentName} (${gatewayName})`
      : agentName;

    // Truncate long messages
    const body = message.length > 100
      ? message.slice(0, 97) + '...'
      : message;

    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `openclaw-${Date.now()}`, // Unique tag to avoid notification stacking
      requireInteraction: false,
    });
  } catch (err) {
    console.error('Failed to show notification:', err);
  }
}
