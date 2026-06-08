-- Migration: Add RBAC and Approval System Fields
-- This migration adds approval_status, requested_role, approved_by, and approved_at fields to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_role VARCHAR(50) DEFAULT NULL AFTER role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved' AFTER requested_role;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INT DEFAULT NULL AFTER approval_status;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL DEFAULT NULL AFTER approved_by;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL AFTER email;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restaurant_id INT DEFAULT NULL AFTER phone;

-- Create approval audit log table
CREATE TABLE IF NOT EXISTS approval_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  approved_by INT,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Add index for approval status queries
CREATE INDEX idx_approval_status ON users(approval_status);
CREATE INDEX idx_restaurant_id ON users(restaurant_id);
CREATE INDEX idx_role_approval ON users(role, approval_status);
