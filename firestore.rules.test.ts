/**
 * MATCH+ Security & Rules Verification Suite (Phase 0 & Section 23)
 * Validates:
 * 1. "Dirty Dozen" Firestore Security Rule attack payloads (for @firebase/rules-unit-testing)
 * 2. Commercial & Laboral matching invariants (no false matches, mandatory checks, no discrimination)
 * 3. Advertising rotation & frequency caps
 */
import assert from 'node:assert/strict';

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Self-Admin Escalation on Create',
    collection: 'users',
    operation: 'create',
    actorUid: 'attacker_1',
    payload: { uid: 'attacker_1', roles: ['buyer', 'admin'], status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '2. Self-Admin Escalation on Update',
    collection: 'users',
    operation: 'update',
    actorUid: 'user_1',
    payload: { roles: ['buyer', 'admin'] },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '3. Ghost Field Shadow Update',
    collection: 'products',
    operation: 'update',
    actorUid: 'seller_1',
    payload: { title: 'Ajo Chilote', verified: true, ghostFlag: 1 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '4. Identity Spoofing on Product Create',
    collection: 'products',
    operation: 'create',
    actorUid: 'attacker_1',
    payload: { ownerId: 'victim_uid', title: 'Producto Falso' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '5. PII Scraping on /users',
    collection: 'users',
    operation: 'get',
    actorUid: 'attacker_1',
    targetId: 'victim_uid',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '6. Private CV Scraping on /workerPrivateCVs',
    collection: 'workerPrivateCVs',
    operation: 'get',
    actorUid: 'unrelated_user',
    targetId: 'worker_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '7. Unauthorized Ad Self-Approval',
    collection: 'adCampaigns',
    operation: 'update',
    actorUid: 'advertiser_1',
    payload: { moderationStatus: 'active', paymentStatus: 'confirmed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '8. Cross-Advertiser Draft Tampering',
    collection: 'adDrafts',
    operation: 'get',
    actorUid: 'advertiser_2',
    targetId: 'draft_of_adv_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '9. Unauthorized Chat Eavesdropping',
    collection: 'conversations/conv_1/messages',
    operation: 'list',
    actorUid: 'outsider_uid',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '10. Fake Match Injection',
    collection: 'matches',
    operation: 'create',
    actorUid: 'attacker_1',
    payload: { participantIds: ['user_a', 'user_b'], initiatorUid: 'user_a', recipientUid: 'user_b' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '11. ID Poisoning Attack',
    collection: 'products',
    operation: 'create',
    actorUid: 'user_1',
    targetId: '../invalid/path/' + 'x'.repeat(140),
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    name: '12. Client-Forged Ad Package Price',
    collection: 'adPackages',
    operation: 'update',
    actorUid: 'regular_user',
    payload: { priceCLP: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
];

assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12, 'Must cover all 12 Dirty Dozen attack vectors');
