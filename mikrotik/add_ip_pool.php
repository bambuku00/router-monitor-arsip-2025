<?php
$token = $_GET['token'];
$mikrotik = $_GET['mikrotik'];

require('../dist/monitoring/conn_api.php');
$mikrotik = $_GET['mikrotik'];

if ($mikrotik == "1") {
  $pool_print = $API->comm("/ip/pool/print");
  $json       = json_encode($pool_print);
  $pool     = json_decode($json, true);
} else if ($mikrotik == "2") {
  $pool_print = $API2->comm("/ip/pool/print");
  $json       = json_encode($pool_print);
  $pool     = json_decode($json, true);
} else if ($mikrotik == "3") {
  $pool_print = $API3->comm("/ip/pool/print");
  $json       = json_encode($pool_print);
  $pool     = json_decode($json, true);
}
?>
<section class="content">
  <form method="post" action="?module=proses_add_pppoe" enctype="multipart/form-data">
    <div class="container-fluid">
      <div class="row">
        <div class="col-md-12">
          <div class="card card-success">
            <div class="card-header">
              <h3 class="card-title"> <i class="fas fa-users nav-icon"></i> Tambah IP POOL</h3>
            </div>
            <!-- /.card-header -->
            <!-- form start -->

            <div class="card-body">

              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-control" name="name" required>
                <input type="text" class="form-control" name="token" value="<?= $token; ?>" hidden>
                <input type="text" class="form-control" name="mikrotik" value="<?= $mikrotik; ?>" hidden>
                <?php
                  if($_GET['key']!==""){
                    ?>
                     <input type="text" class="form-control" name="key" value="<?= $_GET['key']; ?>" hidden>
                    <?php
                  }
                ?>
              </div>

              <div class="form-group">
                <label>Ranges</label>
                <input type="text" class="form-control" name="ranges" required>
              </div>
            </div>

            <div class="card-footer">
              <button type="submit" name="proses_pool" class="btn btn-primary"><i class="fas fa-save"></i> Simpan</button>
              <a href="javascript:history.back()" class="btn btn-info pull-right"><i class="fa fa-undo"></i> Kembali</a>
            </div>

          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-12">
          <div class="card card-danger">
            <div class="card-header">
              <h3 class="card-title"> <i class="fas fa-users nav-icon"></i> List IP POOL</h3>
            </div>
            <div class="card-body">
              <table id="example1" class="table table-sm table-bordered table-striped">
                <thead>
                  <th style="width: 5%;">No</th>
                  <th style="width: 20%;">Nama</th>
                  <th style="width: 20%;">Ranges</th>
                  <th style="width: 20%;">Next Pool</th>
                  <th style="width: 18%;">Aksi</th>
                </thead>
                <tbody>
                  <?php
                  $no = 1;
                  foreach ($pool as $data) {

                  ?>
                    <tr style="background-color: <?= $wr; ?>;">
                      <td><?= $no++; ?></td>
                      <td><?= $data['name']; ?></td>
                      <td><?= $data['ranges']; ?></td>
                      <td><?= $data['next-pool']; ?></td>

                      <td>
                        <a class="btn btn-danger btn-sm" href="?module=remove_pool&key=<?=$no-2;?>&token=<?=$token;?>&mikrotik=<?=$mikrotik;?>" title="Delete Data" onclick="return confirm('ANDA YAKIN AKAN MENGHAPUS DATA ? HATI-HATI , JIKA ANDA HAPUS POOL PASTIKAN DI PROFIL PPP HARUS DI UPDATE JUGA POOL TERBARU')"><i class="fas fa-trash"></i></a>
                      </td>
                    </tr>
                  <?php
                  }

                  ?>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</section>