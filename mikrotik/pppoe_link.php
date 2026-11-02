<?php
$key = $_GET['key'];
$mikrotik = $_GET['mikrotik'];

require('../dist/monitoring/conn_api.php');
if ($mikrotik == "1") {
    $ppp_print = $API->comm("/ppp/secret/print");
} else if ($mikrotik == "2") {
    $ppp_print = $API2->comm("/ppp/secret/print");
} else if ($mikrotik == "3") {
    $ppp_print = $API3->comm("/ppp/secret/print");
}

$json = json_encode($ppp_print);
$result = json_decode($json, true);

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
                            <h3 class="card-title"><i class="ri-link-m"></i> Link PPPoe <-> Pelanggan</h3>
                        </div>
                        <div class="card-body">
                            <div class="form-group mb-3">
                                <label>Name PPPoe</label>
                                <input type="text" class="form-control" name="name" value="<?=$dat['name'];?>" readonly>
                                <input type="text" class="form-control" name="profile" value="<?=$dat['profile'];?>" readonly>
                            </div>

                            <div class="table-responsive">
                                <table id="example1" class="table table-sm table-hover table-bordered">
                                    <thead class="text-center">
                                        <tr>
                                            <th width="5%">No</th>
                                            <th>Nama Pelanggan</th>
                                            <th class="d-none d-md-table-cell">Paket Layanan</th>
                                            <th class="d-none d-md-table-cell">ODP</th>
                                            <th class="d-none d-md-table-cell">Tgl. Isolir</th>
                                            <th class="d-none d-md-table-cell">Alamat</th>
                                            <th class="d-none d-md-table-cell">Tgl. Install</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $ambildata = mysqli_query($koneksi, "SELECT * FROM pelanggan");
                                        $No = 1;
                                        while ($data = mysqli_fetch_array($ambildata)) {
                                            $cek_pppoe = mysqli_query($koneksi, "SELECT * FROM pppoe_link WHERE id_pel = '$data[id]'");
                                            if (mysqli_num_rows($cek_pppoe) > 0) {
                                                continue;
                                            }

                                            $g = mysqli_fetch_array(mysqli_query($koneksi, "SELECT * FROM paket WHERE id='$data[layanan]'"));
                                            $odp = mysqli_fetch_array(mysqli_query($koneksi, "SELECT * FROM odp WHERE id='$data[odp]'"));
                                        ?>
                                        <tr>
                                            <td class="text-center"><?=$No++;?></td>
                                            <td><?=$data['nama'];?></td>
                                            <td class="d-none d-md-table-cell"><?=$g['paket'];?></td>
                                            <td class="d-none d-md-table-cell"><?=$odp['nama'];?></td>
                                            <td class="d-none d-md-table-cell"><?=$data['tanggal_isolir2'];?></td>
                                            <td class="d-none d-md-table-cell"><?=$data['alamat'];?></td>
                                            <td class="d-none d-md-table-cell"><?=$data['tanggal_pasang'];?></td>
                                            <td class="text-center">
                                                <a class="btn bg-label-dark btn-sm" href="?module=proses_link_pppoe&id=<?=$data['id'];?>&nama=<?=$data['nama'];?>&pppoe=<?=$dat['name'];?>&profil2=<?=$dat['profile'];?>&isolir2=<?=$data['tanggal_isolir2'];?>&key=link&mikrotik=<?=$mikrotik;?>" onclick="return confirm('Anda yakin ingin menghubungkan pppoe <?=$dat['name'];?> dengan pelanggan <?=$data['nama'];?> ?')" title="Link Data">
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
