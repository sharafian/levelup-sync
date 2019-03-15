import { LevelUp } from 'levelup'

interface LevelupCacheItem<T> {
  value?: T,
  freeing?: boolean,
  writePromise?: Promise<void>,
  queuedWriteCallback?: () => Promise<void>
}

export class LevelupSync<T> {
  private db: LevelUp
  private cache: {
    [key: string]: LevelupCacheItem<T>
  }

  constructor (db: LevelUp) {
    this.db = db
    this.cache = {}
  }

  async load (key: string): Promise<void> {
    try {
      const value = await this.db.get(key)
      this.cache[key] = { value }
    } catch (e) {
      if (e.name === 'NotFoundError') {
        this.cache[key] = {}
      } else {
        throw e
      }
    }
  }

  async free (key: string): Promise<void> {
    const item = this.cache[key]

    if (!item) {
      return
    }

    item.freeing = true

    if (item.writePromise) {
      if (item.queuedWriteCallback) {
        await item.writePromise
      }
      await item.writePromise
    }

    delete this.cache[key]
  }

  _getCacheItem (key: string): LevelupCacheItem<T> {
    const item = this.cache[key]

    if (!item) {
      throw new Error('item is not in cache. key=' + key)
    }

    if (item.freeing) {
      throw new Error('item is being freed. key=' + key)
    }

    return item
  }

  // TODO: should this throw an error if not found?
  getSync (key: string): T | undefined {
    return this._getCacheItem(key).value
  }

  putSync (key: string, value: T): void {
    const item = this._getCacheItem(key)
    item.value = value

    if (!item.writePromise) {
      item.writePromise = this.db.put(key, value)
        .then(this._moveQueueCallback.bind(this, item))
    } else {
      item.queuedWriteCallback = (() => this.db.put(key, value))
    }
  }

  delSync (key: string): void {
    const item = this._getCacheItem(key)
    delete item.value

    if (!item.writePromise) {
      item.writePromise = this.db.del(key)
        .then(this._moveQueueCallback.bind(this, item))
    } else {
      item.queuedWriteCallback = (() => this.db.del(key))
    }
  }

  _moveQueueCallback (item: LevelupCacheItem<T>): Promise<void> {
    if (item.queuedWriteCallback) {
      item.writePromise = item.queuedWriteCallback()
        .then(this._moveQueueCallback.bind(this, item))

      delete item.queuedWriteCallback
      return item.writePromise
    } else {
      delete item.writePromise
      return Promise.resolve()
    }
  }

  getLevelUp (): LevelUp {
    return this.db
  }
}
