-- Migration: Add logo column to restaurants

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS logo VARCHAR(255) DEFAULT NULL AFTER subscription_status;