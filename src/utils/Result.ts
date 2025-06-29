export type Result<TOK, TError> = Result.OK<TOK> | Result.Error<TError>

export namespace Result {
  export interface OK<T> {
    type: "ok"
    payload: T
  }

  export interface Error<T> {
    type: "error"
    payload: T
  }

  export const isResult = <TOK, TErr>(
    input: any,
  ): input is Result<TOK, TErr> => {
    if (input == null) return false
    if (typeof input !== "object") return false
    if (input.type !== "ok" && input.type !== "error") return false
    if (!("payload" in input)) return false
    return true
  }

  export function ok(): Result.OK<void>
  export function ok<const TOK>(payload: TOK): Result.OK<TOK>
  export function ok<const TOK>(payload?: TOK): Result.OK<TOK> {
    return {
      type: "ok",
      payload: payload as TOK,
    }
  }

  export function error(): Result.Error<void>
  export function error<const TError>(payload: TError): Result.Error<TError>
  export function error<const TError>(payload?: TError): Result.Error<TError> {
    return {
      type: "error",
      payload: payload as TError,
    }
  }

  export const maybeValue = <TOK, TError>(
    res: Result<TOK, TError>,
  ): undefined | TOK => {
    if (res.type === "ok") return res.payload
    return
  }

  export const maybeError = <TOK, TError>(
    res: Result<TOK, TError>,
  ): undefined | TError => {
    if (res.type === "error") return res.payload
    return
  }

  export const encase = <TOK, TError = unknown>(
    fn: () => TOK,
  ): Result<TOK, TError> => {
    try {
      return ok(fn())
    } catch (e: unknown) {
      return error(e) as any
    }
  }
  export function encaseMaybeValue<TOK>(fn: () => TOK): undefined | TOK
  export function encaseMaybeValue<TOK, TFallback>(
    fallbackValue: TFallback,
    fn: () => TOK,
  ): TOK | TFallback
  export function encaseMaybeValue<TOK, TFallback>(
    ...args: [fallbackValue: TFallback, fn: () => TOK] | [fn: () => TOK]
  ): undefined | TOK | TFallback {
    const [fallbackValue, fn] = args.length === 1 ? [undefined, args[0]] : args
    const res = encase(fn)
    return res.type === "ok" ? res.payload : fallbackValue
  }

  interface CurriedMapFn {
    <TOKInput, TOKOutput, TError>(
      mapping: (payload: TOKInput) => TOKOutput,
    ): (res: Result<TOKInput, TError>) => Result<TOKOutput, TError>
    <TOKInput, TOKOutput, TError>(
      mapping: (payload: TOKInput) => TOKOutput,
      res: Result<TOKInput, TError>,
    ): Result<TOKOutput, TError>
  }
  export const map: CurriedMapFn = <TOKInput, TOKOutput, TError>(
    mapping: (payload: TOKInput) => TOKOutput,
    res?: Result<TOKInput, TError>,
  ): any => {
    if (res == null) {
      return (res: Result<TOKInput, TError>) => realMap(mapping, res)
    } else {
      return realMap(mapping, res)
    }

    function realMap(
      mapping: (payload: TOKInput) => TOKOutput,
      res: Result<TOKInput, TError>,
    ): Result<TOKOutput, TError> {
      if (res.type === "error") return res
      return Result.ok(mapping(res.payload))
    }
  }

  interface CurriedChainErrorFn {
    <TOKInput, TErrorInput, TOKOutput, TErrorOutput>(
      mapping: (payload: TErrorInput) => Result<TOKOutput, TErrorOutput>,
    ): (
      res: Result<TOKInput, TErrorInput>,
    ) => Result<TOKInput | TOKOutput, TErrorOutput>
    <TOKInput, TErrorInput, TOKOutput, TErrorOutput>(
      mapping: (payload: TErrorInput) => Result<TOKOutput, TErrorOutput>,
      res: Result<TOKInput, TErrorInput>,
    ): Result<TOKInput | TOKOutput, TErrorOutput>
  }
  export const chainError: CurriedChainErrorFn = <
    TOKInput,
    TErrorInput,
    TOKOutput,
    TErrorOutput,
  >(
    chainFn: (payload: TErrorInput) => Result<TOKOutput, TErrorOutput>,
    res?: Result<TOKInput, TErrorInput>,
  ): any => {
    if (res == null) {
      return (res: Result<TOKInput, TErrorInput>) =>
        realChainError(chainFn, res)
    } else {
      return realChainError(chainFn, res)
    }

    function realChainError(
      chainFn: (payload: TErrorInput) => Result<TOKOutput, TErrorOutput>,
      res: Result<TOKInput, TErrorInput>,
    ): Result<TOKInput | TOKOutput, TErrorOutput> {
      if (res.type !== "error") return res
      return chainFn(res.payload)
    }
  }

  interface CurriedFlatMapFn {
    <TOKInput, TErrorInput, TOKOutput, TErrorOutput>(
      mapping: (payload: TOKInput) => Result<TOKOutput, TErrorOutput>,
    ): (
      res: Result<TOKInput, TErrorInput>,
    ) => Result<TOKOutput, TErrorInput | TErrorOutput>
    <TOKInput, TErrorInput, TOKOutput, TErrorOutput>(
      mapping: (payload: TOKInput) => Result<TOKOutput, TErrorOutput>,
      res: Result<TOKInput, TErrorInput | TErrorInput>,
    ): Result<TOKOutput, TErrorOutput>
  }
  export const flatMap: CurriedFlatMapFn = <
    TOKInput,
    TErrorInput,
    TOKOutput,
    TErrorOutput,
  >(
    mapping: (payload: TOKInput) => Result<TOKOutput, TErrorOutput>,
    res?: Result<TOKInput, TErrorInput>,
  ): any => {
    if (res == null) {
      return (res: Result<TOKInput, TErrorInput>) => realMap(mapping, res)
    } else {
      return realMap(mapping, res)
    }

    function realMap(
      mapping: (payload: TOKInput) => Result<TOKOutput, TErrorOutput>,
      res: Result<TOKInput, TErrorInput>,
    ): Result<TOKOutput, TErrorInput | TErrorOutput> {
      if (res.type === "error") return res
      return mapping(res.payload)
    }
  }
  export const chainOk = flatMap
}
