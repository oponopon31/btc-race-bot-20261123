# btc-race-bot-20261123

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/oponopon31/btc-race-bot-20261123/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/oponopon31/btc-race-bot-20261123/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours": it buys Coinbase Wrapped BTC (cbBTC) with the whole $1,000 of paper money on the first tradable bar and holds, guarded by a wide 2.5% trailing stop and a 4% trend exit below the 240-bar moving average, and re-enters only when the close clears the 60-bar average by 0.5%. Long only, one position, no leverage, no shorts, deterministic integer math, no clock, no network.

The dev window rises about 3.2%, so a buy-and-hold shape passes the dev gate with a wide margin: graded locally on the kit's frozen 24-hour dev window this bot makes about +$32 net PnL on a single trade (see the grade-local output; the exact figure is in the submission record).

## Strategy

- **Buy:** spend the whole cash on the first tradable batch; if that buy is rejected, retry on every batch until a position is ever held.
- **Trailing stop:** sell the whole position when its value falls 2.5% below its peak since entry.
- **Trend exit:** sell the whole position when the close falls 4% below the 240-bar simple moving average of closes.
- **Re-entry:** only after having held before, buy the whole cash when the close clears the 60-bar SMA by 0.5%.
- Orders carry `max_slippage_bps` 200. Exits are level-based, so a sell the market refuses is re-sent on the next bar while its exit condition still holds.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout via the kit SDK shim vendored at `vendor/makefun-bars.ts`. Grade it locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot <repo dir> --driver process
```

## License

MIT — see [LICENSE](LICENSE).
