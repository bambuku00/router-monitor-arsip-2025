<?php
if (isset($_POST['proses']) || isset($_POST['proses7'])) {
    require('../dist/monitoring/conn_api.php');
    
    $alamat_isolir  = $_POST['alamat_isolir'];
    $type           = $_POST['type'];
    $ether_masuk    = $_POST['ether_input'];
    $mikrotik       = $_POST['mikrotik'];

    // Ambil nama profil isolir dari database
    $hey = mysqli_fetch_array(mysqli_query($koneksi, "SELECT profil_isolir FROM heysoyam WHERE id=1"));
    $profil_isolir = $hey['profil_isolir'];

    // Fungsi untuk mendapatkan API berdasarkan nomor mikrotik
    function getAPI($mikrotik) {
        global $API, $API2, $API3;
        switch($mikrotik) {
            case "1": return $API;
            case "2": return $API2;
            case "3": return $API3;
            default: return null;
        }
    }

    // Ambil API yang sesuai
    $currentAPI = getAPI($mikrotik);

    if (!$currentAPI) {
        die("Mikrotik tidak valid");
    }

    try {
        // Konfigurasi untuk isolir
        $config = [
            'ip_pool' => [
                "name" => $profil_isolir,
                "ranges" => '10.128.135.2-10.128.135.254',
            ],
            'ppp_profile' => [
                "name" => $profil_isolir,
                "local-address" => '10.128.135.1',
                "remote-address" => $profil_isolir,
                "address-list" => 'isolir-list',
            ],
            'firewall_filter' => [
                "chain" => 'forward',
                "src-address-list" => 'isolir-list',
                "action" => 'drop',
                "comment" => 'Drop PPPoe Isolir',
            ],
            'firewall_nat' => [
                "chain" => 'dstnat',
                "src-address-list" => 'isolir-list',
                "protocol" => 'tcp',
                "dst-port" => '80,443',
                "action" => 'redirect',
                "to-ports" => '8085',
                "comment" => "NAT PPPoE isolir to warning",
            ],
            'web_proxy' => [
                "enabled" => 'yes',
                "port" => '8085',
                "max-cache-size" => 'unlimited',
            ],
            'access_proxy' => [
                "src-address" => '10.128.135.0/24',
                "dst-address" => '!10.128.135.1',
                "dst-port" => '80',
                "dst-host" => '!winet.id',
                "action" => isset($_POST['proses7']) ? 'redirect' : 'deny',
                isset($_POST['proses7']) ? "action-data" : "redirect-to" => $ether_masuk . ':8085',
            ],
            'access_proxy2' => [
                "src-address" => '10.128.135.0/24',
                "dst-port" => '8085',
                "action" => 'allow',
            ]
        ];

        // Eksekusi konfigurasi
        $currentAPI->comm("/ip/pool/add", $config['ip_pool']);
        $currentAPI->comm("/ppp/profile/add", $config['ppp_profile']);
        $currentAPI->comm("/ip/firewall/filter/add", $config['firewall_filter']);
        $currentAPI->comm("/ip/firewall/nat/add", $config['firewall_nat']);
        $currentAPI->comm("/ip/proxy/set", $config['web_proxy']);
        $currentAPI->comm("/ip/proxy/access/add", $config['access_proxy']);
        $currentAPI->comm("/ip/proxy/access/add", $config['access_proxy2']);

        // Update database dengan nama profil isolir
        mysqli_query($koneksi, "UPDATE heysoyam SET profil_isolir='$profil_isolir' WHERE id=1");

        // Redirect sesuai dengan jenis ROS
        $redirect_page = isset($_POST['proses7']) ? 'proses_ros7' : 'proses_ros6';
        header("location:?module=$redirect_page&mikrotik=$mikrotik");

    } catch (Exception $e) {
        die("Error: " . $e->getMessage());
    }
}
?>
