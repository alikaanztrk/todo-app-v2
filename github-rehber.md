# GitHub'a Proje Yükleme Rehberi

## Adım 1: Git Kurulumu
Eğer bilgisayarınızda Git yüklü değilse, [git-scm.com](https://git-scm.com/) adresinden indirip kurabilirsiniz.

## Adım 2: GitHub Hesabı
[GitHub](https://github.com/) adresinden bir hesap oluşturmanız gerekiyor.

## Adım 3: GitHub'da Repo Oluşturma
1. GitHub'da oturum açın
2. Sağ üst köşedeki "+" simgesine tıklayın
3. "New repository" (Yeni depo) seçeneğini seçin
4. Repo adını "todo-app-v2" olarak girin
5. Açıklama ekleyin (isteğe bağlı)
6. **ÖNEMLİ:** README dosyası oluşturma seçeneğini işaretlemeyin, boş bir repo oluşturun
7. "Create repository" (Depo oluştur) butonuna tıklayın

## Adım 4: Projeyi GitHub'a Yükleme
Bilgisayarınızda komut istemini (CMD) veya PowerShell'i açın ve aşağıdaki komutları sırasıyla yazın:

```bash
# Proje klasörüne gidin
cd c:\Users\Ali KaaN\Desktop\todo-v2

# Git deposu başlatın
git init

# Ana dalı "main" olarak ayarlayın
git branch -M main

# Tüm dosyaları ekleyin
git add .

# İlk kaydı oluşturun
git commit -m "İlk yükleme: Todo Uygulaması v2"

# GitHub bağlantısını ekleyin
git remote add origin https://github.com/alikaanztrk/todo-app-v2.git

# Dosyaları GitHub'a gönderin
git push -u origin main
```

## Hata Çözümü

### "fatal: couldn't find remote ref main" Hatası
Bu hata, uzak repoda henüz hiç branch olmadığını gösterir. Çözüm:

```bash
# İlk push için ayarlama yapın
git push --set-upstream origin main

# Veya alternatif olarak
git push -u origin master:main
```

### "failed to push some refs" Hatası 
Eğer bu hatayı alırsanız:

```bash
# GitHub'daki değişiklikleri önce çekin
git pull origin main --allow-unrelated-histories

# Herhangi bir çakışmayı düzeltin (varsa)
# Sonra tekrar gönderin
git push -u origin main
```

### GitHub'da Repo Zaten İçerik İçeriyorsa
Eğer GitHub'da repo oluştururken README dosyası eklediyseniz:

```bash
# Uzaktaki değişiklikleri alın
git pull origin main --allow-unrelated-histories

# Çakışmaları çözün ve değişiklikleri commit edin
git add .
git commit -m "README çakışması çözüldü"

# Değişiklikleri gönderin
git push -u origin main
```

## Git Kullanıcı Bilgilerini Ayarlama

```bash
git config --global user.name "Adınız Soyadınız"
git config --global user.email "email@adresiniz.com"
```

Bu ayarları bir kez yapmanız yeterlidir. Git, sonraki işlemlerinizde bu bilgileri kullanacaktır.
