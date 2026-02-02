# Очистка WSL и Настройка CI/CD

## Очистка WSL

### Вариант 1: Очистка кэша (быстро)

```bash
# В WSL
# Удалить cargo кэш
rm -rf ~/.cargo/registry
rm -rf ~/.cargo/git
rm -rf ~/.cache/solana

# Удалить Anchor
rm -rf ~/.avm

# Удалить Solana
rm -rf ~/.local/share/solana
```

### Вариант 2: Полная переустановка WSL (если нужно)

```powershell
# В PowerShell (от администратора)
# Список дистрибутивов
wsl --list

# Удалить конкретный дистрибутив
wsl --unregister Ubuntu

# Переустановить
wsl --install
```

### Вариант 3: Просто не использовать WSL

Можно собирать контракт только через GitHub Actions, локальная сборка не обязательна.

---

## Настройка GitHub Actions

### 1. Создать GitHub Secrets

Перейди в репозиторий на GitHub:
- Settings → Secrets and variables → Actions → New repository secret

Добавь секрет:
- **Name**: `SOLANA_DEPLOYER_PRIVATE_KEY`
- **Value**: Приватный ключ кошелька для деплоя (JSON array)

Получить приватный ключ:
```bash
# Создать новый кошелек для деплоя
solana-keygen new --outfile deployer-keypair.json

# Показать содержимое (это и будет секрет)
cat deployer-keypair.json
# Скопируй весь JSON array, например: [123,45,67,...]
```

### 2. Пополнить кошелек

```bash
# Получить адрес
solana-keygen pubkey deployer-keypair.json

# Пополнить на devnet (бесплатно)
solana airdrop 2 <АДРЕС> --url devnet
```

### 3. Запушить workflow

Workflow уже создан в `.github/workflows/build-smart-contract.yml`.

Просто запуши изменения:
```bash
cd /mnt/c/Users/mormeli/.gemini/antigravity/scratch/bebrafun
git add .github/workflows/build-smart-contract.yml
git add CLEAN_WSL.md
git commit -m "feat: Add GitHub Actions workflow for smart contract build"
git push origin master
```

### 4. Проверить выполнение

1. Перейди на GitHub в свой репозиторий
2. Вкладка **Actions**
3. Увидишь workflow "Build Smart Contract"
4. Кликни на него чтобы посмотреть прогресс

### 5. Скачать артефакты

После успешной сборки:
1. Перейди в Actions → выбери успешный run
2. Внизу будет секция **Artifacts**
3. Скачай `smart-contract-artifacts.zip`
4. Внутри будут:
   - `*.so` файлы (скомпилированные программы)
   - `*.json` файлы (IDL для фронтенда)

---

## Ручной деплой (если нужно)

Если хочешь задеплоить вручную после сборки на GitHub Actions:

```bash
# Скачай артефакты с GitHub Actions
# Распакуй их в prediction-market/duels_escrow/target/

# Установи Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Настрой кошелек
solana config set --keypair deployer-keypair.json
solana config set --url devnet

# Деплой
solana program deploy target/deploy/prediction_market.so
```

---

## Автоматический деплой

Workflow настроен на автоматический деплой при пуше в `master`:

1. **Build** - собирает все программы
2. **Test** - запускает тесты
3. **Deploy to Devnet** - деплоит на devnet (только если тесты прошли)

Чтобы задеплоить:
```bash
git push origin master
```

Workflow автоматически:
- Соберет контракт
- Запустит тесты
- Задеплоит на devnet
- Сохранит Program IDs в артефакты

---

## Преимущества CI/CD подхода

✅ **Чистое окружение** - каждая сборка в свежем контейнере  
✅ **Воспроизводимость** - одинаковые версии инструментов  
✅ **Автоматизация** - деплой по пушу в master  
✅ **Артефакты** - все файлы сохраняются  
✅ **Нет проблем с WSL** - не нужно настраивать локально  

---

## Следующие шаги

После успешной сборки на GitHub Actions:

1. ✅ Скачать IDL файлы из артефактов
2. ✅ Обновить фронтенд с новым IDL
3. ✅ Обновить бэкенд с новым Program ID
4. ✅ Протестировать на devnet
5. ✅ Задеплоить на mainnet (через отдельный workflow)
