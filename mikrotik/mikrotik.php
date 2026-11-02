<?php
// Tidak ada koneksi Mikrotik saat load - status diambil via AJAX agar halaman tidak nunggu
?>

<section class="content">
    <div class="container-fluid">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h3 class="card-title mb-0"><i class="ri-router-line"></i> Mikrotik API</h3>
                <button class="btn btn-primary btn-sm add-btn d-none d-md-inline-block">
                    <i class="ri-add-line"></i> Tambah Mikrotik
                </button>
                <div class="dropdown d-md-none">
                    <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <i class="ri-more-2-fill"></i> Aksi
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item add-btn" href="javascript:;"><i class="ri-add-line me-2"></i> Tambah Mikrotik</a></li>
                    </ul>
                </div>
            </div>
            <div class="card-body">
                <div class="card-datatable table-responsive">
                    <table class="invoice-list-table table table-bordered table-striped table-hover" id="mikrotikTable">
                        <thead>
                            <tr>
                                <th width="10%">Mikrotik</th>
                                <th width="20%">IP Address</th>
                                <th width="15%">Username</th>
                                <th width="10%">Port</th>
                                <th width="15%">Status</th>
                                <th width="30%">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php
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
                            $result = mysqli_query($koneksi, "SELECT id, nama, ip, user, pass, port FROM mikrotik_router ORDER BY urutan, id");
                            $badges = ['', 'bg-primary', 'bg-success', 'bg-warning', 'bg-danger', 'bg-info'];
                            if (!$result || mysqli_num_rows($result) == 0) {
                                echo "<tr><td colspan='6' class='text-center'>Belum ada MikroTik. Klik <b>Tambah Mikrotik</b> untuk menambah.</td></tr>";
                            } else {
                                while ($row = mysqli_fetch_assoc($result)) {
                                    $mid = (int)$row['id'];
                                    ?>
                                    <tr>
                                        <td data-label="Mikrotik" class="mobile-card-check"><span class="badge <?= $badges[$mid] ?? 'bg-secondary' ?>"><?= htmlspecialchars($row['nama'] ?: 'Mikrotik ' . $mid) ?></span></td>
                                        <td data-label="IP Address" class="mobile-card-title"><?= htmlspecialchars($row['ip']) ?></td>
                                        <td data-label="Username"><?= htmlspecialchars($row['user']) ?></td>
                                        <td data-label="Port" class="d-none d-md-table-cell"><?= htmlspecialchars($row['port']) ?></td>
                                        <td data-label="Status" class="status-cell" data-id="<?= $mid ?>"><span class="badge bg-secondary"><i class="ri-loader-4-line ri-spin"></i> Cek...</span></td>
                                        <td data-label="Aksi" class="mobile-card-actions">
                                            <div class="d-flex align-items-center gap-2">
                                                <a href="?module=secret&mikrotik=<?= $mid ?>"
                                                   class="text-body"
                                                   data-bs-toggle="tooltip" 
                                                   data-bs-placement="top" 
                                                   title="Secret">
                                                    <i class="ri-key-line"></i>
                                                </a>
                                                <a href="javascript:void(0);" 
                                                   class="text-body edit-btn" data-mikrotik="<?= $mid ?>" data-id="<?= $row['id'] ?>"
                                                    data-nama="<?= htmlspecialchars($row['nama']) ?>"
                                                    data-ip="<?= htmlspecialchars($row['ip']) ?>" data-user="<?= htmlspecialchars($row['user']) ?>"
                                                    data-pass="<?= htmlspecialchars($row['pass']) ?>" data-port="<?= htmlspecialchars($row['port']) ?>"
                                                    data-bs-toggle="tooltip" 
                                                    data-bs-placement="top" 
                                                    title="Edit">
                                                    <i class="ri-edit-box-line"></i>
                                                </a>
                                                <a href="javascript:void(0);"
                                                   class="text-body delete-single-btn" data-id="<?= $row['id'] ?>" data-mikrotik="<?= $mid ?>"
                                                   onclick="return confirm('Apakah anda yakin akan menghapus Mikrotik ini?')"
                                                   data-bs-toggle="tooltip" 
                                                   data-bs-placement="top" 
                                                   title="Delete">
                                                    <i class="ri-delete-bin-5-fill"></i>
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                    <?php
                                }
                            }
                            ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Modal Tambah/Edit Mikrotik -->
<div class="modal fade" id="tambahMikrotikModal" tabindex="-1" aria-labelledby="tambahMikrotikModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="tambahMikrotikModalLabel">Tambah/Edit Mikrotik</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form id="mikrotikForm">
                    <input type="hidden" name="id" id="mikrotik-id">
                    <input type="hidden" name="mikrotik_number" id="mikrotik-number">
                    <div class="form-group">
                        <label>Nama Mikrotik</label>
                        <input type="text" name="nama_mikrotik" id="nama_mikrotik" class="form-control" placeholder="Contoh: Mikrotik Main" required>
                    </div>
                    <div class="form-group">
                        <label>IP Mikrotik</label>
                        <input type="text" name="ip_mikrotik" id="ip_mikrotik" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>User Mikrotik</label>
                        <input type="text" name="user_mikrotik" id="user_mikrotik" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Password Mikrotik</label>
                        <input type="password" name="pass_mikrotik" id="pass_mikrotik" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Port Mikrotik</label>
                        <input type="number" name="port_mikrotik" id="port_mikrotik" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-success">Simpan</button>
                </form>
            </div>
        </div>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>

<script>
$(document).ready(function() {
    // Handle edit button click
    $('.edit-btn').on('click', function() {
        var id = $(this).data('id');
        var mikrotikNumber = $(this).data('mikrotik');
        var nama = $(this).data('nama');
        var ip = $(this).data('ip');
        var user = $(this).data('user');
        var pass = $(this).data('pass');
        var port = $(this).data('port');

        $('#mikrotik-id').val(id);
        $('#mikrotik-number').val(mikrotikNumber);
        $('#nama_mikrotik').val(nama);
        $('#ip_mikrotik').val(ip);
        $('#user_mikrotik').val(user);
        $('#pass_mikrotik').val(pass);
        $('#port_mikrotik').val(port);

        $('#tambahMikrotikModalLabel').text('Edit Mikrotik ' + mikrotikNumber);
        $('#tambahMikrotikModal').modal('show');
    });

    // Handle add button click
    $('.add-btn').on('click', function() {
        $('#mikrotikForm')[0].reset();
        $('#mikrotik-id').val('');
        $('#mikrotik-number').val('');
        
        $.ajax({
            url: 'module/mikrotik/proses_mikrotik.php',
            type: 'POST',
            data: { action: 'check-slots' },
            dataType: 'json',
            success: function(response) {
                if(response.status === 'success') {
                    $('#mikrotik-number').val(response.next_slot);
                    $('#tambahMikrotikModalLabel').text('Tambah Mikrotik ' + response.next_slot);
                    $('#tambahMikrotikModal').modal('show');
                } else {
                    alert('Gagal: ' + (response.message || 'Unknown error'));
                }
            },
            error: function(xhr, status, error) {
                console.error('Error:', xhr.responseText);
                alert('Gagal memeriksa slot yang tersedia: ' + error);
            }
        });
    });

    // Handle form submission
    $('#mikrotikForm').on('submit', function(e) {
        e.preventDefault();
        
        $.ajax({
            url: 'module/mikrotik/proses_mikrotik.php',
            type: 'POST',
            data: $(this).serialize(),
            dataType: 'json',
            success: function(response) {
                if(response.status === 'success') {
                    alert('Mikrotik berhasil disimpan!');
                    $('#tambahMikrotikModal').modal('hide');
                    location.reload();
                } else {
                    alert('Gagal menyimpan: ' + (response.message || 'Unknown error'));
                }
            },
            error: function(xhr, status, error) {
                console.error('Error:', xhr.responseText);
                alert('Gagal menyimpan. Silakan cek console untuk detail error');
            }
        });
    });

    // Handle delete single button click
    $('.delete-single-btn').on('click', function() {
        var id = $(this).data('id');
        var mikrotikNumber = $(this).data('mikrotik');
        
        if(confirm('Anda yakin ingin menghapus Mikrotik ' + mikrotikNumber + '?')) {
            $.ajax({
                url: 'module/mikrotik/proses_mikrotik.php',
                type: 'POST',
                data: {
                    action: 'delete-single',
                    id: id,
                    mikrotik_number: mikrotikNumber
                },
                dataType: 'json',
                success: function(response) {
                    if(response.status === 'success') {
                        alert('Mikrotik berhasil dihapus!');
                        location.reload();
                    } else {
                        alert('Gagal menghapus: ' + (response.message || 'Unknown error'));
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error:', xhr.responseText);
                    alert('Gagal menghapus Mikrotik: ' + error);
                }
            });
        }
    });

    // Cek status koneksi via AJAX (tidak block halaman saat Mikrotik mati)
    function checkStatusCell($cell) {
        var id = $cell.data('id');
        $.ajax({
            url: 'module/mikrotik/check_status.php',
            type: 'GET',
            data: { id: id },
            dataType: 'json',
            timeout: 5000,
            success: function(r) {
                if (r.status === 'connected') {
                    $cell.html('<span class="badge bg-success">Connected</span>');
                } else {
                    $cell.html('<span class="badge bg-danger">Disconnected</span>');
                }
            },
            error: function() {
                $cell.html('<span class="badge bg-danger">Disconnected</span>');
            }
        });
    }

    // Cek status tiap Mikrotik secara async (stagger agar tidak bersamaan)
    $('.status-cell').each(function(i) {
        var $cell = $(this);
        setTimeout(function() { checkStatusCell($cell); }, i * 200);
    });
});
</script>
