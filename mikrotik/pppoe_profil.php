<?php
require('../dist/monitoring/conn_api.php');
$mikrotik = $_GET['mikrotik'];

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

// Ambil API yang sesuai
$currentAPI = getAPI($mikrotik);

if ($currentAPI) {
    // Ambil info resource mikrotik
    $rsq = $currentAPI->comm("/system/resource/print");
    $result = json_decode(json_encode($rsq), true)[0];
    $type = $result['board-name'];
    $ros = $result['factory-software'];

    // Ambil data PPP profile
    $ppp_print = $currentAPI->comm("/ppp/profile/print");
    $profil = json_decode(json_encode($ppp_print), true);
} else {
    die("Mikrotik tidak valid");
}
?>

<div class="container-xxl flex-grow-1 container-p-y">
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="ri-profile-line"></i> PPP Profil - Mikrotik <?=$type;?> ROS : <?=$ros;?>
            </h5>
            <div class="d-flex gap-2">
                <a href="javascript:history.back()" class="btn bg-label-dark btn-sm">
                    <i class="ri-arrow-go-back-line"></i> Kembali
                </a>
                <a href="?module=add_pppoe_profil&mikrotik=<?=$mikrotik;?>" class="btn bg-label-success btn-sm">
                    <i class="ri-add-line"></i> Tambah Profil
                </a>
            </div>
        </div>

        <div class="card-datatable table-responsive">
            <table class="table table-hover" id="invoiceTable">
                <thead>
                    <tr>
                        <th class="d-none d-md-table-cell">No</th>
                        <th>Nama</th>
                        <th class="d-none d-md-table-cell">Local Address</th>
                        <th class="d-none d-md-table-cell">Remote Address</th>
                        <th class="d-none d-md-table-cell">Rate Limit</th>
                        <th class="d-none d-md-table-cell">Sync Paket</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $no = 1;                      
                    foreach ($profil as $data) {
                        // Query untuk data profil link dan paket
                        $profil_link = mysqli_query($koneksi, 
                            "SELECT pl.*, p.paket 
                             FROM pppoe_profil_link pl 
                             LEFT JOIN paket p ON p.id = pl.id_paket 
                             WHERE pl.profil = '$data[name]' 
                             AND pl.mikrotik = '$mikrotik'");
                        
                        $d1 = mysqli_fetch_array($profil_link);
                        $d2 = mysqli_num_rows($profil_link);
                    ?>
                    <tr>
                        <td class="d-none d-md-table-cell"><?= $no++; ?></td>
                        <td><?= $data['name']; ?></td>
                        <td class="d-none d-md-table-cell"><?= $data['local-address'] ?? '-'; ?></td>
                        <td class="d-none d-md-table-cell"><?= $data['remote-address'] ?? '-'; ?></td>
                        <td class="d-none d-md-table-cell"><?= $data['rate-limit'] ?? '-'; ?></td>
                        <td class="d-none d-md-table-cell"><?= $d1['paket'] ?? '-'; ?></td>
                        <td>
                            <div class="d-flex gap-2">
                                <?php if($d2 > 0){ ?>
                                    <a class="btn bg-label-danger btn-sm" 
                                       onclick="return confirm('Anda yakin ingin memutuskan hubungan profile PPP <?= $data['name']; ?>?')" 
                                       href="?module=proses_link_pppoe_profil&key=unlink&id=<?=$d1['id'];?>&mikrotik=<?=$mikrotik;?>" 
                                       title="UnLink Data">
                                        <i class="ri-link-unlink-m"></i>
                                    </a>
                                <?php } else { ?>
                                    <a class="btn bg-label-dark btn-sm" 
                                       href="?module=pppoe_profil_link&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>" 
                                       title="Link Data">
                                        <i class="ri-link-m"></i>
                                    </a>
                                <?php } ?>
                                
                                <a class="btn bg-label-info btn-sm" 
                                   href="?module=edit_pppoe_profil&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>" 
                                   title="Edit Data">
                                    <i class="ri-pencil-line"></i>
                                </a>

                                <a class="btn bg-label-warning btn-sm" 
                                   href="?module=remove_pppoe_profil&key=<?=$no-2;?>&id=<?=$d1['id'];?>&mikrotik=<?=$mikrotik;?>" 
                                   title="Delete Data" 
                                   onclick="return confirm('ANDA YAKIN AKAN MENGHAPUS DATA ?')">
                                    <i class="ri-delete-bin-line"></i>
                                </a>
                            </div>
                        </td>
                    </tr>
                    <?php } ?>
                </tbody>
            </table>
        </div>
    </div>
</div>