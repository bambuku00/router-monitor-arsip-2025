<?php
$key      = $_GET['key'];
$mikrotik = $_GET['mikrotik'];
require('../dist/monitoring/conn_api.php');
if($mikrotik=="1"){
  $ppp_print = $API->comm("/ppp/profile/print");
  $json = json_encode($ppp_print);
  $result = json_decode($json, true);
} else if($mikrotik=="2"){
  $ppp_print = $API2->comm("/ppp/profile/print");
  $json = json_encode($ppp_print);
  $result = json_decode($json, true);
} else if($mikrotik=="3"){
  $ppp_print = $API3->comm("/ppp/profile/print");
  $json = json_encode($ppp_print);
  $result = json_decode($json, true);
}





foreach ($result as $dat) {
  $nam = $dat['name'];
  if ($nam == $key) {
?>
    <section class="content">
        <form method="post" action="?module=proses_link_pppoe" enctype="multipart/form-data">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-12">
                        <div class="card card-success">
                            <div class="card-header">
                                <h3 class="card-title"><i class="ri-link-m"></i> Link PPP Profil <-> Paket Pelanggan</h3>
                            </div>
                            <div class="card-body">
                                <div class="form-group mb-3">
                                    <label>Nama Profil PPP</label>
                                    <input type="text" class="form-control" name="name" value="<?= $dat['name']; ?>" readonly>
                                </div>
                                <div class="table-responsive">
                                    <table id="example1" class="table table-sm table-hover table-bordered">
                                        <thead class="text-center">
                                            <tr>
                                                <th width="5%">No</th>
                                                <th>Nama Layanan</th>
                                                <th>Isi Kecepatan</th>
                                                <th>Harga</th>
                                                <th>Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php
                                            $ambildata = mysqli_query($koneksi, "SELECT * FROM paket");
                                            $No = 1;
                                            while ($data = mysqli_fetch_array($ambildata)) {
                                            ?>
                                            <tr>
                                                <td class="text-center"><?= $No++; ?></td>
                                                <td><?= $data['paket']; ?></td>
                                                <td><?= $data['kecepatan']; ?></td>
                                                <td>Rp <?= number_format($data['harga'], 0, ",", "."); ?></td>
                                                <td class="text-center">
                                                    <a class="btn bg-label-dark btn-sm" href="?module=proses_link_pppoe_profil&id=<?= $data['id']; ?>&profil=<?= $dat['name'];?>&key=link&mikrotik=<?=$mikrotik;?>" onclick="return confirm('Anda yakin ingin menghubungkan profile PPP <?= $dat['name']; ?> dengan paket pelanggan <?= $data['paket']; ?> ?')" title="Link Data">
                                                        <i class="ri-link-m"></i> Link
                                                    </a>
                                                </td>
                                            </tr>
                                            <?php
                                            }
                                            ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="card-footer">
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
  }
}
?>