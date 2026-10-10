# Extensions

Repo menyediakan host extension pada editor renderer dengan permission-gated API. Extension dapat menambahkan render hooks, cursor effects, settings panels, event handlers, dan asset terkemas sesuai manifest/API.

## Workflow pengembang extension

- Gunakan direktori extension yang dibuka dari UI aplikasi.
- Siapkan manifest dan entry module sesuai API rujukan.
- Nyatakan permission yang diperlukan.
- Daftarkan hooks/panels/assets melalui host, lalu uji preview serta export yang relevan.
- Bersihkan registration/lifecycle ketika extension dilepas.

API dokumentasi lama masih memakai nama Recordly. Nama method/manifest yang merupakan kontrak runtime tidak boleh diganti hanya untuk menyamakan branding. Lihat [referensi API lengkap](../development/extensions-api.md) untuk signature dan contoh asli.

## Batas konteks

Render hook renderer yang ada bukan bukti permission mengubah canonical Story atau sibling media. Perubahan ownership dan parity setiap pipeline perlu diuji secara khusus jika extension menambahkan kemampuan editing.

Dokumentasi ini menyertakan referensi lokal. Ketersediaan marketplace eksternal dan kompatibilitas setiap paket extension tidak diuji pada penyusunan portal docs.

