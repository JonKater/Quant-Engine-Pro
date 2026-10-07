# Vision: What QuantEngine Pro Should Be

This document describes **the goal, not the route**. It states how the app must
behave for it to serve its purpose — not which libraries, classes or algorithms
get it there. How the goal is reached is deliberately left open.

---

## The purpose in one sentence

A browser app for **designing trading strategies, backtesting them honestly, and
then trading them by hand in a realistically simulated demo account** across forex,
gold and equity indices — with no real money, no broker account, and no sign-up.

## Who it is for

Someone learning quantitative trading, or testing a strategy idea, who needs
**numbers they can rely on**. The user has to be able to trust this app. A metric
that looks better than reality is worse than no metric at all.

---

## Guiding principles

These four sentences take precedence over any feature:

1. **Honesty over impression.** Every number shown is either correctly computed or
   not shown. No placeholder value dressed up as a measurement. If the interface
   calls something a Sharpe ratio, it must be a Sharpe ratio.
2. **What is visible has an effect.** Every toggle, input field and selection in
   the interface genuinely changes how the app behaves. No decorative controls.
3. **Traceability.** The user can see how a result came about: which trades, at
   which prices, with which costs. Identical inputs produce identical results.
4. **No deception about what the app is.** It is clear throughout that everything
   is simulated. The app carries its own, recognisably fictional name and does not
   present itself as a real or regulated financial institution.

---

## Area 1 — The trading terminal

**Target state:** The user trades a simulated account in real time, and the account
behaves the way a real one would.

What the user can do:

- Watch several instruments at once (currency pairs, gold, an equity index) with
  live buy/sell quotes and the current spread between them.
- View a candlestick chart of the selected instrument, switch the timeframe, and
  overlay common indicators.
- Open positions immediately at the market price, or place orders that trigger only
  when a price is reached.
- Set loss and profit limits, change them after the fact, and enable a trailing
  stop.
- Inspect and export open positions, resting orders, and completed trade history.
- Deliberately make conditions harder: raise volatility, pause the simulation,
  reset the account.

How success is measured:

- **The account figures are correct at all times.** Balance, equity, used and free
  margin, and the margin level agree with each other at every moment — including
  immediately after opening or closing a position, and while several positions are
  open at once. There is no interim state in which the display is wrong and only
  corrects itself on the next price update.
- **Profit and loss are expressed in the account currency.** For every instrument,
  including those not quoted in the account currency. A price gain in yen appears
  as the amount it is worth in US dollars.
- **Margin reflects the position's actual notional value**, measured in the account
  currency, divided by the leverage.
- **Every cost appears and sums correctly:** the spread, the commission, and — if
  overnight financing is part of the model — that too. Anything labelled "net"
  includes all costs. The realised profit in the account summary reconciles with
  the change in balance.
- **Orders are validated before they are accepted.** A buy order meant to trigger
  at a lower price is rejected if it sits above the market. Position sizes respect
  each instrument's own constraints. No order — including a resting one that
  triggers later — opens a position for which no margin is available.
- **Margin-call and forced-liquidation logic fires reliably**, working from the
  true account state rather than an interim value.
- **Switching the chart timeframe really shows different candles.** Candles close
  at the end of their period and a new one begins — the last candle does not grow
  indefinitely.

---

## Area 2 — The strategy and backtesting lab

**Target state:** The user assembles a strategy, runs it over historical price
data, and receives an assessment that **does not mislead** — above all, no illusory
quality produced by overfitting.

What the user can do:

- Assemble a strategy from a fixed, manageable set of indicators and set their
  parameters.
- Define rules for position sizing, loss limits and profit targets.
- Start an automatic parameter search that works across rolling time windows:
  optimise on one segment, then verify on the immediately following, unseen
  segment.
- Read the result: trades, hit rate, return, risk, the equity curve, and a
  statement on whether the parameters found are likely overfitted.
- Carry a discovered strategy over into the terminal.

How success is measured:

- **The backtest produces trades.** A strategy with sensible defaults yields an
  analysable number of trades over a typical dataset. If none occur, the app says
  so plainly and explains why — rather than presenting empty metrics as a valid
  evaluation.
- **The entry logic is internally consistent.** The conditions describe a market
  situation that actually occurs. It does not simultaneously require an uptrend and
  a deeply oversold reading — conditions that in practice exclude each other.
- **The time windows are usefully cut.** Each optimisation window is long enough
  that, after the indicators' warm-up period, a meaningful sample remains. The
  windows traverse the **entire** dataset; no large portion of the history goes
  unused.
- **Optimise on the training segment, evaluate on the verification segment.** The
  choice of best parameters rests exclusively on the segment used for optimisation.
  The verification segment is read only to report how well that choice held up — it
  does not influence the choice. Only then is the reported robustness worth
  anything.
- **No look-ahead.** Every indicator and level computed at a point in time uses
  only prices up to that point. No value derived from later prices feeds into an
  earlier decision.
- **Results are reproducible.** The same dataset and the same settings produce the
  same result. Two runs are comparable.
- **Metrics carry accurate names.** Risk measures are expressed relative to the
  capital deployed and, where reported as annual figures, are correctly annualised.
  Maximum equity drawdown accounts for the path *while* positions are open, not
  just the values between closed trades.
- **Backtest and terminal use the same cost model.** The backtest accounts for the
  spread just as the live simulation does. A result from the lab and the same
  approach in the terminal do not produce systematically different numbers.
- **The selected indicators determine the strategy.** What the user enables or
  disables demonstrably changes how trading occurs. Any statement about the
  influence of individual parameters is derived from the actual search — or left
  out.
- **The search does not block the interface.** While computation runs, the app
  stays responsive and progress stays visible.

---

## Area 3 — The explanatory section

**Target state:** A section that explains how the app computes what it computes,
and where the limits of the simulation lie — so the user can interpret the numbers
correctly.

It describes what actually happens in this app: how prices are generated, how the
spread is modelled, how margin and forced liquidation work, how the rolling
verification procedure is structured, and which simplifications were made
deliberately.

How success is measured: the explanatory section describes **this** app. It does
not depict infrastructure that does not exist, and quotes no throughput or latency
figures that are measured nowhere.

---

## Non-goals

Deliberately outside the scope:

- **No real money and no connection to a real broker.** No order leaves the app.
- **No live market data.** Prices are simulated. They should behave plausibly —
  session rhythm, varying spreads, volatility bursts — but they do not claim to be
  real market prices.
- **No server of its own, no database, no user accounts.** The app runs in the
  browser. Everything starts fresh on each load unless something is explicitly
  persisted.
- **No distributed infrastructure and no standalone mobile apps.** The app works
  well on a phone — as a web page.
- **No investment advice and no performance promises.**
- **No third-party brands.** The app carries its own, recognisably fictional name
  and uses no names, server designations or account identifiers belonging to real,
  regulated financial companies.

---

## The acceptance test

The vision is met when a person with no prior knowledge can do the following in one
sitting, without encountering a single number that does not hold up:

1. They assemble a strategy in the lab, start the parameter search, and receive an
   evaluation with a plausible number of trades, an equity curve, and an assessment
   of overfitting.
2. They run the same search a second time and get the same result.
3. They carry the strategy into the terminal, open a position on an instrument not
   quoted in the account currency, and the profit shown matches what the position
   size and the price move imply.
4. They open a second position, close the first, and the account summary is
   internally consistent immediately afterwards.
5. They raise volatility until a forced liquidation triggers, and the account
   behaves understandably throughout.
6. They switch the chart timeframe and see different candles.
7. They export the trade history, add up the net results, and arrive at the change
   in balance.
