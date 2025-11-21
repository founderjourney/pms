# 📅 iCal Sync API Documentation

**Version:** 1.0
**Module:** iCal Sync (OTA Integration)
**Base URL:** `/api/ical`

---

## 📋 Overview

El módulo de sincronización iCal permite la integración bidireccional con OTAs (Booking.com, Hostelworld, Airbnb, etc.) a través del estándar iCalendar (RFC 5545).

### **Features:**
- ✅ Export calendarios iCal por habitación/cama
- ✅ Import calendarios desde OTAs (Hostelworld, Booking.com)
- ✅ Sincronización automática cada 2 horas
- ✅ Detección de conflictos de reservas
- ✅ Logging completo de sincronizaciones
- ✅ Soporte para múltiples fuentes OTA

### **Casos de uso:**
1. **Booking.com:** Import reservas → Tu PMS (one-way)
2. **Hostelworld:** Sincronización bidireccional completa
3. **Prevenir overbooking:** Conflict detection automático
4. **Centralización:** Todas las reservas OTA en un solo lugar

---

## 🔐 Authentication

**Endpoints públicos** (no requieren auth):
- `GET /api/ical/*.ics` - Export calendars (OTAs necesitan acceso público)

**Endpoints privados** (requieren auth):
- Todos los demás endpoints de administración

**Header:**
```http
session-id: your-session-id-here
```

---

## 📤 Export Endpoints (iCal Generation)

### 1. Export Calendar - Por Habitación

**Endpoint:** `GET /api/ical/rooms/:room_id.ics`
**Auth:** No requerido (público)
**Description:** Genera feed iCal con todas las reservas de una habitación específica

**Request:**
```bash
curl http://localhost:3000/api/ical/rooms/1.ics
```

**Response:**
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID://Almanik PMS//iCal Sync//EN
X-WR-CALNAME:Room 1 - Almanik Hostel
X-WR-TIMEZONE:America/Bogota
BEGIN:VEVENT
UID:booking-123@almanik-pms.com
DTSTART:20251125T000000Z
DTEND:20251128T000000Z
SUMMARY:Juan Perez - Cama 1A
DESCRIPTION:Booking #123\nConfirmation: ALM-20251120-123456\nGuest: Juan Perez\nNights: 3\nTotal: $150000
STATUS:CONFIRMED
BUSY:BUSY
END:VEVENT
END:VCALENDAR
```

**Status Codes:**
- `200` - OK
- `404` - Room not found
- `500` - Server error

---

### 2. Export Calendar - Por Cama

**Endpoint:** `GET /api/ical/beds/:bed_id.ics`
**Auth:** No requerido (público)
**Description:** Genera feed iCal con todas las reservas de una cama específica

**Request:**
```bash
curl http://localhost:3000/api/ical/beds/5.ics
```

**Response:** (mismo formato iCal que anterior)

---

### 3. Export Calendar - Todas las Habitaciones

**Endpoint:** `GET /api/ical/all-rooms.ics`
**Auth:** No requerido (público)
**Description:** Genera feed iCal consolidado con todas las reservas del hostel

**Request:**
```bash
curl http://localhost:3000/api/ical/all-rooms.ics
```

**Uso:**
- Backup completo de todas las reservas
- Importar a Google Calendar / Outlook
- Vista unificada para management

---

## 📥 Import / Source Management Endpoints

### 4. Registrar Fuente iCal (OTA Feed)

**Endpoint:** `POST /api/ical/sources`
**Auth:** Requerido
**Description:** Registra una nueva fuente de calendario externo (OTA)

**Request Body:**
```json
{
  "name": "Hostelworld Room 1",
  "source_type": "hostelworld",
  "ical_url": "https://www.hostelworld.com/ical/property123/room1.ics",
  "room_id": 1,
  "bed_id": null,
  "sync_interval_minutes": 120
}
```

**Fields:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| name | string | ✅ | Nombre descriptivo de la fuente |
| source_type | string | ✅ | Tipo de OTA: `booking`, `hostelworld`, `airbnb`, `custom` |
| ical_url | string | ✅ | URL del feed iCal a importar |
| room_id | integer | ❌ | ID de habitación (si aplica) |
| bed_id | integer | ❌ | ID de cama (si aplica) |
| sync_interval_minutes | integer | ❌ | Intervalo de sync (default: 120) |

**Response:**
```json
{
  "success": true,
  "source": {
    "id": 1,
    "name": "Hostelworld Room 1",
    "source_type": "hostelworld",
    "ical_url": "https://www.hostelworld.com/ical/...",
    "room_id": 1,
    "bed_id": null,
    "active": true,
    "last_sync_at": null,
    "last_sync_status": null,
    "sync_interval_minutes": 120,
    "created_at": "2025-11-21T10:00:00Z"
  }
}
```

**Status Codes:**
- `200` - Source created
- `400` - Missing required fields
- `401` - Not authenticated
- `500` - Server error

---

### 5. Listar Fuentes iCal

**Endpoint:** `GET /api/ical/sources`
**Auth:** Requerido

**Request:**
```bash
curl -H "session-id: xxx" http://localhost:3000/api/ical/sources
```

**Response:**
```json
{
  "sources": [
    {
      "id": 1,
      "name": "Hostelworld Room 1",
      "source_type": "hostelworld",
      "ical_url": "https://...",
      "room_id": 1,
      "active": true,
      "last_sync_at": "2025-11-21T12:00:00Z",
      "last_sync_status": "success",
      "last_sync_error": null,
      "sync_interval_minutes": 120
    },
    {
      "id": 2,
      "name": "Booking.com Room 2",
      "source_type": "booking",
      "ical_url": "https://...",
      "room_id": 2,
      "active": true,
      "last_sync_at": "2025-11-21T11:45:00Z",
      "last_sync_status": "error",
      "last_sync_error": "HTTP 404: Not Found"
    }
  ]
}
```

---

### 6. Ver Fuente Específica + Stats

**Endpoint:** `GET /api/ical/sources/:id`
**Auth:** Requerido

**Request:**
```bash
curl -H "session-id: xxx" http://localhost:3000/api/ical/sources/1
```

**Response:**
```json
{
  "source": {
    "id": 1,
    "name": "Hostelworld Room 1",
    "source_type": "hostelworld",
    "ical_url": "https://...",
    "active": true,
    "last_sync_at": "2025-11-21T12:00:00Z",
    "last_sync_status": "success"
  },
  "stats": {
    "total_reservations": 12,
    "recent_syncs": [
      {
        "id": 45,
        "sync_started_at": "2025-11-21T12:00:00Z",
        "sync_completed_at": "2025-11-21T12:00:05Z",
        "status": "success",
        "events_processed": 15,
        "events_created": 2,
        "events_updated": 1,
        "events_cancelled": 0,
        "conflicts_detected": 0
      }
    ]
  }
}
```

---

### 7. Actualizar Fuente iCal

**Endpoint:** `PUT /api/ical/sources/:id`
**Auth:** Requerido

**Request Body:**
```json
{
  "name": "Hostelworld Room 1 Updated",
  "ical_url": "https://new-url.com/calendar.ics",
  "active": true,
  "sync_interval_minutes": 60
}
```

**Response:**
```json
{
  "success": true,
  "source": { /* updated source */ }
}
```

---

### 8. Eliminar Fuente iCal

**Endpoint:** `DELETE /api/ical/sources/:id`
**Auth:** Requerido

**Request:**
```bash
curl -X DELETE -H "session-id: xxx" \
  http://localhost:3000/api/ical/sources/1
```

**Response:**
```json
{
  "success": true,
  "message": "Source removed"
}
```

---

## 🔄 Sync Operations

### 9. Sincronización Manual - Una Fuente

**Endpoint:** `POST /api/ical/sync/:source_id`
**Auth:** Requerido
**Description:** Ejecuta sincronización manual inmediata para una fuente específica

**Request:**
```bash
curl -X POST -H "session-id: xxx" \
  http://localhost:3000/api/ical/sync/1
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "processed": 15,
    "created": 2,
    "updated": 1,
    "cancelled": 0,
    "conflicts": 0
  },
  "source": "Hostelworld Room 1"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "HTTP 404: Feed not found",
  "source": "Hostelworld Room 1"
}
```

---

### 10. Sincronización Manual - Todas las Fuentes

**Endpoint:** `POST /api/ical/sync-all`
**Auth:** Requerido
**Description:** Ejecuta sincronización manual de todas las fuentes activas

**Request:**
```bash
curl -X POST -H "session-id: xxx" \
  http://localhost:3000/api/ical/sync-all
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "source_id": 1,
      "success": true,
      "stats": {
        "processed": 15,
        "created": 2,
        "updated": 1,
        "cancelled": 0,
        "conflicts": 0
      },
      "source": "Hostelworld Room 1"
    },
    {
      "source_id": 2,
      "success": false,
      "error": "HTTP 404: Not Found",
      "source": "Booking.com Room 2"
    }
  ]
}
```

---

## 📊 External Reservations

### 11. Listar Reservas Externas

**Endpoint:** `GET /api/ical/external-reservations`
**Auth:** Requerido
**Description:** Lista todas las reservas importadas desde OTAs

**Query Parameters:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| status | string | Filtrar por estado: `confirmed`, `cancelled` |
| source_id | integer | Filtrar por fuente específica |

**Request:**
```bash
curl -H "session-id: xxx" \
  "http://localhost:3000/api/ical/external-reservations?status=confirmed&source_id=1"
```

**Response:**
```json
{
  "reservations": [
    {
      "id": 1,
      "booking_id": null,
      "source_id": 1,
      "external_id": "booking-xyz@hostelworld.com",
      "source_type": "hostelworld",
      "guest_name": "John Doe",
      "check_in": "2025-11-25",
      "check_out": "2025-11-28",
      "bed_id": 5,
      "room_id": 1,
      "status": "confirmed",
      "created_at": "2025-11-21T10:00:00Z",
      "updated_at": "2025-11-21T12:00:00Z"
    }
  ]
}
```

---

## 🚨 Conflict Detection

### **Cómo funciona:**

El sistema detecta conflictos automáticamente al importar reservas:

1. **Check interno:** Busca reservas del PMS que se superpongan
2. **Check externo:** Busca otras reservas OTA que se superpongan
3. **Alert:** Si detecta conflicto, lo registra en logs y alerta

**Lógica de conflicto:**
```sql
-- Detecta overlapping dates
WHERE bed_id = X
AND (
  (check_in < NEW_CHECK_OUT AND check_out > NEW_CHECK_IN) OR
  (check_in < NEW_CHECK_OUT AND check_out > NEW_CHECK_IN) OR
  (check_in >= NEW_CHECK_IN AND check_out <= NEW_CHECK_OUT)
)
```

**Response en sync log:**
```json
{
  "conflicts_detected": 1
}
```

**Prioridad de resolución:**
- Reservas internas > Reservas externas
- Manual intervention requerida si conflicto detectado

---

## ⏰ Automatic Sync (Cron Job)

### **Configuración:**

- **Frecuencia:** Cada 2 horas (customizable)
- **Schedule:** `0 */2 * * *` (minuto 0 de cada 2 horas)
- **Auto-start:** Se inicia automáticamente con el servidor

### **Logs del Cron:**

```bash
🔄 ====== iCal Sync Started ======
📅 Time: 2025-11-21T12:00:00Z
📋 Found 3 active source(s)

🔄 Syncing: Hostelworld Room 1 (hostelworld)
  ✅ Created: Juan Perez (2025-11-25 to 2025-11-28)
  ✏️  Updated: Maria Garcia (2025-11-30 to 2025-12-02)
  📊 Stats: 2 new, 1 updated, 0 conflicts

🔄 Syncing: Booking.com Room 2 (booking)
  ✅ Created: Peter Smith (2025-11-26 to 2025-11-29)
  📊 Stats: 1 new, 0 updated, 0 conflicts

📊 ====== Sync Summary ======
✅ Successful: 3/3
❌ Failed: 0/3
⏱️  Duration: 8.42s
============================
```

### **Ejecutar manualmente:**
```bash
node server/cron/sync-ical.js
```

---

## 📖 Setup Guides

### **Hostelworld Setup:**

1. **Login** a Hostelworld Extranet
2. **Go to:** Calendar Settings → Export Calendar
3. **Copy iCal URL:** `https://www.hostelworld.com/ical/xxxxx.ics`
4. **Registrar en PMS:**
```bash
curl -X POST -H "session-id: xxx" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/ical/sources \
  -d '{
    "name": "Hostelworld Room 1",
    "source_type": "hostelworld",
    "ical_url": "https://www.hostelworld.com/ical/xxxxx.ics",
    "room_id": 1
  }'
```

5. **Import en Hostelworld:**
   - Settings → Import Calendar
   - Add URL: `http://your-pms-domain.com/api/ical/rooms/1.ics`
   - ✅ Bidirectional sync completo!

---

### **Booking.com Setup (Import Only):**

⚠️ **Importante:** Booking.com YA NO acepta import desde marzo 2025

**Setup para Import (Tu PMS ← Booking.com):**

1. **Login** a Booking.com Extranet
2. **Go to:** Calendar → Sync Calendars
3. **Export Calendar:** Copy iCal URL
4. **Registrar en tu PMS:**
```bash
curl -X POST -H "session-id: xxx" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/ical/sources \
  -d '{
    "name": "Booking.com Room 1",
    "source_type": "booking",
    "ical_url": "https://admin.booking.com/hotel/xxxxx/ical",
    "room_id": 1
  }'
```

**Para Export (Tu PMS → Booking.com):**
- ❌ No soportado vía iCal (limitación Booking.com)
- ✅ Manual update en Booking extranet
- ⏳ Aplicar a XML API (4-6 semanas aprobación)

---

## 🔍 Troubleshooting

### **Problema: Sync falla con HTTP 404**
```
❌ Error: HTTP 404: Not Found
```
**Solución:**
- Verificar URL del feed iCal es correcta
- Verificar que el feed esté activo en la OTA
- Probar URL en navegador manualmente

---

### **Problema: Conflictos detectados**
```
⚠️  Conflict detected for Juan Perez (2025-11-25 to 2025-11-28)
```
**Solución:**
1. Revisar `GET /api/ical/external-reservations`
2. Identificar reserva conflictiva
3. Cancelar una de las dos reservas (interna o externa)
4. Re-sync para limpiar conflicto

---

### **Problema: Sync muy lento (>30 segundos)**
**Solución:**
- Reducir número de fuentes activas
- Aumentar `sync_interval_minutes` (menos frecuente)
- Verificar conexión a internet
- Revisar logs de OTA para rate limiting

---

## 📊 Database Schema

### **ical_sources**
```sql
id, name, source_type, ical_url, room_id, bed_id, active,
last_sync_at, last_sync_status, last_sync_error, sync_interval_minutes,
created_at, updated_at
```

### **external_reservations**
```sql
id, booking_id, source_id, external_id, source_type, guest_name,
check_in, check_out, bed_id, room_id, status, raw_ical_data,
created_at, updated_at
```

### **sync_logs**
```sql
id, source_id, sync_started_at, sync_completed_at, status,
events_processed, events_created, events_updated, events_cancelled,
conflicts_detected, error_message, created_at
```

---

## ✅ Best Practices

1. **URLs públicas:** Asegurar que iCal export endpoints sean accesibles públicamente
2. **HTTPS:** Usar HTTPS en producción (OTAs requieren secure connection)
3. **Monitoring:** Revisar `sync_logs` diariamente
4. **Conflict resolution:** Resolver conflictos dentro de 24h
5. **Backup:** Mantener raw_ical_data para debugging
6. **Rate limiting:** No sync más frecuente que cada 1 hora

---

## 🚀 Next Steps

1. **Aplicar a Booking.com XML API** para sync bidireccional
2. **Add email notifications** para conflictos
3. **Dashboard frontend** para visualizar syncs
4. **Support Airbnb** (si se usa)

---

**Documentación completa:** Day 3
**Última actualización:** 2025-11-21
**Contacto:** Claude + Equipo Almanik PMS
