import { pool } from '../models/client'
import type { PoolClient } from 'pg'

const LEGACY_PROVIDER_KEYS = ['delhivery', 'ekart', 'ekartlogistics'] as const
const DELIVERY_ONE_PROVIDER = 'deliveryone'
const DELIVERY_ONE_SURFACE_ID = 99
const DELIVERY_ONE_EXPRESS_ID = 100

const dryRun =
  process.argv.includes('--dry-run') ||
  ['1', 'true', 'yes'].includes(
    String(process.env.PURGE_LEGACY_COURIERS_DRY_RUN || '').trim().toLowerCase(),
  )

const confirmed =
  process.argv.includes('--confirm') ||
  ['1', 'true', 'yes'].includes(
    String(process.env.PURGE_LEGACY_COURIERS_CONFIRM || '').trim().toLowerCase(),
  )

const compactSql = (expression: string) =>
  `lower(regexp_replace(trim(coalesce(${expression}, '')), '[[:space:]_-]+', '', 'g'))`

const modeSql = (expression: string) => `
  case
    when lower(trim(coalesce(${expression}, ''))) in ('air', 'a', 'express', 'e') then 'air'
    when lower(trim(coalesce(${expression}, ''))) in ('surface', 's', 'ground') then 'surface'
    else lower(trim(coalesce(${expression}, '')))
  end
`

const legacyProviderListSql = LEGACY_PROVIDER_KEYS.map((key) => `'${key}'`).join(', ')

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`
const publicTable = (tableName: string) => `public.${quoteIdentifier(tableName)}`

type StepSummary = {
  step: string
  affected: number
  skipped?: boolean
}

const tableExists = async (client: PoolClient, tableName: string) => {
  const result = await client.query<{ exists: boolean }>(
    `select to_regclass($1) is not null as exists`,
    [`public.${tableName}`],
  )
  return Boolean(result.rows[0]?.exists)
}

const runStep = async (
  client: PoolClient,
  summaries: StepSummary[],
  step: string,
  query: string,
  params: unknown[] = [],
) => {
  const result = await client.query(query, params)
  summaries.push({ step, affected: result.rowCount ?? 0 })
  return result.rowCount ?? 0
}

const deleteFromOptionalTable = async (
  client: PoolClient,
  summaries: StepSummary[],
  tableName: string,
  whereSql: string,
) => {
  if (!(await tableExists(client, tableName))) {
    summaries.push({ step: `delete ${tableName}`, affected: 0, skipped: true })
    return 0
  }

  return runStep(
    client,
    summaries,
    `delete ${tableName}`,
    `delete from ${publicTable(tableName)} where ${whereSql}`,
  )
}

const migratableDelhiveryRateRowsSql = `
  select
    sr.id,
    sr.plan_id,
    sr.business_type,
    sr.zone_id,
    sr.type,
    sr.courier_id,
    case
      when sr.courier_id = ${DELIVERY_ONE_EXPRESS_ID}
        or lower(coalesce(sr.courier_name, '')) like '%express%'
        or ${modeSql('sr.mode')} = 'air'
      then 'air'
      else 'surface'
    end as target_mode,
    case
      when sr.courier_id = ${DELIVERY_ONE_EXPRESS_ID}
        or lower(coalesce(sr.courier_name, '')) like '%express%'
        or ${modeSql('sr.mode')} = 'air'
      then 'Delhivery Express'
      else 'Delhivery Surface'
    end as target_name
  from shipping_rates sr
  where sr.courier_id in (${DELIVERY_ONE_SURFACE_ID}, ${DELIVERY_ONE_EXPRESS_ID})
    and (
      ${compactSql('sr.service_provider')} = 'delhivery'
      or (
        ${compactSql('sr.service_provider')} = ''
        and lower(coalesce(sr.courier_name, '')) like '%delhivery%'
      )
    )
`

const duplicateMigratableRateRowsSql = `
  with candidates as (
    ${migratableDelhiveryRateRowsSql}
  )
  select c.id
  from candidates c
  where exists (
    select 1
    from shipping_rates keep
    where keep.id <> c.id
      and keep.plan_id = c.plan_id
      and keep.business_type = c.business_type
      and keep.zone_id = c.zone_id
      and keep.type = c.type
      and keep.courier_id = c.courier_id
      and ${compactSql('keep.service_provider')} in ('deliveryone', 'delhiveryone', 'delivery1')
      and ${modeSql('keep.mode')} = c.target_mode
  )
`

const residualLegacyRateWhereSql = `
  ${compactSql('service_provider')} in (${legacyProviderListSql})
  or (
    ${compactSql('service_provider')} = ''
    and lower(coalesce(courier_name, '')) like '%ekart%'
  )
  or (
    ${compactSql('service_provider')} = ''
    and lower(coalesce(courier_name, '')) like '%delhivery%'
    and courier_id not in (${DELIVERY_ONE_SURFACE_ID}, ${DELIVERY_ONE_EXPRESS_ID})
  )
`

const countOptionalTable = async (client: PoolClient, tableName: string, whereSql: string) => {
  if (!(await tableExists(client, tableName))) return 0
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count from ${publicTable(tableName)} where ${whereSql}`,
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function main() {
  if (!dryRun && !confirmed) {
    throw new Error(
      'Refusing to purge without confirmation. Re-run with --confirm or PURGE_LEGACY_COURIERS_CONFIRM=true. Use --dry-run to preview.',
    )
  }

  const client = await pool.connect()
  const summaries: StepSummary[] = []

  try {
    await client.query('begin')

    await runStep(
      client,
      summaries,
      'ensure deliveryone couriers',
      `
        with seeds(id, name, mode) as (
          values
            (${DELIVERY_ONE_SURFACE_ID}, 'Delhivery Surface', 'surface'),
            (${DELIVERY_ONE_EXPRESS_ID}, 'Delhivery Express', 'air')
        )
        insert into couriers (
          id,
          name,
          "serviceProvider",
          "isEnabled",
          business_type,
          created_at,
          updated_at
        )
        select
          id,
          name,
          '${DELIVERY_ONE_PROVIDER}',
          true,
          '["b2c"]'::jsonb,
          now(),
          now()
        from seeds
        on conflict (id, "serviceProvider") do update
        set
          name = excluded.name,
          "isEnabled" = true,
          business_type = case
            when couriers.business_type @> '["b2c"]'::jsonb then couriers.business_type
            else couriers.business_type || '["b2c"]'::jsonb
          end,
          updated_at = now()
        returning 1
      `,
    )

    await runStep(
      client,
      summaries,
      'copy plain delhivery credentials to deliveryone when needed',
      `
        insert into courier_credentials (
          provider,
          api_base,
          client_name,
          api_key,
          client_id,
          username,
          password,
          webhook_secret,
          created_at,
          updated_at
        )
        select
          '${DELIVERY_ONE_PROVIDER}',
          source.api_base,
          source.client_name,
          source.api_key,
          source.client_id,
          source.username,
          source.password,
          source.webhook_secret,
          now(),
          now()
        from courier_credentials source
        where ${compactSql('source.provider')} = 'delhivery'
          and not exists (
            select 1
            from courier_credentials existing
            where ${compactSql('existing.provider')} = '${DELIVERY_ONE_PROVIDER}'
          )
        limit 1
        on conflict (provider) do nothing
      `,
    )

    await runStep(
      client,
      summaries,
      'backfill missing deliveryone credential fields',
      `
        update courier_credentials target
        set
          api_base = coalesce(nullif(target.api_base, ''), source.api_base),
          client_name = coalesce(nullif(target.client_name, ''), source.client_name),
          api_key = coalesce(nullif(target.api_key, ''), source.api_key),
          client_id = coalesce(nullif(target.client_id, ''), source.client_id),
          username = coalesce(nullif(target.username, ''), source.username),
          password = coalesce(nullif(target.password, ''), source.password),
          webhook_secret = coalesce(nullif(target.webhook_secret, ''), source.webhook_secret),
          updated_at = now()
        from courier_credentials source
        where ${compactSql('target.provider')} = '${DELIVERY_ONE_PROVIDER}'
          and ${compactSql('source.provider')} = 'delhivery'
      `,
    )

    await runStep(
      client,
      summaries,
      'delete duplicate migrated COD slabs',
      `
        delete from shipping_rate_cod_slabs
        where shipping_rate_id in (${duplicateMigratableRateRowsSql})
      `,
    )

    await runStep(
      client,
      summaries,
      'delete duplicate migrated weight slabs',
      `
        delete from shipping_rate_slabs
        where shipping_rate_id in (${duplicateMigratableRateRowsSql})
      `,
    )

    await runStep(
      client,
      summaries,
      'delete duplicate plain delhivery rates',
      `
        delete from shipping_rates
        where id in (${duplicateMigratableRateRowsSql})
      `,
    )

    await runStep(
      client,
      summaries,
      'migrate usable plain delhivery rates to deliveryone',
      `
        with candidates as (
          ${migratableDelhiveryRateRowsSql}
        )
        update shipping_rates sr
        set
          service_provider = '${DELIVERY_ONE_PROVIDER}',
          courier_name = candidates.target_name,
          mode = candidates.target_mode,
          last_updated = now()
        from candidates
        where sr.id = candidates.id
        returning 1
      `,
    )

    await runStep(
      client,
      summaries,
      'delete residual legacy COD slabs',
      `
        delete from shipping_rate_cod_slabs
        where shipping_rate_id in (
          select id from shipping_rates where ${residualLegacyRateWhereSql}
        )
      `,
    )

    await runStep(
      client,
      summaries,
      'delete residual legacy weight slabs',
      `
        delete from shipping_rate_slabs
        where shipping_rate_id in (
          select id from shipping_rates where ${residualLegacyRateWhereSql}
        )
      `,
    )

    await runStep(
      client,
      summaries,
      'delete residual legacy shipping rates',
      `
        delete from shipping_rates
        where ${residualLegacyRateWhereSql}
      `,
    )

    const serviceProviderLegacyWhere = `${compactSql('service_provider')} in (${legacyProviderListSql})`
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_pincodes',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_zone_to_zone_rates',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_zone_regions',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_overhead_rules',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_zone_states',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_additional_charges',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_b2b_volumetric_rules',
      serviceProviderLegacyWhere,
    )
    await deleteFromOptionalTable(
      client,
      summaries,
      'meracourierwala_holidays',
      serviceProviderLegacyWhere,
    )

    await runStep(
      client,
      summaries,
      'delete legacy courier credentials',
      `
        delete from courier_credentials
        where ${compactSql('provider')} in (${legacyProviderListSql})
      `,
    )

    await runStep(
      client,
      summaries,
      'delete legacy courier rows',
      `
        delete from couriers
        where ${compactSql('"serviceProvider"')} in (${legacyProviderListSql})
      `,
    )

    const remaining = {
      couriers: await countOptionalTable(
        client,
        'couriers',
        `${compactSql('"serviceProvider"')} in (${legacyProviderListSql})`,
      ),
      courierCredentials: await countOptionalTable(
        client,
        'courier_credentials',
        `${compactSql('provider')} in (${legacyProviderListSql})`,
      ),
      shippingRates: await countOptionalTable(client, 'shipping_rates', residualLegacyRateWhereSql),
      b2bPincodes: await countOptionalTable(
        client,
        'meracourierwala_b2b_pincodes',
        serviceProviderLegacyWhere,
      ),
      b2bZoneToZoneRates: await countOptionalTable(
        client,
        'meracourierwala_b2b_zone_to_zone_rates',
        serviceProviderLegacyWhere,
      ),
      holidays: await countOptionalTable(
        client,
        'meracourierwala_holidays',
        serviceProviderLegacyWhere,
      ),
    }

    const deliveryOne = {
      couriers: await countOptionalTable(
        client,
        'couriers',
        `${compactSql('"serviceProvider"')} = '${DELIVERY_ONE_PROVIDER}'`,
      ),
      shippingRates: await countOptionalTable(
        client,
        'shipping_rates',
        `${compactSql('service_provider')} = '${DELIVERY_ONE_PROVIDER}'`,
      ),
      credentials: await countOptionalTable(
        client,
        'courier_credentials',
        `${compactSql('provider')} = '${DELIVERY_ONE_PROVIDER}'`,
      ),
    }

    if (dryRun) {
      await client.query('rollback')
    } else {
      await client.query('commit')
    }

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? 'dry-run rolled back' : 'committed',
          summaries,
          remainingLegacyConfig: remaining,
          deliveryOneConfig: deliveryOne,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
