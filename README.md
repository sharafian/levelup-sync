# Levelup Sync
> Provides a synchronous interface for levelup (using a cache) to avoid race conditions.

Race conditions are an easy pitfall to fall into.

```js
const levelup = require('levelup')
const leveldown = require('leveldown')

const db = levelup(leveldown('./my-database'))

// There's a race condition in this function because we do an asynchronous get,
// increment in memory, and then do an asynchronous put. If more than one call
// to badIncrementBalance is in progress then:
//
// - badIncrementBalance 1 reads from the store and gets "0"
// - badIncrementBalance 1 increments "0" to "10" and begins to write
// - badIncrementBalance 2 reads from the store and gets "0"
// - badIncrementBalance 2 increments "0" to "10" and begins to write
// - badIncrementBalance 1 finishes writing "10" to the store
// - badIncrementBalance 2 finishes writing "10" to the store

async function badIncrementBalance (amount) {
  const balance = await db.get('balance')
  const newBalance = Number(balance) + amount

  await db.put('balance', String(newBalance))
}

async function run () {
  await db.put('balance', '0')

  await Promise.all([
    badIncrementBalance(10),
    badIncrementBalance(10)
  ])

  const finalValue = await db.get('balance')
  console.log('final value:', finalValue.toString())
}

run()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
```

But using a synchronous interface prevents this kind of error. Levelup sync
will provide a synchronous interface to your store, while still queuing all the
writes you make in the background to minimize potential for data loss.

`load` is called before any synchronous operations are performed, to make sure
we start with the latest value from the store. It's also possible to `free` a
key, which will wait for all writes to complete (while preventing new
synchronous writes), and then erase it from the cache.

```js
const levelup = require('levelup')
const leveldown = require('leveldown')
const { LevelupSync } = require('..')

const db = levelup(leveldown('./my-database'))
const syncDb = new LevelupSync(db)

function goodIncrementBalance (amount) {
  const balance = syncDb.getSync('balance')
  const newBalance = Number(balance) + amount

  syncDb.putSync('balance', String(newBalance))
}

async function run () {
  await syncDb.load('balance')
  syncDb.putSync('balance', '0')

  goodIncrementBalance(10)
  goodIncrementBalance(10)

  const finalValue = syncDb.getSync('balance')
  console.log('final value:', finalValue)
}

run()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
```
