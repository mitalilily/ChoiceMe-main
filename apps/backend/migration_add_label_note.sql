ALTER TABLE meracourierwala_label_preferences
  ADD COLUMN IF NOT EXISTS note_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS label_note varchar(240) NOT NULL DEFAULT '';
