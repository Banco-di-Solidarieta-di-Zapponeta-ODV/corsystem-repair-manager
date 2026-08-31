ALTER TABLE `Repair`
  ADD COLUMN `finalAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `finalCostAmount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `finalMargin` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `readyAt` DATETIME(3) NULL,
  ADD COLUMN `deliveredAt` DATETIME(3) NULL,
  ADD COLUMN `warrantyUntil` DATETIME(3) NULL;

CREATE INDEX `Repair_readyAt_idx` ON `Repair`(`readyAt`);
CREATE INDEX `Repair_deliveredAt_idx` ON `Repair`(`deliveredAt`);
CREATE INDEX `Repair_warrantyUntil_idx` ON `Repair`(`warrantyUntil`);

CREATE TABLE `RepairTest` (
  `id` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `checklist` JSON NOT NULL,
  `notes` TEXT NOT NULL,
  `technicianId` VARCHAR(191) NOT NULL DEFAULT '',
  `technicianName` VARCHAR(191) NOT NULL DEFAULT '',
  `createdBy` VARCHAR(191) NOT NULL DEFAULT '',
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `RepairTest_repairId_idx`(`repairId`),
  INDEX `RepairTest_status_idx`(`status`),
  INDEX `RepairTest_completedAt_idx`(`completedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RepairTest`
  ADD CONSTRAINT `RepairTest_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `DeliveryRecord` (
  `id` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NOT NULL,
  `handedTo` VARCHAR(191) NOT NULL DEFAULT '',
  `note` TEXT NOT NULL,
  `settlementMode` VARCHAR(191) NOT NULL DEFAULT 'PAID',
  `amountDue` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `amountPaid` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `balanceAtDelivery` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `warrantyMonths` INTEGER NOT NULL DEFAULT 0,
  `warrantyUntil` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdBy` VARCHAR(191) NOT NULL DEFAULT '',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DeliveryRecord_repairId_key`(`repairId`),
  INDEX `DeliveryRecord_deliveredAt_idx`(`deliveredAt`),
  INDEX `DeliveryRecord_settlementMode_idx`(`settlementMode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeliveryRecord`
  ADD CONSTRAINT `DeliveryRecord_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
