UPDATE public.messages 
SET delivered_count = sent_count, status = 'delivered' 
WHERE status = 'sent' AND sent_count > 0 AND (delivered_count IS NULL OR delivered_count = 0);