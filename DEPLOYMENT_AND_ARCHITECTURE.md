# MATCH+ — Arquitectura, Despliegue y Configuración

## 1. Descripción General
**MATCH+** (*"Conectamos necesidades con oportunidades"*) es una aplicación web modular y PWA (Progressive Web App) diseñada para el lanzamiento piloto en **Chiloé (Región de Los Lagos)** con arquitectura escalable a nivel regional, nacional e internacional.

Integra **tres motores independientes** sobre una cuenta única multirrol:
1. **MATCH COMERCIAL**: Ofertas de productos/servicios + solicitudes explícitas de compra (*"Busco 100 kilos de ajo chilote..."*) + tarjetas swipe + búsqueda tradicional + match mutuo real.
2. **MATCH LABORAL**: Perfiles de trabajadores gratuitos + CV privado protegido + empresas y vacantes + cálculo objetivo y explicable de compatibilidad (`%`) + controles antidiscriminación.
3. **MATCH ADVERTISING & CREA TU ANUNCIO**: Asistente de 10 pasos, panel **MI PUBLICIDAD**, algoritmo ponderado de 100 pts, rotación configurable, protección estricta de experiencia (cero anuncios en chats privados o modales de match), pago **Flow Chile** y transferencia manual conciliable en el Panel Administrativo.

---

## 2. Seguridad y Base de Datos (Firebase Firestore)
- Configuración activa en `/firebase-applet-config.json` y esquema documentado en `/firebase-blueprint.json`.
- Reglas desplegadas en `/firestore.rules` (validadas con `@firebase/eslint-plugin-security-rules`):
  - Default-deny global.
  - Verificación obligatoria de correo (`email_verified == true`) para escrituras sensibles.
  - Privacidad estricta de `workerPrivateCVs`, `users`, `matches`, `conversations` y `messages`.
  - Contadores de anuncios protegidos contra manipulación directa del cliente.
  - Contabilidad por motor (`engine`: `'commercial' | 'employment' | 'advertising'`) en `adOrders`.
- Administrador inicial configurado: `naourclaudio@gmail.com`.

### Activación de Correo y Contraseña en Firebase Console
Google Auth está habilitado por defecto. Para permitir registro e inicio con **Correo y Contraseña**:
1. Ingresa a [Firebase Console](https://console.firebase.google.com/) → proyecto `gen-lang-client-0131136890`.
2. Ve a **Authentication → Sign-in method**.
3. Habilita el proveedor **Correo electrónico / Contraseña**.

---

## 3. Pasarela de Pagos Flow Chile (Server-Side)
Las credenciales de Flow **nunca** se exponen en el frontend. El servidor Express (`server.ts`) firma las peticiones con `HMAC-SHA256` en:
- `POST /api/payments/flow/create`
- `POST /api/payments/flow/webhook` (verificación servidor a servidor `payment/getStatus`)
- `POST /api/payments/flow/verify`
- `GET /api/payments/flow/status`

Variables de entorno requeridas en `.env` (o Secrets del entorno de hosting):
```bash
FLOW_ENV=sandbox # o "production"
FLOW_API_KEY="TU_API_KEY_DE_FLOW"
FLOW_SECRET_KEY="TU_SECRET_KEY_DE_FLOW"
APP_URL="https://tu-dominio.com"
```

---

## 4. Ejecución Local y Despliegue en Vercel / Node
### Ejecución Local
```bash
npm install
npm run dev
```
El servidor Express + Vite middlewares correrá en `http://localhost:3000`.

### Compilación y Producción
```bash
npm run build
npm start
```
Para desplegar en Vercel:
- Conecta el repositorio en Vercel o configura un servicio Node/Cloud Run para mantener el backend Express (`server.ts`) activo junto con los endpoints `/api/payments/flow/*` y `/api/ads/events`.
- Configura las variables de entorno `FLOW_ENV`, `FLOW_API_KEY`, `FLOW_SECRET_KEY` y `APP_URL` en el panel del proveedor.
