<?php
require('../../../koneksi.php');

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $nama = mysqli_real_escape_string($koneksi, $_POST['nama']);
    $ip = mysqli_real_escape_string($koneksi, $_POST['ip_address']);
    $user = mysqli_real_escape_string($koneksi, $_POST['username']);
    $pass = mysqli_real_escape_string($koneksi, $_POST['password']);
    $port = mysqli_real_escape_string($koneksi, $_POST['port'] ?: '8728');

    $maxq = mysqli_query($koneksi, "SELECT COALESCE(MAX(id), 0) as m FROM mikrotik_router");
    $next = $maxq && ($r = mysqli_fetch_assoc($maxq)) ? (int)$r['m'] + 1 : 1;
    $query = "INSERT INTO mikrotik_router (id, nama, ip, user, pass, port, urutan) VALUES ($next, '$nama', '$ip', '$user', '$pass', '$port', $next)";

    if (mysqli_query($koneksi, $query)) {
        header('Location: ?module=mikrotik');
    } else {
        echo "Gagal menambahkan Mikrotik: " . mysqli_error($koneksi);
    }
}
?>

<section class="content">
    <div class="container-fluid">
        <div class="card">
            <div class="card-header">
                <h3 class="card-title"><i class="ri-router-line"></i> Tambah Mikrotik</h3>
            </div>
            <div class="card-body">
                <form method="post" action="">
                    <div class="form-group">
                        <label>Nama Mikrotik</label>
                        <input type="text" name="nama" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>IP Address</label>
                        <input type="text" name="ip_address" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" name="username" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Port</label>
                        <input type="number" name="port" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-success">Simpan</button>
                </form>
            </div>
        </div>
    </div>
</section> 