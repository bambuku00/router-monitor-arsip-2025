<?php
require('../dist/monitoring/conn_api.php');
$key = $_GET['key'];
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
    try {
        // Ambil data PPP profile
        $profile_print = $currentAPI->comm("/ppp/profile/print");
        $profiles = json_decode(json_encode($profile_print), true);

        // Ambil data IP pool untuk dropdown
        $pool_print = $currentAPI->comm("/ip/pool/print");
        $pools = json_decode(json_encode($pool_print), true);

        // Cari profile yang sesuai dengan key
        $profile = array_filter($profiles, function($data) use ($key) {
            return $data['name'] === $key;
        });

        if (empty($profile)) {
            die("Profile PPP tidak ditemukan");
        }

        $data = current($profile); // Ambil data profile pertama yang cocok
?>
        <section class="content">
            <form method="post" action="?module=proses_add_pppoe" enctype="multipart/form-data">
                <div class="container-fluid">
                    <div class="row">
                        <div class="col-md-12">
                            <div class="card card-success">
                                <div class="card-header">
                                    <h3 class="card-title"><i class="ri-user-edit-line"></i> Edit Profile PPP</h3>
                                </div>
                                <div class="card-body">
                                    <div class="form-group mb-3">
                                        <label>Name</label>
                                        <input type="text" class="form-control" name="name" value="<?= $data['name']; ?>" required>
                                        <input type="hidden" name="nama_lama" value="<?= $data['name']; ?>">
                                        <input type="hidden" name="mikrotik" value="<?= $mikrotik; ?>">
                                    </div>

                                    <div class="form-group mb-3">
                                        <label>Local Address</label>
                                        <input type="text" class="form-control" name="local-address" 
                                               value="<?= $data['local-address'] ?? ''; ?>" required>
                                    </div>

                                    <div class="form-group mb-3">
                                        <label>Remote Address (pilih ip-pool)</label>
                                        <select name="remote-address" class="form-select form-select-sm bg-secondary bg-opacity-10 text-dark" required>
                                            <option value="<?= $data['remote-address']; ?>"><?= $data['remote-address']; ?></option>
                                            <?php foreach ($pools as $pool) { 
                                                if ($pool['name'] !== $data['remote-address']) { ?>
                                                    <option value="<?= $pool['name']; ?>"><?= $pool['name']; ?></option>
                                            <?php }
                                            } ?>
                                        </select>
                                        <div class="mt-2">
                                            <a href="?module=add_ip_pool&token=edit_pppoe_profil&mikrotik=<?= $mikrotik; ?>&key=<?= $key; ?>" 
                                               class="btn bg-label-primary btn-sm">
                                                <i class="ri-add-line"></i> Tambah IP POOL
                                            </a>
                                        </div>
                                    </div>

                                    <div class="form-group mb-3">
                                        <label>Address List</label>
                                        <input type="text" class="form-control" name="address-list" 
                                               value="<?= $data['address-list'] ?? ''; ?>">
                                    </div>

                                    <div class="form-group mb-3">
                                        <label>Rate Limit (rx/tx)</label>
                                        <input type="text" class="form-control" name="rate-limit" 
                                               value="<?= $data['rate-limit'] ?? ''; ?>">
                                    </div>

                                    <div class="form-group mb-3">
                                        <label>Comment</label>
                                        <input type="text" class="form-control" name="comment" 
                                               value="<?= $data['comment'] ?? ''; ?>">
                                    </div>
                                </div>

                                <div class="card-footer d-flex justify-content-between">
                                    <button type="submit" name="edit_profil" class="btn bg-label-primary btn-sm">
                                        <i class="ri-save-line"></i> Update
                                    </button>
                                    <a href="javascript:history.back()" class="btn bg-label-dark btn-sm">
                                        <i class="ri-arrow-go-back-line"></i> Kembali
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </section>
<?php
    } catch (Exception $e) {
        die("Error: " . $e->getMessage());
    }
} else {
    die("Mikrotik tidak valid");
}
?>