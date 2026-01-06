// src/db/bootstrap-search-all.ts
import type { PrismaService } from '@/prisma/prisma.service'; // uprav cestu dle projektu

const SQL = `
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION set_search_all()
RETURNS trigger AS $$
DECLARE txt text := ''; val text; rec jsonb := to_jsonb(NEW); i int;
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

CREATE OR REPLACE FUNCTION ensure_trgm_search(table_name regclass, cols text[])
RETURNS void AS $$
DECLARE
  schema_name text := split_part(table_name::text, '.', 1);
  rel_name    text := split_part(table_name::text, '.', 2);
  exists_col  boolean; exists_idx boolean; exists_trg boolean;
  idxname     text := format('%s_search_all_trgm_idx', replace(table_name::text, '.', '_'));
  trgname     text := format('%s_search_all_trg',      replace(table_name::text, '.', '_'));
  colargs     text;
BEGIN
  IF cols IS NULL OR array_length(cols,1) IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns ic
    WHERE ic.table_schema = schema_name AND ic.table_name = rel_name AND ic.column_name = 'search_all'
  ) INTO exists_col;
  IF NOT exists_col THEN
    EXECUTE format('ALTER TABLE %s ADD COLUMN search_all text', table_name);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = trgname AND n.nspname = schema_name AND c.relname = rel_name
  ) INTO exists_trg;
  IF NOT exists_trg THEN
    colargs := array_to_string(ARRAY(SELECT format('''%s''', c) FROM unnest(cols) c), ', ');
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_search_all(%s)',
      trgname, table_name, colargs
    );
    EXECUTE format('UPDATE %s SET search_all = unaccent(lower(%s))',
      table_name,
      array_to_string(
        ARRAY(SELECT format('coalesce(%I::text, '''')', c) FROM unnest(cols) c),
        ' || '' '' || '
      )
    );
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = idxname) INTO exists_idx;
  IF NOT exists_idx THEN
    EXECUTE format('CREATE INDEX %I ON %s USING gin (search_all gin_trgm_ops)', idxname, table_name);
  END IF;
END
$$ LANGUAGE plpgsql;

DO $$
DECLARE r record; cols text[];
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type='BASE TABLE'
      AND table_schema='public'
      AND table_name NOT IN ('_prisma_migrations')
  LOOP
    SELECT array_agg(column_name::text ORDER BY ordinal_position)
      INTO cols
      FROM information_schema.columns
      WHERE table_schema=r.table_schema AND table_name=r.table_name
        AND column_name <> 'search_all'
        AND (data_type IN ('text','character varying') OR udt_name='citext');

    IF cols IS NOT NULL AND array_length(cols,1) > 0 THEN
      PERFORM ensure_trgm_search(format('%I.%I', r.table_schema, r.table_name)::regclass, cols);
    END IF;
  END LOOP;
END $$;
`;

export async function bootstrapSearchAll(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(SQL);
}
