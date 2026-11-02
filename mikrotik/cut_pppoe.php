<?php
$key = $_GET['key'];
$mikrotik = $_GET['mikrotik'];

// Validasi key apakah ada dan formatnya benar
if (empty($key) || !is_string($key)) {
    echo 'Key tidak valid';
    exit;
}

require('../dist/monitoring/conn_api.php');

// Tentukan API yang digunakan berdasarkan mikrotik
if ($mikrotik == "1") {
    $do = $API->comm("/ppp/active/remove", array(
        "numbers" => 0,  // Gunakan $key langsung, jika key adalah caller-id yang valid
    ));
    header('location:?module=pppoe_aktiv&mikrotik=' . $mikrotik);
} else if ($mikrotik == "2") {
    $do = $API2->comm("/ppp/active/remove", array(
        "numbers" => $key,
    ));
    header('location:?module=pppoe_aktiv&mikrotik=' . $mikrotik);
} else if ($mikrotik == "3") {
    $do = $API3->comm("/ppp/active/remove", array(
        "numbers" => $key,
    ));
    header('location:?module=pppoe_aktiv&mikrotik=' . $mikrotik);
}
?>
