-- ============================================
-- MOT Table Grants v1
--
-- RLS policies define row-level access, but API roles also need table grants.
-- Keep raw_utterances immutable at the permission layer: family users get SELECT only.
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Backend routes using the service role need broad access, except raw_utterances
-- remains append-only even at the permission layer.
GRANT SELECT ON
  elders,
  family_members,
  devices,
  photos,
  family_questions,
  prompts,
  raw_utterances,
  timeline_events,
  entities,
  themes,
  emotion_layer,
  unresolved_queue,
  sensory_details,
  verifications,
  memory_candidates,
  story_outputs,
  subscriptions
TO service_role;

GRANT INSERT, UPDATE, DELETE ON
  elders,
  family_members,
  devices,
  photos,
  family_questions,
  prompts,
  timeline_events,
  entities,
  themes,
  emotion_layer,
  unresolved_queue,
  sensory_details,
  verifications,
  memory_candidates,
  story_outputs,
  subscriptions
TO service_role;

GRANT INSERT ON raw_utterances TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Family dashboard reads only the current user's RLS-visible rows.
GRANT SELECT ON
  elders,
  family_members,
  devices,
  photos,
  family_questions,
  prompts,
  raw_utterances,
  timeline_events,
  entities,
  themes,
  emotion_layer,
  unresolved_queue,
  sensory_details,
  verifications,
  memory_candidates,
  story_outputs,
  subscriptions
TO authenticated;

-- Family-created records. Do not grant raw_utterances INSERT/UPDATE/DELETE.
GRANT INSERT ON photos, family_questions, verifications TO authenticated;

-- Existing photo RLS policies allow family updates/deletes; grants mirror that table only.
GRANT UPDATE, DELETE ON photos TO authenticated;

GRANT EXECUTE ON FUNCTION my_elder_ids() TO authenticated;
