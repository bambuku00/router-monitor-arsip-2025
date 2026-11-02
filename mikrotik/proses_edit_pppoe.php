<?php
if (isset($_POST['proses'])) {

  $name      = $_POST['name'];
  $nama_lama = $_POST['nama_lama'];
  $password  = $_POST['password'];
  $profile   = $_POST['profile'];
  $comment   = $_POST['comment'];
  $mikrotik  = $_POST['mikrotik'];

  #cek dulu ada ga di database link nya
  $q = mysqli_query($koneksi, "SELECT * FROM pppoe_link WHERE pppoe='$nama_lama' AND mikrotik='$mikrotik'");
  $c = mysqli_num_rows($q);

  if ($c > 0) {
    mysqli_query($koneksi, "UPDATE pppoe_link SET pppoe='$name',mikrotik='$mikrotik' WHERE pppoe='$nama_lama' AND mikrotik='$mikrotik'");
  }

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

    if ($nama_lama == $name) {


      $ce         = $API->comm("/ppp/secret/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co         = $API->comm("/ppp/secret/set", array(
        ".id" => $id,
        "name" => $name,
        "password" => $password,
        "service" => 'pppoe',
        "profile" => $profile,
        "comment" => $comment,
      ));
      header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API->comm("/ppp/secret/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co         = $API->comm("/ppp/secret/set", array(
          ".id" => $id,
          "name" => $name,
          "password" => $password,
          "service" => 'pppoe',
          "profile" => $profile,
          "comment" => $comment,
        ));
        header('location:?module=secret&mikrotik=' . $mikrotik);
      }
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

    if ($nama_lama == $name) {

      $ce         = $API2->comm("/ppp/secret/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co         = $API2->comm("/ppp/secret/set", array(
        ".id" => $id,
        "name" => $name,
        "password" => $password,
        "service" => 'pppoe',
        "profile" => $profile,
        "comment" => $comment,
      ));
      header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API2->comm("/ppp/secret/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co         = $API2->comm("/ppp/secret/set", array(
          ".id" => $id,
          "name" => $name,
          "password" => $password,
          "service" => 'pppoe',
          "profile" => $profile,
          "comment" => $comment,
        ));
        header('location:?module=secret&mikrotik=' . $mikrotik);
      }
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

    if ($nama_lama == $name) {

      $ce         = $API3->comm("/ppp/secret/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co         = $API3->comm("/ppp/secret/set", array(
        ".id" => $id,
        "name" => $name,
        "password" => $password,
        "service" => 'pppoe',
        "profile" => $profile,
        "comment" => $comment,
      ));
      header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {

      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API3->comm("/ppp/secret/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co         = $API3->comm("/ppp/secret/set", array(
          ".id" => $id,
          "name" => $name,
          "password" => $password,
          "service" => 'pppoe',
          "profile" => $profile,
          "comment" => $comment,
        ));
        header('location:?module=secret&mikrotik=' . $mikrotik);
      }
    }
  }
}

if (isset($_POST['proses2'])) {

  $name      = $_POST['name'];
  $nama_lama = $_POST['nama_lama'];
  $password  = $_POST['password'];
  $profile   = $_POST['profile'];
  $comment   = $_POST['comment'];
  $mikrotik  = $_POST['mikrotik'];

  #cek dulu ada ga di database link nya
  $q = mysqli_query($koneksi, "SELECT * FROM pppoe_link WHERE pppoe='$nama_lama' AND mikrotik='$mikrotik'");
  $c = mysqli_num_rows($q);

  if ($c > 0) {
    mysqli_query($koneksi, "UPDATE pppoe_link SET pppoe='$name',mikrotik='$mikrotik' WHERE pppoe='$nama_lama' AND mikrotik='$mikrotik'");
  }

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

    if ($nama_lama == $name) {
      $ce         = $API->comm("/ppp/secret/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co         = $API->comm("/ppp/secret/set", array(
        ".id" => $id,
        "name" => $name,
        "password" => $password,
        "service" => 'pppoe',
        "profile" => $profile,
        "comment" => $comment,
      ));

      $act_print  = $API->comm("/ppp/active/print");
      $json       = json_encode($act_print);
      $result     = json_decode($json, true);
      $no         = -1;
      foreach ($result as $data) {
        $no++;
        if ($data['name'] == $nama_lama) {
          $number = $no;
        }
      }

      $rem = $API->comm("/ppp/active/remove", array(
        "numbers" => $number,
      ));


      header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {

      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {

        $ce         = $API->comm("/ppp/secret/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);

        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co         = $API->comm("/ppp/secret/set", array(
          ".id" => $id,
          "name" => $name,
          "password" => $password,
          "service" => 'pppoe',
          "profile" => $profile,
          "comment" => $comment,
        ));

        $act_print  = $API->comm("/ppp/active/print");
        $json       = json_encode($act_print);
        $result     = json_decode($json, true);
        $no         = -1;
        foreach ($result as $data) {
          $no++;
          if ($data['name'] == $nama_lama) {
            $number = $no;
          }
        }

        $rem = $API->comm("/ppp/active/remove", array(
          "numbers" => $number,
        ));


        header('location:?module=secret&mikrotik=' . $mikrotik);
      }
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

    if($nama_lama==$name){
      $ce         = $API2->comm("/ppp/secret/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co         = $API2->comm("/ppp/secret/set", array(
        ".id" => $id,
        "name" => $name,
        "password" => $password,
        "service" => 'pppoe',
        "profile" => $profile,
        "comment" => $comment,
      ));

      $act_print  = $API2->comm("/ppp/active/print");
      $json       = json_encode($act_print);
      $result     = json_decode($json, true);
      $no         = -1;
      foreach ($result as $data) {
        $no++;
        if ($data['name'] == $nama_lama) {
          $number = $no;
        }
      }

      $rem = $API2->comm("/ppp/active/remove", array(
        "numbers" => $number,
      ));

      header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {
  
        $ce         = $API2->comm("/ppp/secret/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);
  
        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co         = $API2->comm("/ppp/secret/set", array(
          ".id" => $id,
          "name" => $name,
          "password" => $password,
          "service" => 'pppoe',
          "profile" => $profile,
          "comment" => $comment,
        ));
  
        $act_print  = $API2->comm("/ppp/active/print");
        $json       = json_encode($act_print);
        $result     = json_decode($json, true);
        $no         = -1;
        foreach ($result as $data) {
          $no++;
          if ($data['name'] == $nama_lama) {
            $number = $no;
          }
        }
  
        $rem = $API2->comm("/ppp/active/remove", array(
          "numbers" => $number,
        ));
  
        header('location:?module=secret&mikrotik=' . $mikrotik);
      }
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

    if($nama_lama==$name){
      $ce         = $API3->comm("/ppp/secret/print");
      $j1         = json_encode($ce);
      $r          = json_decode($j1, true);

      foreach ($r as $data) {
        $n = $data['name'];
        if ($n == $nama_lama) {
          $id = $data['.id'];
        }
      }
      $co         = $API3->comm("/ppp/secret/set", array(
        ".id" => $id,
        "name" => $name,
        "password" => $password,
        "service" => 'pppoe',
        "profile" => $profile,
        "comment" => $comment,
      ));

      $act_print  = $API3->comm("/ppp/active/print");
      $json       = json_encode($act_print);
      $result     = json_decode($json, true);
      $no         = -1;
      foreach ($result as $data) {
        $no++;
        if ($data['name'] == $nama_lama) {
          $number = $no;
        }
      }

      $rem = $API3->comm("/ppp/active/remove", array(
        "numbers" => $number,
      ));
      header('location:?module=secret&mikrotik=' . $mikrotik);
    } else {
      if ($trig == "1") {
        echo "Data sudah ada gunakan data lain";
      } else {
  
        $ce         = $API3->comm("/ppp/secret/print");
        $j1         = json_encode($ce);
        $r          = json_decode($j1, true);
  
        foreach ($r as $data) {
          $n = $data['name'];
          if ($n == $nama_lama) {
            $id = $data['.id'];
          }
        }
        $co         = $API3->comm("/ppp/secret/set", array(
          ".id" => $id,
          "name" => $name,
          "password" => $password,
          "service" => 'pppoe',
          "profile" => $profile,
          "comment" => $comment,
        ));
  
        $act_print  = $API3->comm("/ppp/active/print");
        $json       = json_encode($act_print);
        $result     = json_decode($json, true);
        $no         = -1;
        foreach ($result as $data) {
          $no++;
          if ($data['name'] == $nama_lama) {
            $number = $no;
          }
        }
  
        $rem = $API3->comm("/ppp/active/remove", array(
          "numbers" => $number,
        ));
        header('location:?module=secret&mikrotik=' . $mikrotik);
      }
    }

   
  }
}
