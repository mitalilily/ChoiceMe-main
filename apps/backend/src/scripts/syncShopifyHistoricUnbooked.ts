import { syncShopifyOrdersForUser } from '../models/services/shopify.service'

const getArg = (name: string, fallback = '') => {
  const prefix = `--${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))
  return value ? value.slice(prefix.length).trim() : fallback
}

const userId = getArg('user-id')
const storeId = getArg('store-id')
const days = Math.max(Number(getArg('days', '20')) || 20, 1)

if (!userId || !storeId) {
  throw new Error('Usage: tsx src/scripts/syncShopifyHistoricUnbooked.ts --user-id=<id> --store-id=<id> [--days=20]')
}

const createdAtMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
const result = await syncShopifyOrdersForUser(userId, 5000, storeId, undefined, {
  createdAtMin,
  onlyUnbooked: true,
})

console.log(JSON.stringify({ userId, storeId, days, createdAtMin, ...result }, null, 2))
