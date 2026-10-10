-- Harus selalu ada minimal satu admin utama yang aktif: tolak penonaktifan,
-- penggantian peran, atau penghapusan admin aktif terakhir. Pengecualian
-- hanya untuk koneksi yang sengaja membuat tabel TEMP `allow_admin_purge`
-- (pembersihan data tes / pemeliharaan), tidak pernah dari aplikasi.
CREATE TRIGGER `users_keep_last_admin_update`
BEFORE UPDATE OF `role`, `active` ON `users`
WHEN OLD.`role` = 'admin' AND OLD.`active` = 1
  AND (NEW.`role` <> 'admin' OR NEW.`active` = 0)
  AND (SELECT count(*) FROM `users` WHERE `role` = 'admin' AND `active` = 1) <= 1
  AND NOT EXISTS (SELECT 1 FROM pragma_table_list WHERE `schema` = 'temp' AND `name` = 'allow_admin_purge')
BEGIN
  SELECT RAISE(ABORT, 'admin aktif terakhir tidak boleh dinonaktifkan');
END;
--> statement-breakpoint
CREATE TRIGGER `users_keep_last_admin_delete`
BEFORE DELETE ON `users`
WHEN OLD.`role` = 'admin' AND OLD.`active` = 1
  AND (SELECT count(*) FROM `users` WHERE `role` = 'admin' AND `active` = 1) <= 1
  AND NOT EXISTS (SELECT 1 FROM pragma_table_list WHERE `schema` = 'temp' AND `name` = 'allow_admin_purge')
BEGIN
  SELECT RAISE(ABORT, 'admin aktif terakhir tidak boleh dihapus');
END;
