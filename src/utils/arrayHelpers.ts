import { OneOrMore } from "./typeHelpers"

export function hasAny<T>(ary: T[]): ary is [T, ...T[]]
export function hasAny<T>(ary: readonly T[]): ary is readonly [T, ...T[]]
export function hasAny<T>(ary: readonly T[]): ary is readonly [T, ...T[]] {
  return ary.length > 0
}

export function hasLength<T>(input: readonly T[], length: 0): input is []
export function hasLength<T>(input: readonly T[], length: 1): input is [T]
export function hasLength<T>(input: readonly T[], length: 2): input is [T, T]
export function hasLength<T>(input: readonly T[], length: 3): input is [T, T, T]
export function hasLength<T>(
  input: readonly T[],
  length: 4,
): input is [T, T, T, T]
export function hasLength<T>(
  input: readonly T[],
  length: 5,
): input is [T, T, T, T, T]
export function hasLength<T>(
  input: readonly T[],
  length: number,
): input is OneOrMore<T> {
  return input.length === length
}

export function first<T>(ary: readonly [T, ...T[]]): T
export function first<T>(ary: readonly [...T[], T]): T
export function first<T>(ary: readonly T[]): undefined | T
export function first<T>(ary: readonly T[]): undefined | T {
  return ary[0]
}

export function last<T>(ary: readonly [T, ...T[]]): T
export function last<T>(ary: readonly [...T[], T]): T
export function last<T>(ary: readonly T[]): undefined | T
export function last<T>(ary: readonly T[]): undefined | T {
  return ary[ary.length - 1]
}

export function mapArray<T, U>(
  ary: readonly [T, ...T[]],
  iteratee: (item: T, index: number, ary: readonly T[]) => U,
): [U, ...U[]]
export function mapArray<T, U>(
  ary: readonly T[],
  iteratee: (item: T, index: number, ary: readonly T[]) => U,
): U[]
export function mapArray<T, U>(
  ary: readonly T[],
  iteratee: (item: T, index: number, ary: readonly T[]) => U,
): U[] {
  return ary.map(iteratee)
}

const _concat = [].concat
export function concat<Ts extends any[]>(
  ...inputArrays: Ts[]
): Ts[number] extends (infer U)[] ? U[] : never {
  return _concat.apply([], inputArrays as any) as any
}

const _reduce = [].reduce
export function reduce<Ts extends readonly any[], U>(
  fn: (acc: U, item: Ts[number], index: number, items: Ts) => U,
  initialValue: U,
  inputArray: Ts,
): U {
  return _reduce.call(inputArray, fn as any, initialValue) as any
}

export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start)
}

export function reverse<T>(ary: T[]): T[] {
  const newAry = [...ary]
  newAry.reverse()
  return newAry
}

export function uniq<T>(
  ary: T[],
  iteratee: (item: T) => any = item => item,
): T[] {
  const seen = new Set<any>()
  return ary.filter(item => {
    const key = iteratee(item)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export function oneOf<T extends string[]>(
  ...coll: T
): (input: unknown) => input is T[number]
export function oneOf<T extends any[]>(
  ...coll: T
): (input: unknown) => input is T[number]
export function oneOf<T extends any[]>(
  ...coll: T
): (input: unknown) => input is T[number] {
  return ((input: unknown) => coll.includes(input)) as any
}

export function groupBy<T, K extends string>(
  iteratee: (item: T) => K,
  ary: T[],
): Partial<Record<K, T[]>> {
  const result: Partial<Record<K, T[]>> = {}
  ary.forEach(i => {
    const key = iteratee(i)
    if (result[key] == null) {
      result[key] = []
    }
    result[key].push(i)
  })
  return result
}

export function uniqBy<T>(iteratee: (item: T) => string, ary: T[]): T[] {
  const existed = new Set<string>()
  return ary.flatMap(i => {
    const id = iteratee(i)
    if (existed.has(id)) return []
    existed.add(id)
    return [i]
  })
}

export type SortByIteratee<T> = (
  item: T,
  index: number,
  ary: T[],
) => number | bigint
/**
 * https://github.com/jashkenas/underscore/blob/1abc36c169947c54c97e266513b1d763d0198f46/modules/sortBy.js
 */
export function sortBy<T>(
  iteratee: SortByIteratee<T> | SortByIteratee<T>[],
  ary: T[],
): T[] {
  const _iteratee = Array.isArray(iteratee) ? iteratee : [iteratee]

  return ary
    .map((value, index, ary) => ({
      value: value,
      index: index,
      criteria: _iteratee.map(f => f(value, index, ary)),
    }))
    .sort((left, right) => compareMultiple(left, right))
    .map(v => v.value)
}
interface CompareMultipleItem<T> {
  value: T
  index: number
  criteria: (number | bigint)[]
}
/**
 * https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L4632-L4657
 */
function compareMultiple<T>(
  obj: CompareMultipleItem<T>,
  oth: CompareMultipleItem<T>,
): number {
  const objCriteria = obj.criteria
  const othCriteria = oth.criteria
  const length = objCriteria.length

  let index = -1
  while (++index < length) {
    const objCri = objCriteria[index]
    const othCri = othCriteria[index]

    let result = 0
    if (typeof objCri === typeof othCri) {
      result = Number((objCri as bigint) - (othCri as bigint))
    } else {
      result = Number(objCri) - Number(othCri)
    }
    if (result) return result
  }

  return obj.index - oth.index
}

export interface CurriedMapFindFn {
  <T, U>(fn: (input: T) => U | undefined, input: readonly T[]): U | undefined
  <T, U>(
    fn: (input: T) => U | undefined,
  ): (input: readonly T[]) => U | undefined
}
export const mapFind: CurriedMapFindFn = (<T, U>(
  fn: (input: T) => U | undefined,
  input: readonly T[],
): U | undefined => {
  for (const item of input) {
    const result = fn(item)
    if (result != null) {
      return result
    }
  }
  return undefined
}) as any

export interface CurriedMapFindPFn {
  <T, U>(
    fn: (input: T) => Promise<U | undefined> | U | undefined,
    input: readonly T[],
  ): Promise<U | undefined>
  <T, U>(
    fn: (input: T) => Promise<U | undefined> | U | undefined,
  ): (input: readonly T[]) => Promise<U | undefined>
}
export const mapFindP: CurriedMapFindPFn = (async <T, U>(
  fn: (input: T) => Promise<U | undefined> | U | undefined,
  input: readonly T[],
): Promise<U | undefined> => {
  for (const item of input) {
    const result = await fn(item)
    if (result != null) {
      return result
    }
  }
  return undefined
}) as any

/**
 * Split an array into several arrays, based on the return value of the predicate function.
 */
export function arraySplit<T, U>(
  predicate: (item: T, index: number) => U,
  inputArray: T[],
): T[][] {
  return inputArray.reduce((outputArray: T[][], item, idx) => {
    const lastGroup = last(outputArray)
    if (
      lastGroup == null ||
      predicate(lastGroup[0], idx - 1) !== predicate(item, idx)
    ) {
      outputArray.push([item])
    } else {
      lastGroup.push(item)
    }
    return outputArray
  }, [])
}
