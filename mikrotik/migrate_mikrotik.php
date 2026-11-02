<?php
/**
 * Migrasi data dari tabel mikrotik (lama) ke mikrotik_router (baru)
 * Jalankan sekali: http://localhost/apiwin/admin/module/mikrotik/migrate_mikrotik.php
 */
require_once __DIR__ . '/../../../koneksi.php';

header('Content-Type: text/html; charset=utf-8');
echo "<h2>Migrasi MikroTik ke mikrotik_router</h2>";

// 1. Buat tabel jika belum ada
$sql_create = "CREATE TABLE IF NOT EXISTS mikrotik_router (
  id int(11) NOT NULL AUTO_INCREMENT,
  nama varchar(100) DEFAULT 'Mikrotik',
  ip varchar(50) NOT NULL,
  user varchar(50) NOT NULL,
  pass varchar(100) NOT NULL,
  port varchar(10) DEFAULT '8728',
  urutan int(11) DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
if (mysqli_query($koneksi, $sql_create)) {
    echo "<p>✓ Tabel mikrotik_router siap</p>";
} else {
    die("<p>✗ Gagal buat tabel: " . mysqli_error($koneksi) . "</p>");
}

// 2. Cek apakah sudah ada data di mikrotik_router (skip migrasi jika sudah)
$cek = mysqli_query($koneksi, "SELECT COUNT(*) as n FROM mikrotik_router");
$row = mysqli_fetch_assoc($cek);
if ($row && $row['n'] > 0) {
    echo "<p>Data sudah ada di mikrotik_router (" . $row['n'] . " baris). Skip migrasi.</p>";
    echo "<p><a href='../../index.php?module=mikrotik'>Kembali ke Pengaturan MikroTik</a></p>";
    exit;
}

// 3. Ambil data dari tabel mikrotik lama
$old = mysqli_query($koneksi, "SELECT * FROM mikrotik WHERE id=1 LIMIT 1");
if (!$old || mysqli_num_rows($old) == 0) {
    echo "<p>Tidak ada data di tabel mikrotik. Silakan tambah MikroTik di pengaturan.</p>";
    exit;
}

$data = mysqli_fetch_assoc($old);
$mikrotiks = [];

foreach ([1 => '', 2 => '2', 3 => '3', 4 => '4', 5 => '5'] as $num => $suffix) {
    $ip = trim($data['ip_mikrotik' . $suffix] ?? '');
    if ($ip === '' || $ip === '0' || $ip === '-') continue;
    $mikrotiks[] = [
        'id' => $num,
        'nama' => 'Mikrotik ' . $num,
        'ip' => $ip,
        'user' => $data['user_mikrotik' . $suffix] ?? 'admin',
        'pass' => $data['pass_mikrotik' . $suffix] ?? '',
        'port' => $data['port_mikrotik' . $suffix] ?? '8728',
    ];
}

if (empty($mikrotiks)) {
    echo "<p>Tidak ada MikroTik yang terkonfigurasi di tabel lama.</p>";
    exit;
}

// 4. Insert ke mikrotik_router
foreach ($mikrotiks as $m) {
    $ip = mysqli_real_escape_string($koneksi, $m['ip']);
    $user = mysqli_real_escape_string($koneksi, $m['user']);
    $pass = mysqli_real_escape_string($koneksi, $m['pass']);
    $port = mysqli_real_escape_string($koneksi, $m['port']);
    $nama = mysqli_real_escape_string($koneksi, $m['nama']);
    $id = (int)$m['id'];
    
    $sql = "INSERT INTO mikrotik_router (id, nama, ip, user, pass, port, urutan) 
            VALUES ($id, '$nama', '$ip', '$user', '$pass', '$port', $id)";
    if (mysqli_query($koneksi, $sql)) {
        echo "<p>✓ Migrasi MikroTik $id: $ip</p>";
    } else {
        echo "<p>✗ Gagal: " . mysqli_error($koneksi) . "</p>";
    }
}

echo "<p><strong>Migrasi selesai.</strong> Silakan tes aplikasi. Tabel mikrotik lama tetap ada untuk cadangan.</p>";
echo "<p><a href='../../index.php?module=mikrotik'>Kembali ke Pengaturan MikroTik</a></p>";
