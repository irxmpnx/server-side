"# Server-side"

### วิธีรัน database
## กรณียังไม่มีข้อมูลใน db

1. เริ่ม PostgresSQL
docker compose up -d

2. ตรวจตาราง
docker exec -it vendoo_postgres psql -U postgres -d market_db -c "\dt"

3. รันเว็ปได้เลย
npm run dev

## กรณีมีข้อมูลใน db แล้ว
1. ลบ volume ทั้งหมด
docker compose down -v
docker compose up -d

2. ทำตามข้อ 2 และ 3 ด้านบนได้เลย
