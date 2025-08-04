-- This is an empty migration.
-- ==============================================
-- 1. VIEW: Student Progress
-- ==============================================
CREATE OR REPLACE VIEW vw_student_progress AS
SELECT 
    m.membership_id,
    u.name AS student_name,
    c.name AS classroom_name,
    COUNT(s.submission_id) AS total_submissions,
    COALESCE(ROUND(AVG(s.score)::numeric, 2), 0) AS avg_score,
    m.xp,
    m.level
FROM memberships m
JOIN users u ON m.user_id = u.user_id
JOIN students st ON st.membership_id = m.membership_id
JOIN classrooms c ON st.classroom_id = c.classroom_id
LEFT JOIN submissions s ON s.student_id = m.membership_id
WHERE m.role = 'STUDENT'
GROUP BY m.membership_id, u.name, c.name, m.xp, m.level;

-- ==============================================
-- 2. VIEW: Teacher Dashboard
-- ==============================================
CREATE OR REPLACE VIEW vw_teacher_dashboard AS
SELECT 
    t.teacher_id,
    u.name AS teacher_name,
    COUNT(DISTINCT c.classroom_id) AS classrooms_count,
    COUNT(DISTINCT st.student_id) AS students_count,
    COUNT(DISTINCT te.test_id) AS tests_count
FROM teachers t
JOIN memberships m ON t.membership_id = m.membership_id
JOIN users u ON m.user_id = u.user_id
LEFT JOIN classrooms c ON c.teacher_id = t.teacher_id
LEFT JOIN students st ON st.classroom_id = c.classroom_id
LEFT JOIN tests te ON te.organization_id = m.organization_id
GROUP BY t.teacher_id, u.name;

-- ==============================================
-- 3. VIEW: Classroom Results
-- ==============================================
CREATE OR REPLACE VIEW vw_classroom_results AS
SELECT 
    c.classroom_id,
    c.name AS classroom_name,
    ROUND(AVG(s.score)::numeric, 2) AS avg_score,
    MAX(s.score) AS best_score,
    MIN(s.score) AS worst_score
FROM classrooms c
LEFT JOIN students st ON st.classroom_id = c.classroom_id
LEFT JOIN submissions s ON s.student_id = st.membership_id
GROUP BY c.classroom_id, c.name;

-- ==============================================
-- 4. GENERICKÁ FUNKCE: Audit Log
-- ==============================================
CREATE OR REPLACE FUNCTION log_audit() RETURNS trigger AS $$
BEGIN
    INSERT INTO audit_logs (
        audit_log_id,
        entity_type,
        entity_id,
        action,
        changed_fields,
        created_at
    ) VALUES (
        gen_random_uuid(),
        TG_TABLE_NAME::text,
        COALESCE(NEW.id::text, OLD.id::text),
        TG_OP,
        row_to_json(COALESCE(NEW, OLD)),
        now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 5. FUNKCE: Award XP
-- ==============================================
CREATE OR REPLACE FUNCTION award_xp() RETURNS trigger AS $$
BEGIN
    UPDATE memberships
    SET xp = xp + 10
    WHERE membership_id = NEW.student_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 6. PROCEDURA: Evaluate Submission
-- ==============================================
CREATE OR REPLACE FUNCTION evaluate_submission(p_submission_id UUID) RETURNS VOID AS $$
DECLARE
    v_score FLOAT;
BEGIN
    SELECT AVG(CASE WHEN r.is_correct THEN 1 ELSE 0 END) * 100
    INTO v_score
    FROM responses r
    WHERE r.submission_id = p_submission_id;

    UPDATE submissions
    SET score = v_score
    WHERE submission_id = p_submission_id;

    UPDATE memberships
    SET xp = xp + (v_score / 10)::INT
    WHERE membership_id = (SELECT student_id FROM submissions WHERE submission_id = p_submission_id);
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 7. TRIGGERS: Audit na všech hlavních tabulkách
-- ==============================================

-- Hlavní tabulky
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'users',
            'organizations',
            'memberships',
            'teachers',
            'students',
            'subjects',
            'classrooms',
            'tests',
            'questions',
            'learning_materials',
            'submissions',
            'responses',
            'import_batches',
            'export_logs'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_audit_%I ON %I;
            CREATE TRIGGER trg_audit_%I
            AFTER INSERT OR UPDATE OR DELETE ON %I
            FOR EACH ROW EXECUTE FUNCTION log_audit();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END;
$$;

-- ==============================================
-- 8. TRIGGER: XP po vložení submission
-- ==============================================
DROP TRIGGER IF EXISTS trg_award_xp ON submissions;
CREATE TRIGGER trg_award_xp
AFTER INSERT ON submissions
FOR EACH ROW EXECUTE FUNCTION award_xp();
