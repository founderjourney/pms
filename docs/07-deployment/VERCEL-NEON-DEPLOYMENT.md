# ALMANIK PMS - Guía de Despliegue en Vercel + Neon

**Versión:** 1.12.1
**Fecha:** 2025-11-27
**Tiempo estimado:** 15-20 minutos

---

## REQUISITOS PREVIOS

- Cuenta en [Vercel](https://vercel.com) (gratis)
- Cuenta en [Neon](https://neon.tech) (gratis - 500MB)
- Repositorio en GitHub con el código

---

## PASO 1: Crear Base de Datos en Neon

### 1.1 Crear cuenta y proyecto
1. Ve a [neon.tech](https://neon.tech) y crea una cuenta
2. Click en "Create a project"
3. Nombre del proyecto: `almanik-pms`
4. Región: Selecciona la más cercana a tus usuarios
5. Click "Create project"

### 1.2 Obtener Connection String
1. En el dashboard de Neon, ve a "Connection Details"
2. Selecciona "Node.js" como driver
3. Copia el connection string, se ve así:
```
postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```
4. **GUARDA ESTE STRING** - lo necesitarás en Vercel

### 1.3 Crear tablas
1. En Neon, ve a "SQL Editor"
2. Copia y ejecuta el contenido de: `database/schemas/neon-production-schema.sql`
   - Este archivo crea las tablas SIN datos de demostración
   - Para desarrollo/pruebas usa: `neon-complete-schema.sql` (incluye datos demo)
3. Verifica que se crearon las tablas

---

## PASO 2: Configurar Vercel

### 2.1 Importar proyecto
1. Ve a [vercel.com](https://vercel.com) y accede
2. Click "Add New" → "Project"
3. Importa desde GitHub: `almanik-pms-viajero`
4. Framework Preset: `Other`

### 2.2 Configurar Variables de Entorno
En la sección "Environment Variables", agrega:

| Variable | Valor | Notas |
|----------|-------|-------|
| `NODE_ENV` | `production` | Obligatorio |
| `DATABASE_URL` | `postgresql://...` | El string de Neon |
| `ADMIN_PASSWORD` | `TuContraseñaSegura123!` | Mínimo 12 caracteres |
| `RECEPTION_PASSWORD` | `OtraContraseña456!` | Para usuario recepción |
| `SESSION_SECRET` | `string-aleatorio-largo` | Genera uno seguro |
| `ALLOWED_ORIGINS` | `https://tu-app.vercel.app` | Tu dominio de Vercel |

### 2.3 Generar SESSION_SECRET seguro
Ejecuta en tu terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2.4 Deploy
1. Click "Deploy"
2. Espera 2-3 minutos
3. Tu app estará en: `https://tu-proyecto.vercel.app`

---

## PASO 3: Verificar el Despliegue

### 3.1 Health Check
```bash
curl https://tu-app.vercel.app/health
```
Debe responder: `{"status":"ok",...}`

### 3.2 Login de prueba
1. Abre `https://tu-app.vercel.app`
2. Login con:
   - Usuario: `admin`
   - Contraseña: La que configuraste en `ADMIN_PASSWORD`

### 3.3 Verificar base de datos
- Los datos de demo NO se crean en producción
- La base empieza vacía (solo usuario admin)

---

## PASO 4: Configurar tu Hostal

### 4.1 Crear Habitaciones y Camas
1. Ve a "Camas" en el menú
2. Las habitaciones/camas se deben crear manualmente
3. O ejecuta el SQL de configuración inicial

### 4.2 SQL para configuración inicial (opcional)
Ejecuta en Neon SQL Editor:

```sql
-- Crear habitaciones de ejemplo (PERSONALIZA ESTO)
INSERT INTO beds (name, room_name, floor, price, status) VALUES
('Cama 1', 'Habitación Azul', 1, 25000, 'available'),
('Cama 2', 'Habitación Azul', 1, 25000, 'available'),
('Cama 3', 'Habitación Verde', 1, 30000, 'available'),
('Cama 4', 'Habitación Verde', 1, 30000, 'available'),
('Cama 5', 'Suite', 2, 50000, 'available'),
('Cama 6', 'Suite', 2, 50000, 'available');

-- Crear productos de ejemplo (PERSONALIZA ESTO)
INSERT INTO products (name, category, price, stock) VALUES
('Cerveza', 'bebidas', 5000, 50),
('Agua', 'bebidas', 2000, 100),
('Snack', 'comida', 3000, 30);
```

---

## PASO 5: Dominio Personalizado (Opcional)

### 5.1 En Vercel
1. Ve a Settings → Domains
2. Agrega tu dominio: `pms.tu-hostal.com`
3. Configura DNS según las instrucciones

### 5.2 Actualizar ALLOWED_ORIGINS
Agrega tu dominio a la variable de entorno:
```
ALLOWED_ORIGINS=https://tu-app.vercel.app,https://pms.tu-hostal.com
```

---

## TROUBLESHOOTING

### Error: "Database connection failed"
- Verifica que `DATABASE_URL` esté correctamente configurado
- Asegúrate de incluir `?sslmode=require` al final

### Error: "Not authenticated"
- Verifica que `SESSION_SECRET` esté configurado
- Limpia cookies del navegador

### Error: "CORS blocked"
- Agrega tu dominio a `ALLOWED_ORIGINS`

### La app no carga
- Revisa los logs en Vercel: Deployments → Ver logs
- Verifica que `vercel.json` esté correcto

---

## COSTOS

| Servicio | Plan Gratis | Límites |
|----------|-------------|---------|
| Vercel | Hobby | 100GB bandwidth/mes |
| Neon | Free | 500MB storage, 1 proyecto |

**Para un hostal pequeño/mediano, el plan gratis es suficiente.**

---

## BACKUPS

### Neon tiene backups automáticos
- 7 días de retención en plan gratis
- Point-in-time recovery disponible

### Backup manual
En Neon → Settings → Export data

---

## SOPORTE

- Documentación Vercel: https://vercel.com/docs
- Documentación Neon: https://neon.tech/docs
- Issues del proyecto: [GitHub Issues]

---

**¡Tu Almanik PMS está listo para producción!**
