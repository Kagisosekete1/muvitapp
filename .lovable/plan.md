# Implementation Plan

This is a very large request. I'll group it into focused phases so each round ships verifiable changes. Reply with a phase number (or "all") to proceed.

## Phase 1 — UX polish (small, fast)
1. **ReelCard instant counts**: render likes/comments/shares from local optimistic state immediately on mount; no spinners/placeholders. Update `src/components/ui/ReelCard.tsx` to seed from props and only revalidate in background.
2. **Mention UX upgrade** in `ReelUploadModal` caption + `EditReelModal`:
   - Use `MentionInput` (currently only in comments/DMs).
   - Validate usernames exist on submit; highlight unresolved `@tokens` in red.
   - Visible insertion rendering: chips/blue text for resolved mentions in caption preview.
3. **First-frame perf**:
   - Move `useFirstReelPreloader` to fire on idle (requestIdleCallback) only after first paint.
   - Lazy-import `BattleDetailDialog`, `GoLiveModal`, `CreatorDashboardModal`, `EarningsModal`, `MuviiAssistant` via `React.lazy` to reduce initial bundle.
   - Add `fetchpriority="high"` + `preload` on first reel poster.
4. **Inbox delete parity**: ensure deleted DM media/clips disappear from `ChatModal` AND clear the conversation preview in `Inbox.tsx` (re-fetch last message after delete).
5. **Activity @mentions section**: new tab/filter in `src/pages/Activity.tsx` listing `notifications.type='mention'`, grouped by context (post/comment/DM) with tap-to-navigate to the reel/comment/chat.

## Phase 2 — Coin economy + battle entry/pot (DB + UI)
1. Migration:
   - `coin_packages` table (id, coins, price_zar) seeded with the 5 tiers.
   - `country_currency` lookup (or extend `country_vat_rates`) for live FX display.
   - `battle_pots` table (battle_id, total_coins, entry_fee, distributed_at).
   - `battle_likes`, `battle_shares`, `reel_shares` tables (separate from votes; idempotent unique constraints).
   - Add `duration_hours` (enum 1/6/24/48/168) + `entry_fee_coins` (default 20) to `battles`.
2. RPCs:
   - `create_battle_v2(_title, _opponent_id, _duration_hours)` — debits 20 coins from challenger, opens pot.
   - `accept_battle(_battle_id)` — debits 20 coins from opponent, adds to pot.
   - `finalize_battle` (update) — splits pot 70/20/10, releases winner share to **pending** balance.
3. UI: BattleUploadDialog gains duration picker + "Costs 20 coins" notice. Show pot total on `BattleDetailDialog`.
4. Reset all `user_coins.balance` to 0 (zero out everyone) via insert tool.

## Phase 3 — Creator eligibility gate + dashboard hiding
1. New `creator_eligibility` view/function returning {accountAgeDays, followers, reels, views, strikes, idVerified, eligible}.
2. Update `src/lib/monetization.ts` `ELIGIBILITY` to: 30 days, 100 followers, 10 reels, 5000 views, 0 strikes, verified.
3. Stage 1 users: hide `EarningsModal`, `CreatorDashboardModal`, coin balance, withdrawal buttons across `Profile`, `Studio`, `CreatorProgressWidget`. Replace with copy: "Keep creating to unlock Creator Rewards."
4. Stage 2 (eligible but not verified): show dashboard + coin balance + gifts, hide withdrawals.
5. Stage 3 (verified): full access.
6. Block monetization for reels flagged as watermarked-from-other-platforms (manual `is_reposted_external` boolean for now; future ML check).

## Phase 4 — Battle interactions + leaderboard + share
1. Battle like / battle reel like / battle share buttons in `BattleDetailDialog`.
2. New `battle_leaderboard` view: by votes/likes/shares/views/wins/followers gained, with daily/weekly/monthly/all-time windows.
3. New `/leaderboard` page with tabs.
4. ShareReelModal: ensure all 8 destinations (WhatsApp, FB, TikTok, IG, X, Messenger, Telegram, Copy) + deep links fall back to www.muvitapp.com.

## Phase 5 — Withdrawals + safety
1. `withdrawal_requests` table; min R1000; 15% fee calc; Bank/PayPal/MobileMoney method enum; pending status.
2. Anti-abuse: rate-limit votes per IP/device (edge function), flag duplicate device fingerprints, block VPN ASN list, finalize battle only after fraud sweep.
3. Admin payouts page already exists — extend to show withdrawal queue.

## Phase 6 — Algorithm reweight
Update `useRecommendationAlgorithm` weights to: watch 35 / shares 25 / comments 20 / likes 10 / follows 5 / profile visits 5, with boosts for dance + original + high-retention + battle videos.

---

## Technical notes
- All new public tables get explicit GRANTs + RLS.
- Coin debits/credits go through SECURITY DEFINER RPCs only.
- Earnings stay in `pending_balance` column until battle close / payout cycle.
- Currency conversion: client-side using a cached FX table refreshed daily via edge function; never trust client for actual debit amounts (always ZAR coins server-side).

## Out of scope this round
- Real KYC integration (stub identity_verified boolean).
- Real watermark detection (manual flag).
- Live streaming (paused per prior instruction).

Reply with phase number(s) to build, or "all" to run sequentially.
