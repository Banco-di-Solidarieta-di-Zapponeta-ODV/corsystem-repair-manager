CREATE TABLE `Supplier` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `vatNumber` VARCHAR(191) NOT NULL DEFAULT '',
  `taxCode` VARCHAR(191) NOT NULL DEFAULT '',
  `email` VARCHAR(191) NOT NULL DEFAULT '',
  `phone` VARCHAR(191) NOT NULL DEFAULT '',
  `address` TEXT NOT NULL,
  `website` VARCHAR(191) NOT NULL DEFAULT '',
  `notes` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Supplier_name_idx`(`name`),
  INDEX `Supplier_vatNumber_idx`(`vatNumber`),
  INDEX `Supplier_active_idx`(`active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Part`
  ADD COLUMN `sku` VARCHAR(64) NULL,
  ADD COLUMN `barcode` VARCHAR(128) NULL,
  ADD COLUMN `supplierId` VARCHAR(191) NULL,
  ADD COLUMN `cost` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `stockQty` DECIMAL(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN `minStock` DECIMAL(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN `location` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE `Part`
SET `sku` = CONCAT('LEG-', UPPER(SUBSTRING(SHA2(`id`, 256), 1, 12)))
WHERE `sku` IS NULL OR TRIM(`sku`) = '';

CREATE UNIQUE INDEX `Part_sku_key` ON `Part`(`sku`);
CREATE UNIQUE INDEX `Part_barcode_key` ON `Part`(`barcode`);
CREATE INDEX `Part_supplierId_idx` ON `Part`(`supplierId`);
CREATE INDEX `Part_category_idx` ON `Part`(`category`);
CREATE INDEX `Part_active_idx` ON `Part`(`active`);
CREATE INDEX `Part_stockQty_idx` ON `Part`(`stockQty`);

ALTER TABLE `Part`
  ADD CONSTRAINT `Part_supplierId_fkey`
  FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `QuoteItem`
  ADD COLUMN `partId` VARCHAR(191) NULL;

CREATE INDEX `QuoteItem_partId_idx` ON `QuoteItem`(`partId`);

ALTER TABLE `QuoteItem`
  ADD CONSTRAINT `QuoteItem_partId_fkey`
  FOREIGN KEY (`partId`) REFERENCES `Part`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `RepairPart` (
  `id` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NOT NULL,
  `partId` VARCHAR(191) NOT NULL,
  `quoteItemId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
  `qtyRequested` DECIMAL(12,3) NOT NULL DEFAULT 1,
  `qtyReserved` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `qtyUsed` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `unitCostSnapshot` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `orderReference` VARCHAR(191) NOT NULL DEFAULT '',
  `expectedAt` DATETIME(3) NULL,
  `receivedAt` DATETIME(3) NULL,
  `notes` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `RepairPart_repairId_idx`(`repairId`),
  INDEX `RepairPart_partId_idx`(`partId`),
  INDEX `RepairPart_quoteItemId_idx`(`quoteItemId`),
  INDEX `RepairPart_status_idx`(`status`),
  INDEX `RepairPart_expectedAt_idx`(`expectedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RepairPart`
  ADD CONSTRAINT `RepairPart_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `RepairPart_partId_fkey`
  FOREIGN KEY (`partId`) REFERENCES `Part`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `RepairPart_quoteItemId_fkey`
  FOREIGN KEY (`quoteItemId`) REFERENCES `QuoteItem`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `StockMovement` (
  `id` VARCHAR(191) NOT NULL,
  `partId` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `stockBefore` DECIMAL(12,3) NOT NULL,
  `stockAfter` DECIMAL(12,3) NOT NULL,
  `unitCost` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `reference` VARCHAR(191) NOT NULL DEFAULT '',
  `note` TEXT NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL DEFAULT '',
  `happenedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `StockMovement_partId_idx`(`partId`),
  INDEX `StockMovement_repairId_idx`(`repairId`),
  INDEX `StockMovement_type_idx`(`type`),
  INDEX `StockMovement_happenedAt_idx`(`happenedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StockMovement`
  ADD CONSTRAINT `StockMovement_partId_fkey`
  FOREIGN KEY (`partId`) REFERENCES `Part`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockMovement_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
