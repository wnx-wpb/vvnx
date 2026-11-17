// Token Radar's model, in the page's own words: the same derivation the build runs, recomputed
// here from the snapshot's figures so the board, the detail view and the stored board agree.
//
//   implied = TVL x baseMultiple x growthMult x maturityMult x breadthMult
//
// The base multiple is calibrated from the snapshot itself: the median market-cap-to-TVL ratio of
// the live-token protocols in the same file, clamped to [0.05, 1.0]. Growth is the 7-day change
// clamped to [-60, 120] per cent and weighted at half strength. Maturity is a saturating curve over
// age, from 0.55 at listing to 1.00 at four years. Breadth adds 2% per extra chain, capped at five.
// No name is special-cased; every row is scored by this one function.

(function (root) {
  'use strict';

  var DAY_MS = 86400000;

  function finite(value, fallback) {
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  function ageDays(asOf, listedAt) {
    if (listedAt === null || listedAt === undefined) return null;
    var a = Date.parse(asOf + 'T00:00:00Z');
    var b = Date.parse(listedAt + 'T00:00:00Z');
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.max(0, Math.floor((a - b) / DAY_MS));
  }

  // The multipliers and the implied value one protocol gets, from its own record.
  function impliedOf(row, data) {
    var model = data.model;
    var age = ageDays(data.as_of, row.listed_at);
    var rawGrowth = finite(row.change_7d, 0);
    var growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
    var growthMult = 1 + (growthPct / 100) * model.growth_weight;
    var ageForModel = age === null ? model.unknown_age_days : age;
    var maturityMult =
      model.maturity_floor +
      model.maturity_range * Math.sqrt(Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
    var extraChains = Math.min(Math.max(row.chains.length - 1, 0), model.breadth_max_extra);
    var breadthMult = 1 + model.breadth_per_chain * extraChains;
    var implied = Math.max(1, Math.round(row.tvl_usd * data.calibration.base_multiple * growthMult * maturityMult * breadthMult));
    return {
      implied: implied,
      growthPct: growthPct,
      growthMult: growthMult,
      maturityMult: maturityMult,
      breadthMult: breadthMult,
      age: age,
    };
  }

  function chainOf(row) {
    return row.chains.length > 0 ? row.chains[0] : 'its main chain';
  }

  function gasFor(chain) {
    var c = String(chain).toLowerCase();
    if (c === 'ethereum') return 'about $12 of gas';
    if (c === 'solana') return 'under $0.10 of fees';
    if (c === 'bitcoin') return 'about $3 of fees';
    if (
      ['arbitrum', 'optimism', 'base', 'blast', 'zksync era', 'linea', 'scroll', 'mantle', 'mode', 'ink', 'unichain', 'abstract', 'soneium', 'fraxtal', 'zora', 'polygon zkevm'].indexOf(c) !== -1
    ) {
      return 'about $1 of gas';
    }
    if (['bsc', 'polygon', 'avalanche', 'fantom', 'celo', 'gnosis', 'moonbeam', 'kava', 'cronos', 'aurora', 'metis', 'boba', 'opbnb'].indexOf(c) !== -1) {
      return 'about $1 of gas';
    }
    return 'a few dollars of gas';
  }

  function capitalFor(row) {
    if (row.tvl_usd >= 5000000000) return 250;
    if (row.tvl_usd >= 1000000000) return 150;
    if (row.tvl_usd >= 100000000) return 100;
    return 50;
  }

  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 120) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('risk curator') !== -1 || c.indexOf('curator') !== -1) {
      return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares in the wallet.';
    }
    if (c.indexOf('capital allocator') !== -1 || c.indexOf('allocator') !== -1) {
      return 'Allocate $' + capital + ' to a ' + name + ' strategy on ' + chain + ' and leave the allocation untouched.';
    }
    if (c.indexOf('lend') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1) {
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the supply position open.';
    }
    if (c.indexOf('leveraged farm') !== -1) {
      return 'Open a $' + capital + ' leveraged farm on ' + name + ' on ' + chain + ' at the lowest leverage it offers.';
    }
    if (c.indexOf('dex') !== -1 || c.indexOf('liquidity manager') !== -1) {
      return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the LP position open.';
    }
    if (c.indexOf('yield aggregator') !== -1 || c.indexOf('yield') !== -1) {
      return 'Deposit $' + capital + ' into ' + name + "'s highest-TVL vault on " + chain + ' and keep the receipt tokens.';
    }
    if (c.indexOf('basis trading') !== -1) {
      return 'Deposit $' + capital + ' into ' + name + "'s basis vault on " + chain + ' and hold the position through one funding cycle.';
    }
    if (c.indexOf('restak') !== -1 || c.indexOf('staking pool') !== -1) {
      return 'Stake $' + capital + ' through ' + name + ' on ' + chain + ' and keep the staking receipt in the wallet.';
    }
    if (c.indexOf('bridge') !== -1) {
      return 'Bridge $' + capital + ' of USDC through ' + name + ' to ' + chain + ' and use the bridged funds in its app.';
    }
    if (c.indexOf('perpetual') !== -1 || c.indexOf('derivative') !== -1) {
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    }
    if (c.indexOf('options') !== -1) {
      return 'Deposit $' + capital + ' of collateral on ' + name + ' and open one defined-risk options position.';
    }
    if (c.indexOf('prediction') !== -1) {
      return 'Fund $' + capital + ' on ' + name + ' and place one position in an active market.';
    }
    if (c.indexOf('rwa') !== -1) {
      return 'Mint $' + capital + ' of the yield-bearing asset on ' + name + ' on ' + chain + ' and hold it in the wallet.';
    }
    if (c.indexOf('stable') !== -1) {
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    }
    if (c.indexOf('insurance') !== -1) {
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    }
    if (c.indexOf('chain') !== -1) {
      return 'Bridge $' + capital + ' to the ' + name + ' chain, swap a small amount on its native DEX and keep a balance in the wallet.';
    }
    if (c.indexOf('launchpad') !== -1) {
      return 'Stake or hold $' + capital + ' through ' + name + ' to qualify for its launches and join one sale.';
    }
    if (c.indexOf('gaming') !== -1 || c.indexOf('nft') !== -1) {
      return 'Buy $' + capital + ' of the in-app asset on ' + name + ' and use it in one full session.';
    }
    if (c.indexOf('privacy') !== -1) {
      return 'Deposit $' + capital + " through " + name + "'s shielded pool on " + chain + ' and keep the note safe.';
    }
    if (c.indexOf('index') !== -1) {
      return 'Buy $' + capital + ' of the ' + name + ' index token on ' + chain + ' and hold it.';
    }
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }

  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s += ' Hold the position and check the protocol\'s own page.';
    return s;
  }

  // A protocol's farm plan: six steps, each an action with a cost and a time, derived from the
  // protocol's own record (category, chains, TVL, age).
  function farmSteps(row, data) {
    var chain = chainOf(row);
    var gas = gasFor(chain);
    var capital = capitalFor(row);
    var age = ageDays(data.as_of, row.listed_at);
    var hold = holdDaysFor(age);
    var action = actionFor(row, capital, chain);
    return [
      {
        text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.',
        cost: 'nothing to set up',
        time: '5 minutes',
      },
      { text: action, cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      {
        text: 'Make one qualifying action each week, such as a deposit, a swap, a vote or a referral check-in.',
        cost: gas + ' a week',
        time: '10 minutes a week',
      },
      {
        text: 'Hold the position for at least ' + hold + ' days so the activity lands in more than one snapshot.',
        cost: 'the $' + capital + ' stays in the position',
        time: hold + ' days',
      },
      {
        text: "Before you withdraw, open the protocol's own points or rewards page from the link it publishes, and never pay anyone to claim.",
        cost: 'no fee to check',
        time: '10 minutes',
      },
      {
        text: 'Write the wallet, the dates and every transaction hash in a farm log, and plan the unwind before any lock or cooldown ends.',
        cost: 'nothing but the log',
        time: '5 minutes',
      },
    ].map(stepText);
  }

  root.RADAR_MODEL = {
    ageDays: ageDays,
    impliedOf: impliedOf,
    farmSteps: farmSteps,
    stepText: stepText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
