ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id
ON public.messages(provider_message_id)
WHERE provider_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_message_delivery(
  _provider_message_id text,
  _status text,
  _delivered_count integer DEFAULT NULL,
  _failed_count integer DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_message public.messages;
  next_delivered integer;
  next_failed integer;
  normalized_status text;
BEGIN
  IF _provider_message_id IS NULL OR btrim(_provider_message_id) = '' THEN
    RAISE EXCEPTION 'provider_message_id is required';
  END IF;

  SELECT * INTO target_message
  FROM public.messages
  WHERE provider_message_id = _provider_message_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'message not found for provider_message_id %', _provider_message_id;
  END IF;

  normalized_status := lower(coalesce(_status, 'sent'));

  next_delivered := COALESCE(_delivered_count,
    CASE
      WHEN normalized_status IN ('delivered', 'success', 'successful', 'sent') THEN COALESCE(array_length(target_message.recipients, 1), 0)
      ELSE COALESCE(target_message.delivered_count, 0)
    END
  );

  next_failed := COALESCE(_failed_count,
    CASE
      WHEN normalized_status IN ('failed', 'undelivered', 'rejected') THEN COALESCE(array_length(target_message.recipients, 1), 0)
      ELSE COALESCE(target_message.failed_count, 0)
    END
  );

  UPDATE public.messages
  SET delivered_count = GREATEST(COALESCE(target_message.delivered_count, 0), COALESCE(next_delivered, 0)),
      failed_count = GREATEST(COALESCE(target_message.failed_count, 0), COALESCE(next_failed, 0)),
      status = CASE
        WHEN normalized_status IN ('delivered', 'success', 'successful') THEN 'delivered'::public.message_status
        WHEN normalized_status IN ('failed', 'undelivered', 'rejected') THEN 'failed'::public.message_status
        ELSE COALESCE(target_message.status, 'sent'::public.message_status)
      END,
      updated_at = now()
  WHERE id = target_message.id
  RETURNING * INTO target_message;

  RETURN target_message;
END;
$$;