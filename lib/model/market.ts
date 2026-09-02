// Market-implied win probability from the closing spread, calibrated against
// real historical outcomes rather than an assumed constant.
//
// Convention used throughout this codebase: `homeSpread` is the number of
// points the HOME team is favored by (positive = home favored, negative =
// home underdog, 0 = pick'em). CFBD's raw `spread` field follows the
// traditional betting-odds convention (negative = home favored), so it is
// negated once in scripts/lib/normalize.ts and never touched again downstream.

export interface LogisticFit {
  k: number;
  b: number;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Inverse of sigmoid: given a probability, return the logit (x such that sigmoid(x) = p). */
export function logit(p: number): number {
  const clamped = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return Math.log(clamped / (1 - clamped));
}

export function marketWinProbability(homeSpread: number, fit: LogisticFit): number {
  return sigmoid(fit.b + fit.k * homeSpread);
}

/** Convert a win probability back into an equivalent point margin, using the same fit. */
export function probabilityToMargin(p: number, fit: LogisticFit): number {
  return (logit(p) - fit.b) / fit.k;
}

/**
 * Fits `p(home win) = sigmoid(b + k * homeSpread)` via batch gradient descent
 * (simple, dependency-free logistic regression with a single predictor).
 * Used offline by scripts/calibrate-market.mts against several prior CFBD
 * seasons; the result is cached in data/calibration.json and imported at
 * runtime so requests never re-fit the model.
 */
export function fitMarketLogistic(
  samples: { homeSpread: number; homeWon: boolean }[],
  opts: { iterations?: number; learningRate?: number } = {}
): LogisticFit & { logLoss: number } {
  const iterations = opts.iterations ?? 5000;
  const lr = opts.learningRate ?? 0.01;

  let k = 0.16; // reasonable starting point within the expected 0.14-0.19 range
  let b = 0;

  const n = samples.length;
  if (n === 0) throw new Error("fitMarketLogistic: no samples provided");

  for (let iter = 0; iter < iterations; iter++) {
    let gradK = 0;
    let gradB = 0;
    for (const s of samples) {
      const p = sigmoid(b + k * s.homeSpread);
      const y = s.homeWon ? 1 : 0;
      const err = p - y;
      gradK += err * s.homeSpread;
      gradB += err;
    }
    k -= (lr * gradK) / n;
    b -= (lr * gradB) / n;
  }

  let logLoss = 0;
  for (const s of samples) {
    const p = Math.min(Math.max(sigmoid(b + k * s.homeSpread), 1e-9), 1 - 1e-9);
    logLoss += s.homeWon ? -Math.log(p) : -Math.log(1 - p);
  }
  logLoss /= n;

  return { k, b, logLoss };
}
