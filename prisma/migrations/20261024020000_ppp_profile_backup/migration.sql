-- Cuplikan profil PPP terakhir dari router, untuk cadangan export.
ALTER TABLE `Router`
  ADD COLUMN `ppp_profile_backup` JSON NULL;
