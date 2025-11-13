# Hướng dẫn cài đặt Redis trên Windows

## Tùy chọn 1: Sử dụng Redis Cloud (Khuyến nghị cho người mới)

Redis Cloud cung cấp tier miễn phí, dễ sử dụng:

1. Truy cập https://redis.com/try-free/
2. Đăng ký tài khoản miễn phí
3. Tạo database mới (chọn region gần bạn nhất)
4. Copy connection string
5. Cập nhật `.env`:
   ```env
   REDIS_HOST=redis-xxxxx.redislabs.com
   REDIS_PORT=12345
   REDIS_PASSWORD=your_password
   ```

## Tùy chọn 2: Sử dụng WSL (Windows Subsystem for Linux)

### Bước 1: Cài đặt WSL

```powershell
# Chạy PowerShell với quyền Administrator
wsl --install
```

Restart máy tính sau khi cài xong.

### Bước 2: Cài đặt Redis trong WSL

```bash
# Mở Ubuntu terminal
sudo apt-get update
sudo apt-get install redis-server -y
```

### Bước 3: Chạy Redis

```bash
# Khởi động Redis server
redis-server

# Hoặc chạy dưới dạng background service
sudo service redis-server start
```

### Bước 4: Test kết nối

```bash
# Trong WSL terminal
redis-cli ping
# Nếu trả về "PONG" là thành công
```

### Bước 5: Cấu hình .env

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Tùy chọn 3: Memurai (Redis native cho Windows)

Memurai là phiên bản Redis tương thích với Windows:

1. Tải về từ https://www.memurai.com/get-memurai
2. Cài đặt theo hướng dẫn
3. Memurai sẽ chạy như Windows service
4. Cấu hình `.env`:
   ```env
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

## Tùy chọn 4: Docker Desktop

Nếu đã có Docker Desktop:

```powershell
# Pull Redis image
docker pull redis:latest

# Run Redis container
docker run --name mymap-redis -p 6379:6379 -d redis

# Check status
docker ps
```

Cấu hình `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Kiểm tra Redis đã hoạt động

### Trong ứng dụng Node.js:

```bash
# Chạy backend
npm run dev

# Nếu Redis kết nối thành công, bạn sẽ thấy:
# ✅ Redis connected successfully!
```

### Sử dụng redis-cli:

```bash
# WSL/Linux/Mac
redis-cli ping

# Hoặc test từ Node.js
node -e "const redis = require('ioredis'); const client = new redis(); client.ping().then(r => console.log(r));"
```

## Troubleshooting

### Lỗi: "Error: connect ECONNREFUSED 127.0.0.1:6379"

**Nguyên nhân**: Redis server chưa chạy

**Giải pháp**:
```bash
# WSL
sudo service redis-server start

# Docker
docker start mymap-redis
```

### Lỗi: "Error: Redis connection timeout"

**Nguyên nhân**: Firewall block port 6379

**Giải pháp**:
1. Mở Windows Defender Firewall
2. Advanced settings → Inbound Rules
3. New Rule → Port → TCP → 6379
4. Allow connection

### Redis dùng quá nhiều RAM

**Giải pháp**: Giới hạn memory trong config

Tạo file `redis.conf`:
```conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Chạy Redis với config:
```bash
redis-server /path/to/redis.conf
```

## Khuyến nghị

- **Development**: Dùng WSL hoặc Docker (dễ quản lý)
- **Production**: Dùng Redis Cloud hoặc managed service (AWS ElastiCache, Azure Cache)
- **Testing**: Dùng Redis Cloud free tier

## Tài liệu tham khảo

- Redis official: https://redis.io/docs/
- Redis Cloud: https://redis.com/redis-enterprise-cloud/overview/
- WSL: https://docs.microsoft.com/en-us/windows/wsl/
- Memurai: https://docs.memurai.com/
