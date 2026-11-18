# MATCH+ Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity & No Privilege Escalation**: No user may create or update `users/{uid}` with `roles` containing `admin` or `moderator`, nor write to `admins/{uid}`. Admin privileges are bootstrapped solely via verified admin email (`naourclaudio@gmail.com` with `email_verified == true`) or existing `admins/{uid}` documents managed by an existing admin.
2. **PII & CV Isolation**: Private account records (`users/{uid}`) and worker private CVs (`workerPrivateCVs/{workerId}`) must never be publicly readable. `users/{uid}` is strictly owner/admin. `workerPrivateCVs/{workerId}` is strictly owner/admin or matched company.
3. **Ad Campaign Payment & Approval Gate**: An advertiser cannot set `paymentStatus = 'confirmed'` or `moderationStatus = 'active' / 'approved'` directly from the client. Only admins (or verified backend reconciliation) may approve campaigns and confirm payments.
4. **Private Conversations**: Only the two participants (`request.auth.uid in resource.data.participantIds`) may read a conversation or read/send messages inside `/conversations/{conversationId}/messages/{messageId}`.
5. **Strict Payload Boundaries & Immutable Owners**: Every create/update validates `isValidId()`, string `.size()`, `ownerId == existing.ownerId`, and server `request.time` timestamps (`createdAt` / `updatedAt`).

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Self-Admin Escalation on Create**: Creating `/users/attacker` with `roles: ["buyer", "admin"]`.
2. **Self-Admin Escalation on Update**: Updating `/users/user1` adding `"admin"` to `roles`.
3. **Ghost Field Shadow Update**: Updating `/products/prod1` with `{ title: "Ajo", isVerified: true, extraGhost: 1 }`.
4. **Identity Spoofing**: Creating `/products/prod2` where `ownerId: "victimUid"` while signed in as `attackerUid`.
5. **PII Scraping**: Reading `/users/victimUid` or listing `/users` as a regular authenticated user.
6. **Private CV Scraping**: Reading `/workerPrivateCVs/worker1` as an unrelated authenticated user.
7. **Unauthorized Ad Self-Approval**: Updating `/adCampaigns/camp1` as the advertiser with `moderationStatus: "active"` or `paymentStatus: "confirmed"`.
8. **Cross-Advertiser Tampering**: Updating or reading `/adDrafts/draftOfOtherUser` or `/adOrders/orderOfOtherUser`.
9. **Unauthorized Chat Eavesdropping**: Listing or reading `/conversations/conv1/messages` when `attackerUid` is not in `participantIds`.
10. **Fake Match Injection**: Creating `/matches/m1` where `request.auth.uid` is neither `initiatorUid` nor `recipientUid` or `participantIds.size() != 2`.
11. **Resource Exhaustion (ID Poisoning)**: Creating `/products/` with document ID longer than 128 chars or containing invalid characters (`../hack`).
12. **Client-Forged Price / Package Tampering**: Creating or updating `/adPackages/pack1` as a non-admin user to set `priceCLP: 0`.
