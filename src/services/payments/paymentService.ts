export interface FlowStatusResponse {
  configured: boolean;
  environment: 'sandbox' | 'production';
  docsUrl: string;
}

export interface FlowCreateOrderResult {
  exempt?: boolean;
  redirectUrl?: string;
  token?: string;
  flowOrder?: number;
  authoritativeAmountCLP?: number;
  environment?: 'sandbox' | 'production';
  error?: string;
  code?: string;
  instructions?: string;
}

export async function getFlowGatewayStatus(): Promise<FlowStatusResponse> {
  const res = await fetch('/api/payments/flow/status');
  if (!res.ok) {
    return {configured: false, environment: 'sandbox', docsUrl: 'https://developers.flow.cl/api'};
  }
  return res.json();
}

export async function initiateFlowPayment(params: {
  commerceOrder: string;
  packageId: string;
  isRegisteredAdvertiser: boolean;
  email: string;
  subject: string;
  customDiscountPercent?: number;
}): Promise<FlowCreateOrderResult> {
  const res = await fetch('/api/payments/flow/create', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function verifyFlowPaymentOnServer(token: string): Promise<{
  verified: boolean;
  result?: {status: number; commerceOrder: string; amount?: number};
  error?: string;
}> {
  const res = await fetch('/api/payments/flow/verify', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({token}),
  });
  return res.json();
}

export async function trackProtectedAdEvent(params: {
  campaignId: string;
  eventType: 'impression' | 'click' | 'contact';
  sessionId: string;
}): Promise<void> {
  try {
    await fetch('/api/ads/events', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(params),
    });
  } catch {
    // Non-blocking telemetry
  }
}
