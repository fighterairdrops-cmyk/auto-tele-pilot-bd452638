
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add user_id to systems table
ALTER TABLE public.systems ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies and replace with user-scoped ones
DROP POLICY "Allow all on systems" ON public.systems;
CREATE POLICY "Users manage own systems" ON public.systems FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY "Allow all on allowed_users" ON public.allowed_users;
CREATE POLICY "Users manage own allowed_users" ON public.allowed_users FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = allowed_users.system_id AND systems.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = allowed_users.system_id AND systems.user_id = auth.uid()));

DROP POLICY "Allow all on allowed_groups" ON public.allowed_groups;
CREATE POLICY "Users manage own allowed_groups" ON public.allowed_groups FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = allowed_groups.system_id AND systems.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = allowed_groups.system_id AND systems.user_id = auth.uid()));

DROP POLICY "Allow all on channels" ON public.channels;
CREATE POLICY "Users manage own channels" ON public.channels FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = channels.system_id AND systems.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = channels.system_id AND systems.user_id = auth.uid()));

DROP POLICY "Allow all on scheduled_tasks" ON public.scheduled_tasks;
CREATE POLICY "Users manage own scheduled_tasks" ON public.scheduled_tasks FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = scheduled_tasks.system_id AND systems.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = scheduled_tasks.system_id AND systems.user_id = auth.uid()));

DROP POLICY "Allow all on auto_delete_rules" ON public.auto_delete_rules;
CREATE POLICY "Users manage own auto_delete_rules" ON public.auto_delete_rules FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = auto_delete_rules.system_id AND systems.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.systems WHERE systems.id = auto_delete_rules.system_id AND systems.user_id = auth.uid()));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
