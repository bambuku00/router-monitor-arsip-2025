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
    // Ambil data PPP secret
    $ppp_print = $currentAPI->comm("/ppp/secret/print");
    $secrets = json_decode(json_encode($ppp_print), true);

    // Ambil data PPP profile untuk dropdown
    $profile_print = $currentAPI->comm("/ppp/profile/print");
    $profiles = json_decode(json_encode($profile_print), true);

    // Cari secret yang sesuai dengan key
    $secret = array_filter($secrets, function($data) use ($key) {
        return $data['name'] === $key;
    });

    if (empty($secret)) {
        die("PPPoE secret tidak ditemukan");
    }

    $data = current($secret); // Ambil data secret pertama yang cocok
?>
    <section class="content">
        <form method="post" action="?module=proses_edit_pppoe" enctype="multipart/form-data">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-12">
                        <div class="card card-success">
                            <div class="card-header">
                                <h3 class="card-title"><i class="ri-user-edit-line"></i> Edit PPPoe</h3>
                            </div>
                            <div class="card-body">
                                <div class="form-group mb-3">
                                    <label>Name</label>
                                    <input type="text" class="form-control" name="name" value="<?= $data['name']; ?>" required>
                                    <input type="hidden" name="nama_lama" value="<?= $data['name']; ?>">
                                    <input type="hidden" name="mikrotik" value="<?= $mikrotik; ?>">
                                </div>

                                <div class="form-group mb-3">
                                    <label>Password</label>
                                    <input type="text" class="form-control" name="password" value="<?= $data['password']; ?>" required>
                                </div>

                                <div class="form-group mb-3">
                                    <label>Profil</label>
                                    <select name="profile" class="form-select form-select-sm bg-secondary bg-opacity-10 text-dark" required>
                                        <option value="<?= $data['profile']; ?>"><?= $data['profile']; ?></option>
                                        <?php foreach ($profiles as $profile) { 
                                            if ($profile['name'] !== $data['profile']) { ?>
                                                <option value="<?= $profile['name']; ?>"><?= $profile['name']; ?></option>
                                        <?php }
                                        } ?>
                                    </select>
                                </div>

                                <div class="form-group mb-3">
                                    <label>Comment</label>
                                    <input type="text" class="form-control" name="comment" value="<?= $data['comment'] ?? ''; ?>">
                                </div>
                            </div>

                            <div class="card-footer d-flex gap-2">
                                <button type="submit" name="proses" class="btn bg-label-warning btn-sm">
                                    <i class="ri-edit-line"></i> Update
                                </button>
                                <button type="submit" name="proses2" class="btn bg-label-success btn-sm" 
                                        onclick="return confirm('Anda ingin melakukan update dan mengkoneksikan ulang PPPoE ini?')">
                                    <i class="ri-refresh-line"></i> Update & Reconnect PPPoE
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
} else {
    die("Mikrotik tidak valid");
}
?>