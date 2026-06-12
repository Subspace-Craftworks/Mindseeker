-- Migration: Add background column to goals table
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS background TEXT;
