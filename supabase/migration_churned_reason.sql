-- Migration: add churned_reason column to roadmaps table
-- Run this in Supabase SQL editor

ALTER TABLE roadmaps
  ADD COLUMN IF NOT EXISTS churned_reason TEXT NOT NULL DEFAULT '';
