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
  console.log('got balance', balance.toString())

  const newBalance = Number(balance) + amount
  console.log('writing new balance', newBalance)
  
  await db.put('balance', String(newBalance))
  console.log('wrote new balance', newBalance)
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
