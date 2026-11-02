<?php
require('../dist/monitoring/conn_api.php');

// Fungsi untuk mendapatkan API berdasarkan nomor mikrotik
function getAPI($mikrotik) {
    global $API, $API2, $API3;
    switch($mikrotik) {
        case "1": return $API;
        case "2": return $API2;
        case "3": return $API3;
        default: return null;
    }
}

// Validasi input mikrotik
$mikrotik = $_GET['mikrotik'] ?? null;
if (!in_array($mikrotik, ['1', '2', '3'])) {
    die("Mikrotik tidak valid");
}

// Ambil API yang sesuai
$currentAPI = getAPI($mikrotik);

try {
    // Ambil data PPP active dan secret
    $active_print = $currentAPI->comm("/ppp/active/print");
    $secret_print = $currentAPI->comm("/ppp/secret/print");
    
    $active = json_decode(json_encode($active_print), true);
    $secrets = json_decode(json_encode($secret_print), true);

    // Hitung statistik
    $active_count = count($active);
    $total_secrets = count($secrets);
    $inactive_count = $total_secrets - $active_count;
    
} catch (Exception $e) {
    die("Error: " . $e->getMessage());
}
?>

<section class="content">
    <div class="container-fluid">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h3 class="card-title d-flex align-items-center gap-2">
                    <img src="../dist/img/dot online.gif" alt="" width="30"> 
                    PPPoe Aktiv
                </h3>
                <div class="d-flex gap-2">
                    <a class="btn bg-label-danger btn-sm" href="#" title="PPPoE Tidak Aktif">
                        <i class="ri-link-unlink-m"></i> <?= $inactive_count; ?>
                    </a>
                    <a class="btn bg-label-success btn-sm" href="#" title="PPPoE Aktif">
                        <i class="ri-global-line"></i> <?= $active_count; ?>
                    </a>
                    <a class="btn bg-label-dark btn-sm" href="javascript:history.back()">
                        <i class="ri-arrow-go-back-line"></i> Kembali
                    </a>
                </div>
            </div>

            <div class="card-body">
                <div class="table-responsive">
                    <table id="example1" class="table table-sm table-hover table-bordered">
                        <thead class="text-center">
                            <tr>
                                <th width="5%">No</th>
                                <th width="15%">Nama</th>
                                <th width="20%" class="d-none d-md-table-cell">Caller-Id</th>
                                <th width="20%" class="d-none d-md-table-cell">Address</th>
                                <th width="20%" class="d-none d-md-table-cell">Uptime</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            $no = 1;
                            foreach ($active as $data) {
                                if ($data['service'] == 'pppoe') {
                                    $name = htmlspecialchars($data['name']);
                                    $caller_id = htmlspecialchars($data['caller-id']);
                                    $address = htmlspecialchars($data['address']);
                                    $uptime = htmlspecialchars($data['uptime']);
                            ?>
                                    <tr>
                                        <td class="text-center"><?= $no++; ?></td>
                                        <td><?= $name; ?></td>
                                        <td class="d-none d-md-table-cell"><?= $caller_id; ?></td>
                                        <td class="d-none d-md-table-cell"><?= $address; ?></td>
                                        <td class="d-none d-md-table-cell"><?= $uptime; ?></td>
                                        <td class="text-center">
                                            <div class="d-flex gap-2 justify-content-center">
                                                <a href="?module=edit_pppoe&key=<?= $name; ?>&mikrotik=<?= $mikrotik; ?>" 
                                                   class="btn bg-label-warning btn-sm"
                                                   title="Edit PPPoE">
                                                    <i class="ri-edit-line"></i> Edit
                                                </a>
                                                <a href="?module=delete_pppoe&key=<?= $name; ?>&mikrotik=<?= $mikrotik; ?>" 
                                                   class="btn bg-label-danger btn-sm"
                                                   title="Hapus PPPoE" 
                                                   onclick="return confirm('Anda yakin ingin menghapus PPPoE ini?')">
                                                    <i class="ri-delete-bin-line"></i> Hapus
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                            <?php
                                }
                            }
                            ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</section>