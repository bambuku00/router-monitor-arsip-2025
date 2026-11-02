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
              <h3 class="card-title"><i class="ri-user-add-line"></i> Tambah PPPoe</h3>
            </div>
            <div class="card-body">
              <div class="form-group mb-3">
                <label>Name</label>
                <input type="text" class="form-control" name="name" required>
                <input type="text" name="mikrotik" value="<?=$mikrotik;?>" hidden>
              </div>

              <div class="form-group mb-3">
                <label>Password</label>
                <input type="text" class="form-control" name="password" required>
              </div>

              <div class="form-group mb-3">
                <label>Profil</label>
                <?php
                require('../dist/monitoring/conn_api.php');
                if($mikrotik=="1"){
                  $do = $API->comm("/ppp/profile/print");
                } else if($mikrotik=="2"){
                  $do = $API2->comm("/ppp/profile/print");
                } else if($mikrotik=="3"){
                  $do = $API3->comm("/ppp/profile/print");
                }
               
                $json = json_encode($do);
                $result = json_decode($json, true);
                ?>
                <select name="profile" class="form-select form-select-sm bg-secondary bg-opacity-10 text-dark" required>
                  <?php foreach ($result as $data) { ?>
                    <option value="<?= $data['name']; ?>"><?= $data['name']; ?></option>
                  <?php } ?>
                </select>
              </div>

              <div class="form-group mb-3">
                <label>Comment</label>
                <input type="text" class="form-control" name="comment">
              </div>
            </div>

            <div class="card-footer d-flex justify-content-between">
              <button type="submit" name="proses" class="btn bg-label-primary btn-sm">
                <i class="ri-save-line"></i> Simpan
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