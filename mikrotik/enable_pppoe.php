<?php
require_once('../dist/monitoring/conn_api.php');
$key        = $_GET['key'];
$mikrotik   = $_GET['mikrotik'];


if ($mikrotik == "1") {
    $do     = $API->comm("/ppp/secret/enable", array(
        "numbers" => $key,
    ));

    header('location:?module=secret&mikrotik=' . $mikrotik);
} else if ($mikrotik == "2") {
    $do     = $API2->comm("/ppp/secret/enable", array(
        "numbers" => $key,
    ));

    header('location:?module=secret&mikrotik=' . $mikrotik);
} else if ($mikrotik == "3") {
    $do     = $API3->comm("/ppp/secret/enable", array(
        "numbers" => $key,
    ));

    header('location:?module=secret&mikrotik=' . $mikrotik);
}
