<?php
require_once('../dist/monitoring/conn_api.php');
$key        = $_GET['key'];
$token      = $_GET['token'];
$mikrotik   = $_GET['mikrotik'];

if ($mikrotik == "1") {
    $do = $API->comm("/ip/pool/remove", array(
        "numbers" => $key,
    ));
} else if ($mikrotik == "2") {
    $do = $API2->comm("/ip/pool/remove", array(
        "numbers" => $key,
    ));
} else if ($mikrotik == "3") {
    $do = $API3->comm("/ip/pool/remove", array(
        "numbers" => $key,
    ));
}



header('location:?module=add_ip_pool&token=' . $token . '&mikrotik=' . $mikrotik);
