import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Server-side authoritative pricing catalog (mirrors configurable defaults, prevents price tampering)
const SERVER_PACKAGE_CATALOG: Record<string, {name: string; priceCLP: number; durationDays: number}> = {
  pkg_inicial: {name: 'PUBLICIDAD INICIAL', priceCLP: 9990, durationDays: 30},
  pkg_profesional: {name: 'PUBLICIDAD PROFESIONAL', priceCLP: 19990, durationDays: 30},
  pkg_premium: {name: 'PUBLICIDAD PREMIUM', priceCLP: 39990, durationDays: 30},
  pkg_patrocinador: {name: 'PATROCINADOR EMPRESARIAL', priceCLP: 89990, durationDays: 30},
  pkg_temp_3: {name: 'CAMPAÑA TEMPORAL 3 DÍAS', priceCLP: 2990, durationDays: 3},
  pkg_temp_7: {name: 'CAMPAÑA TEMPORAL 7 DÍAS', priceCLP: 5990, durationDays: 7},
  pkg_temp_15: {name: 'CAMPAÑA TEMPORAL 15 DÍAS', priceCLP: 9990, durationDays: 15},
  pkg_microstore_5: {name: 'MICROTIENDA +5 PRODUCTOS (MENSUAL)', priceCLP: 9990, durationDays: 30},
};

const PAYMENT_EXEMPT_EMAILS = new Set([
  'isadoranaour@gmail.com',
  'naourclaudio@gmail.com',
  'verocheuquepil@gmail.com',
  'renatonaourch@gmail.com',
]);

function isPaymentExemptEmail(email?: string): boolean {
  if (!email) return false;
  return PAYMENT_EXEMPT_EMAILS.has(email.trim().toLowerCase());
}

// Idempotency & webhook verification audit store in memory for runtime protection
const processedFlowTokens = new Map<string, {status: number; commerceOrder: string; flowOrder?: number; verifiedAt: string}>();
const adEventRateMap = new Map<string, number>();

function getFlowConfig() {
  const env = process.env.FLOW_ENV === 'production' ? 'production' : 'sandbox';
  const apiKey = process.env.FLOW_API_KEY?.trim() || '';
  const secretKey = process.env.FLOW_SECRET_KEY?.trim() || '';
  const baseUrl =
    env === 'production'
      ? process.env.FLOW_PRODUCTION_URL || 'https://www.flow.cl/api'
      : process.env.FLOW_SANDBOX_URL || 'https://sandbox.flow.cl/api';
  const appUrl = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
  return {env, apiKey, secretKey, baseUrl, appUrl, configured: Boolean(apiKey && secretKey)};
}

/**
 * Official Flow API v1 HMAC-SHA256 signature generator.
 * Parameters are sorted alphabetically by key, concatenated as key+value, and signed with secretKey.
 */
function signFlowParams(params: Record<string, string | number>, secretKey: string): string {
  const sortedKeys = Object.keys(params).sort();
  const payload = sortedKeys.map((k) => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '1mb'}));
  app.use(express.urlencoded({extended: true}));

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ok: true, service: 'matchplus-server', timestamp: new Date().toISOString()});
  });

  // Flow configuration availability check (never leaks secret keys)
  app.get('/api/payments/flow/status', (_req, res) => {
    const cfg = getFlowConfig();
    res.json({
      configured: cfg.configured,
      environment: cfg.env,
      docsUrl: 'https://developers.flow.cl/api',
    });
  });

  // Create Flow Payment Order (Server-authoritative pricing + HMAC-SHA256)
  app.post('/api/payments/flow/create', async (req, res) => {
    const cfg = getFlowConfig();
    const {commerceOrder, packageId, isRegisteredAdvertiser, email, subject, customDiscountPercent} = req.body || {};

    if (!commerceOrder || typeof commerceOrder !== 'string' || commerceOrder.length > 64) {
      return res.status(400).json({error: 'commerceOrder inválido.'});
    }

    const pkg = SERVER_PACKAGE_CATALOG[String(packageId)];
    if (!pkg) {
      return res.status(400).json({error: 'Plan publicitario no válido en catálogo del servidor.'});
    }

    if (typeof email === 'string' && isPaymentExemptEmail(email)) {
      return res.json({
        exempt: true,
        authoritativeAmountCLP: 0,
        environment: cfg.env,
      });
    }

    const discountPct = isRegisteredAdvertiser ? Math.min(Number(customDiscountPercent ?? 15), 50) : 0;
    const finalAmount = Math.max(350, Math.round(pkg.priceCLP * (1 - discountPct / 100)));

    if (!cfg.configured) {
      return res.status(503).json({
        error: 'Flow no está configurado en las variables de entorno del servidor.',
        code: 'FLOW_NOT_CONFIGURED',
        instructions:
          'Configura FLOW_API_KEY y FLOW_SECRET_KEY en tu entorno (puedes obtenerlas en sandbox.flow.cl o flow.cl). Mientras tanto puedes generar una Orden de Pago por Transferencia Bancaria para conciliación manual.',
        authoritativeAmountCLP: finalAmount,
      });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({error: 'Se requiere correo electrónico del pagador para Flow.'});
    }

    try {
      const params: Record<string, string | number> = {
        apiKey: cfg.apiKey,
        commerceOrder,
        currency: 'CLP',
        amount: finalAmount,
        email,
        subject: String(subject || `MATCH+ ${pkg.name}`).slice(0, 120),
        urlConfirmation: `${cfg.appUrl}/api/payments/flow/webhook`,
        urlReturn: `${cfg.appUrl}/?flowReturn=1&order=${encodeURIComponent(commerceOrder)}`,
      };
      const s = signFlowParams(params, cfg.secretKey);
      const body = new URLSearchParams();
      Object.entries({...params, s}).forEach(([k, v]) => body.append(k, String(v)));

      const flowRes = await fetch(`${cfg.baseUrl}/payment/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: body.toString(),
      });
      const data = (await flowRes.json()) as {url?: string; token?: string; flowOrder?: number; message?: string};

      if (!flowRes.ok || !data.url || !data.token) {
        return res.status(502).json({
          error: data.message || 'Error al crear orden en Flow.',
          code: 'FLOW_API_ERROR',
        });
      }

      return res.json({
        redirectUrl: `${data.url}?token=${encodeURIComponent(data.token)}`,
        token: data.token,
        flowOrder: data.flowOrder,
        authoritativeAmountCLP: finalAmount,
        environment: cfg.env,
      });
    } catch (err) {
      console.error('Flow create error:', err);
      return res.status(500).json({error: 'Error interno al comunicarse con Flow.'});
    }
  });

  // Flow official confirmation webhook (idempotent + server-side getStatus verification)
  app.post('/api/payments/flow/webhook', async (req, res) => {
    const cfg = getFlowConfig();
    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({error: 'Token requerido.'});
    }

    if (processedFlowTokens.has(token)) {
      return res.status(200).json({ok: true, idempotent: true, cached: processedFlowTokens.get(token)});
    }

    if (!cfg.configured) {
      return res.status(503).json({error: 'Flow credentials missing on server.'});
    }

    try {
      const params: Record<string, string> = {apiKey: cfg.apiKey, token};
      const s = signFlowParams(params, cfg.secretKey);
      const url = `${cfg.baseUrl}/payment/getStatus?apiKey=${encodeURIComponent(cfg.apiKey)}&token=${encodeURIComponent(token)}&s=${encodeURIComponent(s)}`;
      const statusRes = await fetch(url);
      const statusData = (await statusRes.json()) as {
        status?: number;
        commerceOrder?: string;
        amount?: number;
        flowOrder?: number;
      };

      if (!statusRes.ok || typeof statusData.status !== 'number') {
        return res.status(502).json({error: 'No se pudo verificar estado con Flow.'});
      }

      processedFlowTokens.set(token, {
        status: statusData.status,
        commerceOrder: statusData.commerceOrder || '',
        flowOrder: statusData.flowOrder,
        verifiedAt: new Date().toISOString(),
      });

      return res.status(200).json({ok: true, verifiedStatus: statusData});
    } catch (err) {
      console.error('Flow webhook error:', err);
      return res.status(500).json({error: 'Error procesando webhook de Flow.'});
    }
  });

  // Server-side verification endpoint (never trust client query params alone)
  app.post('/api/payments/flow/verify', async (req, res) => {
    const cfg = getFlowConfig();
    const {token} = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({error: 'Token de operación Flow requerido.'});
    }

    if (processedFlowTokens.has(token)) {
      return res.json({verified: true, result: processedFlowTokens.get(token)});
    }

    if (!cfg.configured) {
      return res.status(503).json({error: 'Flow no configurado en el servidor.'});
    }

    try {
      const params: Record<string, string> = {apiKey: cfg.apiKey, token};
      const s = signFlowParams(params, cfg.secretKey);
      const url = `${cfg.baseUrl}/payment/getStatus?apiKey=${encodeURIComponent(cfg.apiKey)}&token=${encodeURIComponent(token)}&s=${encodeURIComponent(s)}`;
      const statusRes = await fetch(url);
      const statusData = (await statusRes.json()) as {
        status?: number;
        commerceOrder?: string;
        amount?: number;
        flowOrder?: number;
      };
      if (!statusRes.ok) {
        return res.status(502).json({error: 'Error verificando transacción en Flow.'});
      }
      if (typeof statusData.status === 'number') {
        processedFlowTokens.set(token, {
          status: statusData.status,
          commerceOrder: statusData.commerceOrder || '',
          flowOrder: statusData.flowOrder,
          verifiedAt: new Date().toISOString(),
        });
      }
      return res.json({verified: true, result: statusData});
    } catch (err) {
      console.error('Flow verify error:', err);
      return res.status(500).json({error: 'Error verificando pago.'});
    }
  });

  // Protected Ad Events telemetry endpoint (prevents browser metric inflation)
  app.post('/api/ads/events', (req, res) => {
    const {campaignId, eventType, sessionId} = req.body || {};
    if (!campaignId || !['impression', 'click', 'contact'].includes(eventType)) {
      return res.status(400).json({error: 'Evento publicitario inválido.'});
    }
    const key = `${sessionId || req.ip}_${campaignId}_${eventType}`;
    const lastTs = adEventRateMap.get(key) || 0;
    const now = Date.now();
    if (now - lastTs < 10000) {
      return res.status(200).json({recorded: false, deduplicated: true});
    }
    adEventRateMap.set(key, now);
    return res.status(200).json({recorded: true, campaignId, eventType, timestamp: new Date(now).toISOString()});
  });

  // Vite middleware in dev OR static dist in production
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'));
  if (isProd) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MATCH+ server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MATCH+ server:', err);
  process.exit(1);
});
