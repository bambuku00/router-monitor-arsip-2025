<?php
require_once('../../../dist/monitoring/routeros_api.class.php');

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'check-connection') {
    $ip = $_POST['ip'] ?? '';
    $user = $_POST['user'] ?? '';
    $pass = $_POST['pass'] ?? '';
    $port = $_POST['port'] ?? '';

    $API = new RouterosAPI();
    $API->timeout = 5;      // Increased from 1s to 5s
    $API->attempts = 3;     // Increased from 1 to 3
    $API->delay = 1;        // Add delay between attempts
    
    try {
        // Direct API connection (removed unnecessary fsockopen pre-check)
        if(@$API->connect($ip, $user, $pass, intval($port))) {
            $API->disconnect();
            echo json_encode(['status' => 'connected']);
            exit;
        }
        echo json_encode(['status' => 'disconnected']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'disconnected', 'error' => $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
} 