CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_data_migrations (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  v_basic_plan_id uuid;
  v_premium_plan_id uuid;
  v_zone record;
  v_plan record;
  v_courier record;
  v_rate_id uuid;
  v_is_kashmir boolean;
  v_slab_rates numeric[];
  v_extra_rate numeric(10, 2);
  v_extra_weight_unit numeric(10, 3);
  v_slab_index integer;
  v_weight_froms numeric[] := ARRAY[0.100, 0.500, 1.000, 2.000, 3.000, 4.000];
  v_weight_tos numeric[] := ARRAY[0.500, 1.000, 2.000, 3.000, 4.000, 5.000];
  v_rate_type text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app_data_migrations
    WHERE key = 'seed_basic_premium_kashmir_b2c_rates_v3'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_basic_plan_id
  FROM plans
  WHERE lower(trim(name)) = 'basic'
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_basic_plan_id IS NULL THEN
    INSERT INTO plans (id, name, description, is_active, created_at)
    VALUES (gen_random_uuid(), 'Basic', 'Default B2C plan', true, now())
    RETURNING id INTO v_basic_plan_id;
  END IF;

  SELECT id INTO v_premium_plan_id
  FROM plans
  WHERE lower(trim(name)) = 'premium'
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  IF v_premium_plan_id IS NULL THEN
    INSERT INTO plans (id, name, description, is_active, created_at)
    VALUES (gen_random_uuid(), 'Premium', 'Premium B2C plan', true, now())
    RETURNING id INTO v_premium_plan_id;
  END IF;

  INSERT INTO couriers (id, name, "serviceProvider", "isEnabled", business_type, created_at, updated_at)
  VALUES
    (100, 'Delhivery Metro Air', 'delhivery', true, '["b2c"]'::jsonb, now(), now()),
    (99, 'Delhivery Metro Surface', 'delhivery', true, '["b2c"]'::jsonb, now(), now())
  ON CONFLICT (id, "serviceProvider") DO UPDATE SET
    name = EXCLUDED.name,
    "isEnabled" = true,
    business_type = EXCLUDED.business_type,
    updated_at = now();

  INSERT INTO meracourierwala_zones
    (id, code, name, description, region, business_type, metadata, states, created_at, updated_at)
  VALUES
    (
      gen_random_uuid(),
      'KASHMIR',
      'Kashmir',
      'Jammu and Kashmir / Ladakh-only B2C pricing zone.',
      'Kashmir',
      'B2C',
      '{"source":"basic-premium-kashmir-rate-seed-v3"}'::jsonb,
      '["JAMMU AND KASHMIR", "LADAKH"]'::jsonb,
      now(),
      now()
    )
  ON CONFLICT (code, business_type) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    region = EXCLUDED.region,
    metadata = EXCLUDED.metadata,
    states = EXCLUDED.states,
    updated_at = now();

  DELETE FROM shipping_rate_cod_slabs
  WHERE shipping_rate_id IN (
    SELECT sr.id
    FROM shipping_rates sr
    INNER JOIN meracourierwala_zones z ON z.id = sr.zone_id
    WHERE lower(trim(sr.business_type)) = 'b2c'
      AND sr.plan_id IN (v_basic_plan_id, v_premium_plan_id)
      AND sr.courier_id IN (99, 100)
      AND lower(coalesce(sr.service_provider, '')) = 'delhivery'
      AND (
        lower(trim(z.code)) IN ('kashmir', 'special zone', 'special_zone')
        OR lower(trim(z.name)) IN ('kashmir', 'special zone')
      )
  );

  DELETE FROM shipping_rate_slabs
  WHERE shipping_rate_id IN (
    SELECT sr.id
    FROM shipping_rates sr
    INNER JOIN meracourierwala_zones z ON z.id = sr.zone_id
    WHERE lower(trim(sr.business_type)) = 'b2c'
      AND sr.plan_id IN (v_basic_plan_id, v_premium_plan_id)
      AND sr.courier_id IN (99, 100)
      AND lower(coalesce(sr.service_provider, '')) = 'delhivery'
      AND (
        lower(trim(z.code)) IN ('kashmir', 'special zone', 'special_zone')
        OR lower(trim(z.name)) IN ('kashmir', 'special zone')
      )
  );

  DELETE FROM shipping_rates sr
  USING meracourierwala_zones z
  WHERE z.id = sr.zone_id
    AND lower(trim(sr.business_type)) = 'b2c'
    AND sr.plan_id IN (v_basic_plan_id, v_premium_plan_id)
    AND sr.courier_id IN (99, 100)
    AND lower(coalesce(sr.service_provider, '')) = 'delhivery'
    AND (
      lower(trim(z.code)) IN ('kashmir', 'special zone', 'special_zone')
      OR lower(trim(z.name)) IN ('kashmir', 'special zone')
    );

  FOR v_plan IN
    SELECT v_basic_plan_id AS id, 'Basic' AS name
    UNION ALL
    SELECT v_premium_plan_id AS id, 'Premium' AS name
  LOOP
    FOR v_zone IN
      SELECT id, code, name
      FROM meracourierwala_zones
      WHERE lower(trim(business_type)) = 'b2c'
        AND (
          lower(trim(code)) IN ('kashmir', 'special zone', 'special_zone')
          OR lower(trim(name)) IN ('kashmir', 'special zone')
        )
    LOOP
      v_is_kashmir :=
        lower(trim(v_zone.code)) = 'kashmir'
        OR lower(trim(v_zone.name)) = 'kashmir';

      FOR v_courier IN
        SELECT 100 AS id, 'Delhivery Metro Air' AS name, 'air' AS mode
        UNION ALL
        SELECT 99 AS id, 'Delhivery Metro Surface' AS name, 'surface' AS mode
      LOOP
        IF v_is_kashmir THEN
          IF v_plan.name = 'Premium' THEN
            v_slab_rates := ARRAY[70.00, 85.00, 115.00, 165.00, 200.00, 225.00];
            v_extra_rate := 25.00;
            v_extra_weight_unit := 2.000;
          ELSE
            v_slab_rates := ARRAY[80.00, 100.00, 150.00, 200.00, 230.00, 260.00];
            v_extra_rate := 20.00;
            v_extra_weight_unit := 1.000;
          END IF;
        ELSE
          IF v_courier.mode = 'air' THEN
            v_slab_rates := ARRAY[110.00, 150.00, 230.00, 300.00, 400.00, 500.00];
            v_extra_rate := 50.00;
            v_extra_weight_unit := 1.000;
          ELSIF v_plan.name = 'Premium' THEN
            v_slab_rates := ARRAY[85.00, 115.00, 180.00, 250.00, 300.00, 360.00];
            v_extra_rate := 40.00;
            v_extra_weight_unit := 1.000;
          ELSE
            v_slab_rates := ARRAY[95.00, 140.00, 195.00, 260.00, 320.00, 380.00];
            v_extra_rate := 50.00;
            v_extra_weight_unit := 1.000;
          END IF;
        END IF;

        FOR v_rate_type IN SELECT 'forward' UNION ALL SELECT 'rto'
        LOOP
          v_rate_id := gen_random_uuid();

          INSERT INTO shipping_rates
            (
              id,
              plan_id,
              service_provider,
              cod_charges,
              cod_percent,
              other_charges,
              rate,
              last_updated,
              courier_id,
              courier_name,
              mode,
              business_type,
              min_weight,
              zone_id,
              type,
              created_at
            )
          VALUES
            (
              v_rate_id,
              v_plan.id,
              'delhivery',
              40.00,
              2.00,
              18.00,
              v_slab_rates[1],
              now(),
              v_courier.id,
              v_courier.name,
              v_courier.mode,
              'b2c',
              0.50,
              v_zone.id,
              v_rate_type,
              now()
            );

          FOR v_slab_index IN 1..array_length(v_slab_rates, 1)
          LOOP
            INSERT INTO shipping_rate_slabs
              (
                id,
                shipping_rate_id,
                weight_from,
                weight_to,
                rate,
                extra_rate,
                extra_weight_unit,
                created_at,
                updated_at
              )
            VALUES
              (
                gen_random_uuid(),
                v_rate_id,
                v_weight_froms[v_slab_index],
                v_weight_tos[v_slab_index],
                v_slab_rates[v_slab_index],
                CASE WHEN v_slab_index = array_length(v_slab_rates, 1) THEN v_extra_rate ELSE NULL END,
                CASE WHEN v_slab_index = array_length(v_slab_rates, 1) THEN v_extra_weight_unit ELSE NULL END,
                now(),
                now()
              );
          END LOOP;

          INSERT INTO shipping_rate_cod_slabs
            (id, shipping_rate_id, amount_from, amount_to, charge_type, charge_value, created_at, updated_at)
          VALUES
            (gen_random_uuid(), v_rate_id, 0.00, 2000.00, 'flat', 40.00, now(), now()),
            (gen_random_uuid(), v_rate_id, 2000.00, NULL, 'percent', 2.00, now(), now());
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  INSERT INTO app_data_migrations (key)
  VALUES ('seed_basic_premium_kashmir_b2c_rates_v3')
  ON CONFLICT (key) DO NOTHING;
END $$;
