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
session_write_close(); // Lepas lock agar request lain tidak nunggu (paralel cek status)

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id < 1) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid id']);
    exit;
}

require_once __DIR__ . '/../../../koneksi.php';
require_once __DIR__ . '/../../../dist/monitoring/routeros_api.class.php';

$query = "SELECT id, ip, user, pass, port FROM mikrotik_router WHERE id=$id LIMIT 1";
$result = mysqli_query($koneksi, $query);
$row = mysqli_fetch_assoc($result);

if (!$row) {
    if (ob_get_length()) ob_clean();
    // Log if database query fails
    error_log("Mikrotik ID $id not found in database");
    echo json_encode(['status' => 'disconnected', 'id' => $id]);
    exit;
}

$port = !empty($row['port']) ? (int)$row['port'] : 8728;

// Check if password is empty
if (empty($row['pass'])) {
    if (ob_get_length()) ob_clean();
    error_log("Mikrotik ID $id - Password KOSONG di database");
    echo json_encode([
        'status' => 'error',
        'id' => $id,
        'error' => 'Password kosong di database'
    ]);
    exit;
}

$API = new RouterosAPI();
$API->timeout = 2;          // Timeout 5 detik
$API->attempts = 1;         // Retry 3 kali
$API->delay = 1;            // Delay 1 detik antar retry
$API->debug = false;
$ok = false;
$error_msg = '';

try {
    // Attempt connection
    if (@$API->connect($row['ip'], $row['user'], $row['pass'], $port)) {
        $API->disconnect();
        $ok = true;
    } else {
        // Get error from RouterOS API
        $error_msg = $API->error_str ?: 'Connection failed';
        error_log("Mikrotik ID $id ({$row['ip']}:{$port}) - Connection Error: {$error_msg}");
    }
} catch (Exception $e) {
    $error_msg = $e->getMessage();
    error_log("Mikrotik ID $id - Exception: {$error_msg}");
}

if (ob_get_length()) ob_clean();
echo json_encode([
    'status' => $ok ? 'connected' : 'disconnected',
    'id' => $id,
    'error' => $error_msg ?: null
]);
