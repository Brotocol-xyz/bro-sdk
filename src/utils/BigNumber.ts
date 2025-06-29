import { Big, BigSource } from "big.js"
import { OneOrMore } from "./typeHelpers"
import { last } from "./arrayHelpers"
import { reduce } from "./arrayHelpers"

Big.PE = 50
Big.NE = -50

export type BigNumberSource = number | bigint | string | Big | BigNumber

const toBig = (num: BigNumberSource): Big => {
  if (num instanceof Big) {
    return num
  }

  return new Big(num as BigSource)
}

const fromBig = (num: Big): BigNumber => {
  return num as unknown as BigNumber
}

export type BigNumber = Omit<Big, keyof Big> & {
  ___B: "BigNumber"
}
export namespace BigNumber {
  export const { roundUp, roundDown, roundHalfUp, roundHalfEven } = Big
  export type RoundingMode =
    | typeof roundUp
    | typeof roundDown
    | typeof roundHalfUp
    | typeof roundHalfEven

  let defaultRoundingMode: RoundingMode = roundHalfUp
  export const setDefaultRoundingMode = (roundingMode: RoundingMode): void => {
    defaultRoundingMode = roundingMode
  }

  export const isBigNumber = (num: any): num is BigNumber => {
    return num instanceof Big
  }

  export const safeFrom = (value: BigNumberSource): undefined | BigNumber => {
    try {
      return from(value)
    } catch (e) {
      return undefined
    }
  }

  export const from = (value: BigNumberSource): BigNumber => {
    return fromBig(toBig(value as any))
  }

  export const toString = (value: BigNumberSource): `${number}` => {
    return toBig(value).toString() as `${number}`
  }

  export const toNumber = (value: BigNumberSource): number => {
    return toBig(value).toNumber()
  }

  export const toBigInt = curry2(
    (
      options: {
        roundingMode?: RoundingMode
      },
      value: BigNumberSource,
    ): bigint => {
      return BigInt(
        toFixed(
          {
            precision: 0,
            roundingMode: options.roundingMode ?? defaultRoundingMode,
          },
          toBig(value),
        ),
      )
    },
  )

  export const toFixed = curry2(
    (
      options: {
        precision?: number
        roundingMode?: RoundingMode
      },
      value: BigNumberSource,
    ): string => {
      return toBig(value).toFixed(
        options.precision,
        options.roundingMode ?? defaultRoundingMode,
      )
    },
  )

  export const toExponential = curry2(
    (
      options: {
        precision?: number
        roundingMode?: RoundingMode
      },
      value: BigNumberSource,
    ): string => {
      return toBig(value).toExponential(
        options.precision,
        options.roundingMode ?? defaultRoundingMode,
      )
    },
  )

  export const isNegative = (value: BigNumberSource): boolean => {
    return toBig(value).lt(0)
  }

  export const isGtZero = (value: BigNumberSource): boolean => {
    return toBig(value).gt(0)
  }

  export const isZero = (value: BigNumberSource): boolean => {
    return toBig(value).eq(0)
  }

  export const isEq = curry2(
    (value: BigNumberSource, a: BigNumberSource): boolean => {
      return toBig(value).eq(toBig(a))
    },
  )

  export const isGt = curry2(
    (value: BigNumberSource, a: BigNumberSource): boolean => {
      return toBig(value).gt(toBig(a))
    },
  )

  export const isGte = curry2(
    (value: BigNumberSource, a: BigNumberSource): boolean => {
      return toBig(value).gte(toBig(a))
    },
  )

  export const isLt = curry2(
    (value: BigNumberSource, a: BigNumberSource): boolean => {
      return toBig(value).lt(toBig(a))
    },
  )

  export const isLte = curry2(
    (value: BigNumberSource, a: BigNumberSource): boolean => {
      return toBig(value).lte(toBig(a))
    },
  )

  export const setPrecision = curry2(
    (
      options: {
        precision?: number
        roundingMode?: RoundingMode
      },
      value: BigNumberSource,
    ): BigNumber => {
      return fromBig(
        toBig(
          toBig(value).toPrecision(
            options.precision,
            options.roundingMode ?? defaultRoundingMode,
          ),
        ),
      )
    },
  )

  export const getPrecision = (value: BigNumberSource): number => {
    return toBig(value).c.length - (toBig(value).e + 1)
  }

  export const getIntegerLength = (value: BigNumberSource): number => {
    return toBig(value).e + 1
  }

  export const leftMoveDecimals = curry2(
    (distance: number, value: BigNumberSource): BigNumber =>
      moveDecimals({ distance }, value),
  )

  export const rightMoveDecimals = curry2(
    (distance: number, value: BigNumberSource): BigNumber =>
      moveDecimals({ distance: -distance }, value),
  )

  export const moveDecimals = curry2(
    (options: { distance: number }, value: BigNumberSource): BigNumber => {
      if (options.distance > 0) {
        return fromBig(toBig(value).div(10 ** options.distance))
      }

      if (options.distance < 0) {
        return fromBig(toBig(value).mul(10 ** -options.distance))
      }

      // distance === 0
      return from(value)
    },
  )

  export const getDecimalPart = curry2(
    (
      options: { precision: number },
      value: BigNumberSource,
    ): undefined | string => {
      /**
       * `toString` will return `"1e-8"` in some case, so we choose `toFixed` here
       */
      const formatted = toFixed(
        {
          precision: Math.min(getPrecision(value), options.precision),
          roundingMode: roundDown,
        },
        value,
      )

      const [, decimals] = formatted.split(".")
      if (decimals == null) return undefined
      return decimals
    },
  )

  export const abs = (value: BigNumberSource): BigNumber => {
    return fromBig(toBig(value).abs())
  }

  export const neg = (value: BigNumberSource): BigNumber => {
    return fromBig(toBig(value).neg())
  }

  export const sqrt = (value: BigNumberSource): BigNumber => {
    return fromBig(toBig(value).sqrt())
  }

  export const add = curry2(
    (value: BigNumberSource, a: BigNumberSource): BigNumber => {
      return fromBig(toBig(value).add(toBig(a)))
    },
  )

  export const minus = curry2(
    (value: BigNumberSource, a: BigNumberSource): BigNumber => {
      return fromBig(toBig(value).minus(toBig(a)))
    },
  )

  export const mul = curry2(
    (value: BigNumberSource, a: BigNumberSource): BigNumber => {
      return fromBig(toBig(value).mul(toBig(a)))
    },
  )
  /**
   * @example
   * cumulativeMul(v, [a, b, c]) // =>
   * [
   *   v,
   *   v * a,
   *   v * a * b,
   *   v * a * b * c
   * ]
   */
  export const cumulativeMul = curry2(
    (
      value: BigNumberSource,
      as: readonly BigNumberSource[],
    ): OneOrMore<BigNumber> => {
      return reduce(
        (acc: OneOrMore<BigNumber>, currentRate: BigNumberSource) => [
          ...acc,
          BigNumber.mul(last(acc)!, currentRate),
        ],
        [from(value)],
        as,
      )
    },
  )

  export const div = curry2(
    (value: BigNumberSource, a: BigNumberSource): BigNumber => {
      return fromBig(toBig(value).div(toBig(a)))
    },
  )

  export const pow = curry2((value: BigNumberSource, a: number): BigNumber => {
    return fromBig(toBig(value).pow(a))
  })

  export const round = curry2(
    (
      options: {
        precision?: number
        roundingMode?: RoundingMode
      },
      value: BigNumberSource,
    ): BigNumber => {
      return fromBig(
        toBig(value).round(
          options.precision,
          options.roundingMode ?? defaultRoundingMode,
        ),
      )
    },
  )

  export const toPrecision = curry2(
    (
      options: {
        precision?: number
        roundingMode?: RoundingMode
      },
      value: BigNumberSource,
    ): string => {
      return toBig(value).toPrecision(
        options.precision,
        options.roundingMode ?? defaultRoundingMode,
      )
    },
  )

  export const ascend = curry2(
    (a: BigNumberSource, b: BigNumberSource): -1 | 0 | 1 =>
      isLt(a, b) ? -1 : isGt(a, b) ? 1 : 0,
  )

  export const descend = curry2(
    (a: BigNumberSource, b: BigNumberSource): -1 | 0 | 1 =>
      isLt(a, b) ? 1 : isGt(a, b) ? -1 : 0,
  )

  export const sort = (
    comparator: (a: BigNumber, b: BigNumber) => -1 | 0 | 1,
    numbers: readonly BigNumberSource[],
  ): BigNumber[] => {
    const _numbers = numbers.map(a => fromBig(toBig(a)))
    _numbers.sort(comparator)
    return _numbers
  }

  export const max = (numbers: OneOrMore<BigNumberSource>): BigNumber => {
    return from(sort(descend, numbers)[0]!)
  }

  export const min = (numbers: OneOrMore<BigNumberSource>): BigNumber => {
    return from(sort(ascend, numbers)[0]!)
  }

  export const clamp = (
    range: [min: BigNumber, max: BigNumber],
    n: BigNumber,
  ): BigNumber => {
    const [min, max] = range
    if (isGte(n, max)) return max
    if (isLte(n, min)) return min
    return n
  }

  export const sum = (numbers: BigNumberSource[]): BigNumber => {
    return numbers
      .map(n => fromBig(toBig(n)))
      .reduce((acc, n) => add(acc, n), ZERO)
  }

  export const ZERO = BigNumber.from(0)
  export const ONE = BigNumber.from(1)
}

interface Curry2<Args extends [any, any], Ret> {
  (a: Args[0]): (b: Args[1]) => Ret
  (a: Args[0], b: Args[1]): Ret
}
function curry2<Args extends [any, any], Ret>(
  fn: (...args: Args) => Ret,
): Curry2<Args, Ret> {
  return function (a: Args[0], b?: Args[1]): Ret {
    if (arguments.length > 1) {
      return (fn as any)(a, b)
    }
    return ((b: Args[1]): Ret => (fn as any)(a, b)) as any
  } as any
}
