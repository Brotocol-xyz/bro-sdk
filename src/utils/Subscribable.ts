export interface Subscription {
  unsubscribe: () => void
}
export interface Subscribable<T> {
  subscribe(subscriber: (value: T) => void): Subscription
}

export interface EmitterFinalizer {
  (): void
}
export interface EmitterInitializer<T> {
  (emit: (value: T) => void): undefined | EmitterFinalizer
}

export function createSubscribable<T>(
  emitterInitializer: EmitterInitializer<T>,
): Subscribable<T> {
  let subscribers: ((value: T) => void)[] = []
  let finalizer: EmitterFinalizer | undefined

  return {
    subscribe: (subscriber: (value: T) => void) => {
      const wrappedSubscriber = (value: T) => {
        subscriber(value)
      }

      if (finalizer == null) {
        finalizer =
          emitterInitializer(value => {
            subscribers.forEach(subscriber => subscriber(value))
          }) ?? (() => {})
      }

      subscribers.push(wrappedSubscriber)
      return {
        unsubscribe: () => {
          subscribers = subscribers.filter(s => s !== wrappedSubscriber)
          if (subscribers.length === 0) {
            finalizer?.()
          }
        },
      }
    },
  }
}

export function createIntervalSubscribable(interval: number): Subscribable<{}> {
  return createSubscribable(emit => {
    const intervalId = setInterval(() => {
      emit({})
    }, interval)

    return () => clearInterval(intervalId)
  })
}

export function mergeSubscribables<T>(
  subscribables: Subscribable<T>[],
): Subscribable<T> {
  return createSubscribable(emit => {
    const subscriptions = subscribables.map(subscribable =>
      subscribable.subscribe(emit),
    )

    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe())
    }
  })
}

export function toAsyncIterable<T>(
  subscribable: Subscribable<T>,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: () => {
      const queue: T[] = []
      let resolve: ((value: IteratorResult<T, undefined>) => void) | null = null
      let finished = false

      const subscription = subscribable.subscribe(value => {
        if (resolve) {
          resolve({ value, done: false })
          resolve = null
        } else {
          queue.push(value)
        }
      })

      return {
        async next(): Promise<IteratorResult<T, undefined>> {
          if (queue.length > 0) {
            return { value: queue.shift() as T, done: false }
          }
          if (finished) {
            return { value: undefined, done: true }
          }
          return new Promise<IteratorResult<T, undefined>>(res => {
            resolve = res
          })
        },
        async return(): Promise<IteratorReturnResult<undefined>> {
          finished = true
          subscription.unsubscribe()
          return { value: undefined, done: true }
        },
        async throw(error) {
          finished = true
          subscription.unsubscribe()
          throw error
        },
        [Symbol.asyncIterator]() {
          return this
        },
      }
    },
  }
}
