ALTER TABLE voice_cues ADD COLUMN IF NOT EXISTS display_cue VARCHAR(255);
ALTER TABLE voice_cues ADD COLUMN IF NOT EXISTS cue_type VARCHAR(50);

-- Default display_cue to raw_cue without trailing ellipsis or exclamation marks
UPDATE voice_cues SET display_cue = raw_cue;
UPDATE voice_cues SET display_cue = REPLACE(display_cue, '...', '') WHERE display_cue LIKE '%...';
UPDATE voice_cues SET display_cue = REPLACE(display_cue, '!', '') WHERE display_cue LIKE '%!';

-- Set cue_type based on keywords
UPDATE voice_cues SET cue_type = 'info';

UPDATE voice_cues SET cue_type = 'warning'
WHERE 
    raw_cue ILIKE '%widen%' OR
    raw_cue ILIKE '%too wide%' OR
    raw_cue ILIKE '%keep chest up%' OR
    raw_cue ILIKE '%knees out%' OR
    raw_cue ILIKE '%knees beyond%' OR
    raw_cue ILIKE '%push knees%' OR
    raw_cue ILIKE '%push through heels%' OR
    raw_cue ILIKE '%drive through heels%' OR
    raw_cue ILIKE '%toes out%' OR
    raw_cue ILIKE '%turn toes%' OR
    raw_cue ILIKE '%lean%' OR
    raw_cue ILIKE '%front knee beyond%' OR
    raw_cue ILIKE '%keep chest upright%' OR
    raw_cue ILIKE '%keep your head back%' OR
    raw_cue ILIKE '%look straight%' OR
    raw_cue ILIKE '%wider step%' OR
    raw_cue ILIKE '%asymmetric%' OR
    raw_cue ILIKE '%sway%' OR
    raw_cue ILIKE '%heels flat%' OR
    raw_cue ILIKE '%keep knees straight%' OR
    raw_cue ILIKE '%knees bent%' OR
    raw_cue ILIKE '%wiggle feet%';
