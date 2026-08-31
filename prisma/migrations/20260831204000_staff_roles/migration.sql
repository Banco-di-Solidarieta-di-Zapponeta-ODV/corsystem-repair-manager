ALTER TABLE `Staff`
  ADD COLUMN `role` VARCHAR(32) NOT NULL DEFAULT 'CUSTOM';

UPDATE `Staff`
SET `role` = 'ADMIN'
WHERE `isAdmin` = TRUE;

CREATE INDEX `Staff_role_idx` ON `Staff`(`role`);
