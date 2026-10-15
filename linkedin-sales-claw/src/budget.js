// How many connection requests are still allowed today.
//
// LinkedIn restricts accounts that jump straight to volume, so the allowance
// ramps with the account's time on this claw (Cristiano, 2026-10-10, the same
// ramp the rented-account fleet uses): week 1 5/day, week 2 10, week 3 18,
// week 4 onward 20. Measured over a rolling 24h off the ledger, never per run,
// so polling more often never means inviting more.

const DAY = 86400_000;
export const DEFAULT_RAMP = [5, 10, 18, 20];

export function dailyConnectCap({ ledger, now = new Date(), ramp = DEFAULT_RAMP }) {
  const first = ledger.firstInviteAt();
  const week = first ? Math.floor((+now - +first) / (7 * DAY)) : 0;
  return ramp[Math.min(week, ramp.length - 1)];
}

export function connectBudget({ ledger, now = new Date(), ramp = DEFAULT_RAMP }) {
  const cap = dailyConnectCap({ ledger, now, ramp });
  return Math.max(0, cap - ledger.invitesSince(DAY, now));
}
