export function entries<T>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj as any) as [keyof T, T[keyof T]][]
}
export function fromEntries<T>(entries: [keyof T, T[keyof T]][]): T {
  return Object.fromEntries(entries) as T
}

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, obj[key]])) as Pick<T, K>
}

export function keys<T>(obj: T): (keyof T)[] {
  return Object.keys(obj as any) as (keyof T)[]
}