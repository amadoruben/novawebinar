-- Bloco 3 · correcção: "começou a ver" só nas participações medidas. Uma participação
-- antiga (tempo nunca medido) que volta à sala já tinha visto antes; gravar agora a
-- hora do primeiro sinal seria inventar quando começou.
CREATE OR REPLACE FUNCTION public.record_participant_progress(
  _participant_id uuid, _position integer, _entry integer DEFAULT NULL, _played integer DEFAULT 0
) RETURNS void
LANGUAGE sql SET search_path = public AS $$
  UPDATE participants SET
    watched_seconds = greatest(watched_seconds, _position),
    entry_seconds = CASE
      WHEN entry_seconds IS NULL AND actual_watch_seconds IS NOT NULL AND _entry IS NOT NULL
        THEN least(_entry, greatest(watched_seconds, _position))
      ELSE entry_seconds END,
    actual_watch_seconds = CASE
      WHEN actual_watch_seconds IS NOT NULL AND _played > 0 THEN least(
        actual_watch_seconds + least(_played, 120),
        greatest(ceil(extract(epoch FROM now() - joined_at))::integer, 0) + 30)
      ELSE actual_watch_seconds END,
    first_progress_at = CASE
      WHEN _played > 0 AND actual_watch_seconds IS NOT NULL THEN coalesce(first_progress_at, now())
      ELSE first_progress_at END,
    last_progress_at = CASE WHEN _played > 0 THEN now() ELSE last_progress_at END
  WHERE id = _participant_id
    AND (_position > watched_seconds
      OR _played > 0
      OR (entry_seconds IS NULL AND actual_watch_seconds IS NOT NULL AND _entry IS NOT NULL));
$$;
