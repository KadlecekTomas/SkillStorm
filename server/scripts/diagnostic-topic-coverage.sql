SELECT
  COALESCE(tl.name, 'Bez tématu') AS topic_name,
  COUNT(r.response_id) AS responses
FROM responses r
JOIN submissions s ON s.submission_id = r.submission_id
JOIN assignments a ON a.assignment_id = s.assignment_id
LEFT JOIN topic_levels tl ON tl.topic_level_id = a.topic_level_id
GROUP BY COALESCE(tl.name, 'Bez tématu')
ORDER BY responses DESC, topic_name ASC;
