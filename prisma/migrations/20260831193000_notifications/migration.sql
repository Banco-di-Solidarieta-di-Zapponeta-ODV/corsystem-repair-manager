CREATE TABLE `Notification` (
  `id` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NOT NULL,
  `event` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `provider` VARCHAR(191) NOT NULL DEFAULT '',
  `recipient` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(191) NOT NULL DEFAULT '',
  `body` TEXT NOT NULL,
  `externalId` VARCHAR(191) NOT NULL DEFAULT '',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `lastError` TEXT NOT NULL,
  `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` DATETIME(3) NULL,
  `lastAttemptAt` DATETIME(3) NULL,
  `dedupeKey` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Notification_dedupeKey_key`(`dedupeKey`),
  INDEX `Notification_repairId_idx`(`repairId`),
  INDEX `Notification_event_idx`(`event`),
  INDEX `Notification_channel_idx`(`channel`),
  INDEX `Notification_status_idx`(`status`),
  INDEX `Notification_scheduledAt_idx`(`scheduledAt`),
  INDEX `Notification_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Notification`
  ADD CONSTRAINT `Notification_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
