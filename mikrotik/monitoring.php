<?php
require_once('../dist/monitoring/conn_api.php');

function getSystemResources($API) {
    if (!$API) return null;
    
    try {
        $resources = $API->comm("/system/resource/print")[0];
        return [
            'cpu' => [
                'load' => $resources['cpu-load'] ?? 0,
                'frequency' => $resources['cpu-frequency'] ?? 0,
                'cores' => $resources['cpu-count'] ?? 1
            ],
            'memory' => [
                'total' => $resources['total-memory'] ?? 0,
                'free' => $resources['free-memory'] ?? 0,
                'used' => ($resources['total-memory'] ?? 0) - ($resources['free-memory'] ?? 0)
            ],
            'storage' => [
                'total' => $resources['total-hdd-space'] ?? 0,
                'free' => $resources['free-hdd-space'] ?? 0,
                'used' => ($resources['total-hdd-space'] ?? 0) - ($resources['free-hdd-space'] ?? 0)
            ],
            'uptime' => $resources['uptime'] ?? 'N/A'
        ];
    } catch (Exception $e) {
        error_log("Error getting Mikrotik resources: " . $e->getMessage());
        return null;
    }
}

function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

// Get data hanya untuk 2 Mikrotik pertama
$mikrotik_data = [];
if ($API) $mikrotik_data[1] = getSystemResources($API);
if ($API2) $mikrotik_data[2] = getSystemResources($API2);

if (isset($_GET['ajax'])) {
    header('Content-Type: application/json');
    echo json_encode($mikrotik_data);
    exit;
}
?>

<!-- Compact monitoring display -->
<?php 
$count = 0;
foreach ($mikrotik_data as $id => $data): 
    if ($count >= 2) break; // Hanya tampilkan 2 Mikrotik
    if ($data):
        $count++;
?>
    <div class="monitoring-item mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Mikrotik <?= $id ?></h6>
            <span class="badge bg-label-primary" style="font-size: 0.7rem;"><?= $data['uptime'] ?></span>
        </div>
        
        <!-- CPU -->
        <div class="mb-2">
            <div class="d-flex justify-content-between mb-1">
                <small>CPU</small>
                <small><?= $data['cpu']['load'] ?>% (<?= $data['cpu']['frequency'] ?> MHz)</small>
            </div>
            <div class="progress" style="height: 4px">
                <div class="progress-bar bg-primary" 
                     style="width: <?= $data['cpu']['load'] ?>%"></div>
            </div>
        </div>

        <!-- Memory -->
        <div class="mb-2">
            <div class="d-flex justify-content-between mb-1">
                <small>Memory</small>
                <small><?= formatBytes($data['memory']['used']) ?> / <?= formatBytes($data['memory']['total']) ?></small>
            </div>
            <div class="progress" style="height: 4px">
                <?php $memPercent = ($data['memory']['used'] / $data['memory']['total']) * 100; ?>
                <div class="progress-bar bg-info" 
                     style="width: <?= $memPercent ?>%"></div>
            </div>
        </div>

        <!-- Storage -->
        <div class="mb-1">
            <div class="d-flex justify-content-between mb-1">
                <small>Storage</small>
                <small><?= formatBytes($data['storage']['used']) ?> / <?= formatBytes($data['storage']['total']) ?></small>
            </div>
            <div class="progress" style="height: 4px">
                <?php $storagePercent = ($data['storage']['used'] / $data['storage']['total']) * 100; ?>
                <div class="progress-bar bg-warning" 
                     style="width: <?= $storagePercent ?>%"></div>
            </div>
        </div>
    </div>
<?php 
    endif;
endforeach; 
?>

<style>
.monitoring-item {
    padding: 12px;
    border-bottom: 1px solid rgba(0,0,0,0.1);
}
.monitoring-item:last-child {
    border-bottom: none;
    margin-bottom: 0 !important;
}
.monitoring-item small {
    font-size: 0.75rem;
}
.progress {
    background-color: rgba(0,0,0,0.05);
}
</style> 