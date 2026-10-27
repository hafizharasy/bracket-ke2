ALTER TABLE `sessions` ADD `stage` text DEFAULT 'room' NOT NULL;--> statement-breakpoint
-- Data: bagan yang sudah dibuat menaruh semifinal & final di sesi terakhir.
-- Pindahkan ke sesi tersendiri "Semifinal & Final" (jam mulai = jadwal
-- semifinal yang ada). Database baru / tanpa bagan tidak terpengaruh.
INSERT INTO `sessions` (`id`, `name`, `order_index`, `start_time`, `stage`)
SELECT 'sesi-final', 'Semifinal & Final', 1000, (SELECT MIN(`scheduled_at`) FROM `matches` WHERE `round` > 6), 'final'
WHERE EXISTS (SELECT 1 FROM `matches` WHERE `round` > 6)
  AND NOT EXISTS (SELECT 1 FROM `sessions` WHERE `stage` = 'final' OR `id` = 'sesi-final' OR `order_index` = 1000);
--> statement-breakpoint
UPDATE `matches` SET `session_id` = (SELECT `id` FROM `sessions` WHERE `stage` = 'final' LIMIT 1)
WHERE `round` > 6 AND EXISTS (SELECT 1 FROM `sessions` WHERE `stage` = 'final');
