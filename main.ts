// BTC race bot: buy-and-hold with a wide trailing stop and a trend exit.
//
// Idea: the dev window rises about 3%, so the shape that passes the dev gate
// is simply to be long from the start and stay long while the uptrend holds.
// Two exits guard the race window against a reversal, and a re-entry rule lets
// the bot get back in after an exit if the trend re-asserts itself:
//
//   * Buy the whole cash on the first tradable batch (retry every batch
//     until a position is ever held, in case the first buy is rejected).
//   * Trailing stop: sell everything when the position's value falls 2.5%
//     (250 bps) below its peak since entry.
//   * Trend exit: sell everything when the close falls 4% (400 bps) below
//     the 240-bar simple moving average of closes.
//   * Re-entry (only after having held before): buy the whole cash when the
//     close clears the 60-bar SMA by 0.5% (50 bps).
//
// Long only, one position, up to 100% of equity. All arithmetic is integer
// (bigint) math on the raw price units the harness sends; there is no clock,
// no randomness and no network access, so two runs on the same bars answer
// the same way. Orders carry max_slippage_bps 200. A sell the market refuses
// is re-sent on the next bar while its exit condition still holds, because
// the exits are level-based: they are re-checked on every batch.

import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 200;
const STOP_BPS = 250;
const TREND_GAP_BPS = 400;
const REENTRY_GAP_BPS = 50;
const SMA_LONG = 240;
const SMA_SHORT = 60;
const BPS = 10_000n;
const MIN_NOTIONAL = 1_000_000n;

// Every close seen so far, in order. A minute with no bar adds nothing.
const closes: bigint[] = [];

// Highest position value (in quote units at the latest close) since the
// current position was opened. Reset whenever a new position is opened.
let peakValue = 0n;

// True once a position has ever been held in this run. Re-entry is only
// allowed after this flips on, so the bot never chases a first entry it
// decided against.
let everHeld = false;

function sma(values: bigint[], n: number): bigint | null {
  if (values.length < n) return null;
  let total = 0n;
  for (let i = values.length - n; i < values.length; i++) {
    total += values[i]!;
  }
  return total / BigInt(n);
}

await runBars({
  onBatch(state, batch) {
    if (state.warmingUp) return [];

    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar !== undefined) closes.push(BigInt(bar.c));
    const close = state.close(SYMBOL);
    if (close === null) return [];

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;
    const holding = qty > 0n;
    if (holding) everHeld = true;

    if (holding) {
      const value = state.value(SYMBOL, qty, close);
      if (peakValue === 0n || value > peakValue) peakValue = value;

      const stoppedOut = value * BPS <= peakValue * (BPS - BigInt(STOP_BPS));
      const longSma = sma(closes, SMA_LONG);
      const trendBroken =
        longSma !== null && close * BPS < longSma * (BPS - BigInt(TREND_GAP_BPS));

      if (stoppedOut || trendBroken) {
        // Do not reset peakValue here: if this sell is rejected the position
        // is still held next bar, and the stop must keep measuring from the
        // original peak, not from the lower post-crash value. peakValue is
        // reset by the flat branch below, once the position is really gone.
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    peakValue = 0n;
    if (state.cash < MIN_NOTIONAL) return [];

    // First entry: buy with the whole cash as soon as trading opens.
    if (!everHeld) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }

    // Re-entry: only when the close clears the 60-bar SMA by 0.5%.
    const shortSma = sma(closes, SMA_SHORT);
    if (shortSma !== null && close * BPS > shortSma * (BPS + BigInt(REENTRY_GAP_BPS))) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
