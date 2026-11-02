<?php
require('../../../koneksi.php');

header('Content-Type: application/json');

function testMikrotikConnection($ip, $user, $pass, $port) {
    require_once __DIR__ . '/../../../dist/monitoring/routeros_api.class.php';
    $API = new RouterosAPI();
    $API->timeout = 5;      // Increased from 2s to 5s
    $API->attempts = 3;     // Increased from 1 to 3
    $API->delay = 1;        // Add delay between attempts
    try {
        if ($API->connect($ip, $user, $pass, intval($port))) {
            $API->disconnect();
            return true;
        }
        return false;
    } catch (Exception $e) {
        return false;
    }
}

// Pastikan tabel ada
mysqli_query($koneksi, "CREATE TABLE IF NOT EXISTS mikrotik_router (
    id int(11) NOT NULL AUTO_INCREMENT,
    nama varchar(100) DEFAULT 'Mikrotik',
    ip varchar(50) NOT NULL,
    user varchar(50) NOT NULL,
    pass varchar(100) NOT NULL,
    port varchar(10) DEFAULT '8728',
    urutan int(11) DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    try {
        $id = $_POST['id'] ?? null;
        $action = $_POST['action'] ?? null;

        if ($action === 'check-slots') {
            $sq = mysqli_query($koneksi, "SELECT COALESCE(MAX(id), 0) + 1 AS next_slot FROM mikrotik_router");
            $slot = ($sq && ($r = mysqli_fetch_assoc($sq))) ? (string)(int)$r['next_slot'] : '1';
            echo json_encode(['status' => 'success', 'next_slot' => $slot]);
            exit;
        }

        if ($action === 'delete-single' && $id) {
            $rid = intval($id);
            if (mysqli_query($koneksi, "DELETE FROM mikrotik_router WHERE id=$rid")) {
                echo json_encode(['status' => 'success']);
            } else {
                throw new Exception(mysqli_error($koneksi));
            }
            exit;
        }

        if ($action === 'delete' && $id) {
            if (mysqli_query($koneksi, "DELETE FROM mikrotik_router WHERE id=" . intval($id))) {
                echo json_encode(['status' => 'success']);
            } else {
                throw new Exception(mysqli_error($koneksi));
            }
            exit;
        }

        // Edit: hanya saat ada id baris valid. Form tambah juga mengirim mikrotik_number (hidden),
        // jangan pakai itu untuk membedakan — kalau salah, UPDATE ... WHERE id=0 "sukses" tanpa ubah DB.
        if (!empty($id) && intval($id) > 0) {
            $rid = intval($id);
            $nama = mysqli_real_escape_string($koneksi, $_POST['nama_mikrotik'] ?? '');
            $ip = mysqli_real_escape_string($koneksi, $_POST['ip_mikrotik']);
            $user = mysqli_real_escape_string($koneksi, $_POST['user_mikrotik']);
            $pass = mysqli_real_escape_string($koneksi, $_POST['pass_mikrotik']);
            $port = mysqli_real_escape_string($koneksi, $_POST['port_mikrotik']);
            $query = "UPDATE mikrotik_router SET nama='$nama', ip='$ip', user='$user', pass='$pass', port='$port' WHERE id=$rid";
            if (mysqli_query($koneksi, $query)) {
                echo json_encode(['status' => 'success']);
            } else {
                throw new Exception(mysqli_error($koneksi));
            }
            exit;
        }

        // Tambah MikroTik baru
        $nama = mysqli_real_escape_string($koneksi, $_POST['nama_mikrotik'] ?? '');
        $ip = mysqli_real_escape_string($koneksi, $_POST['ip_mikrotik']);
        $user = mysqli_real_escape_string($koneksi, $_POST['user_mikrotik']);
        $pass = mysqli_real_escape_string($koneksi, $_POST['pass_mikrotik']);
        $port = mysqli_real_escape_string($koneksi, $_POST['port_mikrotik']);

        if (!testMikrotikConnection($ip, $user, $pass, $port)) {
            echo json_encode(['status' => 'error', 'message' => 'Gagal terhubung ke Mikrotik. Pastikan IP, username, password, dan port sudah benar.']);
            exit;
        }

        $maxq = mysqli_query($koneksi, "SELECT COALESCE(MAX(id), 0) as m FROM mikrotik_router");
        $max = $maxq ? mysqli_fetch_assoc($maxq) : null;
        $next = ($max ? (int)$max['m'] : 0) + 1;
        $query = "INSERT INTO mikrotik_router (id, nama, ip, user, pass, port, urutan) VALUES ($next, '$nama', '$ip', '$user', '$pass', '$port', $next)";
        if (mysqli_query($koneksi, $query)) {
            echo json_encode(['status' => 'success']);
        } else {
            throw new Exception(mysqli_error($koneksi));
        }

    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
}
