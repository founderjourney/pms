# 🧪 GUÍA DE TESTING MANUAL - Sistema de Reservas

**Servidor:** http://localhost:3000
**Credenciales:** admin / admin123

---

## 📝 PASO 1: Obtener Session ID

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "sessionId": "1763700045778",
  "user": {...}
}
```

📌 **Copia tu `sessionId` y úsalo en los siguientes pasos**

---

## 📝 PASO 2: Ver disponibilidad de camas

```bash
curl "http://localhost:3000/api/reservations/availability/check?check_in=2025-12-20&check_out=2025-12-23" \
  -H "session-id: TU_SESSION_ID"
```

**Qué muestra:**
- Total de camas (27)
- Camas disponibles
- Camas ocupadas
- Precio por noche de cada cama

---

## 📝 PASO 3: Crear una reserva

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID" \
  -d '{
    "guest_id": 1,
    "bed_id": 10,
    "check_in": "2025-12-20",
    "check_out": "2025-12-23",
    "source": "phone"
  }'
```

**Qué hace:**
- Crea reserva para huésped ID 1 (Juan Carlos Pérez)
- Asigna cama ID 10 (2-1)
- Del 20 al 23 de diciembre (3 noches)
- Genera código único (ej: ALM-20251120-184046)
- Calcula precio automáticamente (3 noches × $25 = $75)

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Reservation created successfully",
  "reservation": {
    "id": 7,
    "confirmation_code": "ALM-20251120-184523",
    "total": 75,
    "nights": 3,
    "status": "pending"
  }
}
```

📌 **Copia el `id` de la reserva para siguientes pasos**

---

## 📝 PASO 4: Ver detalles de la reserva

```bash
curl http://localhost:3000/api/reservations/7 \
  -H "session-id: TU_SESSION_ID"
```

**Qué muestra:**
- Info completa de la reserva
- Datos del huésped
- Datos de la cama
- Transacciones asociadas

---

## 📝 PASO 5: Confirmar la reserva

```bash
curl -X POST http://localhost:3000/api/reservations/7/confirm \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID"
```

**Qué hace:**
- Cambia status de "pending" → "confirmed"
- Crea transacción automática (cargo por habitación)
- Registra en activity_log

---

## 📝 PASO 6: Actualizar la reserva

```bash
curl -X PUT http://localhost:3000/api/reservations/7 \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID" \
  -d '{"check_out": "2025-12-25"}'
```

**Qué hace:**
- Extiende check-out al 25 de diciembre
- Recalcula noches: 3 → 5
- Recalcula precio: $75 → $125

---

## 📝 PASO 7: Listar todas las reservas

```bash
curl http://localhost:3000/api/reservations \
  -H "session-id: TU_SESSION_ID"
```

**Filtros opcionales:**
```bash
# Solo reservas pendientes
curl "http://localhost:3000/api/reservations?status=pending" \
  -H "session-id: TU_SESSION_ID"

# Solo reservas de un huésped específico
curl "http://localhost:3000/api/reservations?guest_id=1" \
  -H "session-id: TU_SESSION_ID"

# Reservas en un rango de fechas
curl "http://localhost:3000/api/reservations?date_from=2025-12-01&date_to=2025-12-31" \
  -H "session-id: TU_SESSION_ID"
```

---

## 📝 PASO 8: Cancelar una reserva

```bash
curl -X DELETE http://localhost:3000/api/reservations/7 \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID" \
  -d '{"reason": "Cliente canceló por cambio de planes"}'
```

**Qué hace:**
- Cambia status a "cancelled"
- Registra fecha de cancelación
- Libera la cama si estaba reservada
- Guarda razón de cancelación

---

## 🎯 CASOS DE USO REALES

### Caso 1: Reserva por teléfono
```bash
# 1. Cliente llama preguntando por disponibilidad
curl "http://localhost:3000/api/reservations/availability/check?check_in=2025-12-25&check_out=2025-12-27" \
  -H "session-id: TU_SESSION_ID"

# 2. Hay camas disponibles, crear reserva
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID" \
  -d '{
    "guest_id": 2,
    "bed_id": 15,
    "check_in": "2025-12-25",
    "check_out": "2025-12-27",
    "source": "phone"
  }'

# 3. Dar código de confirmación al cliente
# "Su reserva está confirmada. Código: ALM-20251120-185030"
```

### Caso 2: Cliente quiere extender estadía
```bash
# 1. Buscar la reserva del cliente
curl "http://localhost:3000/api/reservations?guest_id=2" \
  -H "session-id: TU_SESSION_ID"

# 2. Extender check-out
curl -X PUT http://localhost:3000/api/reservations/8 \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID" \
  -d '{"check_out": "2025-12-30"}'

# 3. El precio se recalcula automáticamente
```

### Caso 3: Cliente no llegó (no-show)
```bash
# Actualizar status a no_show
curl -X PUT http://localhost:3000/api/reservations/8 \
  -H "Content-Type: application/json" \
  -H "session-id: TU_SESSION_ID" \
  -d '{"status": "no_show"}'
```

---

## 🛠️ HERRAMIENTAS ÚTILES

### Si tienes `jq` instalado (prettify JSON):
```bash
curl http://localhost:3000/api/reservations \
  -H "session-id: TU_SESSION_ID" | jq '.'
```

### Si prefieres usar Postman/Insomnia:
1. Importa la colección de endpoints
2. Configura header: `session-id: TU_SESSION_ID`
3. Prueba cada endpoint visualmente

---

## 📊 DATOS DE PRUEBA DISPONIBLES

### Huéspedes (guest_id):
- 1: Juan Carlos Pérez
- 2: María González
- 3: Carlos Eduardo Silva
- 4: Ana Lucía Rodríguez
- 5: Diego Alejandro Martínez
- 6: Valentina Morales

### Camas (bed_id):
- 1-9: Habitación 1 ($25/noche)
- 10-15: Habitación 2 ($25/noche)
- 16-19: Habitación 3 ($25/noche)
- 20-24: Habitación 4 ($25/noche)
- 25-26: Priv 1 ($50/noche)
- 27: Priv 2 ($60/noche)

---

## ✅ CHECKLIST DE TESTING

- [ ] Puedo hacer login y obtener session-id
- [ ] Puedo verificar disponibilidad de camas
- [ ] Puedo crear una nueva reserva
- [ ] Se genera código de confirmación único
- [ ] El precio se calcula automáticamente
- [ ] Puedo confirmar una reserva pendiente
- [ ] Se crea transacción al confirmar
- [ ] Puedo actualizar fechas de reserva
- [ ] El precio se recalcula al actualizar
- [ ] Puedo ver detalles de una reserva
- [ ] Puedo listar todas las reservas
- [ ] Puedo filtrar reservas por status/fecha
- [ ] Puedo cancelar una reserva
- [ ] No puedo reservar cama ya ocupada

---

**¡Listo para probar! 🚀**
