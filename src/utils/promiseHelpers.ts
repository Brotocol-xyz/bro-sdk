export type UnboxPromise<T> = T extends PromiseLike<infer R> ? R : T

export function defer<T = void>(): defer.Deferred<T> {
  const result: defer.Deferred<T> = {
    isPending: true,
  } as any
  result.promise = new Promise<T>((_resolve, _reject) => {
    result.resolve = v => {
      result.isPending = false
      _resolve(v)
    }
    result.reject = v => {
      result.isPending = false
      _reject(v)
    }
  })
  return result
}
export namespace defer {
  export interface Deferred<T> {
    isPending: boolean
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (err: any) => void
  }
}

export async function props<I extends Record<string, any>>(
  inputs: I,
): Promise<{ [K in keyof I]: UnboxPromise<I[K]> }> {
  const res = await Promise.all(Object.values(inputs))
  return Object.fromEntries(
    Object.keys(inputs).map((k, i) => [k, res[i]]) as any,
  ) as any
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
