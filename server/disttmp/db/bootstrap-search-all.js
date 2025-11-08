"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapSearchAll = bootstrapSearchAll;
var SQL = "\nCREATE EXTENSION IF NOT EXISTS unaccent;\nCREATE EXTENSION IF NOT EXISTS pg_trgm;\n\nCREATE OR REPLACE FUNCTION set_search_all()\nRETURNS trigger AS $$\nDECLARE txt text := ''; val text; rec jsonb := to_jsonb(NEW); i int;\nBEGIN\n  FOR i IN 0..TG_NARGS-1 LOOP\n    val := COALESCE(rec ->> TG_ARGV[i], '');\n    IF txt <> '' THEN txt := txt || ' '; END IF;\n    txt := txt || val;\n  END LOOP;\n  NEW.search_all := unaccent(lower(txt));\n  RETURN NEW;\nEND\n$$ LANGUAGE plpgsql;\n\nCREATE OR REPLACE FUNCTION ensure_trgm_search(table_name regclass, cols text[])\nRETURNS void AS $$\nDECLARE\n  schema_name text := split_part(table_name::text, '.', 1);\n  rel_name    text := split_part(table_name::text, '.', 2);\n  exists_col  boolean; exists_idx boolean; exists_trg boolean;\n  idxname     text := format('%s_search_all_trgm_idx', replace(table_name::text, '.', '_'));\n  trgname     text := format('%s_search_all_trg',      replace(table_name::text, '.', '_'));\n  colargs     text;\nBEGIN\n  IF cols IS NULL OR array_length(cols,1) IS NULL THEN RETURN; END IF;\n\n  SELECT EXISTS (\n    SELECT 1 FROM information_schema.columns ic\n    WHERE ic.table_schema = schema_name AND ic.table_name = rel_name AND ic.column_name = 'search_all'\n  ) INTO exists_col;\n  IF NOT exists_col THEN\n    EXECUTE format('ALTER TABLE %s ADD COLUMN search_all text', table_name);\n  END IF;\n\n  SELECT EXISTS (\n    SELECT 1\n    FROM pg_trigger t\n    JOIN pg_class c ON c.oid = t.tgrelid\n    JOIN pg_namespace n ON n.oid = c.relnamespace\n    WHERE t.tgname = trgname AND n.nspname = schema_name AND c.relname = rel_name\n  ) INTO exists_trg;\n  IF NOT exists_trg THEN\n    colargs := array_to_string(ARRAY(SELECT format('''%s''', c) FROM unnest(cols) c), ', ');\n    EXECUTE format(\n      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %s\n       FOR EACH ROW EXECUTE FUNCTION set_search_all(%s)',\n      trgname, table_name, colargs\n    );\n    EXECUTE format('UPDATE %s SET search_all = unaccent(lower(%s))',\n      table_name,\n      array_to_string(\n        ARRAY(SELECT format('coalesce(%I::text, '''')', c) FROM unnest(cols) c),\n        ' || '' '' || '\n      )\n    );\n  END IF;\n\n  SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = idxname) INTO exists_idx;\n  IF NOT exists_idx THEN\n    EXECUTE format('CREATE INDEX %I ON %s USING gin (search_all gin_trgm_ops)', idxname, table_name);\n  END IF;\nEND\n$$ LANGUAGE plpgsql;\n\nDO $$\nDECLARE r record; cols text[];\nBEGIN\n  FOR r IN\n    SELECT table_schema, table_name\n    FROM information_schema.tables\n    WHERE table_type='BASE TABLE'\n      AND table_schema='public'\n      AND table_name NOT IN ('_prisma_migrations')\n  LOOP\n    SELECT array_agg(column_name::text ORDER BY ordinal_position)\n      INTO cols\n      FROM information_schema.columns\n      WHERE table_schema=r.table_schema AND table_name=r.table_name\n        AND column_name <> 'search_all'\n        AND (data_type IN ('text','character varying') OR udt_name='citext');\n\n    IF cols IS NOT NULL AND array_length(cols,1) > 0 THEN\n      PERFORM ensure_trgm_search(format('%I.%I', r.table_schema, r.table_name)::regclass, cols);\n    END IF;\n  END LOOP;\nEND $$;\n";
function bootstrapSearchAll(prisma) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.$executeRawUnsafe(SQL)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
