
-- Update handle_new_user: give 10 free credits (KES 5.00 = 10 SMS at 0.50/each)
-- and make first user admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count integer;
  new_wallet_id uuid;
  initial_balance numeric := 5.00;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Create wallet with 10 free SMS credits (KES 5.00 at 0.50/SMS)
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, initial_balance)
  RETURNING id INTO new_wallet_id;
  
  -- Log the welcome credits
  INSERT INTO public.wallet_transactions (user_id, wallet_id, type, amount, balance_before, balance_after, description)
  VALUES (NEW.id, new_wallet_id, 'credit', initial_balance, 0, initial_balance, 'Welcome bonus: 10 free SMS credits');
  
  -- First user gets admin role, others get user role
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;
