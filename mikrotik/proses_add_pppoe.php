<?php
if (isset($_POST['proses'])) {

  $name      = $_POST['name'];
  $password  = $_POST['password'];
  $profile   = $_POST['profile'];
  $comment   = $_POST['comment'];
  $mikrotik  = $_POST['mikrotik'];

  require('../dist/monitoring/conn_api.php');

  if ($mikrotik == "1") {
    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API->comm("/ppp/secret/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($trig == "1") {
      echo "Data sudah ada gunakan data lain";
    } else {
      $do = $API->comm("/ppp/secret/add", array(
        "name" => $name,
        "password" => $password,
        "profile" => $profile,
        "service" => 'pppoe',
        "comment" => $comment,

      ));

      header('location:?module=secret&mikrotik=' . $mikrotik);
    }
  } else if ($mikrotik == "2") {
    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API2->comm("/ppp/secret/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($trig == "1") {
      echo "Data sudah ada gunakan data lain";
    } else {
      $do = $API2->comm("/ppp/secret/add", array(
        "name" => $name,
        "password" => $password,
        "profile" => $profile,
        "service" => 'pppoe',
        "comment" => $comment,

      ));

      header('location:?module=secret&mikrotik=' . $mikrotik);
    }
  } else if ($mikrotik == "3") {
    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API3->comm("/ppp/secret/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($trig == "1") {
      echo "Data sudah ada gunakan data lain";
    } else {
      $do = $API3->comm("/ppp/secret/add", array(
        "name" => $name,
        "password" => $password,
        "profile" => $profile,
        "service" => 'pppoe',
        "comment" => $comment,

      ));

      header('location:?module=secret&mikrotik=' . $mikrotik);
    }
  }
}

if (isset($_POST['proses_profil'])) {
  $mikrotik     = $_POST['mikrotik'];
  $name         = $_POST['name'];
  $local_add    = $_POST['local-address'];
  $remote_add   = $_POST['remote-address'];
  $address_list = $_POST['address-list'];
  $rate_limit   = $_POST['rate-limit'];
  $comment      = $_POST['comment'];



  require('../dist/monitoring/conn_api.php');

  if ($mikrotik == "1") {
    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API->comm("/ppp/profile/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($trig == "1") {
      echo "Data sudah ada gunakan data lain";
    } else {
      $do = $API->comm("/ppp/profile/add", array(
        "name" => $name,
        "local-address" => $local_add,
        "remote-address" => $remote_add,
        "address-list" => $address_list,
        "rate-limit" => $rate_limit,
        "comment" => $comment,
      ));
      header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
    }
  } else if ($mikrotik == "2") {
    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API2->comm("/ppp/profile/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($trig == "1") {
      echo "Data sudah ada gunakan data lain";
    } else {
      $do = $API2->comm("/ppp/profile/add", array(
        "name" => $name,
        "local-address" => $local_add,
        "remote-address" => $remote_add,
        "address-list" => $address_list,
        "rate-limit" => $rate_limit,
        "comment" => $comment,
      ));
      header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
    }
  } else if ($mikrotik == "3") {
    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API3->comm("/ppp/profile/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($trig == "1") {
      echo "Data sudah ada gunakan data lain";
    } else {
      $do = $API3->comm("/ppp/profile/add", array(
        "name" => $name,
        "local-address" => $local_add,
        "remote-address" => $remote_add,
        "address-list" => $address_list,
        "rate-limit" => $rate_limit,
        "comment" => $comment,
      ));
      header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
    }
  }
}

if (isset($_POST['edit_profil'])) {

  $name         = $_POST['name'];
  $local_add    = $_POST['local-address'];
  $remote_add   = $_POST['remote-address'];
  $address_list = $_POST['address-list'];
  $rate_limit   = $_POST['rate-limit'];
  $comment      = $_POST['comment'];
  $mikrotik     = $_POST['mikrotik'];
  $nama_lama    = $_POST['nama_lama'];


  #cek dulu ada ga di database link nya

  $c = mysqli_num_rows(mysqli_query($koneksi, "SELECT * FROM pppoe_profil_link WHERE profil='$nama_lama' AND mikrotik='$mikrotik' "));


  if ($c > 0) {
    mysqli_query($koneksi, "UPDATE pppoe_profil_link SET profil='$name',mikrotik='$mikrotik' WHERE profil='$nama_lama' AND mikrotik='$mikrotik'");
  }

  if ($mikrotik == "1") {
    require('../dist/monitoring/conn_api.php');

    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API->comm("/ppp/profile/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($nama_lama == $name) {
      $ce         = $API->comm("/ppp/profile/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co  = $API->comm("/ppp/profile/set", array(
        ".id" => $id,
        "name" => $name,
        "local-address" => $local_add,
        "remote-address" => $remote_add,
        "address-list" => $address_list,
        "rate-limit" => $rate_limit,
        "comment" => $comment,
      ));
      header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API->comm("/ppp/profile/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co  = $API->comm("/ppp/profile/set", array(
          ".id" => $id,
          "name" => $name,
          "local-address" => $local_add,
          "remote-address" => $remote_add,
          "address-list" => $address_list,
          "rate-limit" => $rate_limit,
          "comment" => $comment,
        ));
        header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
      }
    }
  } else if ($mikrotik == "2") {
    require('../dist/monitoring/conn_api.php');

    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API2->comm("/ppp/profile/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($nama_lama == $name) {
      $ce         = $API2->comm("/ppp/profile/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co  = $API2->comm("/ppp/profile/set", array(
        ".id" => $id,
        "name" => $name,
        "local-address" => $local_add,
        "remote-address" => $remote_add,
        "address-list" => $address_list,
        "rate-limit" => $rate_limit,
        "comment" => $comment,
      ));
      header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API2->comm("/ppp/profile/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co  = $API2->comm("/ppp/profile/set", array(
          ".id" => $id,
          "name" => $name,
          "local-address" => $local_add,
          "remote-address" => $remote_add,
          "address-list" => $address_list,
          "rate-limit" => $rate_limit,
          "comment" => $comment,
        ));
        header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
      }
    }
  } else if ($mikrotik == "3") {
    require('../dist/monitoring/conn_api.php');

    #cek dulu biar ga duplikat dan buat notif duplikat
    $ce         = $API3->comm("/ppp/profile/print");
    $j1         = json_encode($ce);
    $r          = json_decode($j1, true);

    foreach ($r as $dat) {
      $n = $dat['name'];
      if ($n == $name) {
        $trig = "1";
      }
    }

    if ($nama_lama == $name) {
      $ce         = $API3->comm("/ppp/profile/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co  = $API3->comm("/ppp/profile/set", array(
        ".id" => $id,
        "name" => $name,
        "local-address" => $local_add,
        "remote-address" => $remote_add,
        "address-list" => $address_list,
        "rate-limit" => $rate_limit,
        "comment" => $comment,
      ));
      header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API3->comm("/ppp/profile/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co  = $API3->comm("/ppp/profile/set", array(
          ".id" => $id,
          "name" => $name,
          "local-address" => $local_add,
          "remote-address" => $remote_add,
          "address-list" => $address_list,
          "rate-limit" => $rate_limit,
          "comment" => $comment,
        ));
        header('location:?module=pppoe_profil&mikrotik=' . $mikrotik);
      }
    }
  }
}

if (isset($_POST['proses_pool'])) {

  $name       = $_POST['name'];
  $ranges     = $_POST['ranges'];
  $token      = $_POST['token'];
  $mikrotik   = $_POST['mikrotik'];
  $key        = $_POST['key'];

  if ($mikrotik == "1") {
    require('../dist/monitoring/conn_api.php');
    $do = $API->comm("/ip/pool/add", array(
      "name" => $name,
      "ranges" => $ranges,
    ));
  } else if ($mikrotik == "2") {
    require('../dist/monitoring/conn_api.php');
    $do = $API2->comm("/ip/pool/add", array(
      "name" => $name,
      "ranges" => $ranges,
    ));
  } else if ($mikrotik == "3") {
    require('../dist/monitoring/conn_api.php');
    $do = $API3->comm("/ip/pool/add", array(
      "name" => $name,
      "ranges" => $ranges,
    ));
  }

  if ($key == "") {
    header('location:?module=' . $token . '&mikrotik=' . $mikrotik);
  } else {
    header('location:?module=' . $token . '&mikrotik=' . $mikrotik . '&key=' . $key);
  }
}
