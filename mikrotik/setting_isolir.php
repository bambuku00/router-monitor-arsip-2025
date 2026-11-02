<?php
require_once __DIR__ . '/../../../helpers/auto_isolir.php';
ensure_heysoyam_hari_tunggu_isolir_column($koneksi);
$mikrotik = $_GET['mikrotik'];
$hey = mysqli_fetch_array(mysqli_query($koneksi, "SELECT * FROM heysoyam"));
?>

<form action="" method="post">
    <section class="content">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-cogs"></i> Setting Auto Isolir</h3>
                        </div>
                        <div class="card-body">
                            <?php
                            require('../dist/monitoring/conn_api.php');

                            if ($mikrotik == "1") {
                                $rsq = $API->comm("/system/resource/print");
                            } else if ($mikrotik == "2") {
                                $rsq = $API2->comm("/system/resource/print");
                            } else if ($mikrotik == "3") {
                                $rsq = $API3->comm("/system/resource/print");
                            }

                            $j1 = json_encode($rsq);
                            $result = json_decode($j1, true);
                            ?>
                            <i class="fas fa-bullhorn"></i> <i>Pastikan API Mikrotik Anda sudah terkoneksi</i>
                            <br><br>
                            <table class="table table-sm table-striped">
                                <tbody>
                                    <tr>
                                        <td style="width: 20%;">Type</td>
                                        <td style="width: 3%;">:</td>
                                        <td><?= $result['0']['board-name']; ?></td>
                                    </tr>
                                    <tr>
                                        <td style="width: 20%;">Router OS</td>
                                        <td style="width: 3%;">:</td>
                                        <td><?= $result['0']['factory-software']; ?></td>
                                    </tr>
                                    <tr>
                                        <td style="width: 20%;">CPU Usage</td>
                                        <td style="width: 3%;">:</td>
                                        <td><?= $result['0']['cpu-load']; ?> %</td>
                                    </tr>
                                    <tr>
                                        <td style="width: 20%;">Up Time</td>
                                        <td style="width: 3%;">:</td>
                                        <td><?= $result['0']['uptime']; ?></td>
                                    </tr>
                                </tbody>
                            </table>
                            <br>
                            <label>Silahkan konfigurasi pengaturan isolir di bawah ini:</label>
                            <br><br>

                            <input type="hidden" name="mikrotik" value="<?= $mikrotik ?>">

                            <div class="form-group">
                                <label>Tanggal Isolir</label>
                                <input type="text" class="form-control" name="tanggal_isolir" 
                                       value="<?= $hey['tanggal_isolir']; ?>" placeholder="Contoh: 20">
                                <small class="text-muted">Masukkan tanggal (1-31) untuk isolir bulanan</small>
                            </div>

                            <div class="form-group">
                                <label>Hari Tunggu Setelah Jatuh Tempo</label>
                                <input type="number" min="0" max="90" class="form-control" name="hari_tunggu_isolir" 
                                       value="<?= htmlspecialchars((string) ($hey['hari_tunggu_isolir'] ?? '0')); ?>" placeholder="0">
                                <small class="text-muted">Hari tambahan setelah jatuh tempo sebelum auto isolir (0 = keesokan hari)</small>
                            </div>

                            <div class="form-group">
                                <label>Waktu Isolir Harian (opsional)</label>
                                <input type="time" class="form-control" name="waktu_isolir_auto" 
                                       value="<?= $hey['waktu_isolir_auto']; ?>">
                                <small class="text-muted">Kosongkan = cek setiap cron. Isi jam untuk proses sekali sehari.</small>
                            </div>

                            <div class="form-group">
                                <label>Profil Isolir</label>
                                <input type="text" class="form-control" name="profil_isolir" 
                                       value="<?= $hey['profil_isolir']; ?>">
                                <small class="text-muted">Nama profil isolir di Mikrotik</small>
                            </div>

                            <div class="mt-4 mb-3">
                                <button type="submit" name="update_profil" class="btn bg-label-primary btn-sm">
                                    <i class="fas fa-save"></i> Update
                                </button>
                                <a href="?module=proses_ros6&mikrotik=<?= $mikrotik; ?>" class="btn bg-label-success btn-sm">
                                    <i class="fas fa-check"></i> Router OS 6
                                </a>
                                <a href="?module=proses_ros7&mikrotik=<?= $mikrotik; ?>" class="btn bg-label-info btn-sm">
                                    <i class="fas fa-check"></i> Router OS 7
                                </a>
                                <a href="javascript:history.back()" class="btn bg-label-dark btn-sm">
                                    <i class="fas fa-undo"></i> Kembali
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</form>

<?php
if(isset($_POST['update_profil'])){
    $profil_isolir      = $_POST['profil_isolir'];
    $tanggal_isolir     = $_POST['tanggal_isolir'];
    $waktu_isolir_auto  = $_POST['waktu_isolir_auto'];
    $hari_tunggu_isolir = (int) ($_POST['hari_tunggu_isolir'] ?? 0);
    if ($hari_tunggu_isolir < 0) {
        $hari_tunggu_isolir = 0;
    }
    if ($hari_tunggu_isolir > 90) {
        $hari_tunggu_isolir = 90;
    }
    $mikrotik           = $_POST['mikrotik'];

    $up = mysqli_query($koneksi,"UPDATE `heysoyam` SET 
        `tanggal_isolir`='$tanggal_isolir',
        `profil_isolir`='$profil_isolir',
        `hari_tunggu_isolir`=$hari_tunggu_isolir,
        `waktu_isolir_auto`='$waktu_isolir_auto' 
        WHERE `id`=1");

    if($up){
        header('location:?module=setting_isolir&mikrotik='.$mikrotik);
    } else {
        echo 'Update data gagal hubungi mukti';
    }
}
?>