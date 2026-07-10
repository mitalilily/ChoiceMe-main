ALTER TABLE meracourierwala_label_preferences
ADD COLUMN IF NOT EXISTS label_sheet_layout varchar(20) NOT NULL DEFAULT 'a4_single';
