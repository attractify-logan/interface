import { useState, useEffect, useCallback } from 'react';
import { getDeviceStatuses } from '../api';
import type { DeviceStatus } from '../types';

export function useDevices() {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const statuses = await getDeviceStatuses();
      setDevices(statuses);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch device statuses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDevices();

    // Poll every 60 seconds
    const interval = setInterval(fetchDevices, 60000);

    return () => clearInterval(interval);
  }, [fetchDevices]);

  return { devices, loading, error, refresh: fetchDevices };
}
