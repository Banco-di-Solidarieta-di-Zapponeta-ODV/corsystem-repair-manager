CREATE TABLE `Diagnosis` (
  `id` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `technicianId` VARCHAR(191) NOT NULL DEFAULT '',
  `technicianName` VARCHAR(191) NOT NULL DEFAULT '',
  `findings` TEXT NOT NULL,
  `rootCause` TEXT NOT NULL,
  `proposedWork` TEXT NOT NULL,
  `partsNeeded` TEXT NOT NULL,
  `testsPerformed` TEXT NOT NULL,
  `riskNotes` TEXT NOT NULL,
  `customerSummary` TEXT NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL DEFAULT '',
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Diagnosis_repairId_key`(`repairId`),
  INDEX `Diagnosis_status_idx`(`status`),
  INDEX `Diagnosis_technicianId_idx`(`technicianId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Quote` (
  `id` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `publicToken` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL DEFAULT '',
  `customerMessage` TEXT NOT NULL,
  `internalNote` TEXT NOT NULL,
  `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `estimatedDays` INTEGER NULL,
  `validUntil` DATETIME(3) NULL,
  `sentAt` DATETIME(3) NULL,
  `respondedAt` DATETIME(3) NULL,
  `customerResponse` VARCHAR(191) NOT NULL DEFAULT '',
  `customerNote` TEXT NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL DEFAULT '',
  `supersededAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Quote_publicToken_key`(`publicToken`),
  UNIQUE INDEX `Quote_repairId_version_key`(`repairId`, `version`),
  INDEX `Quote_repairId_idx`(`repairId`),
  INDEX `Quote_status_idx`(`status`),
  INDEX `Quote_validUntil_idx`(`validUntil`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuoteItem` (
  `id` VARCHAR(191) NOT NULL,
  `quoteId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'service',
  `description` TEXT NOT NULL,
  `qty` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `unitPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `unitCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `lineTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `lineCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `QuoteItem_quoteId_idx`(`quoteId`),
  INDEX `QuoteItem_type_idx`(`type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Diagnosis`
  ADD CONSTRAINT `Diagnosis_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Quote`
  ADD CONSTRAINT `Quote_repairId_fkey`
  FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `QuoteItem`
  ADD CONSTRAINT `QuoteItem_quoteId_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Compatibilita con RepairNOTE: un budget storico valorizzato diventa
-- Preventivo v1 importato, senza cancellare il campo Repair.budget legacy.
INSERT INTO `Quote` (
  `id`, `repairId`, `version`, `status`, `publicToken`, `title`,
  `customerMessage`, `internalNote`, `subtotal`, `discountAmount`, `total`,
  `estimatedDays`, `validUntil`, `sentAt`, `respondedAt`, `customerResponse`,
  `customerNote`, `createdBy`, `supersededAt`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('quote_', SUBSTRING(SHA2(CONCAT('quote|', r.`id`), 256), 1, 24)),
  r.`id`,
  1,
  'LEGACY',
  CONCAT('legacy_', SUBSTRING(SHA2(CONCAT('token|', r.`id`), 256), 1, 32)),
  'Preventivo storico importato',
  '',
  'Importato automaticamente dal campo Repair.budget durante la migrazione CorSystem.',
  r.`budget`,
  0,
  r.`budget`,
  NULL,
  NULL,
  NULL,
  NULL,
  '',
  '',
  'migration',
  NULL,
  r.`createdAt`,
  r.`updatedAt`
FROM `Repair` r
WHERE r.`budget` > 0;

INSERT INTO `QuoteItem` (
  `id`, `quoteId`, `type`, `description`, `qty`, `unitPrice`, `unitCost`,
  `lineTotal`, `lineCost`, `sortOrder`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('qitem_', SUBSTRING(SHA2(CONCAT('qitem|', q.`id`), 256), 1, 24)),
  q.`id`,
  'legacy',
  'Preventivo storico RepairNOTE',
  1,
  q.`total`,
  0,
  q.`total`,
  0,
  0,
  q.`createdAt`,
  q.`updatedAt`
FROM `Quote` q
WHERE q.`status` = 'LEGACY';
