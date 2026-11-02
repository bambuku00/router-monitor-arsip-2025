<?php
$key        = $_GET['key'];
$id         = $_GET['id'];
$nama       = $_GET['nama'];
$pppoe      = $_GET['pppoe'];
$profil2      = $_GET['profil2'];
$isolir2      = $_GET['isolir2'];
$mikrotik   = $_GET['mikrotik'];

if ($key == 'link') {
    //validasi dulu biar ga duplikat
    $v1 = mysqli_num_rows(mysqli_query($koneksi, "SELECT * FROM pppoe_link WHERE id_pel='$id'"));
    if ($v1 > 0) {
        mysqli_query($koneksi, "DELETE FROM `pppoe_link` WHERE `id_pel`='$id'");
        mysqli_query($koneksi, "INSERT INTO `pppoe_link`(`id_pel`, `nama`,`pppoe`,`profil2`,`isolir2`,`mikrotik`) VALUES ('$id','$nama','$pppoe','$profil2','$isolir2','$mikrotik')");
        header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {
        mysqli_query($koneksi, "INSERT INTO `pppoe_link`(`id_pel`, `nama`,`pppoe`,`profil2`,`isolir2`,`mikrotik`) VALUES ('$id','$nama','$pppoe','$profil2','$isolir2','$mikrotik')");
        header('location:?module=secret&mikrotik=' . $mikrotik);
    }
} else if ($key == 'unlink') {
    mysqli_query($koneksi, "DELETE FROM `pppoe_link` WHERE `pppoe`='$pppoe'");
    header('location:?module=secret&mikrotik=' . $mikrotik);
}
