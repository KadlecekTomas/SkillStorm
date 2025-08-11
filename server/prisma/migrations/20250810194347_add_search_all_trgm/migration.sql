-- 0) Rozšíření (idempotentně)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- A) Trigger funkce, která sestaví search_all z vybraných sloupců
CREATE OR REPLACE FUNCTION set_search_all()
RETURNS trigger AS $$
DECLARE
  txt text := '';
  val text;
  rec jsonb := to_jsonb(NEW);
  i int;
BEGIN
  FOR i IN 0..TG_NARGS-1 LOOP
    val := COALESCE(rec ->> TG_ARGV[i], '');
    IF txt <> '' THEN txt := txt || ' '; END IF;
    txt := txt || val;
  END LOOP;

  NEW.search_all := unaccent(lower(txt));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- B) Helper: přidá sloupec search_all, trigger a GIN trgm index (idempotentně)
CREATE OR REPLACE FUNCTION ensure_trgm_search(table_name regclass, cols text[])
RETURNS void AS $$
DECLARE
  schema_name text := split_part(table_name::text, '.', 1);
  rel_name    text := split_part(table_name::text, '.', 2);
  exists_col  boolean;
  exists_idx  boolean;
  exists_trg  boolean;
  idxname     text := format('%s_search_all_trgm_idx', replace(table_name::text, '.', '_'));
  trgname     text := format('%s_search_all_trg',      replace(table_name::text, '.', '_'));
  colidents   text;
  colargs     text;
BEGIN
  -- 1) sloupec search_all (obyč. TEXT, ne generated)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns ic
    WHERE ic.table_schema = schema_name
      AND ic.table_name   = rel_name
      AND ic.column_name  = 'search_all'
  ) INTO exists_col;

  IF NOT exists_col THEN
    EXECUTE format('ALTER TABLE %s ADD COLUMN search_all text', table_name);
  END IF;

-- 2) trigger, který search_all vypočítá při INSERT/UPDATE
SELECT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE t.tgname = trgname AND n.nspname = schema_name AND c.relname = rel_name
) INTO exists_trg;

IF NOT exists_trg THEN
  colargs := array_to_string(ARRAY(SELECT format('''%s''', c) FROM unnest(cols) c), ', ');

  -- Spustíme při INSERT a při JAKÉMKOLI UPDATE (bez "OF sloupce")
  EXECUTE format(
    'CREATE TRIGGER %I
       BEFORE INSERT OR UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_search_all(%s)',
    trgname, table_name, colargs
  );

  -- Hned po vytvoření si napočítáme hodnoty pro existující řádky
  EXECUTE format('UPDATE %s SET search_all = unaccent(lower(%s))',
    table_name,
    array_to_string(
      ARRAY(SELECT format('coalesce(%I::text, '''')', c) FROM unnest(cols) c),
      ' || '' '' || '
    )
  );
END IF;

  -- 3) index na search_all
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = idxname) INTO exists_idx;
  IF NOT exists_idx THEN
    EXECUTE format('CREATE INDEX %I ON %s USING gin (search_all gin_trgm_ops)', idxname, table_name);
  END IF;
END
$$ LANGUAGE plpgsql;


-- users
SELECT ensure_trgm_search('public."users"', ARRAY['name','email','username']);
-- organizations
SELECT ensure_trgm_search('public."organizations"', ARRAY['name','city','address','country']);
-- catalog_subjects
SELECT ensure_trgm_search('public."catalog_subjects"', ARRAY['code','name']);
-- catalog_topics
SELECT ensure_trgm_search('public."catalog_topics"', ARRAY['name']);
-- subjects
SELECT ensure_trgm_search('public."subjects"', ARRAY['name']);
-- subject_levels
SELECT ensure_trgm_search('public."subject_levels"', ARRAY['label']);
-- topic_levels
SELECT ensure_trgm_search('public."topic_levels"', ARRAY['name']);
-- class_sections
SELECT ensure_trgm_search('public."class_sections"', ARRAY['section','label']);
-- learning_materials
SELECT ensure_trgm_search('public."learning_materials"', ARRAY['title','description']);
-- tests
SELECT ensure_trgm_search('public."tests"', ARRAY['title','description']);
-- questions
SELECT ensure_trgm_search('public."questions"', ARRAY['text']);
-- students
SELECT ensure_trgm_search('public."students"', ARRAY['studentNumber','externalId']);
