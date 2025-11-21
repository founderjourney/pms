# 📅 DÍA 3 - PLAN DE TRABAJO DETALLADO

**Fecha:** 2025-11-21
**Status Día 2:** ✅ Completado - Sistema de Reservas Backend 100%
**Objetivo Día 3:** Integración OTA vía iCal Sync (Booking.com + Hostelworld)

---

## ✅ ESTADO ACTUAL (Día 2 Completado)

- ✅ Backend de Reservas: 7 endpoints funcionando
- ✅ Sistema de confirmación con códigos únicos
- ✅ Validación de disponibilidad y conflictos
- ✅ Creación automática de transacciones
- ✅ Documentación API completa

---

## 🎯 OBJETIVO DÍA 3

**Meta Principal:** Implementar sincronización iCal bidireccional con OTAs

**Contexto del negocio:**
- **OTAs activas:** Booking.com + Hostelworld
- **Capacidad:** 5 habitaciones, 25 camas
- **Problema crítico:** Prevenir overbooking entre canales
- **Delay aceptable:** 1-12 horas (tamaño del hostal lo permite)

**Por qué iCal primero:**
- Hostelworld: Soporte completo bidireccional ✅
- Booking.com: Solo import (export manual temporal)
- Sin costos adicionales
- Implementación rápida (3-5 días)
- Base para XML API futuro

---

## 📋 ARQUITECTURA DEL SISTEMA

### **Componentes principales:**

```
┌─────────────────────────────────────────────────────────────┐
│                     ALMANIK PMS                              │
│                                                              │
│  ┌────────────────┐    ┌──────────────────┐                │
│  │  Reservations  │───▶│   iCal Export    │───┐            │
│  │    Module      │    │  (per room/bed)  │   │            │
│  └────────────────┘    └──────────────────┘   │            │
│         ▲                                      │            │
│         │              ┌──────────────────┐   │            │
│         │              │   iCal Import    │   │            │
│         └──────────────│  (OTA → PMS)     │   │            │
│                        └──────────────────┘   │            │
│                               ▲                │            │
│                               │                │            │
│                        ┌──────────────────┐   │            │
│                        │  Sync Scheduler  │   │            │
│                        │  (Cron: 2 hours) │   │            │
│                        └──────────────────┘   │            │
│                                                │            │
│                        ┌──────────────────┐   │            │
│                        │ Conflict Detect  │   │            │
│                        │  & Resolution    │   │            │
│                        └──────────────────┘   │            │
└────────────────────────────────────────────────┼────────────┘
                                                 │
                                                 │
            ┌────────────────────────────────────┼────────────┐
            │                                    ▼            │
            │         EXTERNAL OTAs                           │
            │                                                 │
            │  ┌─────────────────┐      ┌─────────────────┐ │
            │  │  Hostelworld    │◀────▶│  Booking.com    │ │
            │  │  (bidirectional)│      │  (import only)  │ │
            │  └─────────────────┘      └─────────────────┘ │
            └─────────────────────────────────────────────────┘
```

---

## 📋 DIVISIÓN DE TAREAS - DÍA 3

### 🤖 TAREA 3.1: Módulo iCal Sync Backend (4-5 horas)

**Archivo:** `server/modules/ical-sync.js`

#### **Funcionalidades a implementar:**

**1. Export iCal (Tu PMS → OTAs)**
```javascript
// Endpoints:
GET /api/ical/rooms/:room_id.ics
GET /api/ical/beds/:bed_id.ics
GET /api/ical/all-rooms.ics  // Consolidated

// Features:
- Generar formato iCal estándar (RFC 5545)
- Incluir todas las reservas confirmadas
- VEVENT por cada reserva con:
  * UID único
  * DTSTART/DTEND
  * SUMMARY (Guest name + confirmation code)
  * DESCRIPTION (detalles reserva)
  * STATUS (CONFIRMED/CANCELLED)
- Cache de 1 hora
- Soporte para timezone correcto
```

**2. Import iCal (OTAs → Tu PMS)**
```javascript
// Endpoints:
POST /api/ical/sources          // Registrar nuevo feed OTA
GET /api/ical/sources           // Listar feeds configurados
DELETE /api/ical/sources/:id    // Eliminar feed
POST /api/ical/sync/:source_id  // Manual sync
POST /api/ical/sync-all         // Sync all sources

// Features:
- Parser iCal (librería: node-ical)
- Crear reservas externas en DB (flag: external_source)
- Detectar updates a reservas existentes
- Detectar cancelaciones
- Conflict detection antes de guardar
- Activity log de cada sync
```

**3. Conflict Detection**
```javascript
// Lógica:
- Detectar overlapping dates para misma cama
- Prioridad: Reservas internas > Externas
- Alert system si detecta conflicto
- Manual resolution UI (futuro)
- Email notification a admin
```

**4. Sync Scheduler**
```javascript
// Archivo: server/cron/sync-ical.js
- Ejecutar cada 2 horas (configurable)
- Sync todos los sources activos
- Error handling y retry logic
- Performance metrics logging
```

---

### 🗄️ TAREA 3.2: Database Schema Updates (30 min)

**Nuevas tablas:**

```sql
-- Table: ical_sources
CREATE TABLE ical_sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,           -- "Booking.com Room 1"
  source_type VARCHAR(50) NOT NULL,     -- "booking", "hostelworld", "airbnb"
  ical_url TEXT NOT NULL,               -- URL del feed
  room_id INTEGER REFERENCES rooms(id), -- Null si es global
  bed_id INTEGER REFERENCES beds(id),   -- Null si es room-level
  active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(20),         -- "success", "error"
  last_sync_error TEXT,
  sync_interval_minutes INTEGER DEFAULT 120,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: external_reservations
CREATE TABLE external_reservations (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id), -- Link a reserva interna
  source_id INTEGER REFERENCES ical_sources(id),
  external_id VARCHAR(255),                    -- UID del iCal
  source_type VARCHAR(50),                     -- "booking", "hostelworld"
  guest_name VARCHAR(255),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  bed_id INTEGER REFERENCES beds(id),
  room_id INTEGER REFERENCES rooms(id),
  status VARCHAR(20) DEFAULT 'confirmed',      -- "confirmed", "cancelled"
  raw_ical_data TEXT,                          -- Backup del evento original
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_id, external_id)
);

-- Table: sync_logs
CREATE TABLE sync_logs (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES ical_sources(id),
  sync_started_at TIMESTAMP,
  sync_completed_at TIMESTAMP,
  status VARCHAR(20),                          -- "success", "partial", "error"
  events_processed INTEGER DEFAULT 0,
  events_created INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_cancelled INTEGER DEFAULT 0,
  conflicts_detected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Migration script:**
```bash
node server/migrate-ical-schema.js
```

---

### 📦 TAREA 3.3: Dependencias NPM (10 min)

```bash
npm install --save node-ical ical-generator moment-timezone
```

**Librerías:**
- `node-ical`: Parser de archivos .ics
- `ical-generator`: Generador de iCal estándar
- `moment-timezone`: Manejo correcto de timezones

---

### 📖 TAREA 3.4: Documentación (1 hora)

**Archivos a crear:**

1. **`docs/05-api/ICAL-SYNC-API.md`**
   - Endpoints export iCal
   - Endpoints import iCal
   - Setup guide para OTAs
   - Ejemplos de configuración

2. **`docs/07-integrations/HOSTELWORLD-SETUP.md`**
   - Paso a paso para conectar Hostelworld
   - Screenshots del extranet
   - Troubleshooting

3. **`docs/07-integrations/BOOKING-SETUP.md`**
   - Setup iCal import desde Booking
   - Workaround para export manual
   - Path a XML API

---

### 🧪 TAREA 3.5: Testing (2 horas)

**Test cases:**

```bash
# 1. Export iCal
curl http://localhost:3000/api/ical/rooms/1.ics
# Verificar: formato válido, todas las reservas incluidas

# 2. Import iCal (mock file)
curl -X POST http://localhost:3000/api/ical/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hostelworld Room 1",
    "source_type": "hostelworld",
    "ical_url": "https://hostelworld.com/ical/xxx.ics",
    "room_id": 1
  }'

# 3. Manual sync
curl -X POST http://localhost:3000/api/ical/sync/1

# 4. Check external reservations created
curl http://localhost:3000/api/ical/sources/1/reservations

# 5. Test conflict detection
# Crear reserva interna que overlaps con externa
# Verificar alert generado
```

**Edge cases:**
- ✅ Timezone correcta (UTC vs local)
- ✅ Reservas multi-día
- ✅ Cancelaciones en OTA
- ✅ Updates de fechas
- ✅ Feeds inaccesibles (404, timeout)
- ✅ iCal malformado

---

## 📊 CHECKLIST DE IMPLEMENTACIÓN

### **Backend Core:**
- [ ] Crear `server/modules/ical-sync.js`
- [ ] Implementar export endpoints (GET /api/ical/...)
- [ ] Implementar import endpoints (POST /api/ical/...)
- [ ] Parser iCal con node-ical
- [ ] Generator iCal con ical-generator
- [ ] Conflict detection logic
- [ ] Activity logging

### **Database:**
- [ ] Crear migration script `server/migrate-ical-schema.js`
- [ ] Ejecutar migration en SQLite (dev)
- [ ] Verificar schema en Neon (producción)
- [ ] Seed data para testing

### **Scheduler:**
- [ ] Crear `server/cron/sync-ical.js`
- [ ] Setup cron job (node-cron o simple setInterval)
- [ ] Error handling y retry
- [ ] Performance logging

### **Integration:**
- [ ] Integrar módulo con `server-simple.js`
- [ ] Agregar rutas al router
- [ ] Middleware de autenticación
- [ ] CORS para iCal endpoints (public read)

### **Testing:**
- [ ] Test export iCal (valid format)
- [ ] Test import from mock iCal
- [ ] Test conflict detection
- [ ] Test automatic sync
- [ ] Test con Hostelworld real (si disponible)
- [ ] Test con Booking.com export

### **Documentation:**
- [ ] API documentation (ICAL-SYNC-API.md)
- [ ] Setup guides (HOSTELWORLD-SETUP.md, BOOKING-SETUP.md)
- [ ] Troubleshooting guide
- [ ] Update README con nueva feature

---

## 🎯 MÉTRICAS DE ÉXITO

**Funcional:**
- ✅ Export iCal válido (pasa validación RFC 5545)
- ✅ Import desde Hostelworld funcionando
- ✅ Import desde Booking.com funcionando
- ✅ Sync automático cada 2 horas
- ✅ Conflict detection activo
- ✅ 0 errores en sync logs

**Performance:**
- ⏱️ Export generation: <2 segundos (25 camas)
- ⏱️ Import processing: <5 segundos por feed
- ⏱️ Sync completo: <30 segundos (todos los sources)

**Business:**
- 🎯 Reducir overbooking risk de 10% → <1%
- 🎯 Eliminar entrada manual de reservas OTA
- 🎯 Tiempo ahorrado: ~30 min/día

---

## 🚧 RIESGOS Y MITIGACIONES

### **Riesgo 1: Delay en sync (12 horas)**
**Impacto:** Posible overbooking
**Mitigación:**
- Sync cada 2 horas (vs 12 horas default)
- Buffer de 1 cama por habitación
- Booking window mínimo 24h
- Alert system inmediato

### **Riesgo 2: Booking.com no acepta import**
**Impacto:** Sync unidireccional solo
**Mitigación:**
- Aplicar a XML API en paralelo
- Manual update temporal (5 min/día)
- Priorizar Hostelworld (100% automatizado)

### **Riesgo 3: iCal malformado de OTA**
**Impacto:** Sync falla
**Mitigación:**
- Robust error handling
- Validation antes de procesar
- Alertas inmediatas
- Manual intervention UI

---

## 📅 TIMELINE ESTIMADO

| Tarea | Tiempo | Status |
|-------|--------|--------|
| Database schema + migration | 30 min | Pending |
| Export iCal endpoints | 1.5 hours | Pending |
| Import iCal logic | 2 hours | Pending |
| Conflict detection | 1 hour | Pending |
| Sync scheduler | 1 hour | Pending |
| Testing manual | 2 hours | Pending |
| Documentation | 1 hour | Pending |
| **TOTAL** | **9 hours** | **0% complete** |

**Delivery:** End of Day 3 (funcionando básico)
**Polish:** Day 4 (testing exhaustivo + setup real OTAs)

---

## 🎓 APRENDIZAJES ESPERADOS

### **Técnicos:**
1. iCal RFC 5545 standard
2. Timezone handling en reservas
3. External API integration patterns
4. Conflict resolution strategies
5. Cron job scheduling en Node.js

### **Negocio:**
1. OTA distribution models
2. Channel management challenges
3. Overbooking prevention techniques
4. Manual vs automated workflows

---

## 📞 NEXT STEPS POST DÍA 3

### **Día 4:**
- Setup real con Hostelworld (obtener iCal URLs)
- Setup real con Booking.com (import only)
- Testing exhaustivo end-to-end
- Monitoring dashboard (frontend)

### **Semana 2:**
- Aplicar a Booking.com XML API
- Optimizar conflict resolution
- Email notifications automáticas
- Performance improvements

### **Futuro:**
- Airbnb integration (si se usa)
- Expedia/Vrbo (si se usa)
- Dynamic pricing sync
- Analytics de ocupación multi-canal

---

## 📚 RECURSOS Y REFERENCIAS

**Standards:**
- RFC 5545: iCalendar specification
- https://icalendar.org/

**Libraries:**
- node-ical: https://github.com/jens-maus/node-ical
- ical-generator: https://github.com/sebbo2002/ical-generator

**OTA Documentation:**
- Hostelworld iCal: https://www.hostelworld.com/hostelmanagement/ical
- Booking.com Calendar Sync: https://partner.booking.com/en-gb/help/rates-availability/extranet-calendar/syncing-your-bookingcom-calendar-third-party-calendars

---

## ✅ PRE-FLIGHT CHECKLIST

**Antes de empezar:**
- [x] Día 2 completado (Reservations module)
- [x] Database funcionando (Neon)
- [x] Server corriendo sin errores
- [ ] NPM packages instalados
- [ ] Database schema migrated
- [ ] Plan revisado y aprobado

**Ready to code:** ✅

---

**Created:** 2025-11-21
**By:** Claude + Equipo Almanik PMS
**Goal:** Sistema de sincronización OTA sin overbooking 🎯
