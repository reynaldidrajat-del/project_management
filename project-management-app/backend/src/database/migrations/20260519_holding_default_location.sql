DO $$
DECLARE
  holding_location_id INTEGER;
BEGIN
  SELECT id
  INTO holding_location_id
  FROM locations
  WHERE lower(trim(name)) = lower('Holding')
  ORDER BY id
  LIMIT 1;

  IF holding_location_id IS NULL THEN
    INSERT INTO locations (name)
    VALUES ('Holding')
    RETURNING id INTO holding_location_id;
  ELSE
    UPDATE locations
    SET name = 'Holding'
    WHERE id = holding_location_id
      AND name <> 'Holding';
  END IF;

  UPDATE users
  SET location_id = holding_location_id
  WHERE location_id IS DISTINCT FROM holding_location_id;
END;
$$;
