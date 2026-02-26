// Generate consistent HSL colors for gateways

export function generateGatewayColor(gatewayId: string): string {
  // Simple hash function to generate a consistent hue from gateway ID
  let hash = 0;
  for (let i = 0; i < gatewayId.length; i++) {
    hash = gatewayId.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate hue (0-360) with good distribution
  const hue = Math.abs(hash % 360);

  // Use high saturation and moderate lightness for vibrant colors
  return `hsl(${hue}, 70%, 60%)`;
}

export function generateGatewayColorWithAlpha(gatewayId: string, alpha: number): string {
  let hash = 0;
  for (let i = 0; i < gatewayId.length; i++) {
    hash = gatewayId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return `hsla(${hue}, 70%, 60%, ${alpha})`;
}
