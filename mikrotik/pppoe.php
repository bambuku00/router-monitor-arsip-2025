<?php
// Tidak load conn_api - info via AJAX agar halaman tidak nunggu saat Mikrotik mati
$colors = ['success', 'danger', 'warning', 'info', 'primary'];
$mikrotiks = [];
$res = mysqli_query($koneksi, "SELECT id, nama, ip FROM mikrotik_router ORDER BY urutan, id");
if ($res) {
    while ($r = mysqli_fetch_assoc($res)) {
        $mikrotiks[] = [
            'id' => (int)$r['id'],
            'nama' => $r['nama'] ?: 'Mikrotik ' . $r['id'],
            'color' => $colors[($r['id'] - 1) % count($colors)] ?? 'secondary'
        ];
    }
}
?>

<div class="container-xxl flex-grow-1 container-p-y">
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
                <i class="ri-user-line"></i> PPPoe - Pilih Mikrotik
            </h5>
            <a href="javascript:history.back()" class="btn bg-label-info btn-sm">
                <i class="ri-arrow-go-back-line"></i> Kembali
            </a>
        </div>

        <div class="card-body">
            <div class="row" id="pppoe-mikrotik-cards">
                <?php if (empty($mikrotiks)): ?>
                    <div class="col-12"><p class="text-muted">Belum ada Mikrotik. Tambah di <a href="?module=mikrotik">Pengaturan Mikrotik</a>.</p></div>
                <?php else: ?>
                    <?php foreach ($mikrotiks as $mk): ?>
                        <div class="col-lg-4 col-md-6 col-12 mb-4">
                            <div class="card bg-label-<?= $mk['color'] ?> ppoe-card" data-id="<?= $mk['id'] ?>" data-color="<?= $mk['color'] ?>">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <div class="d-flex align-items-center gap-3">
                                            <div class="avatar">
                                                <div class="avatar-initial bg-<?= $mk['color'] ?> rounded">
                                                    <i class="ri-router-line"></i>
                                                </div>
                                            </div>
                                            <div class="card-info">
                                                <h4 class="mb-0 ppoe-board-name"><?= htmlspecialchars($mk['nama']) ?></h4>
                                            </div>
                                        </div>
                                    </div>
                                    <p class="mb-2 ppoe-info">
                                        <i class="ri-loader-4-line ri-spin"></i> Memuat...
                                    </p>
                                    <a href="?module=secret&mikrotik=<?= $mk['id'] ?>" class="btn btn-<?= $mk['color'] ?> btn-sm ppoe-link" style="display:none">
                                        <i class="ri-check-line"></i> Lihat Data
                                    </a>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.ppoe-card').forEach(function(card, i) {
        var id = card.dataset.id;
        var $info = card.querySelector('.ppoe-info');
        var $board = card.querySelector('.ppoe-board-name');
        var $link = card.querySelector('.ppoe-link');
        
        setTimeout(function() {
            fetch('module/mikrotik/pppoe_info.php?id=' + id).then(function(r) { return r.json(); }).then(function(data) {
                if (data.status === 'connected') {
                    $board.textContent = data['board-name'] || 'Mikrotik ' + id;
                    $info.innerHTML = 'ROS : ' + (data['factory-software'] || '-') + '<br>CPU : ' + (data['cpu-load'] || '0') + ' %<br>Uptime : ' + (data['uptime'] || '-');
                    $link.style.display = '';
                } else {
                    $info.innerHTML = '<span class="badge bg-danger">Disconnected</span>';
                    $link.style.display = 'none';
                }
            }).catch(function() {
                $info.innerHTML = '<span class="badge bg-danger">Error</span>';
                $link.style.display = 'none';
            });
        }, i * 150);
    });
});
</script>