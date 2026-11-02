<?php
$mikrotik = $_GET['mikrotik'];
?>
<section class="content">
  <form method="post" action="?module=proses_add_pppoe" enctype="multipart/form-data">
    <div class="container-fluid">
      <div class="row">
        <div class="col-md-12">
          <div class="card card-success">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-users nav-icon"></i> Tambah Profile PPP</h3>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-control" name="name" required>
                <input type="text" class="form-control" name="mikrotik" value="<?=$mikrotik;?>" hidden>
              </div>

              <div class="form-group">
                <label>Local Address</label>
                <input type="text" class="form-control" name="local-address" required>
              </div>

              <div class="form-group">
                <label>Remote Address (pilih ip-pool)</label>
                <?php
                  require('../dist/monitoring/conn_api.php');
                  if ($mikrotik == "1") {
                    $do = $API->comm("/ip/pool/print");
                  } else if ($mikrotik == "2") {
                    $do = $API2->comm("/ip/pool/print");
                  } else if ($mikrotik == "3") {
                    $do = $API3->comm("/ip/pool/print");
                  }

                  $json = json_encode($do);
                  $result = json_decode($json, true);
                ?>
                <select name="remote-address" class="form-select form-select-sm bg-secondary bg-opacity-10 text-dark" required>
                  <?php foreach ($result as $data) { ?>
                    <option value="<?=$data['name'];?>"><?=$data['name'];?></option>
                  <?php } ?>
                </select>
                <br>
                <a href="?module=add_ip_pool&token=add_pppoe_profil&mikrotik=<?=$_GET['mikrotik'];?>" class="btn bg-label-primary btn-sm"><i class="ri-add-line"></i> Tambah IP POOL</a>
              </div>

              <div class="form-group">
                <label>Address List</label>
                <input type="text" class="form-control" name="address-list">
              </div>

              <div class="form-group">
                <label>Rate Limit (rx/tx)</label>
                <input type="text" class="form-control" name="rate-limit">
              </div>

              <div class="form-group">
                <label>Comment</label>
                <input type="text" class="form-control" name="comment">
              </div>
            </div>
            <div class="card-footer">
              <button type="submit" name="proses_profil" class="btn bg-label-primary btn-sm"><i class="ri-save-line"></i> Simpan</button>
              <a href="javascript:history.back()" class="btn bg-label-dark btn-sm"><i class="ri-arrow-go-back-line"></i> Kembali</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</section>