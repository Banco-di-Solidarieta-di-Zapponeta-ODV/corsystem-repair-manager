CREATE TABLE `Device` (
  `id` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'Altro',
  `brand` VARCHAR(191) NOT NULL DEFAULT '',
  `model` VARCHAR(191) NOT NULL DEFAULT '',
  `imei` VARCHAR(191) NOT NULL DEFAULT '',
  `serialNumber` VARCHAR(191) NOT NULL DEFAULT '',
  `color` VARCHAR(191) NOT NULL DEFAULT '',
  `notes` TEXT NOT NULL,
  `fingerprint` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Device_clientId_fingerprint_key`(`clientId`, `fingerprint`),
  INDEX `Device_clientId_idx`(`clientId`),
  INDEX `Device_imei_idx`(`imei`),
  INDEX `Device_serialNumber_idx`(`serialNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Repair` ADD COLUMN `deviceId` VARCHAR(191) NULL;
CREATE INDEX `Repair_deviceId_idx` ON `Repair`(`deviceId`);

ALTER TABLE `Device`
  ADD CONSTRAINT `Device_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Repair`
  ADD CONSTRAINT `Repair_deviceId_fkey`
  FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill conservativo: ogni repair genera un'identita dispositivo deterministica.
-- L'IMEI ha priorita. Senza IMEI usiamo cliente + marca + modello + properties.
INSERT INTO `Device` (
  `id`, `clientId`, `type`, `brand`, `model`, `imei`, `serialNumber`, `color`, `notes`, `fingerprint`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('dev_', SUBSTRING(SHA2(CONCAT(
    r.`clientId`, '|',
    CASE
      WHEN TRIM(COALESCE(r.`imei`, '')) <> '' THEN CONCAT('imei:', LOWER(TRIM(r.`imei`)))
      ELSE CONCAT('legacy:', LOWER(TRIM(COALESCE(r.`brand`, ''))), '|', LOWER(TRIM(COALESCE(r.`model`, ''))), '|', LOWER(TRIM(COALESCE(r.`properties`, ''))))
    END
  ), 256), 1, 24)) AS `id`,
  r.`clientId`,
  'Altro' AS `type`,
  MAX(COALESCE(r.`brand`, '')) AS `brand`,
  MAX(COALESCE(r.`model`, '')) AS `model`,
  MAX(COALESCE(r.`imei`, '')) AS `imei`,
  '' AS `serialNumber`,
  '' AS `color`,
  '' AS `notes`,
  SHA2(CONCAT(
    r.`clientId`, '|',
    CASE
      WHEN TRIM(COALESCE(r.`imei`, '')) <> '' THEN CONCAT('imei:', LOWER(TRIM(r.`imei`)))
      ELSE CONCAT('legacy:', LOWER(TRIM(COALESCE(r.`brand`, ''))), '|', LOWER(TRIM(COALESCE(r.`model`, ''))), '|', LOWER(TRIM(COALESCE(r.`properties`, ''))))
    END
  ), 256) AS `fingerprint`,
  MIN(r.`createdAt`) AS `createdAt`,
  MAX(r.`updatedAt`) AS `updatedAt`
FROM `Repair` r
GROUP BY
  r.`clientId`,
  SHA2(CONCAT(
    r.`clientId`, '|',
    CASE
      WHEN TRIM(COALESCE(r.`imei`, '')) <> '' THEN CONCAT('imei:', LOWER(TRIM(r.`imei`)))
      ELSE CONCAT('legacy:', LOWER(TRIM(COALESCE(r.`brand`, ''))), '|', LOWER(TRIM(COALESCE(r.`model`, ''))), '|', LOWER(TRIM(COALESCE(r.`properties`, ''))))
    END
  ), 256);

UPDATE `Repair` r
JOIN `Device` d
  ON d.`clientId` = r.`clientId`
 AND d.`fingerprint` = SHA2(CONCAT(
    r.`clientId`, '|',
    CASE
      WHEN TRIM(COALESCE(r.`imei`, '')) <> '' THEN CONCAT('imei:', LOWER(TRIM(r.`imei`)))
      ELSE CONCAT('legacy:', LOWER(TRIM(COALESCE(r.`brand`, ''))), '|', LOWER(TRIM(COALESCE(r.`model`, ''))), '|', LOWER(TRIM(COALESCE(r.`properties`, ''))))
    END
  ), 256)
SET r.`deviceId` = d.`id`;
