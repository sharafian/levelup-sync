const levelup = require('levelup')
const leveldown = require('leveldown')
const { LevelupSync } = require('..')

const db = levelup(leveldown('./my-database'))
const syncDb = new LevelupSync(db)

function goodIncrementBalance (amount) {
  const balance = syncDb.getSync('balance')
  console.log('got balance', balance)

  const newBalance = Number(balance) + amount
  console.log('writing new balance', newBalance)

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
