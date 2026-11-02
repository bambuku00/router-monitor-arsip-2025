<?php

$key        = $_GET['key'];
$mikrotik   = $_GET['mikrotik'];


mysqli_query($koneksi, "DELETE FROM pppoe_link WHERE pppoe='$key'");

require_once('../dist/monitoring/conn_api.php');
if ($mikrotik == "1") {
    $do = $API->comm("/ppp/secret/remove", array(
        "numbers" => $key,
    ));

    $act_print  = $API->comm("/ppp/active/print");
    $json       = json_encode($act_print);
    $result     = json_decode($json, true);
    $no         = -1;
    foreach ($result as $data) {
      $no++;
      if ($data['name'] == $key) {
        $number = $no;
      }
    }

    $rem = $API->comm("/ppp/active/remove", array(
      "numbers" => $number,
    ));
    header('location:?module=secret&mikrotik=' . $mikrotik);
} else if ($mikrotik == "2") {
    $do = $API2->comm("/ppp/secret/remove", array(
        "numbers" => $key,
    ));

    $act_print  = $API2->comm("/ppp/active/print");
    $json       = json_encode($act_print);
    $result     = json_decode($json, true);
    $no         = -1;
    foreach ($result as $data) {
      $no++;
      if ($data['name'] == $key) {
        $number = $no;
      }
    }

    $rem = $API2->comm("/ppp/active/remove", array(
      "numbers" => $number,
    ));
    header('location:?module=secret&mikrotik=' . $mikrotik);
} else if ($mikrotik == "3") {
    $do = $API3->comm("/ppp/secret/remove", array(
        "numbers" => $key,
    ));

    $act_print  = $API3->comm("/ppp/active/print");
    $json       = json_encode($act_print);
    $result     = json_decode($json, true);
    $no         = -1;
    foreach ($result as $data) {
      $no++;
      if ($data['name'] == $key) {
        $number = $no;
      }
    }

    $rem = $API3->comm("/ppp/active/remove", array(
      "numbers" => $number,
    ));
    header('location:?module=secret&mikrotik=' . $mikrotik);
}
