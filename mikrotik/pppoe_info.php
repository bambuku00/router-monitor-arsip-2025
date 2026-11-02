<?php
// Fix Windows session path issue
if (!session_id()) {
    $session_path = sys_get_temp_dir();
    if (!is_writable($session_path)) {
        $session_path = __DIR__ . '/../../logs/sessions';
        @mkdir($session_path, 0777, true);
    }
    @ini_set('session.save_path', $session_path);
    session_start();
}

header('Content-Type: application/json');
ob_start();

if (!isset($_SESSION['login']) || $_SESSION['login'] !== true) {
    if (ob_get_length()) ob_clean();
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}
session_write_close();

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id < 1) {
    if (ob_get_length()) ob_clean();
    echo json_encode(['status' => 'error', 'message' => 'Invalid id']);
    exit;
}

require_once __DIR__ . '/../../../koneksi.php';
require_once __DIR__ . '/../../../dist/monitoring/routeros_api.class.php';

$query = "SELECT id, nama, ip, user, pass, port FROM mikrotik_router WHERE id=$id LIMIT 1";
$result = mysqli_query($koneksi, $query);
$row = mysqli_fetch_assoc($result);

if (!$row) {
    if (ob_get_length()) ob_clean();
    error_log("pppoe_info.php - Mikrotik ID $id not found");
    echo json_encode(['status' => 'disconnected', 'id' => $id]);
    exit;
}

// Check if password exists
if (empty($row['pass'])) {
    if (ob_get_length()) ob_clean();
    error_log("pppoe_info.php - Mikrotik ID $id - Password kosong");
    echo json_encode(['status' => 'error', 'message' => 'Password not configured']);
    exit;
}

$port = !empty($row['port']) ? (int)$row['port'] : 8728;
$API = new RouterosAPI();
$API->timeout = 5;          // Timeout 5 detik (increased from 2)
$API->attempts = 3;         // Retry 3 kali (increased from 1)
$API->delay = 1;            // Delay 1 detik antar retry
$info = null;
$error_msg = '';

try {
    // Direct connection attempt
    if (@$API->connect($row['ip'], $row['user'], $row['pass'], $port)) {
        // Get system resource details
        $rsq = @$API->comm("/system/resource/print");
        $API->disconnect();
        $info = is_array($rsq) && isset($rsq[0]) ? $rsq[0] : null;
    } else {
        $error_msg = $API->error_str ?: 'Connection failed';
        error_log("pppoe_info.php - ID $id - {$row['ip']}:{$port} - Error: {$error_msg}");
    }
} catch (Exception $e) {
    $error_msg = $e->getMessage();
    error_log("pppoe_info.php - ID $id - Exception: {$error_msg}");
}

if (ob_get_length()) ob_clean();

if ($info) {
    echo json_encode([
        'status' => 'connected',
        'id' => $id,
        'board-name' => $info['board-name'] ?? '-',
        'factory-software' => $info['factory-software'] ?? '-',
        'cpu-load' => $info['cpu-load'] ?? '0',
        'uptime' => $info['uptime'] ?? '-'
    ]);
} else {
    echo json_encode(['status' => 'disconnected', 'id' => $id, 'error' => $error_msg ?: null]);
}
