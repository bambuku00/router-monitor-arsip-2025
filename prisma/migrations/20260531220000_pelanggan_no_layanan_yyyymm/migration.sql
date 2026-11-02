-- Format ulang: YYYYMM (dari created) + urutan 6 digit
UPDATE `Pelanggan` p
INNER JOIN (
  SELECT
    id,
    CONCAT(
      DATE_FORMAT(`created`, '%Y%m'),
      LPAD(
        ROW_NUMBER() OVER (
          PARTITION BY DATE_FORMAT(`created`, '%Y%m')
          ORDER BY id
        ),
        6,
        '0'
      )
    ) AS new_no
  FROM `Pelanggan`
) ranked ON p.id = ranked.id
SET p.noLayanan = ranked.new_no;
