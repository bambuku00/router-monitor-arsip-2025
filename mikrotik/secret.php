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

    // Ambil data PPP secret
    $ppp_print = $currentAPI->comm("/ppp/secret/print");
    $secret = json_decode(json_encode($ppp_print), true);
    
    // Ambil data PPP aktif (online)
    $ppp_aktif = $currentAPI->comm("/ppp/active/print");
    $active_ppp = json_decode(json_encode($ppp_aktif), true);
    $active_names = array_column($active_ppp ?: [], 'name');
} else {
    die("Mikrotik tidak valid");
}

// Filter status
$filter_status = isset($_GET['filter']) ? $_GET['filter'] : 'all';

// Hitung status PPPoE
$online_count = 0;
$offline_count = 0;
$total_pppoe = 0;

foreach ($secret as $data) {
    if ($data['service'] == 'pppoe') {
        $total_pppoe++;
        if (in_array($data['name'], $active_names)) {
            $online_count++;
        } else {
            $offline_count++;
        }
    }
}

// Pagination & pencarian ditangani DataTables (sama seperti modul invoice)
?>
<div class="container-xxl flex-grow-1 container-p-y">
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="ri-user-line"></i> PPPoe - Mikrotik <?= $type; ?> ROS : <?= $ros; ?>
            </h5>
            <!-- Desktop buttons -->
            <div class="d-none d-md-flex gap-2">
                <a class="btn bg-label-success btn-sm" href="?module=add_pppoe&mikrotik=<?=$mikrotik;?>">
                    <i class="ri-add-line"></i> Tambah PPPoe
                </a>
                <a class="btn bg-label-primary btn-sm" href="?module=pppoe_profil&mikrotik=<?=$mikrotik;?>">
                    <i class="ri-profile-line"></i> PPPoe Profil
                </a>
                <a class="btn bg-label-danger btn-sm" href="?module=setting_isolir&mikrotik=<?=$mikrotik;?>">
                    <i class="ri-settings-3-line"></i> Setting Isolir
                </a>
                <a class="btn bg-label-info btn-sm" href="javascript:history.back()">
                    <i class="ri-arrow-go-back-line"></i> Kembali
                </a>
            </div>
            <!-- Mobile dropdown -->
            <div class="dropdown d-md-none">
                <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    <i class="ri-menu-line"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                        <a class="dropdown-item" href="?module=add_pppoe&mikrotik=<?=$mikrotik;?>">
                            <i class="ri-add-line"></i> Tambah PPPoe
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" href="?module=pppoe_profil&mikrotik=<?=$mikrotik;?>">
                            <i class="ri-profile-line"></i> PPPoe Profil
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" href="?module=setting_isolir&mikrotik=<?=$mikrotik;?>">
                            <i class="ri-settings-3-line"></i> Setting Isolir
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" href="javascript:history.back()">
                            <i class="ri-arrow-go-back-line"></i> Kembali
                        </a>
                    </li>
                </ul>
            </div>
        </div>
        <div class="card-body">
            <!-- Filter Status Section -->
            <div class="mb-4">
                <label class="form-label mb-2"><strong>Filter Status PPPoE:</strong></label>
                <div class="d-flex gap-2 flex-wrap">
                    <a href="?module=secret&mikrotik=<?=$mikrotik;?>&filter=all"
                       class="btn btn-sm <?= $filter_status == 'all' ? 'btn-primary' : 'btn-outline-secondary'; ?>">
                        <i class="ri-list-check-2"></i> Semua <span class="badge bg-dark ms-1"><?= $total_pppoe; ?></span>
                    </a>
                    <a href="?module=secret&mikrotik=<?=$mikrotik;?>&filter=online"
                       class="btn btn-sm <?= $filter_status == 'online' ? 'btn-success' : 'btn-outline-success'; ?>">
                        <i class="ri-wifi-line"></i> Online <span class="badge bg-success ms-1"><?= $online_count; ?></span>
                    </a>
                    <a href="?module=secret&mikrotik=<?=$mikrotik;?>&filter=offline"
                       class="btn btn-sm <?= $filter_status == 'offline' ? 'btn-danger' : 'btn-outline-danger'; ?>">
                        <i class="ri-wifi-off-line"></i> Offline <span class="badge bg-danger ms-1"><?= $offline_count; ?></span>
                    </a>
                </div>
            </div>

            <hr class="mb-3" />

            <!-- Show entries + pencarian hanya dari DataTables (jangan tambah input manual = dobel) -->
            <div class="card-datatable table-responsive">
                <table class="invoice-list-table table table-sm table-striped" id="secretPppoeTable">
                    <thead>
                        <tr>
                            <th class="d-none d-md-table-cell">No</th>
                            <th>Secret</th>
                            <th class="d-none d-md-table-cell">Password</th>
                            <th class="d-none d-md-table-cell">Profil</th>
                            <th class="d-none d-md-table-cell">Nama Pelanggan</th>
                            <th class="d-none d-md-table-cell">Paket</th>
                            <th class="d-none d-md-table-cell">ODP</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        $no = 1;
                        foreach ($secret as $data) {
                            if ($data['service'] == 'pppoe') {
                                // Tentukan status (online/offline)
                                $is_online = in_array($data['name'], $active_names);
                                $status_class = $is_online ? 'online' : 'offline';
                                
                                // Filter berdasarkan parameter
                                if ($filter_status != 'all' && $filter_status != $status_class) {
                                    continue;
                                }
                                
                                // Query untuk data pelanggan
                                $pel = [];
                                $paket = [];
                                $odp = [];
                                $pppoe_link = mysqli_query($koneksi, "SELECT * FROM pppoe_link WHERE pppoe='$data[name]'");
                                $d1 = mysqli_num_rows($pppoe_link);
                                if ($d1 > 0) {
                                    $d2 = mysqli_fetch_array($pppoe_link);
                                    $pel = mysqli_fetch_array(mysqli_query($koneksi, "SELECT * FROM pelanggan WHERE id='$d2[id_pel]'"));
                                    if (is_array($pel)) {
                                        $paket = mysqli_fetch_array(mysqli_query($koneksi, "SELECT * FROM paket WHERE id='$pel[layanan]'"));
                                        $odp = mysqli_fetch_array(mysqli_query($koneksi, "SELECT * FROM odp WHERE id='$pel[odp]'"));
                                    }
                                    if (!is_array($paket)) $paket = [];
                                    if (!is_array($odp)) $odp = [];
                                    if (!is_array($pel)) $pel = [];
                                }

                                $status = $data['disabled'];
                                ?>
                                <tr data-status="<?= $status_class; ?>" class="pppoe-row">
                                    <td class="d-none d-md-table-cell" data-label="No"><?= $no++; ?></td>
                                    <td data-label="Secret">
                                        <div class="d-flex align-items-center gap-2">
                                            <?php if ($is_online): ?>
                                                <span class="badge bg-success"><i class="ri-wifi-line"></i></span>
                                            <?php else: ?>
                                                <span class="badge bg-danger"><i class="ri-wifi-off-line"></i></span>
                                            <?php endif; ?>
                                            <span><?= htmlspecialchars($data['name'] ?? ''); ?></span>
                                        </div>
                                    </td>
                                    <td class="d-none d-md-table-cell" data-label="Password"><?= htmlspecialchars($data['password'] ?? ''); ?></td>
                                    <td class="d-none d-md-table-cell" data-label="Profil"><?= htmlspecialchars($data['profile'] ?? ''); ?></td>
                                    <td class="d-none d-md-table-cell" data-label="Nama"><?= htmlspecialchars($pel['nama'] ?? '-'); ?></td>
                                    <td class="d-none d-md-table-cell" data-label="Paket"><?= htmlspecialchars($paket['paket'] ?? '-'); ?></td>
                                    <td class="d-none d-md-table-cell" data-label="ODP"><?= htmlspecialchars($odp['nama'] ?? '-'); ?></td>
                                    <td data-label="Aksi" class="mobile-card-actions">
                                        <div class="d-flex align-items-center">
                                            <?php if ($status == 'false') { ?>
                                                <a href="?module=disable_pppoe&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>" 
                                                   class="text-body"
                                                   data-bs-toggle="tooltip"
                                                   data-bs-placement="top"
                                                   title="Disabled And Disconnect Data"
                                                   onclick="return confirm('Anda ingin melakukan disabled dan memutuskan koneksi pada akun ini ?')">
                                                    <i class="ri-shut-down-line fs-5"></i>
                                                </a>
                                            <?php } else { ?>
                                                <a href="?module=enable_pppoe&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>"
                                                   class="text-body"
                                                   data-bs-toggle="tooltip"
                                                   data-bs-placement="top"
                                                   title="Enabled Data">
                                                    <i class="ri-checkbox-circle-line fs-5"></i>
                                                </a>
                                            <?php } ?>

                                            <a href="?module=edit_pppoe&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>&id=<?=$pel['id'] ?? '';?>"
                                               class="text-body ms-2"
                                               data-bs-toggle="tooltip"
                                               data-bs-placement="top"
                                               title="Edit Data">
                                                <i class="ri-pencil-line fs-5"></i>
                                            </a>

                                            <?php if ($d1 == 0) { ?>
                                                <a href="?module=pppoe_link&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>"
                                                   class="text-danger ms-2"
                                                   data-bs-toggle="tooltip"
                                                   data-bs-placement="top"
                                                   title="Link Data">
                                                    <i class="ri-link-m fs-5"></i>
                                                </a>
                                            <?php } else { ?>
                                                <a href="?module=proses_link_pppoe&pppoe=<?= $data['name']; ?>&key=unlink&mikrotik=<?=$mikrotik;?>"
                                                   class="text-success ms-2"
                                                   data-bs-toggle="tooltip"
                                                   data-bs-placement="top"
                                                   title="Unlink Data">
                                                    <i class="ri-link-unlink-m fs-5"></i>
                                                </a>
                                            <?php } ?>

                                            <a href="?module=remove_pppoe&key=<?= $data['name']; ?>&mikrotik=<?=$mikrotik;?>"
                                               class="text-body ms-2"
                                               data-bs-toggle="tooltip"
                                               data-bs-placement="top"
                                               title="Delete Data"
                                               onclick="return confirm('ANDA YAKIN AKAN MENGHAPUS DATA , DAN MEMUTUSKAN KONEKSI?')">
                                                <i class="ri-delete-bin-2-line fs-5"></i>
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            <?php }
                        } ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

