-- This is an empty migration.
-- View pro statistiky
CREATE OR REPLACE VIEW task_completion_stats AS
SELECT 
    t.id AS test_id,
    t.title,
    COUNT(s.id) AS total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') AS passed_count,
    ROUND(
        (COUNT(s.id) FILTER (WHERE s.status = 'APPROVED')::decimal / NULLIF(COUNT(s.id), 0)) * 100,
        2
    ) AS pass_rate
FROM "Test" t
LEFT JOIN "Submission" s ON s."testId" = t.id
GROUP BY t.id, t.title;

-- Funkce pro XP
CREATE OR REPLACE FUNCTION update_xp_on_submission()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPROVED' AND (OLD.status IS DISTINCT FROM 'APPROVED') THEN
        UPDATE "Gamification"
        SET xp = xp + 10,
            level = (xp + 10) / 100 + 1
        WHERE "userId" = NEW."studentId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pro XP
CREATE TRIGGER trg_update_xp
AFTER UPDATE ON "Submission"
FOR EACH ROW
EXECUTE FUNCTION update_xp_on_submission();
