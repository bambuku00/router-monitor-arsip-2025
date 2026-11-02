<?php

$key        = $_GET['key'];
$id         = $_GET['id'];
$profil     = $_GET['profil'];
$mikrotik   = $_GET['mikrotik'];

$return_page = isset($_GET['return_page']) ? $_GET['return_page'] : '';
$redirect_url = ($return_page == 'paket') ? '?module=paket' : '?module=pppoe_profil&mikrotik='.$mikrotik;

if ($key == 'link') {
    //validasi dulu biar ga duplikat
    $v1 = mysqli_num_rows(mysqli_query($koneksi, "SELECT * FROM pppoe_profil_link WHERE id_paket='$id' and mikrotik='$mikrotik'"));
   
    if ($v1 > 0) {
        mysqli_query($koneksi, "DELETE FROM `pppoe_profil_link` WHERE `id`='$id'");
        mysqli_query($koneksi, "INSERT INTO `pppoe_profil_link`(`id_paket`, `profil`,`mikrotik`) VALUES ('$id','$profil','$mikrotik')");
        header('location:'.$redirect_url);
    } else {
        mysqli_query($koneksi, "INSERT INTO `pppoe_profil_link`(`id_paket`, `profil`,`mikrotik`) VALUES ('$id','$profil','$mikrotik')");
        header('location:'.$redirect_url);
    }
} else if ($key == 'unlink') {
    mysqli_query($koneksi, "DELETE FROM `pppoe_profil_link` WHERE `id`='$id'");
    header('location:'.$redirect_url);
}
