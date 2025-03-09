# Todo App v2 - GitHub'a Yükleme Kılavuzu

## Adım 1: Git Kurulumu
Eğer bilgisayarınızda Git kurulu değilse, [git-scm.com](https://git-scm.com/) adresinden indirin ve kurun.

## Adım 2: Komut Satırı İşlemleri
Projenizi GitHub'a yüklemek için şu komutları çalıştırın:

```bash
# Proje dizinine gidin
cd c:\Users\Ali KaaN\Desktop\todo-v2

# Git reposunu başlatın
git init

# Tüm dosyaları ekleyin
git add .

# İlk commit'i oluşturun
git commit -m "İlk commit: Todo App v2"

# GitHub reposunu ekleyin (HTTPS kullanarak)
git remote add origin https://github.com/alikaanztrk/todo-app-v2.git

# Değişiklikleri GitHub'a gönderin
git push -u origin master
```

## Adım 3: GitHub Kimlik Doğrulama
Eğer ilk kez push işlemi yapıyorsanız, GitHub kullanıcı adı ve şifreniz veya bir kişisel erişim tokeni (PAT) girmeniz gerekebilir.

## Adım 4: Değişiklikleri Kontrol Etme
Push işlemi tamamlandıktan sonra, https://github.com/alikaanztrk/todo-app-v2 adresine giderek dosyalarınızın başarıyla yüklendiğinden emin olun.

## Not
GitHub'a ilk kez bağlanıyorsanız, aşağıdaki komutlarla kullanıcı bilgilerinizi ayarlayabilirsiniz:

```bash
git config --global user.name "Adınız Soyadınız"
git config --global user.email "email@adresiniz.com"
```
