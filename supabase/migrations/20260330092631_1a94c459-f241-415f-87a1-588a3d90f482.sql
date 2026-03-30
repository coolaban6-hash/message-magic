
-- Fix overly permissive INSERT policy on system_logs
DROP POLICY "System can insert logs" ON public.system_logs;

-- Only authenticated users can create logs (edge functions use service role)
CREATE POLICY "Authenticated users can insert logs" ON public.system_logs 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);
