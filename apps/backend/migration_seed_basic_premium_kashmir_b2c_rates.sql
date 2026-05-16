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
  v_forward_rate numeric(10, 2);
  v_rto_rate numeric(10, 2);
BEGIN
  IF EXISTS (
    SELECT 1
    FROM app_data_migrations
    WHERE key IN (
      'seed_basic_premium_kashmir_b2c_rates_v1',
      'seed_basic_premium_kashmir_b2c_rates_v2',
      'seed_basic_premium_kashmir_b2c_rates_v3',
      'seed_basic_premium_kashmir_b2c_rates_v4'
    )
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

  IF NOT EXISTS (
    SELECT 1
    FROM meracourierwala_zones
    WHERE lower(trim(business_type)) = 'b2c'
      AND (lower(trim(code)) IN ('special zone', 'special_zone') OR lower(trim(name)) = 'special zone')
  ) THEN
    INSERT INTO meracourierwala_zones
      (id, code, name, description, region, business_type, metadata, states, created_at, updated_at)
    VALUES
      (
        gen_random_uuid(),
        'SPECIAL ZONE',
        'Special Zone',
        'Kashmir and other special-service pincodes.',
        'Kashmir',
        'B2C',
        '{"source":"basic-premium-kashmir-rate-seed"}'::jsonb,
        '[]'::jsonb,
        now(),
        now()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM meracourierwala_zones
    WHERE lower(trim(business_type)) = 'b2c'
      AND (lower(trim(code)) = 'roi' OR lower(trim(name)) = 'rest of india')
  ) THEN
    INSERT INTO meracourierwala_zones
      (id, code, name, description, region, business_type, metadata, states, created_at, updated_at)
    VALUES
      (
        gen_random_uuid(),
        'ROI',
        'Rest of India',
        'Outside Kashmir fallback zone.',
        'Outside Kashmir',
        'B2C',
        '{"source":"basic-premium-kashmir-rate-seed"}'::jsonb,
        '[]'::jsonb,
        now(),
        now()
      );
  END IF;

  DELETE FROM shipping_rate_cod_slabs
  WHERE shipping_rate_id IN (
    SELECT id
    FROM shipping_rates
    WHERE business_type = 'b2c'
      AND plan_id IN (v_basic_plan_id, v_premium_plan_id)
      AND courier_id IN (99, 100)
      AND lower(coalesce(service_provider, '')) = 'delhivery'
  );

  DELETE FROM shipping_rate_slabs
  WHERE shipping_rate_id IN (
    SELECT id
    FROM shipping_rates
    WHERE business_type = 'b2c'
      AND plan_id IN (v_basic_plan_id, v_premium_plan_id)
      AND courier_id IN (99, 100)
      AND lower(coalesce(service_provider, '')) = 'delhivery'
  );

  DELETE FROM shipping_rates
  WHERE business_type = 'b2c'
    AND plan_id IN (v_basic_plan_id, v_premium_plan_id)
    AND courier_id IN (99, 100)
    AND lower(coalesce(service_provider, '')) = 'delhivery';

  FOR v_plan IN
    SELECT v_basic_plan_id AS id, 'Basic' AS name
    UNION ALL
    SELECT v_premium_plan_id AS id, 'Premium' AS name
  LOOP
    FOR v_zone IN
      SELECT id, code, name
      FROM meracourierwala_zones
      WHERE lower(trim(business_type)) = 'b2c'
        AND lower(trim(code)) NOT LIKE '%soecial%'
        AND lower(trim(name)) NOT LIKE '%within sate%'
    LOOP
      v_is_kashmir :=
        lower(trim(v_zone.code)) IN ('special zone', 'special_zone')
        OR lower(trim(v_zone.name)) = 'special zone';

      FOR v_courier IN
        SELECT 100 AS id, 'Delhivery Metro Air' AS name, 'air' AS mode
        UNION ALL
        SELECT 99 AS id, 'Delhivery Metro Surface' AS name, 'surface' AS mode
      LOOP
        IF v_plan.name = 'Basic' THEN
          IF v_is_kashmir THEN
            v_forward_rate := CASE WHEN v_courier.mode = 'air' THEN 205.00 ELSE 185.00 END;
            v_rto_rate := CASE WHEN v_courier.mode = 'air' THEN 120.00 ELSE 115.00 END;
          ELSE
            v_forward_rate := CASE WHEN v_courier.mode = 'air' THEN 175.00 ELSE 155.00 END;
            v_rto_rate := CASE WHEN v_courier.mode = 'air' THEN 100.00 ELSE 95.00 END;
          END IF;
        ELSE
          IF v_is_kashmir THEN
            v_forward_rate := CASE WHEN v_courier.mode = 'air' THEN 185.00 ELSE 165.00 END;
            v_rto_rate := CASE WHEN v_courier.mode = 'air' THEN 110.00 ELSE 100.00 END;
          ELSE
            v_forward_rate := CASE WHEN v_courier.mode = 'air' THEN 155.00 ELSE 135.00 END;
            v_rto_rate := CASE WHEN v_courier.mode = 'air' THEN 90.00 ELSE 85.00 END;
          END IF;
        END IF;

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
            v_forward_rate,
            now(),
            v_courier.id,
            v_courier.name,
            v_courier.mode,
            'b2c',
            0.50,
            v_zone.id,
            'forward',
            now()
          );

        INSERT INTO shipping_rate_cod_slabs
          (id, shipping_rate_id, amount_from, amount_to, charge_type, charge_value, created_at, updated_at)
        VALUES
          (gen_random_uuid(), v_rate_id, 0.00, 2000.00, 'flat', 40.00, now(), now()),
          (gen_random_uuid(), v_rate_id, 2000.00, NULL, 'percent', 2.00, now(), now());

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
            v_rto_rate,
            now(),
            v_courier.id,
            v_courier.name,
            v_courier.mode,
            'b2c',
            0.50,
            v_zone.id,
            'rto',
            now()
          );

        INSERT INTO shipping_rate_cod_slabs
          (id, shipping_rate_id, amount_from, amount_to, charge_type, charge_value, created_at, updated_at)
        VALUES
          (gen_random_uuid(), v_rate_id, 0.00, 2000.00, 'flat', 40.00, now(), now()),
          (gen_random_uuid(), v_rate_id, 2000.00, NULL, 'percent', 2.00, now(), now());
      END LOOP;
    END LOOP;
  END LOOP;

  INSERT INTO app_data_migrations (key)
  VALUES ('seed_basic_premium_kashmir_b2c_rates_v1')
  ON CONFLICT (key) DO NOTHING;
END $$;
