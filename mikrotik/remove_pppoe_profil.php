<?php
    require_once('../dist/monitoring/conn_api.php');
    $key        = $_GET['key'];
    $id         = $_GET['id'];
    $mikrotik   = $_GET['mikrotik'];

    mysqli_query($koneksi,"DELETE FROM `pppoe_profil_link` WHERE `id`='$id'");
    
    if($mikrotik=="1"){
        $do = $API->comm("/ppp/profile/remove", array(
            "numbers" => $key,
            ));
    } else if($mikrotik=="2"){
        $do = $API2->comm("/ppp/profile/remove", array(
            "numbers" => $key,
            ));
    } else if($mikrotik=="3"){
        $do = $API3->comm("/ppp/profile/remove", array(
            "numbers" => $key,
            ));
    }
    
    header('location:?module=pppoe_profil&mikrotik='.$mikrotik);
?>