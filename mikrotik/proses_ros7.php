<?php
$mikrotik = $_GET['mikrotik'];
?>
<form action="?module=proses_isolir" method="post" enctype="multipart/form-data">
    <section class="content">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="ri-settings-line"></i> Proses Insert Parameter Ke ROS 7 (Mikrotik: <?=$mikrotik;?>)</h3>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-info mb-4" role="alert">
                                <h6 class="alert-heading fw-bold mb-2">Sebelum klik tombol proses perhatikan hal-hal berikut ini (hanya berlaku isolir PPPoE):</h6>
                                <ol class="mb-0">
                                    <li>Ini merupakan jalan cepat untuk menginstall script ke mikrotik Anda / Jika Anda sudah mempunyai profil isolir di PPP, langkah ini bisa diskip.</li>
                                    <li>Pastikan Mikrotik sudah terkoneksi dengan benar</li>
                                    <li>Pastikan belum ada IP Pool pada segment 10.128.135.0/24</li>
                                    <li>Pastikan sudah mengaktivkan service PPPoE</li>
                                    <li>Ini akan membuat IP Pool dengan nama isolir</li>
                                    <li>Ini akan membuat Firewall Nat -> isolir</li>
                                    <li>Ini akan membuat Firewall Filter -> isolir</li>
                                    <li>Ini akan mengaktivkan Webproxy dan pengaturan Access</li>
                                    <li>Ini akan membuat profile PPP isolir</li>
                                    <li>Jika setuju silahkan klik tombol proses, dan setelah proses silahkan cek di winbox/webfig mikrotik Anda</li>
                                </ol>
                            </div>

                            <div class="form-group mb-4">
                                <label class="form-label">Masukan IP input internet mikrotik untuk redirect halaman isolir</label>
                                <input type="text" class="form-control" name="ether_input" placeholder="Contoh: 172.16.1.1" required>
                                <input type="text" name="mikrotik" value="<?=$mikrotik;?>" hidden>
                                <input type="text" name="alamat_isolir" value="<?= $alamat_isolir; ?>" hidden>
                                <input type="text" name="type" value="ros7" hidden>
                            </div>

                            <div class="alert alert-warning" role="alert">
                                <p class="mb-2">Setelah klik tombol proses, silahkan ikuti langkah ini:</p>
                                <ol class="mb-2">
                                    <li>IP -> Web Proxy -> Reset HTML -> yes/ok</li>
                                    <li>Copykan file standar informasi blokir berikut ini <a href="#" class="alert-link">klik disini untuk download</a></li>
                                    <li>Paste dalam folder webproxy di file mikrotik</li>
                                </ol>
                            </div>
                        </div>
                        <div class="card-footer d-flex justify-content-between">
                            <button type="submit" name="proses7" class="btn bg-label-primary btn-sm"><i class="ri-save-line"></i> Proses</button>
                            <a href="javascript:history.back()" class="btn bg-label-dark btn-sm"><i class="ri-arrow-go-back-line"></i> Kembali</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</form>