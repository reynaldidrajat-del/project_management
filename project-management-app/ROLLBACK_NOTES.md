# Rollback Notes

Dokumen ini menyimpan checkpoint commit penting agar rollback bisa dilakukan dengan jelas jika dibutuhkan.

## 2026-05-25 10:19:54 +07:00

- Commit: `03f50ee5c7686de6de8ee5a9eab663296380a6c0`
- Short hash: `03f50ee`
- Branch: `main`
- Remote: `origin`
- Repository: `https://github.com/reynaldidrajat-del/project_management.git`
- Commit message: `feat: update project management features`
- Status push: sudah dipush ke `origin/main`

### Ringkasan Perubahan

- Menambahkan fitur backend untuk activity, chat, notification, performance, checklist task, comment task, label task, permission, dan realtime service.
- Menambahkan migrasi database untuk auth/RBAC/activity, task labels/checklists, comments/notifications, dan realtime chat.
- Memperbarui route, controller, service, schema, seed, dan konfigurasi backend.
- Menambahkan fitur frontend untuk activity feed, chat, notification bell, realtime bridge, task calendar, task labels, bulk toolbar, halaman my tasks, notifications, performance, dan task calendar.
- Memperbarui dokumentasi pengembangan dan README.

### Verifikasi

- `npm run build` pada folder `frontend` berhasil.
- Vite memberi warning ukuran chunk JavaScript lebih dari 500 kB, tetapi build tetap sukses.

### Cara Rollback Aman

Gunakan `git revert` jika ingin membatalkan perubahan commit ini tanpa menghapus history Git:

```bash
git revert 03f50ee5c7686de6de8ee5a9eab663296380a6c0
git push origin main
```

Gunakan `git reset --hard` hanya jika benar-benar ingin memundurkan branch dan siap menimpa history remote:

```bash
git reset --hard c2794c9
git push --force-with-lease origin main
```

Catatan: untuk repository yang sudah dipush dan mungkin dipakai orang lain, `git revert` lebih aman daripada force push.
