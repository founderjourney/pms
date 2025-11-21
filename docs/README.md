# 📚 DOCUMENTACIÓN ALMANIK PMS

Bienvenido al centro de documentación del sistema Almanik PMS. Toda la documentación ha sido organizada profesionalmente para facilitar su consulta.

---

## 📁 ESTRUCTURA DE DOCUMENTACIÓN

### 01. Documentación de Producto
**Ubicación:** `docs/01-product/`

Define qué es el sistema, sus objetivos y validaciones:

- **PRD-v3-SIMPLIFICADO.md** - Product Requirements Document (versión simplificada)
- **MVP-VALIDATION-SUMMARY.md** - Resumen de validación del MVP
- **RESUMEN-EJECUTIVO-SISTEMA.md** - Resumen ejecutivo para stakeholders

### 02. Planificación y Roadmaps
**Ubicación:** `docs/02-planning/`

Planificación del proyecto y hojas de ruta:

- **ROADMAP-SENIOR.md** - Roadmap técnico nivel senior
- **ROADMAP-FUTURO-FEATURES-COMPLEJAS.md** - Features avanzadas futuras
- **SPRINTS-ALMANIK-PMS-SIMPLIFICADO.md** - Planificación de sprints

### 03. Deployment y Configuración
**Ubicación:** `docs/03-deployment/`

Guías de despliegue y configuración en producción:

- **DEPLOYMENT-GUIDE.md** - Guía general de despliegue
- **NEON-MIGRATION-PLAN.md** - Plan de migración a Neon PostgreSQL
- **MIGRATION-COMPLETE.md** - Reporte de migración completada (Day 1)
- **PRODUCTION-DEPLOY-COMPLETE.md** - Despliegue en producción completo
- **DEPLOY-SUCCESS.md** - Reporte de despliegue exitoso
- **SUPABASE-SETUP.md** - Configuración de Supabase (legacy)

### 04. Planes Diarios y Reportes
**Ubicación:** `docs/04-daily-plans/` y `docs/04-reports/`

#### Planes Diarios (NEW - 2025-11-20):
- **DIA-2-PLAN.md** - 🆕 Plan detallado Día 2 con estrategia de delegación
- **DIA-2-RESUMEN.md** - 🆕 Resumen completo Día 2 (100% completado)

#### Reportes de Estado:
- **STATUS-REPORT-CURRENT.md** - Reporte histórico (Oct 2025)
- **STATUS-REPORT.md** - Reporte histórico anterior
- **TECHNICAL-AUDIT-REPORT.md** - Auditoría técnica del sistema
- **SENIOR-ARCHITECT-AUDIT-2025-11-19.md** - Auditoría arquitectónica

### 05. Documentación API
**Ubicación:** `docs/05-api/`

Documentación detallada de APIs y endpoints:

- **RESERVATIONS-API.md** - 🆕 API completa de Reservas (7 endpoints) con ejemplos

### 06. Notas de Desarrollo
**Ubicación:** `docs/05-development/`

Contexto y notas para el equipo de desarrollo:

- **context.md** - Contexto completo del proyecto (IMPORTANTE)
- **REVISAO-CON-VIVI.txt** - Notas de revisión con stakeholder
- **habitaciones.txt** - Configuración de habitaciones y camas

### Archivo de Documentos Obsoletos
**Ubicación:** `docs/archive/obsolete-docs/`

Documentación antigua que ya no es relevante pero se mantiene para referencia histórica.

---

## 🚀 INICIO RÁPIDO

### Para nuevos desarrolladores:
1. 🔥 **START HERE:** `docs/START-HERE.md`
2. 📊 **Progreso actual:** `docs/PROJECT-TRACKING.md` (🆕 ACTUALIZADO)
3. 📖 Contexto completo: `docs/05-development/context.md`
4. 📋 PRD del sistema: `docs/01-product/PRD-v3-SIMPLIFICADO.md`

### Para seguir el progreso diario:
1. 🎯 **Tracking general:** `docs/PROJECT-TRACKING.md` (70% completado)
2. 📅 **Día 2 (último):** `docs/04-daily-plans/DIA-2-RESUMEN.md` (✅ Completado)
3. 🗓️ **Plan Día 2:** `docs/04-daily-plans/DIA-2-PLAN.md`

### Para usar las APIs:
1. 🔌 **API Reservations:** `docs/05-api/RESERVATIONS-API.md` (7 endpoints)
2. 🧪 **Testing manual:** `GUIA-TESTING-MANUAL.md` (raíz del proyecto)
3. 🤖 **Testing automático:** `test-reservations.sh` (raíz del proyecto)

### Para deployment:
1. Guía principal: `docs/03-deployment/DEPLOYMENT-GUIDE.md`
2. Migración Neon: `docs/03-deployment/NEON-MIGRATION-PLAN.md`
3. Reporte migración: `docs/03-deployment/MIGRATION-COMPLETE.md`

### Para stakeholders:
1. 📊 Progreso actual: `docs/PROJECT-TRACKING.md`
2. Resumen ejecutivo: `docs/01-product/RESUMEN-EJECUTIVO-SISTEMA.md`
3. Roadmap: `docs/02-planning/ROADMAP-SENIOR.md`

---

## 📊 OTROS RECURSOS DEL PROYECTO

### Base de Datos
**Ubicación:** `database/`

- `schemas/` - Esquemas SQL
- `seeds/` - Datos de prueba
- `migrations/` - Scripts de migración
- `local/` - Base de datos SQLite local

### Scripts de Desarrollo
**Ubicación:** `scripts/`

- `setup.sh` - Script de configuración inicial
- `test-simple.js` - Tests básicos
- `test-supabase.js` - Tests de Supabase

### Prototipos HTML
**Ubicación:** `prototypes/`

Prototipos HTML antiguos para referencia histórica.

---

## 🔄 MANTENIMIENTO DE DOCUMENTACIÓN

### Cuando actualizar documentación:

- **Cambios en features:** Actualizar PRD y roadmaps
- **Cambios en deployment:** Actualizar guías de deployment
- **Updates de estado:** Crear nuevo reporte en `04-reports/`
- **Notas técnicas:** Agregar a `context.md`

### Convención de nombres:

- Usar MAYÚSCULAS para nombres principales
- Usar guiones `-` para separar palabras
- Incluir fecha en reportes periódicos (si aplica)
- Usar sufijos descriptivos: `-GUIDE`, `-REPORT`, `-COMPLETE`

---

**Última actualización:** 2025-11-20 (Day 2 - Reservations Backend Complete)
**Mantenido por:** Equipo Almanik PMS
