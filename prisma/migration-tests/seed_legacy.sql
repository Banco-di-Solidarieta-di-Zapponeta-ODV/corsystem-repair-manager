INSERT INTO `Staff` (`id`, `name`, `username`, `email`, `passwordHash`, `isAdmin`, `pagePermissions`, `sessionTokenHash`, `sessionExpiresAt`, `createdAt`, `updatedAt`) VALUES
('staff-admin-legacy', 'Admin Legacy', 'admin-legacy', 'admin@example.test', 'test:test', TRUE, JSON_ARRAY('repairs','clients','finance','settings'), NULL, NULL, NOW(3), NOW(3)),
('staff-custom-legacy', 'Operatore Legacy', 'operatore-legacy', 'operatore@example.test', 'test:test', FALSE, JSON_ARRAY('repairs','clients'), NULL, NULL, NOW(3), NOW(3));

INSERT INTO `Client` (`id`, `name`, `docType`, `identity`, `email`, `phone`, `address`, `comment`, `level`, `createdAt`, `updatedAt`) VALUES
('client-imei', 'Cliente IMEI', 'CF', 'TESTIMEI', 'imei@example.test', '3200000001', '', '', 'VIP', NOW(3), NOW(3)),
('client-legacy', 'Cliente Legacy', 'CF', 'TESTLEGACY', 'legacy@example.test', '3200000002', '', '', 'VIP', NOW(3), NOW(3));

INSERT INTO `Part` (`id`, `defaultName`, `category`, `zh`, `es`, `price`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
('legacy-part-display', 'Display OLED Samsung Galaxy S25', 'Display', '', 'Pantalla OLED Samsung Galaxy S25', 129.00, 1, NOW(3), NOW(3)),
('legacy-part-battery', 'Batteria Samsung Galaxy S25', 'Batterie', '', 'Bateria Samsung Galaxy S25', 79.00, 2, NOW(3), NOW(3));

INSERT INTO `Repair` (
  `id`, `ticket`, `clientId`, `brand`, `model`, `properties`, `imei`, `issue`, `internalNote`,
  `passwordType`, `passwordText`, `passwordPattern`, `status`, `repairTime`, `warrantyStart`,
  `technicianId`, `technicianName`, `budget`, `deposit`, `paymentMethod`, `discountAmount`, `costAmount`,
  `frontPhoto`, `backPhoto`, `signatureDataUrl`, `signedAt`, `publicToken`, `orderType`, `sourceRepairId`,
  `warrantyReason`, `warrantyDiagnosis`, `warrantyResolution`, `warrantyChargeable`, `statusHistory`,
  `notificationLog`, `searchText`, `ticketSort`, `createdAt`, `updatedAt`
) VALUES
(
  'repair-imei-1', 'LEGACY-100001', 'client-imei', 'Samsung', 'Galaxy S25', 'nero', '123456789012345',
  'Display rotto', '', '', '', JSON_ARRAY(), '预定', '2026-08-01 10:00', '', '', '',
  129.00, 0, 'none', 0, 0, '', '', '', '', 'public-imei-1', 'repair', '', '', '', '', FALSE,
  JSON_ARRAY(), JSON_ARRAY(), 'legacy 100001 samsung galaxy s25 123456789012345', 100001, NOW(3), NOW(3)
),
(
  'repair-imei-2', 'LEGACY-100002', 'client-imei', 'Samsung', 'Galaxy S25', 'nero', '123456789012345',
  'Batteria', '', '', '', JSON_ARRAY(), '预定', '2026-08-10 10:00', '', '', '',
  0, 0, 'none', 0, 0, '', '', '', '', 'public-imei-2', 'repair', '', '', '', '', FALSE,
  JSON_ARRAY(), JSON_ARRAY(), 'legacy 100002 samsung galaxy s25 123456789012345', 100002, NOW(3), NOW(3)
),
(
  'repair-legacy-1', 'LEGACY-100003', 'client-legacy', 'Apple', 'MacBook Air M2', 'grigio|A2681', '',
  'Non si accende', '', '', '', JSON_ARRAY(), '预定', '2026-08-15 09:00', '', '', '',
  240.00, 0, 'none', 0, 0, '', '', '', '', 'public-legacy-1', 'repair', '', '', '', '', FALSE,
  JSON_ARRAY(), JSON_ARRAY(), 'legacy 100003 apple macbook air m2', 100003, NOW(3), NOW(3)
),
(
  'repair-legacy-2', 'LEGACY-100004', 'client-legacy', 'Apple', 'MacBook Air M2', 'grigio|A2681', '',
  'Controllo alimentazione', '', '', '', JSON_ARRAY(), '预定', '2026-08-20 09:00', '', '', '',
  0, 0, 'none', 0, 0, '', '', '', '', 'public-legacy-2', 'repair', '', '', '', '', FALSE,
  JSON_ARRAY(), JSON_ARRAY(), 'legacy 100004 apple macbook air m2', 100004, NOW(3), NOW(3)
);
