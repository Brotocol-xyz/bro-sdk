import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createIntervalSubscribable,
  createSubscribable,
  mergeSubscribables,
  toAsyncIterable,
  type EmitterInitializer,
} from "./Subscribable"

describe("Subscribable", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("createSubscribable", () => {
    it("should create a subscribable object", () => {
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emit(42)
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      expect(subscribable).toBeDefined()
      expect(typeof subscribable.subscribe).toBe("function")
    })

    it("should call emitterInitializer when subscribed", () => {
      const mockEmitterInitializer = vi.fn<EmitterInitializer<number>>()
      const subscribable = createSubscribable(mockEmitterInitializer)

      expect(mockEmitterInitializer).not.toHaveBeenCalled()

      subscribable.subscribe(() => {})
      expect(mockEmitterInitializer).toHaveBeenCalledTimes(1)
    })

    it("should send values to subscribers", () => {
      const mockSubscriber = vi.fn()
      let emitFunction: (value: number) => void

      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      subscribable.subscribe(mockSubscriber)

      emitFunction!(123)
      expect(mockSubscriber).toHaveBeenCalledWith(123)
    })

    it("should support multiple subscribers", () => {
      const mockSubscriber1 = vi.fn()
      const mockSubscriber2 = vi.fn()

      let emitFunction: (value: string) => void

      const emitterInitializer: EmitterInitializer<string> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      subscribable.subscribe(mockSubscriber1)
      subscribable.subscribe(mockSubscriber2)

      emitFunction!("test")
      expect(mockSubscriber1).toHaveBeenCalledWith("test")
      expect(mockSubscriber2).toHaveBeenCalledWith("test")
    })

    it("should return subscription object with unsubscribe method", () => {
      const emitterInitializer: EmitterInitializer<number> = () => () => {}
      const subscribable = createSubscribable(emitterInitializer)

      const subscription = subscribable.subscribe(() => {})
      expect(subscription).toBeDefined()
      expect(typeof subscription.unsubscribe).toBe("function")
    })

    it("should stop receiving values after unsubscribing", () => {
      const mockSubscriber = vi.fn()
      let emitFunction: (value: number) => void

      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const subscription = subscribable.subscribe(mockSubscriber)

      emitFunction!(1)
      expect(mockSubscriber).toHaveBeenCalledWith(1)

      subscription.unsubscribe()
      mockSubscriber.mockClear()

      emitFunction!(2)
      expect(mockSubscriber).not.toHaveBeenCalled()
    })

    it("should call finalizer when all subscribers unsubscribe", () => {
      const mockFinalizer = vi.fn()
      const emitterInitializer: EmitterInitializer<number> = () => mockFinalizer

      const subscribable = createSubscribable(emitterInitializer)
      const subscription1 = subscribable.subscribe(() => {})
      const subscription2 = subscribable.subscribe(() => {})

      expect(mockFinalizer).not.toHaveBeenCalled()

      subscription1.unsubscribe()
      expect(mockFinalizer).not.toHaveBeenCalled()

      subscription2.unsubscribe()
      expect(mockFinalizer).toHaveBeenCalledTimes(1)
    })

    it("should handle cases without finalizer", () => {
      const emitterInitializer: EmitterInitializer<number> = () => undefined
      const subscribable = createSubscribable(emitterInitializer)
      const subscription = subscribable.subscribe(() => {})

      expect(() => subscription.unsubscribe()).not.toThrow()
    })

    it("should initialize emitterInitializer only once", () => {
      const mockEmitterInitializer = vi.fn(() => () => {})
      const subscribable = createSubscribable(mockEmitterInitializer)

      subscribable.subscribe(() => {})
      subscribable.subscribe(() => {})
      subscribable.subscribe(() => {})

      expect(mockEmitterInitializer).toHaveBeenCalledTimes(1)
    })
  })

  describe("createIntervalSubscribable", () => {
    it("should create an interval subscribable object", () => {
      const subscribable = createIntervalSubscribable(1000)
      expect(subscribable).toBeDefined()
      expect(typeof subscribable.subscribe).toBe("function")
    })

    it("should emit events at specified intervals", () => {
      const mockSubscriber = vi.fn()
      const subscribable = createIntervalSubscribable(1000)

      subscribable.subscribe(mockSubscriber)

      expect(mockSubscriber).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)
      expect(mockSubscriber).toHaveBeenCalledTimes(1)
      expect(mockSubscriber).toHaveBeenCalledWith({})

      vi.advanceTimersByTime(1000)
      expect(mockSubscriber).toHaveBeenCalledTimes(2)

      vi.advanceTimersByTime(2000)
      expect(mockSubscriber).toHaveBeenCalledTimes(4)
    })

    it("should clear timer after unsubscribing", () => {
      const mockSubscriber = vi.fn()
      const subscribable = createIntervalSubscribable(1000)
      const subscription = subscribable.subscribe(mockSubscriber)

      vi.advanceTimersByTime(1000)
      expect(mockSubscriber).toHaveBeenCalledTimes(1)

      subscription.unsubscribe()
      mockSubscriber.mockClear()

      vi.advanceTimersByTime(2000)
      expect(mockSubscriber).not.toHaveBeenCalled()
    })

    it("should support different interval times", () => {
      const mockSubscriber = vi.fn()
      const subscribable = createIntervalSubscribable(500)

      subscribable.subscribe(mockSubscriber)

      vi.advanceTimersByTime(500)
      expect(mockSubscriber).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(500)
      expect(mockSubscriber).toHaveBeenCalledTimes(2)
    })
  })

  describe("toAsyncIterable", () => {
    it("should convert Subscribable to AsyncIterable", () => {
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)

      expect(asyncIterable).toBeDefined()
      expect(typeof asyncIterable[Symbol.asyncIterator]).toBe("function")
    })

    it("should receive values through async iterator", async () => {
      vi.useRealTimers() // Use real timers in this test
      
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      const iterator = asyncIterable[Symbol.asyncIterator]()

      // Send values immediately
      setTimeout(() => emitFunction!(42), 0)
      const result1 = await iterator.next()
      expect(result1.value).toBe(42)
      expect(result1.done).toBe(false)

      // Send another value
      setTimeout(() => emitFunction!(84), 0)
      const result2 = await iterator.next()
      expect(result2.value).toBe(84)
      expect(result2.done).toBe(false)

      vi.useFakeTimers() // Restore fake timers
    })

    it("should handle multiple values in queue", async () => {
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      const iterator = asyncIterable[Symbol.asyncIterator]()

      // Send multiple values quickly
      emitFunction!(1)
      emitFunction!(2)
      emitFunction!(3)

      const result1 = await iterator.next()
      expect(result1.value).toBe(1)

      const result2 = await iterator.next()
      expect(result2.value).toBe(2)

      const result3 = await iterator.next()
      expect(result3.value).toBe(3)
    })

    it("should end iteration after calling return()", async () => {
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      const iterator = asyncIterable[Symbol.asyncIterator]()

      if (iterator.return) {
        const returnResult = await iterator.return()
        expect(returnResult.value).toBeUndefined()
        expect(returnResult.done).toBe(true)

        const nextResult = await iterator.next()
        expect(nextResult.done).toBe(true)
      }
    })

    it("should throw error after calling throw()", async () => {
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      const iterator = asyncIterable[Symbol.asyncIterator]()

      const error = new Error("test error")
      if (iterator.throw) {
        await expect(iterator.throw(error)).rejects.toThrow("test error")
      }
    })

    it("should unsubscribe after completion", async () => {
      const mockFinalizer = vi.fn()
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return mockFinalizer
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      const iterator = asyncIterable[Symbol.asyncIterator]()

      expect(mockFinalizer).not.toHaveBeenCalled()

      if (iterator.return) {
        await iterator.return()
        expect(mockFinalizer).toHaveBeenCalledTimes(1)
      }
    })

    it("should return itself as async iterator", () => {
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      const iterator = asyncIterable[Symbol.asyncIterator]()

      // Test that iterator implements Symbol.asyncIterator
      expect(typeof (iterator as any)[Symbol.asyncIterator]).toBe("function")
      expect((iterator as any)[Symbol.asyncIterator]()).toBe(iterator)
    })

    it("should work correctly in for await...of loops", async () => {
      vi.useRealTimers() // Use real timers
      
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      
      const receivedValues: number[] = []
      let iterationCount = 0
      const maxIterations = 3

      // Use for await...of loop
      const loopPromise = (async () => {
        for await (const value of asyncIterable) {
          receivedValues.push(value)
          iterationCount++
          
          // Limit iterations to avoid infinite loop
          if (iterationCount >= maxIterations) {
            break
          }
        }
      })()

      // Send some values
      setTimeout(() => emitFunction!(10), 10)
      setTimeout(() => emitFunction!(20), 20)
      setTimeout(() => emitFunction!(30), 30)

      // Wait for loop completion
      await loopPromise

      expect(receivedValues).toEqual([10, 20, 30])
      expect(iterationCount).toBe(3)

      vi.useFakeTimers() // Restore fake timers
    })

    it("should handle break correctly in for await...of loops", async () => {
      vi.useRealTimers() // Use real timers
      
      let emitFunction: (value: string) => void
      const mockFinalizer = vi.fn()
      const emitterInitializer: EmitterInitializer<string> = emit => {
        emitFunction = emit
        return mockFinalizer
      }

      const subscribable = createSubscribable(emitterInitializer)
      const asyncIterable = toAsyncIterable(subscribable)
      
      const receivedValues: string[] = []

      // Use for await...of loop and break on specific condition
      const loopPromise = (async () => {
        for await (const value of asyncIterable) {
          receivedValues.push(value)
          
          // Break loop when receiving "stop"
          if (value === "stop") {
            break
          }
        }
      })()

      // Send some values
      setTimeout(() => emitFunction!("first"), 10)
      setTimeout(() => emitFunction!("second"), 20)
      setTimeout(() => emitFunction!("stop"), 30)
      setTimeout(() => emitFunction!("should-not-receive"), 40)

      // Wait for loop completion
      await loopPromise

      expect(receivedValues).toEqual(["first", "second", "stop"])
      // Verify finalizer is called (break triggers cleanup)
      expect(mockFinalizer).toHaveBeenCalledTimes(1)

      vi.useFakeTimers() // Restore fake timers
    })
  })

  describe("mergeSubscribables", () => {
    it("should create a merged subscribable", () => {
      let emitFunction1: (value: number) => void
      let emitFunction2: (value: number) => void

      const subscribable1 = createSubscribable<number>(emit => {
        emitFunction1 = emit
        return () => {}
      })

      const subscribable2 = createSubscribable<number>(emit => {
        emitFunction2 = emit
        return () => {}
      })

      const merged = mergeSubscribables([subscribable1, subscribable2])
      expect(merged).toBeDefined()
      expect(typeof merged.subscribe).toBe("function")
    })

    it("should emit values from all sources", () => {
      const mockSubscriber = vi.fn()
      let emitFunction1: (value: string) => void
      let emitFunction2: (value: string) => void

      const subscribable1 = createSubscribable<string>(emit => {
        emitFunction1 = emit
        return () => {}
      })

      const subscribable2 = createSubscribable<string>(emit => {
        emitFunction2 = emit
        return () => {}
      })

      const merged = mergeSubscribables([subscribable1, subscribable2])
      merged.subscribe(mockSubscriber)

      emitFunction1!("hello")
      emitFunction2!("world")

      expect(mockSubscriber).toHaveBeenCalledWith("hello")
      expect(mockSubscriber).toHaveBeenCalledWith("world")
      expect(mockSubscriber).toHaveBeenCalledTimes(2)
    })

    it("should handle empty array", () => {
      const merged = mergeSubscribables<number>([])
      const mockSubscriber = vi.fn()

      merged.subscribe(mockSubscriber)
      expect(mockSubscriber).not.toHaveBeenCalled()
    })

    it("should unsubscribe from all sources", () => {
      const mockFinalizer1 = vi.fn()
      const mockFinalizer2 = vi.fn()

      const subscribable1 = createSubscribable<number>(() => mockFinalizer1)
      const subscribable2 = createSubscribable<number>(() => mockFinalizer2)

      const merged = mergeSubscribables([subscribable1, subscribable2])
      const subscription = merged.subscribe(() => {})

      subscription.unsubscribe()

      expect(mockFinalizer1).toHaveBeenCalledTimes(1)
      expect(mockFinalizer2).toHaveBeenCalledTimes(1)
    })
  })

  describe("edge cases and error handling", () => {
    it("should handle errors in subscribers", () => {
      const mockSubscriber1 = vi.fn()
      const mockSubscriber2 = vi.fn(() => {
        throw new Error("subscriber error")
      })
      const mockSubscriber3 = vi.fn()

      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      subscribable.subscribe(mockSubscriber1)
      subscribable.subscribe(mockSubscriber2)
      subscribable.subscribe(mockSubscriber3)

      // Should not affect other subscribers due to one subscriber's error
      expect(() => emitFunction!(42)).toThrow("subscriber error")
      expect(mockSubscriber1).toHaveBeenCalledWith(42)
      expect(mockSubscriber3).not.toHaveBeenCalled() // Subsequent subscribers may not be called due to error
    })

    it("should handle repeated unsubscription", () => {
      const emitterInitializer: EmitterInitializer<number> = () => () => {}
      const subscribable = createSubscribable(emitterInitializer)
      const subscription = subscribable.subscribe(() => {})

      expect(() => {
        subscription.unsubscribe()
        subscription.unsubscribe()
        subscription.unsubscribe()
      }).not.toThrow()
    })

    it("should handle empty subscriber list", () => {
      let emitFunction: (value: number) => void
      const emitterInitializer: EmitterInitializer<number> = emit => {
        emitFunction = emit
        return () => {}
      }

      const subscribable = createSubscribable(emitterInitializer)
      const subscription = subscribable.subscribe(() => {})
      subscription.unsubscribe()

      // Sending values with no subscribers should not cause errors
      expect(() => emitFunction!(42)).not.toThrow()
    })
  })
})