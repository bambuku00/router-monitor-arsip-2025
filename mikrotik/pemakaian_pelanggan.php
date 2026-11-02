<?php
  $id = $_GET['id'];
  $pel = mysqli_fetch_array(mysqli_query($koneksi,"SELECT * FROM pelanggan WHERE id='$id'"));
    $nama = $pel['nama'];
  $link = mysqli_fetch_array(mysqli_query($koneksi,"SELECT * FROM pppoe_link WHERE id_pel='$id'"));
    $pppoe = $link['pppoe'];
?>
<section class="content">
    <div class="container-fluid">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="fas fa-chart-area nav-icon"></i> Pemakaian Pelanggan <?=$nama;?></h3>
               </div>
            <!-- /.card-header -->
            <div class="card-body">
              <iframe src="https://<?=$website;?>/dist/monitor2/index.php?interface=<pppoe-<?=$pppoe;?>>" height="500px" width="520px"></iframe>
            </div>
          </div>
    </div>
</section>