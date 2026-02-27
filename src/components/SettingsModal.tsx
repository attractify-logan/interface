import { useState, useEffect } from 'react';
import type { Gateway, DeviceConfig } from '../types';
import { scanForGateways, type DiscoveredGateway, listDevices, addDevice, updateDevice, deleteDevice } from '../api';

interface SettingsModalProps {
  gateways: Map<string, Gateway>;
  preSelectedGatewayId?: string;
  onAdd: (config: { name: string; url: string; token?: string; password?: string }) => Promise<any>;
  onRemove: (id: string) => Promise<void>;
  onReconnect: (config: { id: string; name: string; url: string }) => Promise<void>;
  onClose: () => void;
}

export default function SettingsModal({
  gateways,
  preSelectedGatewayId,
  onAdd,
  onRemove,
  onReconnect,
  onClose,
}: SettingsModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('ws://');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [discoveredGateways, setDiscoveredGateways] = useState<DiscoveredGateway[]>([]);

  // Infrastructure Monitor state
  const [infraMonitorEnabled, setInfraMonitorEnabled] = useState(false);
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    id: '',
    name: '',
    ip: '',
    icon: '🖥️',
    enabled: true,
    ssh_user: '',
    ssh_port: 22,
    services: [] as string[],
  });
  const [serviceInput, setServiceInput] = useState('');

  useEffect(() => {
    const enabled = localStorage.getItem('openclaw-chat-infra-monitor') === 'true';
    setInfraMonitorEnabled(enabled);
    if (enabled) {
      loadDevices();
    }
  }, []);

  const loadDevices = async () => {
    try {
      const deviceList = await listDevices();
      setDevices(deviceList);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const handleInfraMonitorToggle = () => {
    const newValue = !infraMonitorEnabled;
    setInfraMonitorEnabled(newValue);
    localStorage.setItem('openclaw-chat-infra-monitor', newValue.toString());
    if (newValue) {
      loadDevices();
    }
    // Trigger a re-render of Sidebar
    window.dispatchEvent(new CustomEvent('infra-monitor-changed'));
  };

  const handleDeviceEdit = (device: DeviceConfig) => {
    setEditingDeviceId(device.id);
    setDeviceForm({
      id: device.id,
      name: device.name,
      ip: device.ip,
      icon: device.icon,
      enabled: device.enabled,
      ssh_user: device.ssh_user || '',
      ssh_port: device.ssh_port,
      services: device.services,
    });
  };

  const handleDeviceSave = async () => {
    try {
      if (editingDeviceId) {
        await updateDevice(editingDeviceId, {
          id: deviceForm.id,
          name: deviceForm.name,
          ip: deviceForm.ip,
          icon: deviceForm.icon,
          enabled: deviceForm.enabled,
          ssh_user: deviceForm.ssh_user || undefined,
          ssh_port: deviceForm.ssh_port,
          services: deviceForm.services,
        });
      } else {
        await addDevice({
          id: deviceForm.id,
          name: deviceForm.name,
          ip: deviceForm.ip,
          icon: deviceForm.icon,
          enabled: deviceForm.enabled,
          ssh_user: deviceForm.ssh_user || undefined,
          ssh_port: deviceForm.ssh_port,
          services: deviceForm.services,
        });
      }
      await loadDevices();
      setEditingDeviceId(null);
      setDeviceForm({
        id: '',
        name: '',
        ip: '',
        icon: '🖥️',
        enabled: true,
        ssh_user: '',
        ssh_port: 22,
        services: [],
      });
    } catch (err: any) {
      setConnectError(err.message || 'Failed to save device');
    }
  };

  const handleDeviceDelete = async (id: string) => {
    if (!confirm('Delete this device?')) return;
    try {
      await deleteDevice(id);
      await loadDevices();
    } catch (err: any) {
      setConnectError(err.message || 'Failed to delete device');
    }
  };

  const handleAddService = () => {
    if (serviceInput.trim()) {
      setDeviceForm({
        ...deviceForm,
        services: [...deviceForm.services, serviceInput.trim()],
      });
      setServiceInput('');
    }
  };

  const handleRemoveService = (index: number) => {
    setDeviceForm({
      ...deviceForm,
      services: deviceForm.services.filter((_, i) => i !== index),
    });
  };

  // Auto-select gateway if preSelectedGatewayId is provided
  useEffect(() => {
    if (preSelectedGatewayId) {
      const gw = gateways.get(preSelectedGatewayId);
      if (gw) {
        handleEdit(gw);
      }
    }
  }, [preSelectedGatewayId]);

  const handleAdd = async () => {
    if (!name || !url) return;
    setConnecting(true);
    setConnectError(null);
    setSuccessMessage(null);
    try {
      await onAdd({
        name,
        url,
        token: token || undefined,
        password: password || undefined,
      });
      setSuccessMessage(editingId ? 'Gateway updated!' : 'Gateway connected!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setName('');
      setUrl('ws://');
      setToken('');
      setPassword('');
      setEditingId(null);
    } catch (e: any) {
      setConnectError(e.message || 'Connection failed');
    }
    setConnecting(false);
  };

  const handleEdit = (gw: Gateway) => {
    setName(gw.config.name);
    setUrl(gw.config.url);
    // Note: token/password not exposed by backend, leave empty
    setToken('');
    setPassword('');
    setEditingId(gw.config.id);
    setConnectError(null);
    setSuccessMessage(null);
  };

  const handleCancelEdit = () => {
    setName('');
    setUrl('ws://');
    setToken('');
    setPassword('');
    setEditingId(null);
    setConnectError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name && url) {
      handleAdd();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const hasFormData = name.trim() || token.trim() || password.trim() || url !== 'ws://';

  const handleBackdropClick = () => {
    if (!hasFormData) {
      onClose();
    }
  };

  const handleScanNetwork = async () => {
    setScanning(true);
    setConnectError(null);
    setDiscoveredGateways([]);
    try {
      const discovered = await scanForGateways();
      setDiscoveredGateways(discovered);
      if (discovered.length === 0) {
        setConnectError('No gateways found on the network');
      }
    } catch (e: any) {
      setConnectError(e.message || 'Network scan failed');
    }
    setScanning(false);
  };

  const handleAddDiscovered = (gw: DiscoveredGateway) => {
    setUrl(gw.url);
    setName(`Gateway ${gw.ip}`);
    setDiscoveredGateways([]);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-surface-raised border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Gateway Connections</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Existing gateways */}
        {gateways.size === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <div className="text-4xl mb-3">🔌</div>
            <div className="text-sm">No gateways connected yet</div>
            <div className="text-xs mt-1">Add your first gateway below to get started</div>
          </div>
        ) : (
          Array.from(gateways.values()).map(gw => (
            <div
              key={gw.config.id}
              onClick={() => handleEdit(gw)}
              className={`flex items-center justify-between p-3 mb-2 rounded-lg border cursor-pointer transition-colors ${
                editingId === gw.config.id
                  ? 'bg-[var(--color-surface-hover)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    gw.connected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{gw.config.name}</div>
                  <div className="text-xs text-text-muted truncate">{gw.config.url}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {!gw.connected && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onReconnect({
                        id: gw.config.id,
                        name: gw.config.name,
                        url: gw.config.url,
                      });
                    }}
                    className="text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    Reconnect
                  </button>
                )}
                <button
                  onClick={async e => {
                    e.stopPropagation();
                    try {
                      await onRemove(gw.config.id);
                    } catch (err: any) {
                      setConnectError(err.message || 'Failed to remove gateway');
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}

        {/* Network Scan */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Discover Gateways</div>
            <button
              onClick={handleScanNetwork}
              disabled={scanning}
              className="text-xs bg-surface-hover hover:bg-surface text-text-secondary rounded-lg px-3 py-1.5 font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {scanning && (
                <svg
                  className="animate-spin h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" />
                </svg>
              )}
              {scanning ? 'Scanning...' : 'Scan Network'}
            </button>
          </div>

          {/* Discovered gateways list */}
          {discoveredGateways.length > 0 && (
            <div className="mb-3 space-y-2">
              {discoveredGateways.map((gw) => (
                <div
                  key={gw.url}
                  className="flex items-center justify-between p-2 bg-surface border border-border rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-green-400">Found gateway</div>
                    <div className="text-xs text-text-muted truncate">{gw.url}</div>
                  </div>
                  <button
                    onClick={() => handleAddDiscovered(gw)}
                    className="ml-2 text-xs text-accent hover:text-accent-hover transition-colors flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="text-sm font-medium mb-3">
            {editingId ? 'Edit Gateway' : 'Add Gateway'}
          </div>
          {successMessage && (
            <div className="text-xs text-green-400 mb-2 p-2 bg-green-500/10 rounded-lg flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {successMessage}
            </div>
          )}
          <input
            type="text"
            placeholder="Name (e.g. Young Neil)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-border-focus"
            autoFocus
          />
          <input
            type="text"
            placeholder="WebSocket URL (e.g. ws://100.77.44.72:18789)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-border-focus"
          />
          <div className="relative mb-2">
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="Token (optional)"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:border-border-focus"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-secondary"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="relative mb-3">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (optional)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-16 text-sm focus:outline-none focus:border-border-focus"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-secondary"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {connectError && (
            <div className="text-xs text-red-400 mb-2 p-2 bg-red-500/10 rounded-lg">
              {connectError}
            </div>
          )}
          <div className="flex gap-2">
            {editingId && (
              <button
                onClick={handleCancelEdit}
                className="flex-1 bg-surface-hover hover:bg-surface text-text-secondary rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleAdd}
              disabled={!name || !url || connecting}
              className="flex-1 bg-accent hover:bg-accent-hover text-surface rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {connecting && (
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" />
                </svg>
              )}
              {connecting ? 'Connecting...' : editingId ? 'Save' : 'Connect'}
            </button>
          </div>
        </div>

        {/* Infrastructure Monitor */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Infrastructure Monitor</div>
            <button
              onClick={handleInfraMonitorToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                infraMonitorEnabled ? 'bg-accent' : 'bg-surface-hover'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  infraMonitorEnabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {infraMonitorEnabled && (
            <>
              {/* Device List */}
              {devices.length > 0 && (
                <div className="mb-3 space-y-2">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-2 bg-surface border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{device.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium">{device.name}</div>
                          <div className="text-xs text-text-muted truncate">{device.ip}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeviceEdit(device)}
                          className="text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeviceDelete(device.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit Device Form */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-text-muted mb-2">
                  {editingDeviceId ? 'Edit Device' : 'Add Device'}
                </div>
                <input
                  type="text"
                  placeholder="ID (e.g. young-neil)"
                  value={deviceForm.id}
                  onChange={e => setDeviceForm({ ...deviceForm, id: e.target.value })}
                  disabled={!!editingDeviceId}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus disabled:opacity-50"
                />
                <input
                  type="text"
                  placeholder="Name (e.g. Young Neil)"
                  value={deviceForm.name}
                  onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                />
                <input
                  type="text"
                  placeholder="IP Address (e.g. 192.168.68.66)"
                  value={deviceForm.ip}
                  onChange={e => setDeviceForm({ ...deviceForm, ip: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                />
                <input
                  type="text"
                  placeholder="Icon (emoji)"
                  value={deviceForm.icon}
                  onChange={e => setDeviceForm({ ...deviceForm, icon: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                />
                <input
                  type="text"
                  placeholder="SSH User (optional)"
                  value={deviceForm.ssh_user}
                  onChange={e => setDeviceForm({ ...deviceForm, ssh_user: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                />
                <input
                  type="number"
                  placeholder="SSH Port (default: 22)"
                  value={deviceForm.ssh_port}
                  onChange={e => setDeviceForm({ ...deviceForm, ssh_port: parseInt(e.target.value) || 22 })}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                />

                {/* Services */}
                <div className="text-xs font-medium text-text-muted mt-2">Services to Monitor</div>
                {deviceForm.services.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {deviceForm.services.map((service, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 bg-surface-hover text-text-secondary text-xs px-2 py-1 rounded"
                      >
                        {service}
                        <button
                          onClick={() => handleRemoveService(index)}
                          className="text-text-muted hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Service name (e.g. ollama)"
                    value={serviceInput}
                    onChange={e => setServiceInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddService()}
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                  />
                  <button
                    onClick={handleAddService}
                    className="bg-surface-hover hover:bg-surface text-text-secondary rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="flex gap-2 mt-3">
                  {editingDeviceId && (
                    <button
                      onClick={() => {
                        setEditingDeviceId(null);
                        setDeviceForm({
                          id: '',
                          name: '',
                          ip: '',
                          icon: '🖥️',
                          enabled: true,
                          ssh_user: '',
                          ssh_port: 22,
                          services: [],
                        });
                      }}
                      className="flex-1 bg-surface-hover hover:bg-surface text-text-secondary rounded-lg py-2.5 text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleDeviceSave}
                    disabled={!deviceForm.id || !deviceForm.name || !deviceForm.ip}
                    className="flex-1 bg-accent hover:bg-accent-hover text-surface rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {editingDeviceId ? 'Save' : 'Add Device'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
